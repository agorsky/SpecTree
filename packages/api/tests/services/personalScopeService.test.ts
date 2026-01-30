import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    personalScope: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    status: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  getPersonalScopeById,
  getPersonalScopeByUserId,
  getPersonalScope,
  userHasPersonalScope,
  createPersonalScope,
  createDefaultStatuses,
  getDefaultBacklogStatus,
  isProjectInPersonalScope,
  isPersonalScopeOwner,
} from '../../src/services/personalScopeService.js';
import { NotFoundError, ConflictError } from '../../src/errors/index.js';

describe('personalScopeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPersonalScopeById', () => {
    it('should return personal scope with counts when found', async () => {
      const mockScope = {
        id: 'scope-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { projects: 5, statuses: 4 },
      };
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(mockScope as any);

      const result = await getPersonalScopeById('scope-123');

      expect(result).toEqual(mockScope);
      expect(prisma.personalScope.findUnique).toHaveBeenCalledWith({
        where: { id: 'scope-123' },
        include: { _count: { select: { projects: true, statuses: true } } },
      });
    });

    it('should return null when not found', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);

      const result = await getPersonalScopeById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPersonalScopeByUserId', () => {
    it('should return personal scope by user ID', async () => {
      const mockScope = {
        id: 'scope-123',
        userId: 'user-123',
        _count: { projects: 3, statuses: 5 },
      };
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(mockScope as any);

      const result = await getPersonalScopeByUserId('user-123');

      expect(result).toEqual(mockScope);
      expect(prisma.personalScope.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { _count: { select: { projects: true, statuses: true } } },
      });
    });

    it('should return null when user has no personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);

      const result = await getPersonalScopeByUserId('user-without-scope');

      expect(result).toBeNull();
    });
  });

  describe('getPersonalScope', () => {
    it('should be an alias for getPersonalScopeByUserId', async () => {
      const mockScope = {
        id: 'scope-123',
        userId: 'user-123',
        _count: { projects: 2, statuses: 5 },
      };
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(mockScope as any);

      const result = await getPersonalScope('user-123');

      expect(result).toEqual(mockScope);
      expect(prisma.personalScope.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { _count: { select: { projects: true, statuses: true } } },
      });
    });
  });

  describe('userHasPersonalScope', () => {
    it('should return true when user has a personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-123' } as any);

      const result = await userHasPersonalScope('user-123');

      expect(result).toBe(true);
      expect(prisma.personalScope.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: { id: true },
      });
    });

    it('should return false when user has no personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);

      const result = await userHasPersonalScope('user-123');

      expect(result).toBe(false);
    });
  });

  describe('createPersonalScope', () => {
    it('should create personal scope with default statuses', async () => {
      const mockUser = { id: 'user-123' };
      const mockScope = { id: 'scope-123', userId: 'user-123' };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null); // No existing scope
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const txMock = {
          personalScope: {
            create: vi.fn().mockResolvedValue(mockScope),
          },
          status: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });

      const result = await createPersonalScope('user-123');

      expect(result).toEqual(mockScope);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { id: true },
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(createPersonalScope('nonexistent-user')).rejects.toThrow(NotFoundError);
      await expect(createPersonalScope('nonexistent-user')).rejects.toThrow(
        "User with id 'nonexistent-user' not found"
      );
    });

    it('should throw ConflictError when user already has a personal scope', async () => {
      const mockUser = { id: 'user-123' };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'existing-scope' } as any);

      await expect(createPersonalScope('user-123')).rejects.toThrow(ConflictError);
      await expect(createPersonalScope('user-123')).rejects.toThrow(
        'User already has a PersonalScope'
      );
    });
  });

  describe('createDefaultStatuses', () => {
    it('should create default statuses for existing personal scope', async () => {
      const mockScope = { id: 'scope-123' };
      const mockStatuses = [
        { id: 'status-1', name: 'Backlog', category: 'backlog', position: 0 },
        { id: 'status-2', name: 'Todo', category: 'unstarted', position: 1 },
        { id: 'status-3', name: 'In Progress', category: 'started', position: 2 },
        { id: 'status-4', name: 'Done', category: 'completed', position: 3 },
        { id: 'status-5', name: 'Canceled', category: 'canceled', position: 4 },
      ];

      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(mockScope as any);

      let statusIndex = 0;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const txMock = {
          status: {
            create: vi.fn().mockImplementation(() => {
              return Promise.resolve(mockStatuses[statusIndex++]);
            }),
          },
        };
        return callback(txMock);
      });

      const result = await createDefaultStatuses('scope-123');

      expect(result).toHaveLength(5);
      expect(prisma.personalScope.findUnique).toHaveBeenCalledWith({
        where: { id: 'scope-123' },
        select: { id: true },
      });
    });

    it('should throw NotFoundError when personal scope does not exist', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);

      await expect(createDefaultStatuses('nonexistent-scope')).rejects.toThrow(NotFoundError);
      await expect(createDefaultStatuses('nonexistent-scope')).rejects.toThrow(
        "PersonalScope with id 'nonexistent-scope' not found"
      );
    });
  });

  describe('getDefaultBacklogStatus', () => {
    it('should return backlog status for personal scope', async () => {
      const mockStatus = {
        id: 'status-123',
        name: 'Backlog',
        category: 'backlog',
        position: 0,
        personalScopeId: 'scope-123',
      };
      vi.mocked(prisma.status.findFirst).mockResolvedValue(mockStatus as any);

      const result = await getDefaultBacklogStatus('scope-123');

      expect(result).toEqual(mockStatus);
      expect(prisma.status.findFirst).toHaveBeenCalledWith({
        where: {
          personalScopeId: 'scope-123',
          category: 'backlog',
        },
        orderBy: { position: 'asc' },
      });
    });

    it('should return null when no backlog status exists', async () => {
      vi.mocked(prisma.status.findFirst).mockResolvedValue(null);

      const result = await getDefaultBacklogStatus('scope-123');

      expect(result).toBeNull();
    });
  });

  describe('isProjectInPersonalScope', () => {
    it('should return true when project belongs to user personal scope', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'project-123' } as any);

      const result = await isProjectInPersonalScope('project-123', 'user-123');

      expect(result).toBe(true);
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'project-123',
          personalScope: { userId: 'user-123' },
        },
        select: { id: true },
      });
    });

    it('should return false when project does not belong to user personal scope', async () => {
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      const result = await isProjectInPersonalScope('project-123', 'user-456');

      expect(result).toBe(false);
    });
  });

  describe('isPersonalScopeOwner', () => {
    it('should return true when user owns the personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'user-123' } as any);

      const result = await isPersonalScopeOwner('scope-123', 'user-123');

      expect(result).toBe(true);
      expect(prisma.personalScope.findUnique).toHaveBeenCalledWith({
        where: { id: 'scope-123' },
        select: { userId: true },
      });
    });

    it('should return false when user does not own the personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ userId: 'user-456' } as any);

      const result = await isPersonalScopeOwner('scope-123', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false when personal scope does not exist', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);

      const result = await isPersonalScopeOwner('nonexistent', 'user-123');

      expect(result).toBe(false);
    });
  });
});
