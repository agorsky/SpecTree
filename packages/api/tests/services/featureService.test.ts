import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    feature: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    epic: {
      findUnique: vi.fn(),
    },
    status: {
      findUnique: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn(),
    },
    task: {
      groupBy: vi.fn().mockResolvedValue([]),
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
  emitEntityCreated: vi.fn(),
  emitEntityUpdated: vi.fn(),
  emitEntityDeleted: vi.fn(),
}));

import { prisma } from '../../src/lib/db.js';
import {
  listFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
} from '../../src/services/featureService.js';
import { resolveStatusesToIds, getStatusIdsByCategory, getDefaultBacklogStatus } from '../../src/services/statusService.js';
import { getAccessibleScopes, hasAccessibleScopes } from '../../src/utils/scopeContext.js';
import { resolveAssigneeId, isAssigneeNone, isAssigneeInvalid, ASSIGNEE_NONE, ASSIGNEE_INVALID } from '../../src/utils/assignee.js';
import { generateSortOrderBetween } from '../../src/utils/ordering.js';
import { emitStatusChanged } from '../../src/events/index.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';

describe('featureService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listFeatures', () => {
    it('should return paginated features with default options', async () => {
      const mockFeatures = [
        { id: 'feat-1', title: 'Feature 1', _count: { tasks: 3 } },
        { id: 'feat-2', title: 'Feature 2', _count: { tasks: 1 } },
      ];
      vi.mocked(prisma.feature.findMany).mockResolvedValue(mockFeatures as any);

      const result = await listFeatures();

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
      expect(prisma.feature.findMany).toHaveBeenCalledWith({
        take: 21,
        where: {},
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { tasks: true } },
          status: true,
          assignee: true,
          creator: { select: { id: true, name: true, email: true } },
          implementer: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it('should handle cursor pagination', async () => {
      const mockFeatures = Array(21).fill(null).map((_, i) => ({
        id: `feat-${i}`,
        title: `Feature ${i}`,
        _count: { tasks: i },
      }));
      vi.mocked(prisma.feature.findMany).mockResolvedValue(mockFeatures as any);

      const result = await listFeatures({ cursor: 'cursor-id', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe('feat-19');
      expect(prisma.feature.findMany).toHaveBeenCalledWith({
        take: 21,
        cursor: { id: 'cursor-id' },
        skip: 1,
        where: {},
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { tasks: true } },
          status: true,
          assignee: true,
          creator: { select: { id: true, name: true, email: true } },
          implementer: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it('should filter by epicId', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ epicId: 'proj-123' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { epicId: 'proj-123' },
        })
      );
    });

    it('should filter by statusId', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ statusId: 'status-123' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { statusId: 'status-123' },
        })
      );
    });

    it('should filter by status name using resolveStatusesToIds', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ status: 'In Progress' });

      expect(resolveStatusesToIds).toHaveBeenCalledWith(['In Progress']);
      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { statusId: { in: ['status-1'] } },
        })
      );
    });

    it('should filter by status array', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ status: ['Todo', 'In Progress'] });

      expect(resolveStatusesToIds).toHaveBeenCalledWith(['Todo', 'In Progress']);
    });

    it('should return empty result when no matching statuses found', async () => {
      vi.mocked(resolveStatusesToIds).mockResolvedValueOnce([]);

      const result = await listFeatures({ status: 'NonexistentStatus' });

      expect(result.data).toEqual([]);
      expect(result.meta.hasMore).toBe(false);
      expect(prisma.feature.findMany).not.toHaveBeenCalled();
    });

    it('should filter by status category', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ statusCategory: 'started' });

      expect(getStatusIdsByCategory).toHaveBeenCalledWith('started');
      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { statusId: { in: ['status-1', 'status-2'] } },
        })
      );
    });

    it('should return empty result when no statuses in category', async () => {
      vi.mocked(getStatusIdsByCategory).mockResolvedValueOnce([]);

      const result = await listFeatures({ statusCategory: 'unknown' });

      expect(result.data).toEqual([]);
      expect(prisma.feature.findMany).not.toHaveBeenCalled();
    });

    it('should filter by assignee using resolveAssigneeId', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      vi.mocked(hasAccessibleScopes).mockReturnValueOnce(true);
      vi.mocked(getAccessibleScopes).mockResolvedValueOnce({ personalScopeId: 'ps-1', teamIds: ['team-1'] });

      await listFeatures({ assignee: 'test@test.com', currentUserId: 'user-current' });

      expect(resolveAssigneeId).toHaveBeenCalledWith('test@test.com', 'user-current');
      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assigneeId: 'user-123' }),
        })
      );
    });

    it('should filter for unassigned when assignee is "none"', async () => {
      vi.mocked(isAssigneeNone).mockReturnValueOnce(true);
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ assignee: 'none' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assigneeId: null },
        })
      );
    });

    it('should return empty result for invalid assignee', async () => {
      vi.mocked(isAssigneeInvalid).mockReturnValueOnce(true);

      const result = await listFeatures({ assignee: 'invalid@test.com' });

      expect(result.data).toEqual([]);
      expect(prisma.feature.findMany).not.toHaveBeenCalled();
    });

    it('should support legacy assigneeId parameter', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ assigneeId: 'user-legacy' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assigneeId: 'user-legacy' },
        })
      );
    });

    it('should filter by search query', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ query: 'search term' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: 'search term' } },
              { description: { contains: 'search term' } },
            ],
          },
        })
      );
    });

    it('should ignore empty query string', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ query: '   ' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('should order by createdAt when specified', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ orderBy: 'createdAt' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }],
        })
      );
    });

    it('should order by updatedAt when specified', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ orderBy: 'updatedAt' });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ updatedAt: 'desc' }],
        })
      );
    });

    it('should clamp limit to maximum of 100', async () => {
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      await listFeatures({ limit: 200 });

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );
    });
  });

  describe('getFeatureById', () => {
    it('should return feature with nested tasks when found by UUID', async () => {
      const mockFeature = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Feature',
        tasks: [{ id: 'task-1' }, { id: 'task-2' }],
      };
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(mockFeature as any);

      const result = await getFeatureById('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockFeature);
      expect(prisma.feature.findFirst).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        include: {
          tasks: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          epic: {
            select: {
              id: true,
              teamId: true,
            },
          },
          creator: { select: { id: true, name: true, email: true } },
          implementer: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it('should return feature when found by identifier', async () => {
      const mockFeature = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        identifier: 'ENG-4',
        title: 'Test Feature',
        tasks: [],
      };
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(mockFeature as any);

      const result = await getFeatureById('ENG-4');

      expect(result).toEqual(mockFeature);
      expect(prisma.feature.findFirst).toHaveBeenCalledWith({
        where: { identifier: 'ENG-4' },
        include: {
          tasks: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          epic: {
            select: {
              id: true,
              teamId: true,
            },
          },
          creator: { select: { id: true, name: true, email: true } },
          implementer: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it('should return null when feature not found', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(null);

      const result = await getFeatureById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createFeature', () => {
    beforeEach(() => {
      // Default mocks for successful creation
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
        teamId: 'team-123',
        team: { key: 'TEST' },
        personalScopeId: null,
        personalScope: null,
      } as any);
      // Mock findMany to return existing features (numeric MAX is TEST-5)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { identifier: 'TEST-5' },
        { identifier: 'TEST-3' },
      ] as any);
      // Mock findUnique to return null (identifier not taken)
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);
    });

    it('should create feature with auto-generated identifier', async () => {
      const mockFeature = {
        id: 'feat-123',
        title: 'New Feature',
        identifier: 'TEST-6',
        sortOrder: 1.0,
        statusId: 'backlog-status-id',
      };
      vi.mocked(prisma.feature.create).mockResolvedValue(mockFeature as any);

      const result = await createFeature({
        title: 'New Feature',
        epicId: 'proj-123',
      });

      expect(result).toEqual(mockFeature);
      expect(prisma.feature.create).toHaveBeenCalledWith({
        data: {
          title: 'New Feature',
          epicId: 'proj-123',
          identifier: 'TEST-6',
          sortOrder: 1.0,
          statusId: 'backlog-status-id', // Default backlog status is now auto-applied
        },
      });
    });

    it('should create feature with all optional fields', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({ id: 'status-123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: true } as any);
      vi.mocked(prisma.feature.create).mockResolvedValue({ id: 'feat-123' } as any);

      await createFeature({
        title: 'New Feature',
        epicId: 'proj-123',
        description: 'A description',
        statusId: 'status-123',
        assigneeId: 'user-123',
        sortOrder: 5.0,
      });

      expect(prisma.feature.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Feature',
          epicId: 'proj-123',
          description: 'A description',
          statusId: 'status-123',
          assigneeId: 'user-123',
          sortOrder: 5.0,
        }),
      });
    });

    it('should auto-generate sortOrder when not provided', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue({ sortOrder: 3.5 } as any);
      vi.mocked(prisma.feature.create).mockResolvedValue({ id: 'feat-123' } as any);

      await createFeature({
        title: 'New Feature',
        epicId: 'proj-123',
      });

      expect(generateSortOrderBetween).toHaveBeenCalledWith(3.5, null);
    });

    it('should trim whitespace from title and description', async () => {
      vi.mocked(prisma.feature.create).mockResolvedValue({ id: 'feat-123' } as any);

      await createFeature({
        title: '  Trimmed Title  ',
        epicId: 'proj-123',
        description: '  Trimmed Desc  ',
      });

      expect(prisma.feature.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Trimmed Title',
          description: 'Trimmed Desc',
        }),
      });
    });

    it('should throw ValidationError when title is empty', async () => {
      await expect(createFeature({ title: '', epicId: 'proj-123' }))
        .rejects.toThrow(ValidationError);
      await expect(createFeature({ title: '  ', epicId: 'proj-123' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when epicId is empty', async () => {
      await expect(createFeature({ title: 'Test', epicId: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when epic does not exist', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue(null);

      await expect(createFeature({ title: 'Test', epicId: 'nonexistent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when epic is archived', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({ id: 'proj-123', isArchived: true } as any);

      await expect(createFeature({ title: 'Test', epicId: 'proj-123' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when status does not exist', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      await expect(createFeature({
        title: 'Test',
        epicId: 'proj-123',
        statusId: 'nonexistent',
      })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when assignee is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: false } as any);

      await expect(createFeature({
        title: 'Test',
        epicId: 'proj-123',
        assigneeId: 'user-123',
      })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when assignee does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(createFeature({
        title: 'Test',
        epicId: 'proj-123',
        assigneeId: 'nonexistent',
      })).rejects.toThrow(NotFoundError);
    });

    it('should create feature on personal epic with PERS- prefix', async () => {
      // Mock personal epic - called twice: first in createFeature check, then in generateIdentifier
      const personalEpicMock = {
        id: 'personal-epic-123',
        isArchived: false,
        teamId: null,
        team: null,
        personalScopeId: 'ps-123',
        personalScope: { id: 'ps-123' },
      };
      vi.mocked(prisma.epic.findUnique)
        .mockResolvedValueOnce(personalEpicMock as any)  // createFeature check
        .mockResolvedValueOnce(personalEpicMock as any); // generateIdentifier
      // Mock existing personal features
      vi.mocked(prisma.feature.findMany).mockResolvedValueOnce([
        { identifier: 'PERS-2' },
        { identifier: 'PERS-1' },
      ] as any);

      const mockFeature = {
        id: 'feat-personal',
        title: 'Personal Feature',
        identifier: 'PERS-3',
        sortOrder: 1.0,
        statusId: 'backlog-status-id',
      };
      vi.mocked(prisma.feature.create).mockResolvedValue(mockFeature as any);

      const result = await createFeature({
        title: 'Personal Feature',
        epicId: 'personal-epic-123',
      });

      expect(result.identifier).toBe('PERS-3');
      expect(prisma.feature.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Personal Feature',
          epicId: 'personal-epic-123',
          identifier: 'PERS-3',
        }),
      });
    });

    it('should throw error when epic has neither team nor personal scope', async () => {
      vi.mocked(prisma.epic.findUnique).mockReset();
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'orphan-epic',
        isArchived: false,
        teamId: null,
        team: null,
        personalScopeId: null,
        personalScope: null,
      } as any);

      await expect(createFeature({
        title: 'Test',
        epicId: 'orphan-epic',
      })).rejects.toThrow('has no associated team or personal scope');
    });
  });

  describe('updateFeature', () => {
    beforeEach(() => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue({
        id: 'feat-123',
        title: 'Original Title',
        statusId: 'old-status',
      } as any);
    });

    it('should update feature title', async () => {
      vi.mocked(prisma.feature.update).mockResolvedValue({
        id: 'feat-123',
        title: 'Updated Title',
      } as any);

      const result = await updateFeature('feat-123', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(prisma.feature.update).toHaveBeenCalledWith({
        where: { id: 'feat-123' },
        data: { title: 'Updated Title' },
      });
    });

    it('should update feature status and emit event', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'new-status',
        teamId: 'team-123',
      } as any);
      vi.mocked(prisma.feature.findFirst).mockResolvedValueOnce({ id: 'feat-123', statusId: 'old-status' } as any);
      vi.mocked(prisma.feature.findUnique).mockResolvedValueOnce({
        id: 'feat-123',
        epic: { teamId: 'team-123' },
      } as any);
      vi.mocked(prisma.feature.update).mockResolvedValue({ id: 'feat-123', statusId: 'new-status' } as any);

      await updateFeature('feat-123', { statusId: 'new-status' });

      expect(emitStatusChanged).toHaveBeenCalledWith({
        entityType: 'feature',
        entityId: 'feat-123',
        oldStatusId: 'old-status',
        newStatusId: 'new-status',
        timestamp: expect.any(Date),
      });
    });

    it('should not emit event when status unchanged', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValueOnce({ id: 'feat-123', statusId: 'same-status' } as any);
      vi.mocked(prisma.feature.findUnique).mockResolvedValueOnce({ id: 'feat-123', epic: { teamId: 'team-123' } } as any);
      vi.mocked(prisma.status.findUnique).mockResolvedValue({ id: 'same-status', teamId: 'team-123' } as any);
      vi.mocked(prisma.feature.update).mockResolvedValue({ id: 'feat-123' } as any);

      await updateFeature('feat-123', { statusId: 'same-status' });

      expect(emitStatusChanged).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when feature does not exist', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(null);

      await expect(updateFeature('nonexistent', { title: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when title is empty', async () => {
      await expect(updateFeature('feat-123', { title: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when status does not exist', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      await expect(updateFeature('feat-123', { statusId: 'nonexistent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when status belongs to different team', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'status-123',
        teamId: 'different-team',
      } as any);
      vi.mocked(prisma.feature.findFirst).mockResolvedValueOnce({ id: 'feat-123' } as any);
      vi.mocked(prisma.feature.findUnique).mockResolvedValueOnce({
        id: 'feat-123',
        epic: { teamId: 'original-team' },
      } as any);

      await expect(updateFeature('feat-123', { statusId: 'status-123' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when assignee is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: false } as any);

      await expect(updateFeature('feat-123', { assigneeId: 'user-123' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should update sortOrder', async () => {
      vi.mocked(prisma.feature.update).mockResolvedValue({ id: 'feat-123', sortOrder: 2.5 } as any);

      await updateFeature('feat-123', { sortOrder: 2.5 });

      expect(prisma.feature.update).toHaveBeenCalledWith({
        where: { id: 'feat-123' },
        data: { sortOrder: 2.5 },
      });
    });
  });

  describe('deleteFeature', () => {
    it('should delete feature when it exists', async () => {
      vi.mocked(prisma.feature.findUnique).mockResolvedValue({ id: 'feat-123' } as any);
      vi.mocked(prisma.feature.delete).mockResolvedValue({ id: 'feat-123' } as any);

      await deleteFeature('feat-123');

      expect(prisma.feature.delete).toHaveBeenCalledWith({
        where: { id: 'feat-123' },
      });
    });

    it('should throw NotFoundError when feature does not exist', async () => {
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(null);

      await expect(deleteFeature('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('identifier generation', () => {
    it('should generate identifier based on team key and highest existing identifier', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
        teamId: 'team-123',
        team: { key: 'COM' },
      } as any);
      // Mock findMany to return existing features (numeric MAX is found)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { identifier: 'COM-42' },
        { identifier: 'COM-10' },
        { identifier: 'COM-5' },
      ] as any);
      // Mock findUnique to return null (identifier not taken)
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.feature.create).mockResolvedValue({
        id: 'feat-123',
        identifier: 'COM-43',
      } as any);

      await createFeature({
        title: 'New Feature',
        epicId: 'proj-123',
      });

      expect(prisma.feature.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: 'COM-43',
        }),
      });
    });

    it('should find max feature number within the team', async () => {
      vi.mocked(prisma.epic.findUnique).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
        teamId: 'team-123',
        team: { key: 'DEV' },
      } as any);
      // Mock findMany to return empty array (no existing features)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      // Mock findUnique to return null (identifier not taken)
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.feature.create).mockResolvedValue({ id: 'feat-123' } as any);

      await createFeature({
        title: 'First Feature',
        epicId: 'proj-123',
      });

      expect(prisma.feature.findMany).toHaveBeenCalledWith({
        where: {
          epic: { teamId: 'team-123' },
        },
        select: { identifier: true },
      });
      expect(prisma.feature.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: 'DEV-1',
        }),
      });
    });
  });
});
