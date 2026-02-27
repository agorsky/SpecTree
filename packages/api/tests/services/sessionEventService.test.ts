import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    sessionEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  persistSessionEvent,
  getSessionEvents,
  type GetSessionEventsOptions,
} from '../../src/services/sessionEventService.js';
import { SessionEventType } from '@dispatcher/shared';
import type { SessionEvent } from '@dispatcher/shared';

describe('sessionEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // persistSessionEvent Tests
  // ==========================================================================

  describe('persistSessionEvent', () => {
    it('should persist a session event to the database', async () => {
      const mockEvent: SessionEvent = {
        epicId: 'epic-123',
        sessionId: 'session-456',
        timestamp: '2026-02-13T12:00:00.000Z',
        eventType: SessionEventType.SESSION_STARTED,
        payload: {
          status: 'active',
          totalFeatures: 5,
          totalTasks: 15,
        },
      };

      vi.mocked(prisma.sessionEvent.create).mockResolvedValue({
        id: 'event-789',
        epicId: 'epic-123',
        sessionId: 'session-456',
        eventType: SessionEventType.SESSION_STARTED,
        payload: JSON.stringify(mockEvent),
        timestamp: new Date('2026-02-13T12:00:00.000Z'),
      } as any);

      await persistSessionEvent(mockEvent);

      expect(prisma.sessionEvent.create).toHaveBeenCalledWith({
        data: {
          epicId: 'epic-123',
          sessionId: 'session-456',
          eventType: SessionEventType.SESSION_STARTED,
          payload: JSON.stringify(mockEvent),
          timestamp: new Date('2026-02-13T12:00:00.000Z'),
        },
      });
    });

    it('should not throw on database failure', async () => {
      const mockEvent: SessionEvent = {
        epicId: 'epic-123',
        sessionId: 'session-456',
        timestamp: '2026-02-13T12:00:00.000Z',
        eventType: SessionEventType.SESSION_ERROR,
        payload: {
          errorCode: 'TEST_ERROR',
          errorMessage: 'Test error message',
        },
      };

      // Mock console.error to verify logging
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(prisma.sessionEvent.create).mockRejectedValue(new Error('Database connection failed'));

      // Should not throw
      await expect(persistSessionEvent(mockEvent)).resolves.toBeUndefined();

      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist event'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should serialize complex event payloads correctly', async () => {
      const mockEvent: SessionEvent = {
        epicId: 'epic-123',
        sessionId: 'session-456',
        timestamp: '2026-02-13T12:00:00.000Z',
        eventType: SessionEventType.SESSION_ENDED,
        payload: {
          status: 'completed',
          summary: 'Completed all tasks',
          nextSteps: ['Deploy to production', 'Monitor metrics'],
          decisions: [
            { decision: 'Use Redis', rationale: 'Better performance' },
          ],
        },
      };

      vi.mocked(prisma.sessionEvent.create).mockResolvedValue({
        id: 'event-789',
        epicId: 'epic-123',
        sessionId: 'session-456',
        eventType: SessionEventType.SESSION_ENDED,
        payload: JSON.stringify(mockEvent),
        timestamp: new Date('2026-02-13T12:00:00.000Z'),
      } as any);

      await persistSessionEvent(mockEvent);

      expect(prisma.sessionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: JSON.stringify(mockEvent),
        }),
      });
    });
  });

  // ==========================================================================
  // getSessionEvents Tests
  // ==========================================================================

  describe('getSessionEvents', () => {
    it('should return events in chronological order', async () => {
      const mockDbEvents = [
        {
          id: 'event-1',
          epicId: 'epic-123',
          sessionId: 'session-456',
          eventType: SessionEventType.SESSION_STARTED,
          payload: JSON.stringify({
            epicId: 'epic-123',
            sessionId: 'session-456',
            timestamp: '2026-02-13T12:00:00.000Z',
            eventType: SessionEventType.SESSION_STARTED,
            payload: { status: 'active' },
          }),
          timestamp: new Date('2026-02-13T12:00:00.000Z'),
        },
        {
          id: 'event-2',
          epicId: 'epic-123',
          sessionId: 'session-456',
          eventType: SessionEventType.SESSION_ENDED,
          payload: JSON.stringify({
            epicId: 'epic-123',
            sessionId: 'session-456',
            timestamp: '2026-02-13T13:00:00.000Z',
            eventType: SessionEventType.SESSION_ENDED,
            payload: { status: 'completed' },
          }),
          timestamp: new Date('2026-02-13T13:00:00.000Z'),
        },
      ];

      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue(mockDbEvents as any);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(2);

      const result = await getSessionEvents('epic-123');

      expect(result.events).toHaveLength(2);
      expect(result.events[0]?.eventType).toBe(SessionEventType.SESSION_STARTED);
      expect(result.events[1]?.eventType).toBe(SessionEventType.SESSION_ENDED);
      expect(result.totalCount).toBe(2);
      expect(result.nextCursor).toBeNull();
    });

    it('should filter by since timestamp', async () => {
      const sinceDate = '2026-02-13T12:30:00.000Z';

      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(0);

      await getSessionEvents('epic-123', { since: sinceDate });

      expect(prisma.sessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: new Date(sinceDate),
            },
          }),
        })
      );
    });

    it('should filter by sessionId', async () => {
      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(0);

      await getSessionEvents('epic-123', { sessionId: 'session-456' });

      expect(prisma.sessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionId: 'session-456',
          }),
        })
      );
    });

    it('should filter by eventTypes', async () => {
      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(0);

      await getSessionEvents('epic-123', {
        eventTypes: [SessionEventType.SESSION_STARTED, SessionEventType.SESSION_ENDED],
      });

      expect(prisma.sessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: {
              in: [SessionEventType.SESSION_STARTED, SessionEventType.SESSION_ENDED],
            },
          }),
        })
      );
    });

    it('should respect limit parameter', async () => {
      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(0);

      await getSessionEvents('epic-123', { limit: 25 });

      expect(prisma.sessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 26, // limit + 1 to check for more results
        })
      );
    });

    it('should clamp limit to maximum of 200', async () => {
      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(0);

      await getSessionEvents('epic-123', { limit: 500 });

      expect(prisma.sessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 201, // max limit (200) + 1
        })
      );
    });

    it('should support cursor-based pagination', async () => {
      const mockDbEvents = Array.from({ length: 51 }, (_, i) => ({
        id: `event-${i}`,
        epicId: 'epic-123',
        sessionId: 'session-456',
        eventType: SessionEventType.SESSION_TASK_STARTED,
        payload: JSON.stringify({
          epicId: 'epic-123',
          sessionId: 'session-456',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          eventType: SessionEventType.SESSION_TASK_STARTED,
          payload: { taskId: `task-${i}` },
        }),
        timestamp: new Date(Date.now() + i * 1000),
      }));

      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue(mockDbEvents as any);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(100);

      const result = await getSessionEvents('epic-123', { limit: 50 });

      // Should return 50 events (not 51)
      expect(result.events).toHaveLength(50);
      
      // Should have nextCursor because there are more results
      expect(result.nextCursor).not.toBeNull();
      
      // Verify cursor format (base64 encoded timestamp:id)
      if (result.nextCursor) {
        const decoded = Buffer.from(result.nextCursor, 'base64').toString('utf-8');
        expect(decoded).toContain(':');
        expect(decoded).toContain('event-49');
      }
    });

    it('should handle invalid cursor gracefully', async () => {
      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(0);

      // Use a cursor that decodes successfully but has wrong format (missing colon)
      const invalidCursor = Buffer.from('invalid-format-no-colon', 'utf-8').toString('base64');

      await getSessionEvents('epic-123', { cursor: invalidCursor });

      // Should still execute query (without cursor - cursorCondition will be undefined)
      expect(prisma.sessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: undefined,
          skip: 0, // Should skip 0 since cursor is invalid
        })
      );
    });

    it('should handle malformed event payload gracefully', async () => {
      const mockDbEvents = [
        {
          id: 'event-1',
          epicId: 'epic-123',
          sessionId: 'session-456',
          eventType: SessionEventType.SESSION_STARTED,
          payload: 'invalid-json{{{', // Malformed JSON
          timestamp: new Date('2026-02-13T12:00:00.000Z'),
        },
      ];

      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue(mockDbEvents as any);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(1);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getSessionEvents('epic-123');

      // Should return a minimal event object
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        epicId: 'epic-123',
        sessionId: 'session-456',
        eventType: SessionEventType.SESSION_STARTED,
      });

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse event payload'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should combine multiple filters correctly', async () => {
      vi.mocked(prisma.sessionEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.sessionEvent.count).mockResolvedValue(0);

      await getSessionEvents('epic-123', {
        since: '2026-02-13T12:00:00.000Z',
        sessionId: 'session-456',
        eventTypes: [SessionEventType.SESSION_TASK_COMPLETED],
        limit: 20,
      });

      expect(prisma.sessionEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            epicId: 'epic-123',
            timestamp: {
              gte: new Date('2026-02-13T12:00:00.000Z'),
            },
            sessionId: 'session-456',
            eventType: {
              in: [SessionEventType.SESSION_TASK_COMPLETED],
            },
          },
          take: 21,
        })
      );
    });
  });
});
