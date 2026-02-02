import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    aiSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    epic: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  startSession,
  endSession,
  getActiveSession,
  getLastSession,
  getSessionHistory,
  getSession,
  logSessionWork,
  findEpicIdForItem,
  abandonSession,
} from '../../src/services/sessionService.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';

describe('sessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // startSession Tests
  // ==========================================================================

  describe('startSession', () => {
    it('should create a new session and return previous handoff', async () => {
      const mockEpic = {
        id: 'epic-123',
        name: 'Test Epic',
        features: [
          {
            status: { category: 'completed' },
            tasks: [
              { status: { category: 'completed' } },
              { status: { category: 'started' } },
            ],
          },
          {
            status: { category: 'started' },
            tasks: [],
          },
        ],
      };

      const mockPreviousSession = {
        id: 'session-prev',
        epicId: 'epic-123',
        externalId: null,
        startedAt: new Date('2026-01-01'),
        endedAt: new Date('2026-01-02'),
        status: 'completed',
        itemsWorkedOn: '[{"type":"feature","id":"f1","identifier":"COM-1","action":"started","timestamp":"2026-01-01T00:00:00Z"}]',
        summary: 'Previous session summary',
        nextSteps: '["Do this next"]',
        blockers: null,
        decisions: null,
        contextBlob: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };

      const mockNewSession = {
        id: 'session-new',
        epicId: 'epic-123',
        externalId: 'ext-123',
        startedAt: new Date(),
        endedAt: null,
        status: 'active',
        itemsWorkedOn: null,
        summary: null,
        nextSteps: null,
        blockers: null,
        decisions: null,
        contextBlob: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(mockPreviousSession as any);
      vi.mocked(prisma.aiSession.create).mockResolvedValue(mockNewSession as any);

      const result = await startSession({ epicId: 'epic-123', externalId: 'ext-123' });

      expect(result.session.id).toBe('session-new');
      expect(result.session.status).toBe('active');
      expect(result.previousSession).not.toBeNull();
      expect(result.previousSession?.summary).toBe('Previous session summary');
      expect(result.epicProgress.totalFeatures).toBe(2);
      expect(result.epicProgress.completedFeatures).toBe(1);
      expect(result.epicProgress.inProgressFeatures).toBe(1);
      expect(result.epicProgress.totalTasks).toBe(2);
      expect(result.epicProgress.completedTasks).toBe(1);
    });

    it('should throw NotFoundError for non-existent epic', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);

      await expect(startSession({ epicId: 'non-existent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should abandon existing active sessions', async () => {
      const mockEpic = {
        id: 'epic-123',
        name: 'Test Epic',
        features: [],
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.aiSession.create).mockResolvedValue({
        id: 'session-new',
        epicId: 'epic-123',
        externalId: null,
        startedAt: new Date(),
        endedAt: null,
        status: 'active',
        itemsWorkedOn: null,
        summary: null,
        nextSteps: null,
        blockers: null,
        decisions: null,
        contextBlob: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await startSession({ epicId: 'epic-123' });

      expect(prisma.aiSession.updateMany).toHaveBeenCalledWith({
        where: {
          epicId: 'epic-123',
          status: 'active',
        },
        data: {
          status: 'abandoned',
          endedAt: expect.any(Date),
        },
      });
    });
  });

  // ==========================================================================
  // endSession Tests
  // ==========================================================================

  describe('endSession', () => {
    it('should end an active session with handoff data', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };
      const mockActiveSession = {
        id: 'session-123',
        epicId: 'epic-123',
        status: 'active',
        startedAt: new Date(),
      };
      const mockUpdatedSession = {
        id: 'session-123',
        epicId: 'epic-123',
        externalId: null,
        startedAt: new Date(),
        endedAt: new Date(),
        status: 'completed',
        itemsWorkedOn: null,
        summary: 'Session completed',
        nextSteps: '["Next step 1"]',
        blockers: '["Blocker 1"]',
        decisions: '[{"decision":"Use X","rationale":"Because Y"}]',
        contextBlob: '{"key":"value"}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(mockActiveSession as any);
      vi.mocked(prisma.aiSession.update).mockResolvedValue(mockUpdatedSession as any);

      const result = await endSession('epic-123', {
        summary: 'Session completed',
        nextSteps: ['Next step 1'],
        blockers: ['Blocker 1'],
        decisions: [{ decision: 'Use X', rationale: 'Because Y' }],
        contextBlob: '{"key":"value"}',
      });

      expect(result.status).toBe('completed');
      expect(result.summary).toBe('Session completed');
      expect(result.nextSteps).toEqual(['Next step 1']);
      expect(result.blockers).toEqual(['Blocker 1']);
      expect(result.decisions).toEqual([{ decision: 'Use X', rationale: 'Because Y' }]);
    });

    it('should throw ValidationError when no active session exists', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(null);

      await expect(endSession('epic-123', { summary: 'Done' }))
        .rejects.toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // getActiveSession Tests
  // ==========================================================================

  describe('getActiveSession', () => {
    it('should return active session if exists', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };
      const mockSession = {
        id: 'session-123',
        epicId: 'epic-123',
        externalId: null,
        startedAt: new Date(),
        endedAt: null,
        status: 'active',
        itemsWorkedOn: null,
        summary: null,
        nextSteps: null,
        blockers: null,
        decisions: null,
        contextBlob: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(mockSession as any);

      const result = await getActiveSession('epic-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('session-123');
      expect(result?.status).toBe('active');
    });

    it('should return null when no active session', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(null);

      const result = await getActiveSession('epic-123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getLastSession Tests
  // ==========================================================================

  describe('getLastSession', () => {
    it('should return the last completed session', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };
      const mockSession = {
        id: 'session-123',
        epicId: 'epic-123',
        externalId: null,
        startedAt: new Date(),
        endedAt: new Date(),
        status: 'completed',
        itemsWorkedOn: null,
        summary: 'Last session summary',
        nextSteps: null,
        blockers: null,
        decisions: null,
        contextBlob: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(mockSession as any);

      const result = await getLastSession('epic-123');

      expect(result).not.toBeNull();
      expect(result?.summary).toBe('Last session summary');
    });
  });

  // ==========================================================================
  // getSessionHistory Tests
  // ==========================================================================

  describe('getSessionHistory', () => {
    it('should return session history with pagination', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };
      const mockSessions = [
        {
          id: 'session-2',
          epicId: 'epic-123',
          externalId: null,
          startedAt: new Date('2026-01-02'),
          endedAt: new Date('2026-01-02'),
          status: 'completed',
          itemsWorkedOn: null,
          summary: 'Session 2',
          nextSteps: null,
          blockers: null,
          decisions: null,
          contextBlob: null,
          createdAt: new Date('2026-01-02'),
          updatedAt: new Date('2026-01-02'),
        },
        {
          id: 'session-1',
          epicId: 'epic-123',
          externalId: null,
          startedAt: new Date('2026-01-01'),
          endedAt: new Date('2026-01-01'),
          status: 'completed',
          itemsWorkedOn: null,
          summary: 'Session 1',
          nextSteps: null,
          blockers: null,
          decisions: null,
          contextBlob: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ];

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue(mockSessions as any);
      vi.mocked(prisma.aiSession.count).mockResolvedValue(2);

      const result = await getSessionHistory('epic-123', 10);

      expect(result.total).toBe(2);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].summary).toBe('Session 2');
    });
  });

  // ==========================================================================
  // logSessionWork Tests
  // ==========================================================================

  describe('logSessionWork', () => {
    it('should log work to active session', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };
      const mockActiveSession = {
        id: 'session-123',
        epicId: 'epic-123',
        status: 'active',
        itemsWorkedOn: null,
      };
      const mockUpdatedSession = {
        id: 'session-123',
        epicId: 'epic-123',
        externalId: null,
        startedAt: new Date(),
        endedAt: null,
        status: 'active',
        itemsWorkedOn: '[{"type":"feature","id":"f1","identifier":"COM-1","action":"updated","timestamp":"2026-01-01T00:00:00.000Z"}]',
        summary: null,
        nextSteps: null,
        blockers: null,
        decisions: null,
        contextBlob: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(mockActiveSession as any);
      vi.mocked(prisma.aiSession.update).mockResolvedValue(mockUpdatedSession as any);

      const result = await logSessionWork('epic-123', {
        itemId: 'f1',
        itemType: 'feature',
        identifier: 'COM-1',
        action: 'updated',
      });

      expect(result).not.toBeNull();
      expect(result?.itemsWorkedOn).toHaveLength(1);
    });

    it('should return null when no active session', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(null);

      const result = await logSessionWork('epic-123', {
        itemId: 'f1',
        itemType: 'feature',
        identifier: 'COM-1',
        action: 'updated',
      });

      expect(result).toBeNull();
    });

    it('should append to existing work items', async () => {
      const mockEpic = { id: 'epic-123', name: 'Test Epic' };
      const existingItems = [
        { type: 'feature', id: 'f1', identifier: 'COM-1', action: 'started', timestamp: '2026-01-01T00:00:00Z' },
      ];
      const mockActiveSession = {
        id: 'session-123',
        epicId: 'epic-123',
        status: 'active',
        itemsWorkedOn: JSON.stringify(existingItems),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.aiSession.findFirst).mockResolvedValue(mockActiveSession as any);
      vi.mocked(prisma.aiSession.update).mockImplementation(async (args) => {
        const items = JSON.parse(args.data.itemsWorkedOn as string);
        return {
          ...mockActiveSession,
          itemsWorkedOn: JSON.stringify(items),
          externalId: null,
          startedAt: new Date(),
          endedAt: null,
          summary: null,
          nextSteps: null,
          blockers: null,
          decisions: null,
          contextBlob: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      });

      const result = await logSessionWork('epic-123', {
        itemId: 'f2',
        itemType: 'feature',
        identifier: 'COM-2',
        action: 'completed',
      });

      expect(result?.itemsWorkedOn).toHaveLength(2);
    });
  });

  // ==========================================================================
  // abandonSession Tests
  // ==========================================================================

  describe('abandonSession', () => {
    it('should abandon an active session', async () => {
      const mockSession = {
        id: 'session-123',
        epicId: 'epic-123',
        status: 'active',
      };
      const mockUpdatedSession = {
        id: 'session-123',
        epicId: 'epic-123',
        externalId: null,
        startedAt: new Date(),
        endedAt: new Date(),
        status: 'abandoned',
        itemsWorkedOn: null,
        summary: null,
        nextSteps: null,
        blockers: null,
        decisions: null,
        contextBlob: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.aiSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.aiSession.update).mockResolvedValue(mockUpdatedSession as any);

      const result = await abandonSession('session-123');

      expect(result.status).toBe('abandoned');
      expect(result.endedAt).not.toBeNull();
    });

    it('should throw ValidationError for non-active session', async () => {
      const mockSession = {
        id: 'session-123',
        epicId: 'epic-123',
        status: 'completed',
      };

      vi.mocked(prisma.aiSession.findUnique).mockResolvedValue(mockSession as any);

      await expect(abandonSession('session-123'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent session', async () => {
      vi.mocked(prisma.aiSession.findUnique).mockResolvedValue(null);

      await expect(abandonSession('non-existent'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
