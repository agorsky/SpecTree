import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
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
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../../src/services/projectService.js';
import { generateSortOrderBetween } from '../../src/utils/ordering.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listProjects', () => {
    it('should return paginated projects with default options', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Project 1', _count: { features: 5 } },
        { id: 'proj-2', name: 'Project 2', _count: { features: 3 } },
      ];
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await listProjects();

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        take: 21,
        where: { isArchived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { _count: { select: { features: true } } },
      });
    });

    it('should handle cursor pagination', async () => {
      const mockProjects = Array(21).fill(null).map((_, i) => ({
        id: `proj-${i}`,
        name: `Project ${i}`,
        _count: { features: i },
      }));
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await listProjects({ cursor: 'cursor-id', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe('proj-19');
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        take: 21,
        cursor: { id: 'cursor-id' },
        where: { isArchived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { _count: { select: { features: true } } },
      });
    });

    it('should filter by teamId', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await listProjects({ teamId: 'team-123' });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false, teamId: 'team-123' },
        })
      );
    });

    it('should order by createdAt when specified', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await listProjects({ orderBy: 'createdAt' });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }],
        })
      );
    });

    it('should order by updatedAt when specified', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await listProjects({ orderBy: 'updatedAt' });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ updatedAt: 'desc' }],
        })
      );
    });

    it('should clamp limit to maximum of 100', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await listProjects({ limit: 200 });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );
    });

    it('should clamp limit to minimum of 1', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await listProjects({ limit: 0 });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 })
      );
    });
  });

  describe('getProjectById', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should return project with feature count', async () => {
      const mockProject = {
        id: validUuid,
        name: 'Test Project',
        _count: { features: 10 },
      };
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject as any);

      const result = await getProjectById(validUuid);

      expect(result).toEqual(mockProject);
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: validUuid, isArchived: false },
        include: { _count: { select: { features: true } } },
      });
    });

    it('should return null when project not found', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      const result = await getProjectById('nonexistent');

      expect(result).toBeNull();
    });

    it('should lookup by name when not a UUID', async () => {
      const mockProject = {
        id: validUuid,
        name: 'My Project',
        _count: { features: 5 },
      };
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject as any);

      const result = await getProjectById('My Project');

      expect(result).toEqual(mockProject);
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { name: 'My Project', isArchived: false },
        include: { _count: { select: { features: true } } },
      });
    });
  });

  describe('createProject', () => {
    beforeEach(() => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
    });

    it('should create project with required fields', async () => {
      const mockProject = {
        id: 'proj-123',
        name: 'New Project',
        teamId: 'team-123',
        sortOrder: 1.0,
      };
      vi.mocked(prisma.project.create).mockResolvedValue(mockProject as any);

      const result = await createProject({
        name: 'New Project',
        teamId: 'team-123',
      });

      expect(result).toEqual(mockProject);
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          name: 'New Project',
          teamId: 'team-123',
          sortOrder: 1.0,
        },
      });
    });

    it('should create project with all optional fields', async () => {
      vi.mocked(prisma.project.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createProject({
        name: 'New Project',
        teamId: 'team-123',
        description: 'Project description',
        icon: 'folder',
        color: '#FF0000',
        sortOrder: 5.0,
      });

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          name: 'New Project',
          teamId: 'team-123',
          description: 'Project description',
          icon: 'folder',
          color: '#FF0000',
          sortOrder: 5.0,
        },
      });
    });

    it('should auto-generate sortOrder when not provided', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue({ sortOrder: 3.0 } as any);
      vi.mocked(prisma.project.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createProject({
        name: 'New Project',
        teamId: 'team-123',
      });

      expect(generateSortOrderBetween).toHaveBeenCalledWith(3.0, null);
    });

    it('should query last project by team for sortOrder', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.project.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createProject({
        name: 'New Project',
        teamId: 'team-123',
      });

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-123', isArchived: false },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
    });

    it('should trim whitespace from input fields', async () => {
      vi.mocked(prisma.project.create).mockResolvedValue({ id: 'proj-123' } as any);

      await createProject({
        name: '  Trimmed Name  ',
        teamId: 'team-123',
        description: '  Trimmed Desc  ',
        icon: '  icon  ',
        color: '  #FFF  ',
      });

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Trimmed Name',
          description: 'Trimmed Desc',
          icon: 'icon',
          color: '#FFF',
        }),
      });
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(createProject({ name: '', teamId: 'team-123' }))
        .rejects.toThrow(ValidationError);
      await expect(createProject({ name: '  ', teamId: 'team-123' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when teamId is empty', async () => {
      await expect(createProject({ name: 'Test', teamId: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(createProject({ name: 'Test', teamId: 'nonexistent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when team is archived', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: true,
      } as any);

      await expect(createProject({ name: 'Test', teamId: 'team-123' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProject', () => {
    beforeEach(() => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue({
        id: 'proj-123',
        name: 'Original Name',
        isArchived: false,
      } as any);
    });

    it('should update project name', async () => {
      vi.mocked(prisma.project.update).mockResolvedValue({
        id: 'proj-123',
        name: 'Updated Name',
      } as any);

      const result = await updateProject('proj-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { name: 'Updated Name' },
      });
    });

    it('should update multiple fields', async () => {
      vi.mocked(prisma.project.update).mockResolvedValue({ id: 'proj-123' } as any);

      await updateProject('proj-123', {
        name: 'Updated Name',
        description: 'New description',
        icon: 'new-icon',
        color: '#00FF00',
        sortOrder: 2.5,
      });

      expect(prisma.project.update).toHaveBeenCalledWith({
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
      vi.mocked(prisma.project.update).mockResolvedValue({ id: 'proj-123' } as any);

      await updateProject('proj-123', {
        name: '  Trimmed  ',
        description: '  Desc  ',
      });

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: {
          name: 'Trimmed',
          description: 'Desc',
        },
      });
    });

    it('should throw NotFoundError when project does not exist', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      await expect(updateProject('nonexistent', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when project is archived', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      await expect(updateProject('proj-123', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(updateProject('proj-123', { name: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should only update provided fields', async () => {
      vi.mocked(prisma.project.update).mockResolvedValue({ id: 'proj-123' } as any);

      await updateProject('proj-123', { description: 'Only description' });

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { description: 'Only description' },
      });
    });
  });

  describe('deleteProject', () => {
    it('should soft delete project by setting isArchived to true', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.project.update).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      await deleteProject('proj-123');

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-123' },
        data: { isArchived: true },
      });
    });

    it('should throw NotFoundError when project does not exist', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      await expect(deleteProject('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when project is already archived', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue({
        id: 'proj-123',
        isArchived: true,
      } as any);

      await expect(deleteProject('proj-123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('team scoping', () => {
    it('should filter projects by team when listing', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await listProjects({ teamId: 'team-abc' });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isArchived: false, teamId: 'team-abc' },
        })
      );
    });

    it('should create project within specified team', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-xyz',
        isArchived: false,
      } as any);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.project.create).mockResolvedValue({
        id: 'proj-123',
        teamId: 'team-xyz',
      } as any);

      const result = await createProject({
        name: 'Team Project',
        teamId: 'team-xyz',
      });

      expect(result.teamId).toBe('team-xyz');
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: 'team-xyz',
        }),
      });
    });
  });
});
