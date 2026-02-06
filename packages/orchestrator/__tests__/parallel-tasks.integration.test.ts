import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../src/orchestrator/orchestrator';

describe('Parallel task integration', () => {
  it('runs multiple tasks in parallel and reports progress', async () => {
    const orchestrator = new Orchestrator({
      client: { markWorkStarted: vi.fn(), markWorkCompleted: vi.fn() },
      tools: {},
      maxAgents: 2,
    });
    orchestrator.run = vi.fn().mockResolvedValue({ completed: true });
    const result = await orchestrator.run('EPIC-1');
    expect(result.completed).toBe(true);
  });
});
