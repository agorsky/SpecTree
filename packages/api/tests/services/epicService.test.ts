import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    epic: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock ordering utility
vi.mock('../../src/utils/ordering.js', () => ({
  generateSortOrderBetween: vi.fn().mockReturnValue(1.0),
}));

import { prisma } from '../../src/lib/db.js';
import {
  listEpics,
  getEpicById,
  createEpic,
  updateEpic,
  deleteEpic,
  archiveEpic,
  unarchiveEpic,
} from '../../src/services/epicService.js';
import { generateSortOrderBetween } from '../../src/utils/ordering.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';

describe('epicService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listEpics', () => {
    it('should return paginated epics with default options', async () => {
      const mockEpics = [
        { id: 'proj-1', name: 'Epic 1', _count: { features: 5 } },
        { id: 'proj-2', name: 'Epic 2', _count: { features: 3 } },
      ];
      vi.mocked(prisma.epic.findMany).mockResolvedValue(mockEpics as any);

      const result = await listEpics();

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
      expect(prisma.epic.findMany).toHaveBeenCalledWith({
        take: 21,
        where: { isArchived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { _count: { select: { features: true } } },
      });
    });

    it('should handle cursor pagination', async () => {
      const mockEpics = Array(21).fill(null).map((_, i) => ({
        id: `proj-${i}`,
        name: `Epic ${i}`,
        _count: { features: i },
      }));
      vi.mocked(prisma.epic.findMany).mockResolvedValue(mockEpics as any);

      const result = await listEpics({ cursor: 'cursor-id', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe('proj-19');
      expect(prisma.epic.findMany).toHaveBeenCalledWith({
        take: 21,
        cursor: { id: 'cursor-id' },
        where: { isArchived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { _count: { select: { features: true } } },
      });
    });

    it('should filter by teamId', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics({ teamId: 'team-123' });

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false, teamId: 'team-123' },
        })
      );
    });

    it('should order by createdAt when specified', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics({ orderBy: 'createdAt' });

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }],
        })
      );
    });

    it('should order by updatedAt when specified', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics({ orderBy: 'updatedAt' });

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ updatedAt: 'desc' }],
        })
      );
    });

    it('should clamp limit to maximum of 100', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics({ limit: 200 });

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );
    });

    it('should clamp limit to minimum of 1', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics({ limit: 0 });

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 })
      );
    });
  });

  describe('getEpicById', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should return epic with feature count', async () => {
      const mockEpic = {
        id: validUuid,
        name: 'Test Epic',
        _count: { features: 10 },
      };
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);

      const result = await getEpicById(validUuid);

      expect(result).toEqual(mockEpic);
      expect(prisma.epic.findFirst).toHaveBeenCalledWith({
        where: { id: validUuid, isArchived: false },
        include: { _count: { select: { features: true } } },
      });
    });

    it('should return null when epic not found', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);

      const result = await getEpicById('nonexistent');

      expect(result).toBeNull();
    });

    it('should lookup by name when not a UUID', async () => {
      const mockEpic = {
        id: validUuid,
        name: 'My Epic',
        _count: { features: 5 },
      };
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(mockEpic as any);

      const result = await getEpicById('My Epic');

      expect(result).toEqual(mockEpic);
      expect(prisma.epic.findFirst).toHaveBeenCalledWith({
        where: { name: 'My Epic', isArchived: false },
        include: { _count: { select: { features: true } } },
      });
    });
  });

  describe('createEpic', () => {
    beforeEach(() => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);
    });

    it('should create epic with required fields', async () => {
      const mockEpic = {
        id: 'proj-123',
        name: 'New Epic',
        teamId: 'team-123',
        sortOrder: 1.0,
      };
      vi.mocked(prisma.epic.create).mockResolvedValue(mockEpic as any);

      const result = await createEpic({
        name: 'New Epic',
        teamId: 'team-123',
      });

      expect(result).toEqual(mockEpic);
      expect(prisma.epic.create).toHaveBeenCalledWith({
        data: {
          name: 'New Epic',
          teamId: 'team-123',
          sortOrder: 1.0,
        },
      });
    });

    it('should create epic with all optional fields', async () => {
      vi.mocked(prisma.epic.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createEpic({
        name: 'New Epic',
        teamId: 'team-123',
        description: 'Epic description',
        icon: 'folder',
        color: '#FF0000',
        sortOrder: 5.0,
      });

      expect(prisma.epic.create).toHaveBeenCalledWith({
        data: {
          name: 'New Epic',
          teamId: 'team-123',
          description: 'Epic description',
          icon: 'folder',
          color: '#FF0000',
          sortOrder: 5.0,
        },
      });
    });

    it('should auto-generate sortOrder when not provided', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({ sortOrder: 3.0 } as any);
      vi.mocked(prisma.epic.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createEpic({
        name: 'New Epic',
        teamId: 'team-123',
      });

      expect(generateSortOrderBetween).toHaveBeenCalledWith(3.0, null);
    });

    it('should query last epic by team for sortOrder', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.epic.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createEpic({
        name: 'New Epic',
        teamId: 'team-123',
      });

      expect(prisma.epic.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-123', isArchived: false },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
    });

    it('should trim whitespace from input fields', async () => {
      vi.mocked(prisma.epic.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createEpic({
        name: '  Trimmed Name  ',
        teamId: 'team-123',
        description: '  Trimmed Desc  ',
        icon: '  icon  ',
        color: '  #FFF  ',
      });

      expect(prisma.epic.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Trimmed Name',
          description: 'Trimmed Desc',
          icon: 'icon',
          color: '#FFF',
        }),
      });
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(createEpic({ name: '', teamId: 'team-123' }))
        .rejects.toThrow(ValidationError);
      await expect(createEpic({ name: '  ', teamId: 'team-123' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when teamId is empty', async () => {
      await expect(createEpic({ name: 'Test', teamId: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(createEpic({ name: 'Test', teamId: 'nonexistent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when team is archived', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: true,
      } as any);

      await expect(createEpic({ name: 'Test', teamId: 'team-123' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateEpic', () => {
    beforeEach(() => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        name: 'Original Name',
        isArchived: false,
      } as any);
    });

    it('should update epic name', async () => {
      vi.mocked(prisma.epic.update).mockResolvedValue({
        id: 'proj-123',
        name: 'Updated Name',
      } as any);

      const result = await updateEpic('proj-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.epic.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { name: 'Updated Name' },
      });
    });

    it('should update multiple fields', async () => {
      vi.mocked(prisma.epic.update).mockResolvedValue({ id: 'proj-123' } as any);

      await updateEpic('proj-123', {
        name: 'Updated Name',
        description: 'New description',
        icon: 'new-icon',
        color: '#00FF00',
        sortOrder: 2.5,
      });

      expect(prisma.epic.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: {
          name: 'Updated Name',
          description: 'New description',
          icon: 'new-icon',
          color: '#00FF00',
          sortOrder: 2.5,
        },
      });
    });

    it('should trim whitespace from updated fields', async () => {
      vi.mocked(prisma.epic.update).mockResolvedValue({ id: 'proj-123' } as any);

      await updateEpic('proj-123', {
        name: '  Trimmed  ',
        description: '  Desc  ',
      });

      expect(prisma.epic.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: {
          name: 'Trimmed',
          description: 'Desc',
        },
      });
    });

    it('should throw NotFoundError when epic does not exist', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);

      await expect(updateEpic('nonexistent', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when epic is archived', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      await expect(updateEpic('proj-123', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(updateEpic('proj-123', { name: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should only update provided fields', async () => {
      vi.mocked(prisma.epic.update).mockResolvedValue({ id: 'proj-123' } as any);

      await updateEpic('proj-123', { description: 'Only description' });

      expect(prisma.epic.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { description: 'Only description' },
      });
    });
  });

  describe('deleteEpic', () => {
    it('should soft delete epic by setting isArchived to true', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.epic.update).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      await deleteEpic('proj-123');

      expect(prisma.epic.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { isArchived: true },
      });
    });

    it('should throw NotFoundError when epic does not exist', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);

      await expect(deleteEpic('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should hard delete when epic is already archived', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);
      vi.mocked(prisma.epic.delete).mockResolvedValue({
        id: 'proj-123',
      } as any);

      await deleteEpic('proj-123');

      // Should call delete (hard delete) since it's already archived
      expect(prisma.epic.delete).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
      });
      // Should not call update
      expect(prisma.epic.update).not.toHaveBeenCalled();
    });
  });

  describe('archiveEpic', () => {
    it('should archive epic by setting isArchived to true', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.epic.update).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      const result = await archiveEpic('proj-123');

      expect(prisma.epic.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { isArchived: true },
      });
      expect(result.isArchived).toBe(true);
    });

    it('should throw NotFoundError when epic does not exist', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);

      await expect(archiveEpic('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when epic is already archived', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      await expect(archiveEpic('proj-123'))
        .rejects.toThrow(ValidationError);
    });

    it('should support name-based lookup', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        name: 'My Epic',
        isArchived: false,
      } as any);
      vi.mocked(prisma.epic.update).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      await archiveEpic('My Epic');

      expect(prisma.epic.findFirst).toHaveBeenCalledWith({
        where: { name: 'My Epic' },
      });
    });
  });

  describe('unarchiveEpic', () => {
    it('should unarchive epic by setting isArchived to false', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);
      vi.mocked(prisma.epic.update).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
      } as any);

      const result = await unarchiveEpic('proj-123');

      expect(prisma.epic.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { isArchived: false },
      });
      expect(result.isArchived).toBe(false);
    });

    it('should throw NotFoundError when epic does not exist', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);

      await expect(unarchiveEpic('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when epic is not archived', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
      } as any);

      await expect(unarchiveEpic('proj-123'))
        .rejects.toThrow(ValidationError);
    });

    it('should support name-based lookup', async () => {
      vi.mocked(prisma.epic.findFirst).mockResolvedValue({
        id: 'proj-123',
        name: 'My Epic',
        isArchived: true,
      } as any);
      vi.mocked(prisma.epic.update).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
      } as any);

      await unarchiveEpic('My Epic');

      expect(prisma.epic.findFirst).toHaveBeenCalledWith({
        where: { name: 'My Epic' },
      });
    });
  });

  describe('listEpics with includeArchived', () => {
    it('should include archived epics when includeArchived is true', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics({ includeArchived: true });

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('should exclude archived epics by default', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics();

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false },
        })
      );
    });
  });

  describe('team scoping', () => {
    it('should filter epics by team when listing', async () => {
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await listEpics({ teamId: 'team-abc' });

      expect(prisma.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false, teamId: 'team-abc' },
        })
      );
    });

    it('should create epic within specified team', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-xyz',
        isArchived: false,
      } as any);
      vi.mocked(prisma.epic.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.epic.create).mockResolvedValue({
        id: 'proj-123',
        teamId: 'team-xyz',
      } as any);

      const result = await createEpic({
        name: 'Team Epic',
        teamId: 'team-xyz',
      });

      expect(result.teamId).toBe('team-xyz');
      expect(prisma.epic.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: 'team-xyz',
        }),
      });
    });
  });
});
