import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    membership: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  listTeamMembers,
  addMemberToTeam,
  updateMemberRole,
  removeMemberFromTeam,
  listUserTeams,
  isValidRole,
  VALID_ROLES,
  isLastAdmin,
  getTeamsWhereUserIsLastAdmin,
} from '../../src/services/membershipService.js';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../../src/errors/index.js';

describe('membershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidRole', () => {
    it('should return true for valid roles', () => {
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('member')).toBe(true);
      expect(isValidRole('guest')).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(isValidRole('invalid')).toBe(false);
      expect(isValidRole('')).toBe(false);
      expect(isValidRole('Admin')).toBe(false); // case sensitive
      expect(isValidRole('owner')).toBe(false);
    });
  });

  describe('VALID_ROLES', () => {
    it('should contain expected roles', () => {
      expect(VALID_ROLES).toContain('admin');
      expect(VALID_ROLES).toContain('member');
      expect(VALID_ROLES).toContain('guest');
      expect(VALID_ROLES).toHaveLength(3);
    });
  });

  describe('listTeamMembers', () => {
    beforeEach(() => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: false,
      } as any);
    });

    it('should return team members with user info', async () => {
      const mockMemberships = [
        {
          id: 'mem-1',
          role: 'admin',
          createdAt: new Date(),
          user: { id: 'user-1', email: 'admin@test.com', name: 'Admin User', avatarUrl: null },
        },
        {
          id: 'mem-2',
          role: 'member',
          createdAt: new Date(),
          user: { id: 'user-2', email: 'member@test.com', name: 'Member User', avatarUrl: null },
        },
      ];
      vi.mocked(prisma.membership.findMany).mockResolvedValue(mockMemberships as any);

      const result = await listTeamMembers('team-123');

      expect(result).toEqual(mockMemberships);
      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(listTeamMembers('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when team is archived', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: true,
      } as any);

      await expect(listTeamMembers('team-123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('addMemberToTeam', () => {
    beforeEach(() => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        isActive: true,
      } as any);
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    });

    it('should add member with default role', async () => {
      const mockMembership = {
        id: 'mem-123',
        userId: 'user-123',
        teamId: 'team-123',
        role: 'member',
      };
      vi.mocked(prisma.membership.create).mockResolvedValue(mockMembership as any);

      const result = await addMemberToTeam('team-123', { userId: 'user-123' });

      expect(result).toEqual(mockMembership);
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          teamId: 'team-123',
        },
      });
    });

    it('should add member with specified role', async () => {
      vi.mocked(prisma.membership.create).mockResolvedValue({ id: 'mem-123' } as any);

      await addMemberToTeam('team-123', { userId: 'user-123', role: 'admin' });

      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          teamId: 'team-123',
          role: 'admin',
        },
      });
    });

    it('should throw ValidationError for invalid role', async () => {
      await expect(addMemberToTeam('team-123', { userId: 'user-123', role: 'invalid' as any }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(addMemberToTeam('nonexistent', { userId: 'user-123' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when team is archived', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: true,
      } as any);

      await expect(addMemberToTeam('team-123', { userId: 'user-123' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(addMemberToTeam('team-123', { userId: 'nonexistent' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        isActive: false,
      } as any);

      await expect(addMemberToTeam('team-123', { userId: 'user-123' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when membership already exists', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: 'existing-mem',
        userId: 'user-123',
        teamId: 'team-123',
      } as any);

      await expect(addMemberToTeam('team-123', { userId: 'user-123' }))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('updateMemberRole', () => {
    beforeEach(() => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: 'mem-123',
        userId: 'user-123',
        teamId: 'team-123',
        role: 'member',
      } as any);
    });

    it('should update member role', async () => {
      const updatedMembership = {
        id: 'mem-123',
        role: 'admin',
      };
      vi.mocked(prisma.membership.update).mockResolvedValue(updatedMembership as any);

      const result = await updateMemberRole('team-123', 'user-123', { role: 'admin' });

      expect(result.role).toBe('admin');
      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { id: 'mem-123' },
        data: { role: 'admin' },
      });
    });

    it('should throw ValidationError for invalid role', async () => {
      await expect(updateMemberRole('team-123', 'user-123', { role: 'invalid' as any }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(updateMemberRole('nonexistent', 'user-123', { role: 'admin' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when membership does not exist', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      await expect(updateMemberRole('team-123', 'nonexistent', { role: 'admin' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should update from admin to member', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: 'mem-123',
        role: 'admin',
      } as any);
      vi.mocked(prisma.membership.update).mockResolvedValue({ id: 'mem-123', role: 'member' } as any);

      const result = await updateMemberRole('team-123', 'user-123', { role: 'member' });

      expect(result.role).toBe('member');
    });

    it('should update from member to guest', async () => {
      vi.mocked(prisma.membership.update).mockResolvedValue({ id: 'mem-123', role: 'guest' } as any);

      const result = await updateMemberRole('team-123', 'user-123', { role: 'guest' });

      expect(result.role).toBe('guest');
    });
  });

  describe('removeMemberFromTeam', () => {
    beforeEach(() => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: 'team-123',
        isArchived: false,
      } as any);
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: 'mem-123',
        userId: 'user-123',
        teamId: 'team-123',
      } as any);
    });

    it('should remove member from team', async () => {
      vi.mocked(prisma.membership.delete).mockResolvedValue({ id: 'mem-123' } as any);

      await removeMemberFromTeam('team-123', 'user-123');

      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: { id: 'mem-123' },
      });
    });

    it('should throw NotFoundError when team does not exist', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(removeMemberFromTeam('nonexistent', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when membership does not exist', async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      await expect(removeMemberFromTeam('team-123', 'nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('listUserTeams', () => {
    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        isActive: true,
      } as any);
    });

    it('should return teams with membership info', async () => {
      const mockMemberships = [
        {
          id: 'mem-1',
          role: 'admin',
          createdAt: new Date(),
          team: {
            id: 'team-1',
            name: 'Team Alpha',
            key: 'ALPHA',
            description: null,
            icon: null,
            color: null,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'mem-2',
          role: 'member',
          createdAt: new Date(),
          team: {
            id: 'team-2',
            name: 'Team Beta',
            key: 'BETA',
            description: 'Beta team',
            icon: 'icon',
            color: '#FF0000',
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];
      vi.mocked(prisma.membership.findMany).mockResolvedValue(mockMemberships as any);

      const result = await listUserTeams('user-123');

      expect(result).toEqual(mockMemberships);
      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          team: {
            isArchived: false,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          createdAt: true,
          team: {
            select: {
              id: true,
              name: true,
              key: true,
              description: true,
              icon: true,
              color: true,
              isArchived: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
    });

    it('should exclude archived teams', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      await listUserTeams('user-123');

      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            team: { isArchived: false },
          }),
        })
      );
    });

    it('should throw NotFoundError when user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(listUserTeams('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        isActive: false,
      } as any);

      await expect(listUserTeams('user-123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('team membership validation', () => {
    it('should validate team exists before adding member', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: true } as any);

      await expect(addMemberToTeam('team-123', { userId: 'user-123' }))
        .rejects.toThrow(NotFoundError);

      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        select: { id: true, isArchived: true },
      });
    });

    it('should validate user exists before adding member', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123', isArchived: false } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(addMemberToTeam('team-123', { userId: 'user-123' }))
        .rejects.toThrow(NotFoundError);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { id: true, isActive: true },
      });
    });

    it('should check for existing membership before adding', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123', isArchived: false } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-123', isActive: true } as any);
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'existing' } as any);

      await expect(addMemberToTeam('team-123', { userId: 'user-123' }))
        .rejects.toThrow(ConflictError);

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_teamId: {
            userId: 'user-123',
            teamId: 'team-123',
          },
        },
      });
    });
  });

  describe('role management', () => {
    it('should allow all valid role transitions', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-123', isArchived: false } as any);
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'mem-123', role: 'member' } as any);
      vi.mocked(prisma.membership.update).mockImplementation(async ({ data }) => ({
        id: 'mem-123',
        role: (data as any).role,
      } as any));

      // member -> admin
      let result = await updateMemberRole('team-123', 'user-123', { role: 'admin' });
      expect(result.role).toBe('admin');

      // member -> guest
      result = await updateMemberRole('team-123', 'user-123', { role: 'guest' });
      expect(result.role).toBe('guest');

      // admin -> member (set mock) - needs count mock for guardrail
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'mem-123', role: 'admin' } as any);
      vi.mocked(prisma.membership.count).mockResolvedValue(2); // Not the last admin
      result = await updateMemberRole('team-123', 'user-123', { role: 'member' });
      expect(result.role).toBe('member');

      // guest -> admin (set mock)
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({ id: 'mem-123', role: 'guest' } as any);
      result = await updateMemberRole('team-123', 'user-123', { role: 'admin' });
      expect(result.role).toBe('admin');
    });
  });

  describe('isLastAdmin', () => {
    it('should return true when user is the only admin', async () => {
      vi.mocked(prisma.membership.count).mockResolvedValue(1);
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: 'mem-123',
        userId: 'user-123',
        teamId: 'team-123',
        role: 'admin',
      } as any);

      const result = await isLastAdmin('team-123', 'user-123');
      expect(result).toBe(true);
    });

    it('should return false when there are multiple admins', async () => {
      vi.mocked(prisma.membership.count).mockResolvedValue(2);

      const result = await isLastAdmin('team-123', 'user-123');
      expect(result).toBe(false);
    });

    it('should return false when user is not an admin', async () => {
      vi.mocked(prisma.membership.count).mockResolvedValue(1);
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: 'mem-123',
        role: 'member',
      } as any);

      const result = await isLastAdmin('team-123', 'user-123');
      expect(result).toBe(false);
    });

    it('should return false when there are no admins at all', async () => {
      vi.mocked(prisma.membership.count).mockResolvedValue(0);

      const result = await isLastAdmin('team-123', 'user-123');
      expect(result).toBe(false);
    });
  });

  describe('getTeamsWhereUserIsLastAdmin', () => {
    it('should return empty array when user is not admin of any team', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      const result = await getTeamsWhereUserIsLastAdmin('user-123');
      expect(result).toEqual([]);
    });

    it('should return team IDs where user is the last admin', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        { teamId: 'team-1' },
        { teamId: 'team-2' },
      ] as any);
      vi.mocked(prisma.membership.count)
        .mockResolvedValueOnce(1) // team-1: only one admin (user)
        .mockResolvedValueOnce(2); // team-2: two admins

      const result = await getTeamsWhereUserIsLastAdmin('user-123');
      expect(result).toEqual(['team-1']);
    });

    it('should return multiple team IDs when user is last admin of multiple teams', async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        { teamId: 'team-1' },
        { teamId: 'team-2' },
        { teamId: 'team-3' },
      ] as any);
      vi.mocked(prisma.membership.count)
        .mockResolvedValueOnce(1) // team-1: only one admin
        .mockResolvedValueOnce(1) // team-2: only one admin
        .mockResolvedValueOnce(3); // team-3: three admins

      const result = await getTeamsWhereUserIsLastAdmin('user-123');
      expect(result).toEqual(['team-1', 'team-2']);
    });
  });

  describe('last-admin guardrails', () => {
    describe('updateMemberRole guardrail', () => {
      beforeEach(() => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue({
          id: 'team-123',
          isArchived: false,
        } as any);
      });

      it('should throw ForbiddenError when demoting the last admin', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          userId: 'user-123',
          teamId: 'team-123',
          role: 'admin',
        } as any);
        vi.mocked(prisma.membership.count).mockResolvedValue(1); // Only one admin

        await expect(updateMemberRole('team-123', 'user-123', { role: 'member' }))
          .rejects.toThrow(ForbiddenError);
        
        await expect(updateMemberRole('team-123', 'user-123', { role: 'member' }))
          .rejects.toThrow('Cannot demote the last admin');
      });

      it('should allow demoting admin when there are multiple admins', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          role: 'admin',
        } as any);
        vi.mocked(prisma.membership.count).mockResolvedValue(2); // Multiple admins
        vi.mocked(prisma.membership.update).mockResolvedValue({
          id: 'mem-123',
          role: 'member',
        } as any);

        const result = await updateMemberRole('team-123', 'user-123', { role: 'member' });
        expect(result.role).toBe('member');
      });

      it('should allow promoting to admin regardless of current admin count', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          role: 'member',
        } as any);
        vi.mocked(prisma.membership.update).mockResolvedValue({
          id: 'mem-123',
          role: 'admin',
        } as any);

        const result = await updateMemberRole('team-123', 'user-123', { role: 'admin' });
        expect(result.role).toBe('admin');
        // count should not have been called since we're promoting, not demoting
      });

      it('should allow changing role from member to guest (not demotion from admin)', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          role: 'member',
        } as any);
        vi.mocked(prisma.membership.update).mockResolvedValue({
          id: 'mem-123',
          role: 'guest',
        } as any);

        const result = await updateMemberRole('team-123', 'user-123', { role: 'guest' });
        expect(result.role).toBe('guest');
      });
    });

    describe('removeMemberFromTeam guardrail', () => {
      beforeEach(() => {
        vi.mocked(prisma.team.findUnique).mockResolvedValue({
          id: 'team-123',
          isArchived: false,
        } as any);
      });

      it('should throw ForbiddenError when removing the last admin', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          userId: 'user-123',
          teamId: 'team-123',
          role: 'admin',
        } as any);
        vi.mocked(prisma.membership.count).mockResolvedValue(1); // Only one admin

        await expect(removeMemberFromTeam('team-123', 'user-123'))
          .rejects.toThrow(ForbiddenError);
        
        await expect(removeMemberFromTeam('team-123', 'user-123'))
          .rejects.toThrow('Cannot remove the last admin');
      });

      it('should allow removing admin when there are multiple admins', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          role: 'admin',
        } as any);
        vi.mocked(prisma.membership.count).mockResolvedValue(2); // Multiple admins
        vi.mocked(prisma.membership.delete).mockResolvedValue({ id: 'mem-123' } as any);

        await removeMemberFromTeam('team-123', 'user-123');
        expect(prisma.membership.delete).toHaveBeenCalledWith({
          where: { id: 'mem-123' },
        });
      });

      it('should allow removing non-admin members regardless of admin count', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          role: 'member',
        } as any);
        vi.mocked(prisma.membership.delete).mockResolvedValue({ id: 'mem-123' } as any);

        await removeMemberFromTeam('team-123', 'user-123');
        expect(prisma.membership.delete).toHaveBeenCalled();
        // count should not be called since user is not an admin
      });

      it('should allow removing guest regardless of admin count', async () => {
        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          id: 'mem-123',
          role: 'guest',
        } as any);
        vi.mocked(prisma.membership.delete).mockResolvedValue({ id: 'mem-123' } as any);

        await removeMemberFromTeam('team-123', 'user-123');
        expect(prisma.membership.delete).toHaveBeenCalled();
      });
    });
  });
});
