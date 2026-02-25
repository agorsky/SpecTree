import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module with all models needed for transfer operations
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    epic: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
    },
    personalScope: {
      findUnique: vi.fn(),
    },
    status: {
      findMany: vi.fn(),
    },
    feature: {
      update: vi.fn(),
    },
    task: {
      update: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock unused modules imported by epicService
vi.mock('../../src/utils/ordering.js', () => ({
  generateSortOrderBetween: vi.fn().mockReturnValue(1.0),
}));
vi.mock('../../src/utils/scopeContext.js', () => ({
  getAccessibleScopes: vi.fn(),
  hasAccessibleScopes: vi.fn(),
}));
vi.mock('../../src/services/changelogService.js', () => ({
  recordChange: vi.fn().mockResolvedValue(undefined),
  diffAndRecord: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/events/index.js', () => ({
  emitEntityCreated: vi.fn(),
  emitEntityUpdated: vi.fn(),
  emitEntityDeleted: vi.fn(),
}));
vi.mock('../../src/schemas/compositeEpic.js', () => ({
  createEpicCompleteInputSchema: { safeParse: vi.fn() },
}));
vi.mock('../../src/schemas/structuredDescription.js', () => ({
  structuredDescriptionSchema: { safeParse: vi.fn() },
}));
vi.mock('../../src/services/structuredDescriptionService.js', () => ({
  structuredDescToMarkdown: vi.fn().mockReturnValue(''),
}));
vi.mock('../../src/services/personalScopeService.js', () => ({
  createPersonalScope: vi.fn().mockResolvedValue({ id: 'new-scope-1', userId: 'user-1' }),
}));

import { prisma } from '../../src/lib/db.js';
import { transferEpicScope } from '../../src/services/epicService.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../src/errors/index.js';

describe('transferEpicScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: $transaction executes the callback with a transaction proxy
    // that delegates to prisma methods
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        epic: prisma.epic,
        feature: prisma.feature,
        task: prisma.task,
      });
    });
  });

  const makeEpic = (overrides: Record<string, any> = {}) => ({
    id: 'epic-1',
    name: 'Test Epic',
    description: null,
    icon: null,
    color: null,
    sortOrder: 1.0,
    isArchived: false,
    scopeType: 'personal',
    teamId: null,
    personalScopeId: 'scope-1',
    createdBy: 'user-1',
    implementedBy: null,
    implementedDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    structuredDesc: null,
    aiContext: null,
    aiNotes: null,
    lastAiSessionId: null,
    lastAiUpdateAt: null,
    features: [],
    ...overrides,
  });

  // ==================== personal-to-team ====================

  it('should transfer personal→team: sets teamId, clears personalScopeId, scopeType=team', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'user-1' } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'membership-1' } as any);
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1', isArchived: false } as any);
    vi.mocked(prisma.status.findMany).mockResolvedValue([]);

    const updatedEpic = makeEpic({ teamId: 'team-1', personalScopeId: null, scopeType: 'team' });
    vi.mocked(prisma.epic.update).mockResolvedValue(updatedEpic as any);

    const result = await transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1');

    expect(result.teamId).toBe('team-1');
    expect(result.personalScopeId).toBeNull();
    expect(result.scopeType).toBe('team');
  });

  it('should transfer personal→team with child entities and remap statuses', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [
        {
          id: 'feature-1',
          statusId: 'personal-status-in-progress',
          tasks: [
            { id: 'task-1', statusId: 'personal-status-done' },
            { id: 'task-2', statusId: 'personal-status-in-progress' },
          ],
        },
        {
          id: 'feature-2',
          statusId: null,
          tasks: [],
        },
      ],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'user-1' } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'membership-1' } as any);
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1', isArchived: false } as any);

    // Source personal statuses
    vi.mocked(prisma.status.findMany)
      .mockResolvedValueOnce([
        { id: 'personal-status-in-progress', name: 'In Progress' },
        { id: 'personal-status-done', name: 'Done' },
        { id: 'personal-status-backlog', name: 'Backlog' },
      ] as any)
      // Target team statuses
      .mockResolvedValueOnce([
        { id: 'team-status-backlog', name: 'Backlog', category: 'backlog' },
        { id: 'team-status-in-progress', name: 'In Progress', category: 'started' },
        { id: 'team-status-done', name: 'Done', category: 'completed' },
      ] as any);

    const updatedEpic = makeEpic({ teamId: 'team-1', personalScopeId: null, scopeType: 'team' });
    vi.mocked(prisma.epic.update).mockResolvedValue(updatedEpic as any);
    vi.mocked(prisma.feature.update).mockResolvedValue({} as any);
    vi.mocked(prisma.task.update).mockResolvedValue({} as any);

    await transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1');

    // Verify feature status remapped
    expect(prisma.feature.update).toHaveBeenCalledWith({
      where: { id: 'feature-1' },
      data: { statusId: 'team-status-in-progress' },
    });

    // Verify task statuses remapped
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { statusId: 'team-status-done' },
    });
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-2' },
      data: { statusId: 'team-status-in-progress' },
    });
  });

  it('should fall back to backlog status when no matching status name exists', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [
        {
          id: 'feature-1',
          statusId: 'personal-status-custom',
          tasks: [],
        },
      ],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'user-1' } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'membership-1' } as any);
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1', isArchived: false } as any);

    // Source: has a custom status with no matching name in team
    vi.mocked(prisma.status.findMany)
      .mockResolvedValueOnce([
        { id: 'personal-status-custom', name: 'My Custom Status' },
      ] as any)
      .mockResolvedValueOnce([
        { id: 'team-status-backlog', name: 'Backlog', category: 'backlog' },
        { id: 'team-status-done', name: 'Done', category: 'completed' },
      ] as any);

    const updatedEpic = makeEpic({ teamId: 'team-1', personalScopeId: null, scopeType: 'team' });
    vi.mocked(prisma.epic.update).mockResolvedValue(updatedEpic as any);
    vi.mocked(prisma.feature.update).mockResolvedValue({} as any);

    await transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1');

    // Should fall back to backlog status
    expect(prisma.feature.update).toHaveBeenCalledWith({
      where: { id: 'feature-1' },
      data: { statusId: 'team-status-backlog' },
    });
  });

  // ==================== team-to-personal ====================

  it('should transfer team→personal: sets personalScopeId, clears teamId, scopeType=personal', async () => {
    const teamEpic = makeEpic({
      scopeType: 'team',
      teamId: 'team-1',
      personalScopeId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(teamEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1' } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'membership-1' } as any);
    vi.mocked(prisma.status.findMany).mockResolvedValue([]);

    const updatedEpic = makeEpic({ teamId: null, personalScopeId: 'scope-1', scopeType: 'personal' });
    vi.mocked(prisma.epic.update).mockResolvedValue(updatedEpic as any);

    const result = await transferEpicScope('epic-1', 'user-1', 'team-to-personal');

    expect(result.personalScopeId).toBe('scope-1');
    expect(result.teamId).toBeNull();
    expect(result.scopeType).toBe('personal');
  });

  it('should transfer team→personal with child entities and remap statuses', async () => {
    const teamEpic = makeEpic({
      scopeType: 'team',
      teamId: 'team-1',
      personalScopeId: null,
      features: [
        {
          id: 'feature-1',
          statusId: 'team-status-in-progress',
          tasks: [
            { id: 'task-1', statusId: 'team-status-done' },
          ],
        },
      ],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(teamEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1' } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'membership-1' } as any);

    // Source: team statuses
    vi.mocked(prisma.status.findMany)
      .mockResolvedValueOnce([
        { id: 'team-status-in-progress', name: 'In Progress' },
        { id: 'team-status-done', name: 'Done' },
      ] as any)
      // Target: personal statuses
      .mockResolvedValueOnce([
        { id: 'personal-status-backlog', name: 'Backlog', category: 'backlog' },
        { id: 'personal-status-in-progress', name: 'In Progress', category: 'started' },
        { id: 'personal-status-done', name: 'Done', category: 'completed' },
      ] as any);

    const updatedEpic = makeEpic({ teamId: null, personalScopeId: 'scope-1', scopeType: 'personal' });
    vi.mocked(prisma.epic.update).mockResolvedValue(updatedEpic as any);
    vi.mocked(prisma.feature.update).mockResolvedValue({} as any);
    vi.mocked(prisma.task.update).mockResolvedValue({} as any);

    await transferEpicScope('epic-1', 'user-1', 'team-to-personal');

    expect(prisma.feature.update).toHaveBeenCalledWith({
      where: { id: 'feature-1' },
      data: { statusId: 'personal-status-in-progress' },
    });
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { statusId: 'personal-status-done' },
    });
  });

  // ==================== Authorization failures ====================

  it('should throw ForbiddenError when non-owner tries to transfer personal epic', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);
    // Return a personal scope owned by a different user
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'other-user' } as any);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1')
    ).rejects.toThrow('Only the personal scope owner can transfer this epic');
  });

  it('should throw ForbiddenError when non-team-member tries to transfer to team', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'user-1' } as any);
    // No membership found
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1')
    ).rejects.toThrow('You must be a member of the target team');
  });

  it('should throw ForbiddenError when non-team-member tries to transfer from team', async () => {
    const teamEpic = makeEpic({
      scopeType: 'team',
      teamId: 'team-1',
      personalScopeId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(teamEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1' } as any);
    // No membership found
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'team-to-personal')
    ).rejects.toThrow('You must be a member of the current team');
  });

  // ==================== Validation failures ====================

  it('should throw NotFoundError when epic does not exist', async () => {
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1')
    ).rejects.toThrow("Epic with id 'epic-1' not found");
  });

  it('should throw ValidationError when transferring personal→team but epic is not personal', async () => {
    const teamEpic = makeEpic({
      scopeType: 'team',
      teamId: 'team-1',
      personalScopeId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(teamEpic as any);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1')
    ).rejects.toThrow('Epic is not in a personal scope');
  });

  it('should throw ValidationError when transferring team→personal but epic is not in team scope', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'team-to-personal')
    ).rejects.toThrow('Epic is not in a team scope');
  });

  it('should throw ValidationError when teamId is missing for personal-to-team', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'personal-to-team')
    ).rejects.toThrow('teamId is required');
  });

  it('should lazily create personal scope when user has none for team→personal', async () => {
    const teamEpic = makeEpic({
      scopeType: 'team',
      teamId: 'team-1',
      personalScopeId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(teamEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'membership-1' } as any);
    vi.mocked(prisma.status.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.epic.update).mockResolvedValue({ ...teamEpic, personalScopeId: 'new-scope-1', scopeType: 'personal', teamId: null } as any);

    const { createPersonalScope } = await import('../../src/services/personalScopeService.js');

    const result = await transferEpicScope('epic-1', 'user-1', 'team-to-personal');

    expect(createPersonalScope).toHaveBeenCalledWith('user-1');
    expect(result.personalScopeId).toBe('new-scope-1');
  });

  it('should throw NotFoundError when target team does not exist', async () => {
    const personalEpic = makeEpic({
      scopeType: 'personal',
      personalScopeId: 'scope-1',
      teamId: null,
      features: [],
    });
    vi.mocked(prisma.epic.findFirst).mockResolvedValue(personalEpic as any);
    vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'user-1' } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'membership-1' } as any);
    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

    await expect(
      transferEpicScope('epic-1', 'user-1', 'personal-to-team', 'team-1')
    ).rejects.toThrow("Team with id 'team-1' not found");
  });
});
