import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    task: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    feature: {
      findUnique: vi.fn(),
    },
    status: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock status service
vi.mock('../../src/services/statusService.js', () => ({
  resolveStatusesToIds: vi.fn().mockResolvedValue(['status-1']),
  getStatusIdsByCategory: vi.fn().mockResolvedValue(['status-1', 'status-2']),
  getDefaultBacklogStatus: vi.fn().mockResolvedValue({ id: 'backlog-status-id', name: 'Backlog' }),
}));

// Mock scope context utility
vi.mock('../../src/utils/scopeContext.js', () => ({
  getAccessibleScopes: vi.fn().mockResolvedValue({ personalScopeIds: [], teamIds: [] }),
  hasAccessibleScopes: vi.fn().mockReturnValue(false),
}));

// Mock assignee utility
vi.mock('../../src/utils/assignee.js', () => ({
  resolveAssigneeId: vi.fn().mockResolvedValue('user-123'),
  isAssigneeNone: vi.fn().mockReturnValue(false),
  isAssigneeInvalid: vi.fn().mockReturnValue(false),
  ASSIGNEE_NONE: Symbol('ASSIGNEE_NONE'),
  ASSIGNEE_INVALID: Symbol('ASSIGNEE_INVALID'),
}));

// Mock ordering utility
vi.mock('../../src/utils/ordering.js', () => ({
  generateSortOrderBetween: vi.fn().mockReturnValue(1.0),
}));

// Mock date parser
vi.mock('../../src/utils/dateParser.js', () => ({
  buildDateFilters: vi.fn().mockReturnValue({}),
}));

// Mock events
vi.mock('../../src/events/index.js', () => ({
  emitStatusChanged: vi.fn(),
}));

import { prisma } from '../../src/lib/db.js';
import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from '../../src/services/taskService.js';
import { resolveStatusesToIds, getStatusIdsByCategory, getDefaultBacklogStatus } from '../../src/services/statusService.js';
import { getAccessibleScopes, hasAccessibleScopes } from '../../src/utils/scopeContext.js';
import { resolveAssigneeId, isAssigneeNone, isAssigneeInvalid } from '../../src/utils/assignee.js';
import { generateSortOrderBetween } from '../../src/utils/ordering.js';
import { emitStatusChanged } from '../../src/events/index.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';

