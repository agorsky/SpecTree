import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    status: {
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
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  listStatuses,
  getStatusById,
  createStatus,
  updateStatus,
  deleteStatus,
  resolveStatusToId,
  resolveStatusesToIds,
  getStatusIdsByCategory,
  createDefaultStatuses,
} from '../../src/services/statusService.js';
import { NotFoundError, ConflictError, ValidationError } from '../../src/errors/index.js';

describe('statusService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listStatuses', () => {
    it('should return all statuses ordered by position', async () => {
      const mockStatuses = [
        { id: 'status-1', name: 'Backlog', position: 0 },
        { id: 'status-2', name: 'Todo', position: 1 },
        { id: 'status-3', name: 'Done', position: 2 },
      ];
      vi.mocked(prisma.status.findMany).mockResolvedValue(mockStatuses as any);

      const result = await listStatuses();

      expect(result).toEqual(mockStatuses);
      expect(prisma.status.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { position: 'asc' },
      });
    });

    it('should filter by teamId', async () => {
      vi.mocked(prisma.status.findMany).mockResolvedValue([]);

      await listStatuses({ teamId: 'team-123' });

      expect(prisma.status.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
        orderBy: { position: 'asc' },
      });
    });
  });

  describe('getStatusById', () => {
    it('should return status when found', async () => {
      const mockStatus = {
        id: 'status-123',
        name: 'In Progress',
        category: 'started',
      };
      vi.mocked(prisma.status.findUnique).mockResolvedValue(mockStatus as any);

      const result = await getStatusById('status-123');

      expect(result).toEqual(mockStatus);
      expect(prisma.status.findUnique).toHaveBeenCalledWith({
        where: { id: 'status-123' },
      });
    });

    it('should return null when status not found', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      const result = await getStatusById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createStatus', () => {
    beforeEach(() => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123' } as any);
    });

    it('should create status with required fields', async () => {
      const mockStatus = {
        id: 'status-123',
        name: 'Review',
        teamId: 'team-123',
        category: 'started',
      };
      vi.mocked(prisma.status.create).mockResolvedValue(mockStatus as any);

      const result = await createStatus({
        name: 'Review',
        teamId: 'team-123',
        category: 'started',
      });

      expect(result).toEqual(mockStatus);
      expect(prisma.status.create).toHaveBeenCalledWith({
        data: {
          name: 'Review',
          teamId: 'team-123',
          category: 'started',
        },
      });
    });

    it('should create status with all optional fields', async () => {
      vi.mocked(prisma.status.create).mockResolvedValue({ id: 'status-123' } as any);

      await createStatus({
        name: 'Custom Status',
        teamId: 'team-123',
        category: 'unstarted',
        color: '#FF5733',
        position: 5,
      });

      expect(prisma.status.create).toHaveBeenCalledWith({
        data: {
          name: 'Custom Status',
          teamId: 'team-123',
          category: 'unstarted',
          color: '#FF5733',
          position: 5,
        },
      });
    });

    it('should trim whitespace from name and color', async () => {
      vi.mocked(prisma.status.create).mockResolvedValue({ id: 'status-123' } as any);

      await createStatus({
        name: '  Trimmed Name  ',
        teamId: 'team-123',
        category: 'backlog',
        color: '  #FFF  ',
      });

      expect(prisma.status.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Trimmed Name',
          color: '#FFF',
        }),
      });
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(createStatus({ name: '', teamId: 'team-123', category: 'backlog' }))
        .rejects.toThrow(ValidationError);
      await expect(createStatus({ name: '  ', teamId: 'team-123', category: 'backlog' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when teamId is empty', async () => {
      await expect(createStatus({ name: 'Test', teamId: '', category: 'backlog' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when category is empty', async () => {
      await expect(createStatus({ name: 'Test', teamId: 'team-123', category: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid category', async () => {
      await expect(createStatus({ name: 'Test', teamId: 'team-123', category: 'invalid' }))
        .rejects.toThrow(ValidationError);
    });

    it('should validate all category values', async () => {
      const validCategories = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];

      for (const category of validCategories) {
        vi.mocked(prisma.status.create).mockResolvedValue({ id: 'status-123' } as any);

        await expect(createStatus({
          name: 'Test',
          teamId: 'team-123',
          category,
        })).resolves.not.toThrow();
      }
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(createStatus({
        name: 'Test',
        teamId: 'nonexistent',
        category: 'backlog',
      })).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError on duplicate name in team', async () => {
      vi.mocked(prisma.status.create).mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(createStatus({
        name: 'Duplicate',
        teamId: 'team-123',
        category: 'backlog',
      })).rejects.toThrow(ConflictError);
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'status-123',
        name: 'Original',
        category: 'backlog',
      } as any);
    });

    it('should update status name', async () => {
      vi.mocked(prisma.status.update).mockResolvedValue({
        id: 'status-123',
        name: 'Updated Name',
      } as any);

      const result = await updateStatus('status-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.status.update).toHaveBeenCalledWith({
        where: { id: 'status-123' },
        data: { name: 'Updated Name' },
      });
    });

    it('should update status category', async () => {
      vi.mocked(prisma.status.update).mockResolvedValue({
        id: 'status-123',
        category: 'started',
      } as any);

      await updateStatus('status-123', { category: 'started' });

      expect(prisma.status.update).toHaveBeenCalledWith({
        where: { id: 'status-123' },
        data: { category: 'started' },
      });
    });

    it('should update status position', async () => {
      vi.mocked(prisma.status.update).mockResolvedValue({
        id: 'status-123',
        position: 10,
      } as any);

      await updateStatus('status-123', { position: 10 });

      expect(prisma.status.update).toHaveBeenCalledWith({
        where: { id: 'status-123' },
        data: { position: 10 },
      });
    });

    it('should update multiple fields', async () => {
      vi.mocked(prisma.status.update).mockResolvedValue({ id: 'status-123' } as any);

      await updateStatus('status-123', {
        name: 'New Name',
        category: 'completed',
        color: '#00FF00',
        position: 5,
      });

      expect(prisma.status.update).toHaveBeenCalledWith({
        where: { id: 'status-123' },
        data: {
          name: 'New Name',
          category: 'completed',
          color: '#00FF00',
          position: 5,
        },
      });
    });

    it('should throw NotFoundError when status does not exist', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      await expect(updateStatus('nonexistent', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(updateStatus('status-123', { name: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when category is empty', async () => {
      await expect(updateStatus('status-123', { category: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid category', async () => {
      await expect(updateStatus('status-123', { category: 'invalid' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError on duplicate name in team', async () => {
      vi.mocked(prisma.status.update).mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(updateStatus('status-123', { name: 'Duplicate' }))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('deleteStatus', () => {
    it('should delete status when not in use', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'status-123',
        _count: { features: 0, tasks: 0 },
      } as any);
      vi.mocked(prisma.status.delete).mockResolvedValue({ id: 'status-123' } as any);

      await deleteStatus('status-123');

      expect(prisma.status.delete).toHaveBeenCalledWith({
        where: { id: 'status-123' },
      });
    });

    it('should throw NotFoundError when status does not exist', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      await expect(deleteStatus('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when status is used by features', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'status-123',
        _count: { features: 5, tasks: 0 },
      } as any);

      await expect(deleteStatus('status-123'))
        .rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when status is used by tasks', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'status-123',
        _count: { features: 0, tasks: 3 },
      } as any);

      await expect(deleteStatus('status-123'))
        .rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when status is used by both', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({
        id: 'status-123',
        _count: { features: 2, tasks: 4 },
      } as any);

      await expect(deleteStatus('status-123'))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('resolveStatusToId', () => {
    it('should return ID for valid UUID that exists', async () => {
      const uuid = '12345678-1234-4234-8234-123456789012';
      vi.mocked(prisma.status.findUnique).mockResolvedValue({ id: uuid } as any);

      const result = await resolveStatusToId(uuid);

      expect(result).toBe(uuid);
      expect(prisma.status.findUnique).toHaveBeenCalledWith({
        where: { id: uuid },
        select: { id: true },
      });
    });

    it('should return null for valid UUID that does not exist', async () => {
      const uuid = '12345678-1234-4234-8234-123456789012';
      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);

      const result = await resolveStatusToId(uuid);

      expect(result).toBeNull();
    });

    it('should look up by name when not a UUID', async () => {
      vi.mocked(prisma.status.findFirst).mockResolvedValue({ id: 'status-123' } as any);

      const result = await resolveStatusToId('In Progress');

      expect(result).toBe('status-123');
      expect(prisma.status.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: 'In Progress', mode: 'insensitive' },
        },
        select: { id: true },
      });
    });

    it('should filter by teamId when provided', async () => {
      vi.mocked(prisma.status.findFirst).mockResolvedValue({ id: 'status-123' } as any);

      await resolveStatusToId('Done', 'team-123');

      expect(prisma.status.findFirst).toHaveBeenCalledWith({
        where: {
          name: { equals: 'Done', mode: 'insensitive' },
          teamId: 'team-123',
        },
        select: { id: true },
      });
    });

    it('should return null when name not found', async () => {
      vi.mocked(prisma.status.findFirst).mockResolvedValue(null);

      const result = await resolveStatusToId('Nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('resolveStatusesToIds', () => {
    it('should resolve single status string', async () => {
      vi.mocked(prisma.status.findFirst).mockResolvedValue({ id: 'status-1' } as any);

      const result = await resolveStatusesToIds('Todo');

      expect(result).toEqual(['status-1']);
    });

    it('should resolve array of status strings', async () => {
      vi.mocked(prisma.status.findFirst)
        .mockResolvedValueOnce({ id: 'status-1' } as any)
        .mockResolvedValueOnce({ id: 'status-2' } as any);

      const result = await resolveStatusesToIds(['Todo', 'Done']);

      expect(result).toEqual(['status-1', 'status-2']);
    });

    it('should filter out not found statuses', async () => {
      vi.mocked(prisma.status.findFirst)
        .mockResolvedValueOnce({ id: 'status-1' } as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'status-3' } as any);

      const result = await resolveStatusesToIds(['Todo', 'Nonexistent', 'Done']);

      expect(result).toEqual(['status-1', 'status-3']);
    });

    it('should remove duplicates', async () => {
      vi.mocked(prisma.status.findFirst)
        .mockResolvedValueOnce({ id: 'status-1' } as any)
        .mockResolvedValueOnce({ id: 'status-1' } as any); // same ID

      const result = await resolveStatusesToIds(['Todo', 'todo']); // case difference

      expect(result).toEqual(['status-1']);
    });

    it('should pass teamId to resolution', async () => {
      vi.mocked(prisma.status.findFirst).mockResolvedValue({ id: 'status-1' } as any);

      await resolveStatusesToIds('Todo', 'team-123');

      expect(prisma.status.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          teamId: 'team-123',
        }),
        select: { id: true },
      });
    });
  });

  describe('getStatusIdsByCategory', () => {
    it('should return status IDs for valid category', async () => {
      vi.mocked(prisma.status.findMany).mockResolvedValue([
        { id: 'status-1' },
        { id: 'status-2' },
      ] as any);

      const result = await getStatusIdsByCategory('started');

      expect(result).toEqual(['status-1', 'status-2']);
      expect(prisma.status.findMany).toHaveBeenCalledWith({
        where: { category: 'started' },
        select: { id: true },
      });
    });

    it('should return empty array for invalid category', async () => {
      const result = await getStatusIdsByCategory('invalid');

      expect(result).toEqual([]);
      expect(prisma.status.findMany).not.toHaveBeenCalled();
    });

    it('should filter by teamId when provided', async () => {
      vi.mocked(prisma.status.findMany).mockResolvedValue([]);

      await getStatusIdsByCategory('completed', 'team-123');

      expect(prisma.status.findMany).toHaveBeenCalledWith({
        where: { category: 'completed', teamId: 'team-123' },
        select: { id: true },
      });
    });

    it('should validate all category values', async () => {
      vi.mocked(prisma.status.findMany).mockResolvedValue([]);

      const validCategories = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];
      for (const category of validCategories) {
        await getStatusIdsByCategory(category);
        expect(prisma.status.findMany).toHaveBeenLastCalledWith({
          where: { category },
          select: { id: true },
        });
      }
    });
  });

  describe('createDefaultStatuses', () => {
    it('should create 5 default statuses in transaction', async () => {
      const mockStatuses = [
        { id: 's1', name: 'Backlog', category: 'backlog', position: 0 },
        { id: 's2', name: 'Todo', category: 'unstarted', position: 1 },
        { id: 's3', name: 'In Progress', category: 'started', position: 2 },
        { id: 's4', name: 'Done', category: 'completed', position: 3 },
        { id: 's5', name: 'Canceled', category: 'canceled', position: 4 },
      ];

      const mockTx = {
        status: {
          create: vi.fn()
            .mockResolvedValueOnce(mockStatuses[0])
            .mockResolvedValueOnce(mockStatuses[1])
            .mockResolvedValueOnce(mockStatuses[2])
            .mockResolvedValueOnce(mockStatuses[3])
            .mockResolvedValueOnce(mockStatuses[4]),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await createDefaultStatuses('team-123');

      expect(result).toEqual(mockStatuses);
      expect(mockTx.status.create).toHaveBeenCalledTimes(5);
    });

    it('should create statuses with correct order', async () => {
      const createCalls: any[] = [];
      const mockTx = {
        status: {
          create: vi.fn().mockImplementation(({ data }) => {
            createCalls.push(data);
            return { id: `s-${createCalls.length}`, ...data };
          }),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await createDefaultStatuses('team-123');

      expect(createCalls[0]).toMatchObject({ name: 'Backlog', position: 0 });
      expect(createCalls[1]).toMatchObject({ name: 'Todo', position: 1 });
      expect(createCalls[2]).toMatchObject({ name: 'In Progress', position: 2 });
      expect(createCalls[3]).toMatchObject({ name: 'Done', position: 3 });
      expect(createCalls[4]).toMatchObject({ name: 'Canceled', position: 4 });
    });

    it('should associate all statuses with the team', async () => {
      const createCalls: any[] = [];
      const mockTx = {
        status: {
          create: vi.fn().mockImplementation(({ data }) => {
            createCalls.push(data);
            return { id: `s-${createCalls.length}`, ...data };
          }),
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await createDefaultStatuses('team-xyz');

      for (const call of createCalls) {
        expect(call.teamId).toBe('team-xyz');
      }
    });
  });

  describe('status ordering', () => {
    it('should list statuses in position order', async () => {
      const mockStatuses = [
        { id: 's1', position: 0 },
        { id: 's2', position: 1 },
        { id: 's3', position: 2 },
      ];
      vi.mocked(prisma.status.findMany).mockResolvedValue(mockStatuses as any);

      await listStatuses();

      expect(prisma.status.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { position: 'asc' },
        })
      );
    });

    it('should allow updating position', async () => {
      vi.mocked(prisma.status.findUnique).mockResolvedValue({ id: 'status-123' } as any);
      vi.mocked(prisma.status.update).mockResolvedValue({ id: 'status-123', position: 99 } as any);

      const result = await updateStatus('status-123', { position: 99 });

      expect(result.position).toBe(99);
    });
  });
});
