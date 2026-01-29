import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    team: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock the statusService to avoid circular dependency issues
vi.mock('../../src/services/statusService.js', () => ({
  createDefaultStatuses: vi.fn().mockResolvedValue([]),
}));

import { prisma } from '../../src/lib/db.js';
import {
  keyExists,
  listTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
} from '../../src/services/teamService.js';
import { createDefaultStatuses } from '../../src/services/statusService.js';
import { NotFoundError, ConflictError, ValidationError } from '../../src/errors/index.js';

describe('teamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('keyExists', () => {
    it('should return false when team key does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await keyExists('NEW-KEY');

      expect(result).toBe(false);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { key: 'NEW-KEY' },
        select: { id: true },
      });
    });

    it('should return true when team key exists', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123' } as any);

      const result = await keyExists('EXISTING-KEY');

      expect(result).toBe(true);
    });

    it('should return false when key belongs to excluded team', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123' } as any);

      const result = await keyExists('EXISTING-KEY', 'team-123');

      expect(result).toBe(false);
    });

    it('should return true when key exists and excludeId is different', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123' } as any);

      const result = await keyExists('EXISTING-KEY', 'team-456');

      expect(result).toBe(true);
    });
  });

  describe('listTeams', () => {
    it('should return paginated teams with default limit', async () => {
      const mockTeams = [
        { id: 'team-1', name: 'Team 1', key: 'T1', _count: { memberships: 5 } },
        { id: 'team-2', name: 'Team 2', key: 'T2', _count: { memberships: 3 } },
      ];
      vi.mocked(prisma.team.findMany).mockResolvedValue(mockTeams as any);

      const result = await listTeams();

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        take: 21, // limit + 1
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { memberships: true } } },
      });
    });

    it('should handle cursor pagination', async () => {
      const mockTeams = Array(21).fill(null).map((_, i) => ({
        id: `team-${i}`,
        name: `Team ${i}`,
        key: `T${i}`,
        _count: { memberships: i },
      }));
      vi.mocked(prisma.team.findMany).mockResolvedValue(mockTeams as any);

      const result = await listTeams({ cursor: 'cursor-id', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe('team-19');
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        take: 21,
        cursor: { id: 'cursor-id' },
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { memberships: true } } },
      });
    });

    it('should clamp limit to maximum of 100', async () => {
      vi.mocked(prisma.team.findMany).mockResolvedValue([]);

      await listTeams({ limit: 200 });

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );
    });

    it('should clamp limit to minimum of 1', async () => {
      vi.mocked(prisma.team.findMany).mockResolvedValue([]);

      await listTeams({ limit: 0 });

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 })
      );
    });
  });

  describe('getTeamById', () => {
    it('should return team when found', async () => {
      const mockTeam = {
        id: 'team-123',
        name: 'Test Team',
        key: 'TEST',
        _count: { memberships: 5 },
      };
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);

      const result = await getTeamById('team-123');

      expect(result).toEqual(mockTeam);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-123', isArchived: false },
        include: { _count: { select: { memberships: true } } },
      });
    });

    it('should return null when team not found', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await getTeamById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createTeam', () => {
    it('should create team with required fields', async () => {
      const mockTeam = {
        id: 'team-123',
        name: 'New Team',
        key: 'NT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null); // key doesn't exist
      vi.mocked(prisma.team.create).mockResolvedValue(mockTeam as any);

      const result = await createTeam({ name: 'New Team', key: 'NT' });

      expect(result).toEqual(mockTeam);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: { name: 'New Team', key: 'NT' },
      });
      expect(createDefaultStatuses).toHaveBeenCalledWith('team-123');
    });

    it('should create team with all optional fields', async () => {
      const mockTeam = { id: 'team-123' };
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.create).mockResolvedValue(mockTeam as any);

      await createTeam({
        name: 'New Team',
        key: 'NT',
        description: 'A description',
        icon: 'icon-name',
        color: '#FF0000',
      });

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          name: 'New Team',
          key: 'NT',
          description: 'A description',
          icon: 'icon-name',
          color: '#FF0000',
        },
      });
    });

    it('should trim whitespace from input fields', async () => {
      const mockTeam = { id: 'team-123' };
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.create).mockResolvedValue(mockTeam as any);

      await createTeam({
        name: '  New Team  ',
        key: '  NT  ',
        description: '  desc  ',
      });

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Team',
          key: 'NT',
          description: 'desc',
        }),
      });
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(createTeam({ name: '', key: 'NT' }))
        .rejects.toThrow(ValidationError);
      await expect(createTeam({ name: '  ', key: 'NT' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when key is empty', async () => {
      await expect(createTeam({ name: 'Test', key: '' }))
        .rejects.toThrow(ValidationError);
      await expect(createTeam({ name: 'Test', key: '  ' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when key already exists', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'existing-team' } as any);

      await expect(createTeam({ name: 'New Team', key: 'EXISTING' }))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('updateTeam', () => {
    it('should update team with provided fields', async () => {
      const existingTeam = { id: 'team-123', key: 'OLD', isArchived: false };
      const updatedTeam = { ...existingTeam, name: 'Updated Name' };
      vi.mocked(prisma.team.findUnique).mockResolvedValue(existingTeam as any);
      vi.mocked(prisma.team.update).mockResolvedValue(updatedTeam as any);

      const result = await updateTeam('team-123', { name: 'Updated Name' });

      expect(result).toEqual(updatedTeam);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        data: { name: 'Updated Name' },
      });
    });

    it('should update team key when not conflicting', async () => {
      const existingTeam = { id: 'team-123', key: 'OLD', isArchived: false };
      vi.mocked(prisma.team.findUnique)
        .mockResolvedValueOnce(existingTeam as any) // first call for existence check
        .mockResolvedValueOnce(null); // second call for keyExists check
      vi.mocked(prisma.team.update).mockResolvedValue({ ...existingTeam, key: 'NEW' } as any);

      await updateTeam('team-123', { key: 'NEW' });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        data: { key: 'NEW' },
      });
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(updateTeam('nonexistent', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when team is archived', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123', isArchived: true } as any);

      await expect(updateTeam('team-123', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when name is empty', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123', isArchived: false } as any);

      await expect(updateTeam('team-123', { name: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when key is empty', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123', isArchived: false } as any);

      await expect(updateTeam('team-123', { key: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when updating to existing key', async () => {
      const existingTeam = { id: 'team-123', key: 'OLD', isArchived: false };
      vi.mocked(prisma.team.findUnique)
        .mockResolvedValueOnce(existingTeam as any) // existence check
        .mockResolvedValueOnce({ id: 'other-team' } as any); // keyExists check

      await expect(updateTeam('team-123', { key: 'TAKEN' }))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('deleteTeam', () => {
    it('should soft delete team by setting isArchived to true', async () => {
      const existingTeam = { id: 'team-123', isArchived: false };
      vi.mocked(prisma.team.findUnique).mockResolvedValue(existingTeam as any);
      vi.mocked(prisma.team.update).mockResolvedValue({ ...existingTeam, isArchived: true } as any);

      await deleteTeam('team-123');

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        data: { isArchived: true },
      });
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(deleteTeam('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when team is already archived', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123', isArchived: true } as any);

      await expect(deleteTeam('team-123'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
