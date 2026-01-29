import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
}));

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import bcrypt from 'bcrypt';
import { prisma } from '../../src/lib/db.js';
import {
  getUsers,
  getUserById,
  getCurrentUser,
  getUserByEmail,
  emailExists,
  createUser,
  updateUser,
  softDeleteUser,
  getUserByEmailWithPassword,
} from '../../src/services/userService.js';

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should return paginated users with default pagination', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@test.com', name: 'User 1' },
        { id: 'user-2', email: 'user2@test.com', name: 'User 2' },
      ];
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
      vi.mocked(prisma.user.count).mockResolvedValue(2);

      const result = await getUsers();

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          passwordHash: false,
        }),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle custom pagination params', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(50);

      const result = await getUsers({ page: 3, limit: 10 });

      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('should clamp page to minimum of 1', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await getUsers({ page: -5 });

      expect(result.pagination.page).toBe(1);
    });

    it('should clamp limit to range [1, 100]', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await getUsers({ limit: 0 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 })
      );

      vi.clearAllMocks();
      await getUsers({ limit: 200 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@test.com',
        name: 'Test User',
        isActive: true,
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.objectContaining({
          id: true,
          email: true,
          passwordHash: false,
        }),
      });
    });

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return first active user', async () => {
      const mockUser = { id: 'user-1', isActive: true };
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        select: expect.objectContaining({ id: true, passwordHash: false }),
      });
    });

    it('should return null when no active user exists', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found by email', async () => {
      const mockUser = { id: 'user-123', email: 'test@test.com' };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await getUserByEmail('test@test.com');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        select: expect.objectContaining({ email: true, passwordHash: false }),
      });
    });

    it('should return null when email not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await getUserByEmail('nonexistent@test.com');

      expect(result).toBeNull();
    });
  });

  describe('emailExists', () => {
    it('should return false when email does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await emailExists('new@test.com');

      expect(result).toBe(false);
    });

    it('should return true when email exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123' } as any);

      const result = await emailExists('existing@test.com');

      expect(result).toBe(true);
    });

    it('should return false when email belongs to excluded user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123' } as any);

      const result = await emailExists('existing@test.com', 'user-123');

      expect(result).toBe(false);
    });

    it('should return true when email exists and excludeId is different', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123' } as any);

      const result = await emailExists('existing@test.com', 'user-456');

      expect(result).toBe(true);
    });
  });

  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'new@test.com',
        name: 'New User',
      };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const result = await createUser({
        email: 'new@test.com',
        name: 'New User',
        password: 'secret123',
      });

      expect(result).toEqual(mockUser);
      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@test.com',
          name: 'New User',
          passwordHash: 'hashed-password',
          avatarUrl: null,
        },
        select: expect.objectContaining({ id: true, passwordHash: false }),
      });
    });

    it('should create user with avatar URL', async () => {
      const mockUser = { id: 'user-123' };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      await createUser({
        email: 'new@test.com',
        name: 'New User',
        password: 'secret123',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          avatarUrl: 'https://example.com/avatar.png',
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('updateUser', () => {
    it('should update user email', async () => {
      const updatedUser = { id: 'user-123', email: 'updated@test.com' };
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const result = await updateUser('user-123', { email: 'updated@test.com' });

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { email: 'updated@test.com' },
        select: expect.any(Object),
      });
    });

    it('should update user name', async () => {
      const updatedUser = { id: 'user-123', name: 'Updated Name' };
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const result = await updateUser('user-123', { name: 'Updated Name' });

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { name: 'Updated Name' },
        select: expect.any(Object),
      });
    });

    it('should hash new password when updating', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-123' } as any);

      await updateUser('user-123', { password: 'newpassword' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: 'hashed-password' },
        select: expect.any(Object),
      });
    });

    it('should update isActive status', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-123', isActive: false } as any);

      const result = await updateUser('user-123', { isActive: false });

      expect(result?.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });

    it('should update avatar URL', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-123' } as any);

      await updateUser('user-123', { avatarUrl: 'https://new-avatar.com/img.png' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { avatarUrl: 'https://new-avatar.com/img.png' },
        select: expect.any(Object),
      });
    });

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error('Record not found'));

      const result = await updateUser('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should handle multiple field updates', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-123' } as any);

      await updateUser('user-123', {
        name: 'New Name',
        email: 'new@test.com',
        avatarUrl: null,
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          name: 'New Name',
          email: 'new@test.com',
          avatarUrl: null,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('softDeleteUser', () => {
    it('should set isActive to false', async () => {
      const deactivatedUser = { id: 'user-123', isActive: false };
      vi.mocked(prisma.user.update).mockResolvedValue(deactivatedUser as any);

      const result = await softDeleteUser('user-123');

      expect(result).toEqual(deactivatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error('Record not found'));

      const result = await softDeleteUser('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmailWithPassword', () => {
    it('should return user with password hash', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@test.com',
        name: 'Test User',
        avatarUrl: null,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        passwordHash: 'hashed-password',
        memberships: [
          { teamId: 'team-123', role: 'MEMBER' },
        ],
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await getUserByEmailWithPassword('test@test.com');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@test.com',
        name: 'Test User',
        avatarUrl: null,
        isActive: true,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        passwordHash: 'hashed-password',
        teamId: 'team-123',
        role: 'MEMBER',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        select: expect.objectContaining({
          id: true,
          passwordHash: true,
        }),
      });
    });

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await getUserByEmailWithPassword('nonexistent@test.com');

      expect(result).toBeNull();
    });
  });
});
