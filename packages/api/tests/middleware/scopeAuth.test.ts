import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    personalScope: {
      findUnique: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
    epic: {
      findUnique: vi.fn(),
    },
    feature: {
      findFirst: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
    },
    status: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  requireScopeAccess,
  hasPersonalScopeAccess,
  hasTeamScopeAccess,
  getScopeFromEpic,
  getScopeFromFeature,
  getScopeFromTask,
  getScopeFromStatus,
  validateScopeAccess,
} from '../../src/middleware/scopeAuth.js';
import { ForbiddenError } from '../../src/errors/index.js';

// Helper to create mock request
function createMockRequest(
  userId: string | null,
  params: Record<string, string> = {},
  body?: Record<string, unknown>
): FastifyRequest {
  return {
    user: userId ? { id: userId } : undefined,
    params,
    body,
  } as unknown as FastifyRequest;
}

// Helper to create mock reply
function createMockReply(): FastifyReply {
  return {} as FastifyReply;
}

describe('scopeAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasPersonalScopeAccess', () => {
    it('should return true when user owns the personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({
        userId: 'user-123',
      } as any);

      const result = await hasPersonalScopeAccess('scope-123', 'user-123');

      expect(result).toBe(true);
      expect(prisma.personalScope.findUnique).toHaveBeenCalledWith({
        where: { id: 'scope-123' },
        select: { userId: true },
      });
    });

    it('should return false when user does not own the personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({
        userId: 'other-user',
      } as any);

      const result = await hasPersonalScopeAccess('scope-123', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false when personal scope does not exist', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);

      const result = await hasPersonalScopeAccess('nonexistent', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('hasTeamScopeAccess', () => {
    it('should return true when user is a member of the team', async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const result = await hasTeamScopeAccess('team-123', 'user-123');

      expect(result).toBe(true);
      expect(prisma.membership.findFirst).toHaveBeenCalledWith({
        where: {
          teamId: 'team-123',
          userId: 'user-123',
        },
        select: { id: true },
      });
    });

    it('should return false when user is not a member of the team', async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

      const result = await hasTeamScopeAccess('team-123', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('getScopeFromEpic', () => {
    it('should return personal scope when project belongs to personal scope', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        teamId: null,
        personalScopeId: 'scope-123',
        personalScope: { userId: 'user-123' },
      } as any);

      const result = await getScopeFromEpic('project-123');

      expect(result).toEqual({
        type: 'personal',
        id: 'scope-123',
        ownerId: 'user-123',
      });
    });

    it('should return team scope when project belongs to team', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        teamId: 'team-123',
        personalScopeId: null,
        personalScope: null,
      } as any);

      const result = await getScopeFromEpic('project-123');

      expect(result).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should return null when project not found', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue(null);

      const result = await getScopeFromEpic('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getScopeFromFeature', () => {
    it('should return personal scope when feature is in personal project', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue({
        epic: {
          teamId: null,
          personalScopeId: 'scope-123',
          personalScope: { userId: 'user-123' },
        },
      } as any);

      const result = await getScopeFromFeature('feature-123');

      expect(result).toEqual({
        type: 'personal',
        id: 'scope-123',
        ownerId: 'user-123',
      });
    });

    it('should return team scope when feature is in team project', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue({
        epic: {
          teamId: 'team-123',
          personalScopeId: null,
          personalScope: null,
        },
      } as any);

      const result = await getScopeFromFeature('feature-123');

      expect(result).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should lookup feature by identifier', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue({
        epic: {
          teamId: 'team-123',
          personalScopeId: null,
          personalScope: null,
        },
      } as any);

      await getScopeFromFeature('ENG-4');

      expect(prisma.feature.findFirst).toHaveBeenCalledWith({
        where: { identifier: 'ENG-4' },
        select: expect.any(Object),
      });
    });

    it('should return null when feature not found', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(null);

      const result = await getScopeFromFeature('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getScopeFromTask', () => {
    it('should return personal scope when task is in personal project', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        feature: {
          epic: {
            teamId: null,
            personalScopeId: 'scope-123',
            personalScope: { userId: 'user-123' },
          },
        },
      } as any);

      const result = await getScopeFromTask('task-123');

      expect(result).toEqual({
        type: 'personal',
        id: 'scope-123',
        ownerId: 'user-123',
      });
    });

    it('should return team scope when task is in team project', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        feature: {
          epic: {
            teamId: 'team-123',
            personalScopeId: null,
            personalScope: null,
          },
        },
      } as any);

      const result = await getScopeFromTask('task-123');

      expect(result).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should lookup task by identifier', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        feature: {
          epic: {
            teamId: 'team-123',
            personalScopeId: null,
            personalScope: null,
          },
        },
      } as any);

      await getScopeFromTask('ENG-4-1');

      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { identifier: 'ENG-4-1' },
        select: expect.any(Object),
      });
    });

    it('should return null when task not found', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

      const result = await getScopeFromTask('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getScopeFromStatus', () => {
    it('should return personal scope when status belongs to personal scope', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        teamId: null,
        personalScopeId: 'scope-123',
        personalScope: { userId: 'user-123' },
      } as any);

      const result = await getScopeFromStatus('status-123');

      expect(result).toEqual({
        type: 'personal',
        id: 'scope-123',
        ownerId: 'user-123',
      });
    });

    it('should return team scope when status belongs to team', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        teamId: 'team-123',
        personalScopeId: null,
        personalScope: null,
      } as any);

      const result = await getScopeFromStatus('status-123');

      expect(result).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should return null when status not found', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      const result = await getScopeFromStatus('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateScopeAccess', () => {
    it('should validate personal scope access using ownerId when available', async () => {
      const scope = { type: 'personal' as const, id: 'scope-123', ownerId: 'user-123' };

      const result = await validateScopeAccess(scope, 'user-123');

      expect(result).toBe(true);
      // Should not query database when ownerId is already resolved
      expect(prisma.personalScope.findUnique).not.toHaveBeenCalled();
    });

    it('should deny personal scope access when user is not owner', async () => {
      const scope = { type: 'personal' as const, id: 'scope-123', ownerId: 'other-user' };

      const result = await validateScopeAccess(scope, 'user-123');

      expect(result).toBe(false);
    });

    it('should query database for personal scope access when ownerId not available', async () => {
      const scope = { type: 'personal' as const, id: 'scope-123' };
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({
        userId: 'user-123',
      } as any);

      const result = await validateScopeAccess(scope, 'user-123');

      expect(result).toBe(true);
      expect(prisma.personalScope.findUnique).toHaveBeenCalled();
    });

    it('should validate team scope access via membership', async () => {
      const scope = { type: 'team' as const, id: 'team-123' };
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const result = await validateScopeAccess(scope, 'user-123');

      expect(result).toBe(true);
      expect(prisma.membership.findFirst).toHaveBeenCalledWith({
        where: {
          teamId: 'team-123',
          userId: 'user-123',
        },
        select: { id: true },
      });
    });

    it('should deny team scope access when user is not a member', async () => {
      const scope = { type: 'team' as const, id: 'team-123' };
      vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

      const result = await validateScopeAccess(scope, 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('requireScopeAccess middleware', () => {
    it('should throw ForbiddenError when user is not authenticated', async () => {
      const middleware = requireScopeAccess('personalScopeId');
      const request = createMockRequest(null, { personalScopeId: 'scope-123' });
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow('User not authenticated');
    });

    it('should throw ForbiddenError when required parameter is missing', async () => {
      const middleware = requireScopeAccess('personalScopeId');
      const request = createMockRequest('user-123', {});
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow(
        'Missing required parameter: personalScopeId'
      );
    });

    it('should allow access to own personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({
        userId: 'user-123',
      } as any);

      const middleware = requireScopeAccess('personalScopeId');
      const request = createMockRequest('user-123', { personalScopeId: 'scope-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'personal',
        id: 'scope-123',
      });
    });

    it('should deny access to other users personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({
        userId: 'other-user',
      } as any);

      const middleware = requireScopeAccess('personalScopeId');
      const request = createMockRequest('user-123', { personalScopeId: 'scope-456' });
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow(
        'Access denied: not the owner of this personal scope'
      );
    });

    it('should allow access to team user is member of', async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const middleware = requireScopeAccess('teamId');
      const request = createMockRequest('user-123', { teamId: 'team-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should deny access to team user is not member of', async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

      const middleware = requireScopeAccess('teamId');
      const request = createMockRequest('user-123', { teamId: 'team-456' });
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow(
        'Access denied: not a member of this team'
      );
    });

    it('should resolve scope from project and validate access', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        teamId: 'team-123',
        personalScopeId: null,
        personalScope: null,
      } as any);
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const middleware = requireScopeAccess('projectId');
      const request = createMockRequest('user-123', { projectId: 'project-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should throw ForbiddenError when project not found', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue(null);

      const middleware = requireScopeAccess('projectId');
      const request = createMockRequest('user-123', { projectId: 'nonexistent' });
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow('Epic not found');
    });

    it('should support mapping syntax for param to resource type', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        teamId: null,
        personalScopeId: 'scope-123',
        personalScope: { userId: 'user-123' },
      } as any);

      const middleware = requireScopeAccess('id:projectId');
      const request = createMockRequest('user-123', { id: 'project-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'personal',
        id: 'scope-123',
        ownerId: 'user-123',
      });
    });

    it('should read resource ID from body when not in params', async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const middleware = requireScopeAccess('teamId');
      const request = createMockRequest('user-123', {}, { teamId: 'team-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should handle feature-based scope resolution', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue({
        epic: {
          teamId: 'team-123',
          personalScopeId: null,
          personalScope: null,
        },
      } as any);
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const middleware = requireScopeAccess('featureId');
      const request = createMockRequest('user-123', { featureId: 'feature-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should throw ForbiddenError when feature not found', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(null);

      const middleware = requireScopeAccess('featureId');
      const request = createMockRequest('user-123', { featureId: 'nonexistent' });
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow('Feature not found');
    });

    it('should handle task-based scope resolution', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        feature: {
          epic: {
            teamId: null,
            personalScopeId: 'scope-123',
            personalScope: { userId: 'user-123' },
          },
        },
      } as any);

      const middleware = requireScopeAccess('taskId');
      const request = createMockRequest('user-123', { taskId: 'task-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'personal',
        id: 'scope-123',
        ownerId: 'user-123',
      });
    });

    it('should throw ForbiddenError when task not found', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

      const middleware = requireScopeAccess('taskId');
      const request = createMockRequest('user-123', { taskId: 'nonexistent' });
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow('Task not found');
    });

    it('should handle status-based scope resolution', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        teamId: 'team-123',
        personalScopeId: null,
        personalScope: null,
      } as any);
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const middleware = requireScopeAccess('statusId');
      const request = createMockRequest('user-123', { statusId: 'status-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should throw ForbiddenError when status not found', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      const middleware = requireScopeAccess('statusId');
      const request = createMockRequest('user-123', { statusId: 'nonexistent' });
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, reply)).rejects.toThrow('Status not found');
    });

    it('should handle unknown resource type as team scope', async () => {
      vi.mocked(prisma.membership.findFirst).mockResolvedValue({
        id: 'membership-123',
      } as any);

      const middleware = requireScopeAccess('unknownParam');
      const request = createMockRequest('user-123', { unknownParam: 'team-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'team',
        id: 'team-123',
      });
    });

    it('should support snake_case resource types', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({
        userId: 'user-123',
      } as any);

      const middleware = requireScopeAccess('personal_scope_id');
      const request = createMockRequest('user-123', { personal_scope_id: 'scope-123' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(request.scope).toEqual({
        type: 'personal',
        id: 'scope-123',
      });
    });
  });
});
