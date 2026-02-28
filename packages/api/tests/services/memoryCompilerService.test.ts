import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    epic: {
      findUnique: vi.fn(),
    },
    decision: {
      findMany: vi.fn(),
    },
    pattern: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import { compileBriefing } from '../../src/services/memoryCompilerService.js';

describe('memoryCompilerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('compileBriefing', () => {
    it('should compile a briefing from AI notes, decisions, and patterns', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'epic-1',
        name: 'Auth Epic',
        aiContext: 'Building authentication system',
        aiNotes: JSON.stringify([
          { type: 'debrief', content: 'Session 1 debrief: implemented login', sessionId: 's1' },
          { type: 'observation', content: 'Existing JWT middleware found' },
        ]),
      } as never);

      vi.mocked(prisma.decision.findMany).mockResolvedValue([
        {
          id: 'd1',
          decision: 'Use JWT for auth',
          rationale: 'Stateless, scalable',
          impact: 'high',
          madeAt: new Date(),
        },
      ] as never);

      // Epic-scoped patterns (first call), global patterns (second call)
      vi.mocked(prisma.pattern.findMany)
        .mockResolvedValueOnce([
          {
            id: 'p1',
            epicId: 'epic-1',
            name: 'Route pattern',
            category: 'architecture',
            description: 'Use Fastify plugin pattern',
            confidence: 0.9,
          },
        ] as never)
        .mockResolvedValueOnce([
          {
            id: 'p2',
            epicId: null,
            name: 'Error handling',
            category: 'architecture',
            description: 'Use AppError hierarchy',
            confidence: 0.95,
          },
        ] as never);

      const result = await compileBriefing('epic-1');

      expect(result.briefing).toContain('Briefing: Auth Epic');
      expect(result.briefing).toContain('Epic Context');
      expect(result.briefing).toContain('Key Decisions');
      expect(result.briefing).toContain('Use JWT for auth');
      expect(result.briefing).toContain('Patterns & Conventions');
      expect(result.briefing).toContain('Route pattern');
      expect(result.briefing).toContain('(global)');
      expect(result.briefing).toContain('Session Debriefs');
      expect(result.briefing).toContain('AI Notes');
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.tokenCount).toBeLessThanOrEqual(2000);
      expect(result.sources).toContain('decisions');
      expect(result.sources).toContain('patterns');
      expect(result.sources).toContain('debriefs');
    });

    it('should return empty briefing for nonexistent epic', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pattern.findMany).mockResolvedValue([]);

      const result = await compileBriefing('nonexistent');

      expect(result.briefing).toBe('');
      expect(result.tokenCount).toBe(0);
      expect(result.sources).toEqual([]);
    });

    it('should handle epic with no notes, decisions, or patterns', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'epic-2',
        name: 'Empty Epic',
        aiContext: null,
        aiNotes: null,
      } as never);

      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pattern.findMany).mockResolvedValue([]);

      const result = await compileBriefing('epic-2');

      expect(result.briefing).toContain('Briefing: Empty Epic');
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.sources).toEqual([]);
    });

    it('should stay within the 2000-token limit', async () => {
      const longContext = 'A'.repeat(10000);
      const manyNotes = Array.from({ length: 50 }, (_, i) => ({
        type: 'debrief',
        content: `Session ${i} debrief: ${'X'.repeat(200)}`,
        sessionId: `s${i}`,
      }));
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'epic-3',
        name: 'Long Epic',
        aiContext: longContext,
        aiNotes: JSON.stringify(manyNotes),
      } as never);

      const manyDecisions = Array.from({ length: 20 }, (_, i) => ({
        id: `d${i}`,
        decision: `Decision ${i}: ${'Y'.repeat(100)}`,
        rationale: `Rationale ${i}: ${'Z'.repeat(100)}`,
        impact: 'high',
        madeAt: new Date(),
      }));
      vi.mocked(prisma.decision.findMany).mockResolvedValue(manyDecisions as never);
      vi.mocked(prisma.pattern.findMany).mockResolvedValue([]);

      const result = await compileBriefing('epic-3');

      // Briefing should always stay within the 2000-token (8000 char) limit
      expect(result.briefing.length).toBeLessThanOrEqual(8000);
      expect(result.tokenCount).toBeLessThanOrEqual(2000);
    });

    it('should prioritize high-impact decisions', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'epic-4',
        name: 'Decision Epic',
        aiContext: null,
        aiNotes: null,
      } as never);

      vi.mocked(prisma.decision.findMany).mockResolvedValue([
        { id: 'd1', decision: 'Low impact decision', rationale: 'reason1', impact: 'low', madeAt: new Date() },
        { id: 'd2', decision: 'High impact decision', rationale: 'reason2', impact: 'high', madeAt: new Date() },
        { id: 'd3', decision: 'Medium impact decision', rationale: 'reason3', impact: 'medium', madeAt: new Date() },
      ] as never);

      vi.mocked(prisma.pattern.findMany).mockResolvedValue([]);

      const result = await compileBriefing('epic-4');

      expect(result.briefing).toContain('High impact decision');
      expect(result.briefing).toContain('Medium impact decision');
      // Low impact should be filtered out when high/medium exist
      expect(result.briefing).not.toContain('Low impact decision');
    });
  });
});