describe('taskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listTasks', () => {
    it('should return paginated tasks with default options', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1' },
        { id: 'task-2', title: 'Task 2' },
      ];
      vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any);

      const result = await listTasks();

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        take: 21,
        where: {},
        orderBy: [{ sortOrder: 'asc' }, { identifier: 'asc' }],
        include: {
          status: true,
          assignee: true,
          feature: {
            select: {
              id: true,
              identifier: true,
              title: true,
            },
          },
        },
      });
    });

    it('should handle cursor pagination', async () => {
      const mockTasks = Array(21).fill(null).map((_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
      }));
      vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any);

      const result = await listTasks({ cursor: 'cursor-id', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe('task-19');
    });

    it('should filter by featureId', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ featureId: 'feat-123' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { featureId: 'feat-123' },
        })
      );
    });

    it('should filter by statusId', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ statusId: 'status-123' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { statusId: 'status-123' },
        })
      );
    });

    it('should filter by status name using resolveStatusesToIds', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ status: 'Done' });

      expect(resolveStatusesToIds).toHaveBeenCalledWith(['Done']);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { statusId: { in: ['status-1'] } },
        })
      );
    });

    it('should filter by status array', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ status: ['Todo', 'Done'] });

      expect(resolveStatusesToIds).toHaveBeenCalledWith(['Todo', 'Done']);
    });

    it('should return empty result when no matching statuses found', async () => {
      vi.mocked(resolveStatusesToIds).mockResolvedValueOnce([]);

      const result = await listTasks({ status: 'NonexistentStatus' });

      expect(result.data).toEqual([]);
      expect(result.meta.hasMore).toBe(false);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('should filter by status category', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ statusCategory: 'completed' });

      expect(getStatusIdsByCategory).toHaveBeenCalledWith('completed');
    });

    it('should filter by assignee using resolveAssigneeId', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(hasAccessibleScopes).mockReturnValueOnce(true);
      vi.mocked(getAccessibleScopes).mockResolvedValueOnce({ personalScopeId: 'ps-1', teamIds: ['team-1'] });

      await listTasks({ assignee: 'user@test.com', currentUserId: 'current-user' });

      expect(resolveAssigneeId).toHaveBeenCalledWith('user@test.com', 'current-user');
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assigneeId: 'user-123' }),
        })
      );
    });

    it('should filter for unassigned when assignee is "none"', async () => {
      vi.mocked(isAssigneeNone).mockReturnValueOnce(true);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ assignee: 'none' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assigneeId: null },
        })
      );
    });

    it('should return empty result for invalid assignee', async () => {
      vi.mocked(isAssigneeInvalid).mockReturnValueOnce(true);

      const result = await listTasks({ assignee: 'invalid' });

      expect(result.data).toEqual([]);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('should support legacy assigneeId parameter', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ assigneeId: 'user-legacy' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assigneeId: 'user-legacy' },
        })
      );
    });

    it('should filter by search query', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ query: 'bug fix' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: 'bug fix' } },
              { description: { contains: 'bug fix' } },
            ],
          },
        })
      );
    });

    it('should order by createdAt when specified', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ orderBy: 'createdAt' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }],
        })
      );
    });

    it('should order by updatedAt when specified', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ orderBy: 'updatedAt' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ updatedAt: 'desc' }],
        })
      );
    });

    it('should clamp limit to valid range', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      await listTasks({ limit: 200 });
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );

      vi.clearAllMocks();
      await listTasks({ limit: 0 });
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 })
      );
    });
  });

  describe('getTaskById', () => {
    it('should return task when found by UUID', async () => {
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Task',
        featureId: 'feat-123',
      };
      vi.mocked(prisma.task.findFirst).mockResolvedValue(mockTask as any);

      const result = await getTaskById('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockTask);
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
    });

    it('should return task when found by identifier', async () => {
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        identifier: 'ENG-4-1',
        title: 'Test Task',
        featureId: 'feat-123',
      };
      vi.mocked(prisma.task.findFirst).mockResolvedValue(mockTask as any);

      const result = await getTaskById('ENG-4-1');

      expect(result).toEqual(mockTask);
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { identifier: 'ENG-4-1' },
      });
    });

    it('should return null when task not found', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

      const result = await getTaskById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createTask', () => {
    beforeEach(() => {
      // Default mocks for successful creation
      vi.mocked(prisma.feature.findUnique).mockResolvedValue({
        id: 'feat-123',
        identifier: 'COM-5',
        project: { teamId: 'team-123' },
      } as any);
      // Mock findMany to return existing tasks for identifier generation
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { identifier: 'COM-5-2' },
        { identifier: 'COM-5-1' },
      ] as any);
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
    });

    it('should create task with auto-generated identifier', async () => {
      const mockTask = {
        id: 'task-123',
        title: 'New Task',
        identifier: 'COM-5-3',
        sortOrder: 1.0,
        statusId: 'backlog-status-id',
      };
      vi.mocked(prisma.task.create).mockResolvedValue(mockTask as any);

      const result = await createTask({
        title: 'New Task',
        featureId: 'feat-123',
      });

      expect(result).toEqual(mockTask);
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          title: 'New Task',
          featureId: 'feat-123',
          identifier: 'COM-5-3',
          sortOrder: 1.0,
          statusId: 'backlog-status-id', // Auto-assigned backlog status
        },
      });
    });

    it('should create task with all optional fields', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({ id: 'status-123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: true } as any);
      vi.mocked(prisma.task.create).mockResolvedValue({ id: 'task-123' } as any);

      await createTask({
        title: 'New Task',
        featureId: 'feat-123',
        description: 'Task description',
        statusId: 'status-123',
        assigneeId: 'user-123',
        sortOrder: 5.0,
      });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Task',
          featureId: 'feat-123',
          description: 'Task description',
          statusId: 'status-123',
          assigneeId: 'user-123',
          sortOrder: 5.0,
        }),
      });
    });

    it('should auto-generate sortOrder when not provided', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({ sortOrder: 2.5 } as any);
      vi.mocked(prisma.task.create).mockResolvedValue({ id: 'task-123' } as any);

      await createTask({
        title: 'New Task',
        featureId: 'feat-123',
      });

      expect(generateSortOrderBetween).toHaveBeenCalledWith(2.5, null);
    });

    it('should trim whitespace from title and description', async () => {
      vi.mocked(prisma.task.create).mockResolvedValue({ id: 'task-123' } as any);

      await createTask({
        title: '  Trimmed Title  ',
        featureId: 'feat-123',
        description: '  Trimmed Desc  ',
      });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Trimmed Title',
          description: 'Trimmed Desc',
        }),
      });
    });

    it('should throw ValidationError when title is empty', async () => {
      await expect(createTask({ title: '', featureId: 'feat-123' }))
        .rejects.toThrow(ValidationError);
      await expect(createTask({ title: '  ', featureId: 'feat-123' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when featureId is empty', async () => {
      await expect(createTask({ title: 'Test', featureId: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when feature does not exist', async () => {
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);

      await expect(createTask({ title: 'Test', featureId: 'nonexistent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when status does not exist', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      await expect(createTask({
        title: 'Test',
        featureId: 'feat-123',
        statusId: 'nonexistent',
      })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when assignee is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: false } as any);

      await expect(createTask({
        title: 'Test',
        featureId: 'feat-123',
        assigneeId: 'user-123',
      })).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateTask', () => {
    beforeEach(() => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        id: 'task-123',
        title: 'Original Title',
        statusId: 'old-status',
      } as any);
    });

    it('should update task title', async () => {
      vi.mocked(prisma.task.update).mockResolvedValue({
        id: 'task-123',
        title: 'Updated Title',
      } as any);

      const result = await updateTask('task-123', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: { title: 'Updated Title' },
      });
    });

    it('should update task status and emit event', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'new-status',
        teamId: 'team-123',
      } as any);
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce({ id: 'task-123', statusId: 'old-status' } as any);
      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce({
        id: 'task-123',
        feature: { project: { teamId: 'team-123' } },
      } as any);
      vi.mocked(prisma.task.update).mockResolvedValue({ id: 'task-123', statusId: 'new-status' } as any);

      await updateTask('task-123', { statusId: 'new-status' });

      expect(emitStatusChanged).toHaveBeenCalledWith({
        entityType: 'task',
        entityId: 'task-123',
        oldStatusId: 'old-status',
        newStatusId: 'new-status',
        timestamp: expect.any(Date),
      });
    });

    it('should not emit event when status unchanged', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce({ id: 'task-123', statusId: 'same-status' } as any);
      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce({ id: 'task-123', feature: { project: { teamId: 'team-123' } } } as any);
      vi.mocked(prisma.status.findUnique).mockResolvedValue({ id: 'same-status', teamId: 'team-123' } as any);
      vi.mocked(prisma.task.update).mockResolvedValue({ id: 'task-123' } as any);

      await updateTask('task-123', { statusId: 'same-status' });

      expect(emitStatusChanged).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when task does not exist', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

      await expect(updateTask('nonexistent', { title: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when title is empty', async () => {
      await expect(updateTask('task-123', { title: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when status does not exist', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      await expect(updateTask('task-123', { statusId: 'nonexistent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when status belongs to different team', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'status-123',
        teamId: 'different-team',
      } as any);
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce({ id: 'task-123' } as any);
      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce({
        id: 'task-123',
        feature: { project: { teamId: 'original-team' } },
      } as any);

      await expect(updateTask('task-123', { statusId: 'status-123' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when assignee is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: false } as any);

      await expect(updateTask('task-123', { assigneeId: 'user-123' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should update sortOrder', async () => {
      vi.mocked(prisma.task.update).mockResolvedValue({ id: 'task-123', sortOrder: 3.5 } as any);

      await updateTask('task-123', { sortOrder: 3.5 });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: { sortOrder: 3.5 },
      });
    });
  });

  describe('deleteTask', () => {
    it('should delete task when it exists', async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: 'task-123' } as any);
      vi.mocked(prisma.task.delete).mockResolvedValue({ id: 'task-123' } as any);

      await deleteTask('task-123');

      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-123' },
      });
    });

    it('should throw NotFoundError when task does not exist', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

      await expect(deleteTask('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('identifier generation', () => {
    it('should generate identifier based on parent feature identifier', async () => {
      vi.mocked(prisma.feature.findUnique).mockResolvedValue({
        id: 'feat-123',
        identifier: 'DEV-42',
        project: { teamId: 'team-123' },
      } as any);
      // Mock findMany to return existing tasks with identifiers
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { identifier: 'DEV-42-5' },
        { identifier: 'DEV-42-3' },
        { identifier: 'DEV-42-1' },
      ] as any);
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.task.create).mockResolvedValue({
        id: 'task-123',
        identifier: 'DEV-42-6',
      } as any);

      await createTask({
        title: 'New Task',
        featureId: 'feat-123',
      });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: 'DEV-42-6',
        }),
      });
    });

    it('should find max task number within the same feature', async () => {
      vi.mocked(prisma.feature.findUnique).mockResolvedValue({
        id: 'feat-123',
        identifier: 'API-1',
        project: { teamId: 'team-123' },
      } as any);
      // Mock findMany to return empty array (no existing tasks)
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.task.create).mockResolvedValue({ id: 'task-123' } as any);

      await createTask({
        title: 'First Task',
        featureId: 'feat-123',
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { featureId: 'feat-123' },
        select: { identifier: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: 'API-1-1',
        }),
      });
    });
  });
});
