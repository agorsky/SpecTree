import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    epic: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    pattern: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import { extractDebrief, storeDebrief, promotePatterns } from '../../src/services/debriefService.js';

describe('debriefService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for promotePatterns (called from storeDebrief)
    vi.mocked(prisma.pattern.findMany).mockResolvedValue([]);
  });

  // ==========================================================================
  // extractDebrief Tests
  // ==========================================================================

  describe('extractDebrief', () => {
    it('should extract decisions, blockers, and next steps from session data', () => {
      const sessionData = {
        id: 'session-1',
        epicId: 'epic-1',
        summary: 'Implemented login flow',
        nextSteps: JSON.stringify(['Add logout', 'Add password reset']),
        blockers: JSON.stringify(['API rate limiting']),
        decisions: JSON.stringify([
          { decision: 'Use JWT', rationale: 'Stateless auth' },
          { decision: 'Skip OAuth for now' },
        ]),
        itemsWorkedOn: JSON.stringify([
          { type: 'task', identifier: 'COM-1-1', action: 'completed' },
          { type: 'task', identifier: 'COM-1-2', action: 'started' },
        ]),
      };

      const debrief = extractDebrief(sessionData);

      expect(debrief.summary).toBe('Implemented login flow');
      expect(debrief.decisions).toEqual([
        'Use JWT: Stateless auth',
        'Skip OAuth for now',
      ]);
      expect(debrief.blockers).toEqual(['API rate limiting']);
      expect(debrief.nextSteps).toEqual(['Add logout', 'Add password reset']);
      expect(debrief.itemsCompleted).toEqual(['COM-1-1']);
    });

    it('should handle null session data fields', () => {
      const sessionData = {
        id: 'session-2',
        epicId: 'epic-1',
        summary: null,
        nextSteps: null,
        blockers: null,
        decisions: null,
        itemsWorkedOn: null,
      };

      const debrief = extractDebrief(sessionData);

      expect(debrief.summary).toBe('Session completed without summary.');
      expect(debrief.decisions).toEqual([]);
      expect(debrief.blockers).toEqual([]);
      expect(debrief.nextSteps).toEqual([]);
      expect(debrief.itemsCompleted).toEqual([]);
      expect(debrief.patterns).toEqual([]);
    });

    it('should extract patterns from decisions containing pattern keywords', () => {
      const sessionData = {
        id: 'session-3',
        epicId: 'epic-1',
        summary: 'Used a reusable approach for data fetching',
        nextSteps: null,
        blockers: null,
        decisions: JSON.stringify([
          { decision: 'Follow the pattern from existing routes' },
          { decision: 'Use camelCase convention for all variables' },
          { decision: 'Simple fix' },
        ]),
        itemsWorkedOn: null,
      };

      const debrief = extractDebrief(sessionData);

      expect(debrief.patterns.length).toBeGreaterThan(0);
      expect(debrief.patterns).toContain('Follow the pattern from existing routes');
      expect(debrief.patterns).toContain('Use camelCase convention for all variables');
    });

    it('should handle malformed JSON gracefully', () => {
      const sessionData = {
        id: 'session-4',
        epicId: 'epic-1',
        summary: 'Test',
        nextSteps: 'invalid json',
        blockers: '{not an array}',
        decisions: '[]',
        itemsWorkedOn: '',
      };

      const debrief = extractDebrief(sessionData);

      expect(debrief.nextSteps).toEqual([]);
      expect(debrief.blockers).toEqual([]);
      expect(debrief.decisions).toEqual([]);
    });
  });

  // ==========================================================================
  // storeDebrief Tests
  // ==========================================================================

  describe('storeDebrief', () => {
    it('should append debrief as AI note on the epic', async () => {
      const mockEpic = {
        aiNotes: JSON.stringify([{ type: 'context', content: 'existing note' }]),
      };

      vi.mocked(prisma.epic.findUnique).mockResolvedValue(mockEpic as never);
      vi.mocked(prisma.epic.update).mockResolvedValue({} as never);

      const debrief = {
        summary: 'Built the auth system',
        decisions: ['Used JWT'],
        blockers: [],
        patterns: ['Follow route pattern'],
        nextSteps: ['Add tests'],
        itemsCompleted: ['COM-1-1'],
      };

      await storeDebrief('epic-1', 'session-1', debrief);

      expect(prisma.epic.findUnique).toHaveBeenCalledWith({
        where: { id: 'epic-1' },
        select: { aiNotes: true },
      });

      expect(prisma.epic.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'epic-1' },
          data: expect.objectContaining({
            lastAiSessionId: 'session-1',
          }),
        })
      );

      // Verify the notes array was extended
      const updateCall = vi.mocked(prisma.epic.update).mock.calls[0]![0] as { data: { aiNotes: string } };
      const updatedNotes = JSON.parse(updateCall.data.aiNotes);
      expect(updatedNotes).toHaveLength(2);
      expect(updatedNotes[1].type).toBe('debrief');
      expect(updatedNotes[1].sessionId).toBe('session-1');
    });

    it('should handle epic with no existing notes', async () => {
      const mockEpic = { aiNotes: null };

      vi.mocked(prisma.epic.findUnique).mockResolvedValue(mockEpic as never);
      vi.mocked(prisma.epic.update).mockResolvedValue({} as never);

      const debrief = {
        summary: 'First session',
        decisions: [],
        blockers: [],
        patterns: [],
        nextSteps: [],
        itemsCompleted: [],
      };

      await storeDebrief('epic-1', 'session-1', debrief);

      const updateCall = vi.mocked(prisma.epic.update).mock.calls[0]![0] as { data: { aiNotes: string } };
      const updatedNotes = JSON.parse(updateCall.data.aiNotes);
      expect(updatedNotes).toHaveLength(1);
      expect(updatedNotes[0].type).toBe('debrief');
    });

    it('should silently skip if epic not found', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue(null);

      const debrief = {
        summary: 'Test',
        decisions: [],
        blockers: [],
        patterns: [],
        nextSteps: [],
        itemsCompleted: [],
      };

      await storeDebrief('nonexistent', 'session-1', debrief);

      expect(prisma.epic.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // promotePatterns Tests (ENG-68)
  // ==========================================================================

  describe('promotePatterns', () => {
    it('should promote a pattern to global when it appears across 3+ epics', async () => {
      vi.mocked(prisma.pattern.findMany).mockResolvedValue([
        { id: 'p1', name: 'Route pattern', epicId: 'epic-1', confidence: 0.8, description: 'Use Fastify plugin', category: 'architecture' },
        { id: 'p2', name: 'Route pattern', epicId: 'epic-2', confidence: 0.7, description: 'Use Fastify plugin', category: 'architecture' },
        { id: 'p3', name: 'Route pattern', epicId: 'epic-3', confidence: 0.9, description: 'Use Fastify plugin v2', category: 'architecture' },
      ] as never);

      vi.mocked(prisma.pattern.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.pattern.create).mockResolvedValue({} as never);

      const promoted = await promotePatterns();

      expect(promoted).toBe(1);
      expect(prisma.pattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          epicId: null,
          name: 'Route pattern',
          source: 'promoted',
          confidence: 1.0, // 0.9 + 0.1 = 1.0 (capped)
        }),
      });
    });

    it('should not promote patterns with fewer than 3 distinct epics', async () => {
      vi.mocked(prisma.pattern.findMany).mockResolvedValue([
        { id: 'p1', name: 'Test pattern', epicId: 'epic-1', confidence: 0.5, description: 'desc', category: 'testing' },
        { id: 'p2', name: 'Test pattern', epicId: 'epic-2', confidence: 0.6, description: 'desc', category: 'testing' },
      ] as never);

      const promoted = await promotePatterns();

      expect(promoted).toBe(0);
      expect(prisma.pattern.create).not.toHaveBeenCalled();
    });

    it('should not promote if a global pattern already exists', async () => {
      vi.mocked(prisma.pattern.findMany).mockResolvedValue([
        { id: 'p1', name: 'Existing global', epicId: 'epic-1', confidence: 0.8, description: 'desc', category: 'workflow' },
        { id: 'p2', name: 'Existing global', epicId: 'epic-2', confidence: 0.7, description: 'desc', category: 'workflow' },
        { id: 'p3', name: 'Existing global', epicId: 'epic-3', confidence: 0.9, description: 'desc', category: 'workflow' },
      ] as never);

      vi.mocked(prisma.pattern.findFirst).mockResolvedValue({ id: 'global-1' } as never);

      const promoted = await promotePatterns();

      expect(promoted).toBe(0);
      expect(prisma.pattern.create).not.toHaveBeenCalled();
    });

    it('should handle empty pattern list', async () => {
      vi.mocked(prisma.pattern.findMany).mockResolvedValue([]);

      const promoted = await promotePatterns();

      expect(promoted).toBe(0);
    });
  });
});
