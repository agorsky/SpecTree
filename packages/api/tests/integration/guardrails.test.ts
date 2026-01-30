/**
 * Integration Tests: Last-Admin Guardrails (COM-322)
 *
 * Tests the guardrails that prevent orphaning teams without admins:
 * - Cannot remove last admin from a team
 * - Cannot delete/deactivate user who is last admin of any team
 * - Cannot demote last admin to a non-admin role
 *
 * @see COM-322, COM-278
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import {
  createTestUser,
  createTestTeam,
  createTestMembership,
} from "../fixtures/factories.js";
import {
  removeMemberFromTeam,
  updateMemberRole,
  isLastAdmin,
  getTeamsWhereUserIsLastAdmin,
} from "../../src/services/membershipService.js";
import { softDeleteUser } from "../../src/services/userService.js";
import { ForbiddenError } from "../../src/errors/index.js";
import type { User, Team, Membership } from "../../src/generated/prisma/index.js";

describe("Last-Admin Guardrail Integration Tests", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  beforeAll(async () => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Cannot Remove Last Admin", () => {
    it("should throw ForbiddenError when removing the only admin from a team", async () => {
      const team = await createTestTeam({ name: "Solo Admin Team", key: "SAT" });
      const admin = await createTestUser({ email: "solo@test.com", name: "Solo Admin" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      await expect(removeMemberFromTeam(team.id, admin.id)).rejects.toThrow(ForbiddenError);
    });

    it("should provide clear error message when trying to remove last admin", async () => {
      const team = await createTestTeam({ name: "Error Msg Team", key: "EMT" });
      const admin = await createTestUser({ email: "erroradmin@test.com", name: "Error Admin" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      try {
        await removeMemberFromTeam(team.id, admin.id);
        expect.fail("Should have thrown ForbiddenError");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).message).toContain("last admin");
        expect((error as ForbiddenError).message).toContain("Promote another member");
      }
    });

    it("should allow removing admin when there are multiple admins", async () => {
      const team = await createTestTeam({ name: "Multi Admin Team", key: "MAT" });
      const admin1 = await createTestUser({ email: "admin1@test.com", name: "Admin 1" });
      const admin2 = await createTestUser({ email: "admin2@test.com", name: "Admin 2" });

      await createTestMembership(team.id, admin1.id, { role: "admin" });
      await createTestMembership(team.id, admin2.id, { role: "admin" });

      // Should succeed - admin2 is still there
      await expect(removeMemberFromTeam(team.id, admin1.id)).resolves.not.toThrow();

      // Verify admin1 is removed
      const membership = await prisma.membership.findUnique({
        where: { userId_teamId: { userId: admin1.id, teamId: team.id } },
      });
      expect(membership).toBeNull();
    });

    it("should allow removing non-admin members regardless of admin count", async () => {
      const team = await createTestTeam({ name: "Member Removal Team", key: "MRT" });
      const admin = await createTestUser({ email: "theadmin@test.com", name: "The Admin" });
      const member = await createTestUser({ email: "member@test.com", name: "Regular Member" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      // Should succeed - member is not an admin
      await expect(removeMemberFromTeam(team.id, member.id)).resolves.not.toThrow();
    });

    it("should allow removing guests regardless of admin count", async () => {
      const team = await createTestTeam({ name: "Guest Removal Team", key: "GRT" });
      const admin = await createTestUser({ email: "guestadmin@test.com", name: "Guest Admin" });
      const guest = await createTestUser({ email: "guest@test.com", name: "Guest User" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, guest.id, { role: "guest" });

      // Should succeed - guest is not an admin
      await expect(removeMemberFromTeam(team.id, guest.id)).resolves.not.toThrow();
    });
  });

  describe("Cannot Delete User Who is Last Admin", () => {
    it("should throw ForbiddenError when deleting user who is last admin of a team", async () => {
      const team = await createTestTeam({ name: "Delete Guard Team", key: "DGT" });
      const admin = await createTestUser({ email: "deleteadmin@test.com", name: "Delete Admin" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      await expect(softDeleteUser(admin.id)).rejects.toThrow(ForbiddenError);
    });

    it("should include team name in error message when deleting last admin", async () => {
      const team = await createTestTeam({ name: "Named Team", key: "NMD" });
      const admin = await createTestUser({ email: "namedadmin@test.com", name: "Named Admin" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      try {
        await softDeleteUser(admin.id);
        expect.fail("Should have thrown ForbiddenError");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).message).toContain("Named Team");
      }
    });

    it("should throw ForbiddenError when user is last admin of multiple teams", async () => {
      const team1 = await createTestTeam({ name: "Team One", key: "TO1" });
      const team2 = await createTestTeam({ name: "Team Two", key: "TO2" });
      const admin = await createTestUser({ email: "multiadmin@test.com", name: "Multi Admin" });

      await createTestMembership(team1.id, admin.id, { role: "admin" });
      await createTestMembership(team2.id, admin.id, { role: "admin" });

      try {
        await softDeleteUser(admin.id);
        expect.fail("Should have thrown ForbiddenError");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        // Should mention both teams
        expect((error as ForbiddenError).message).toContain("Team One");
        expect((error as ForbiddenError).message).toContain("Team Two");
      }
    });

    it("should allow deleting user who is not the last admin", async () => {
      const team = await createTestTeam({ name: "Safe Delete Team", key: "SDT" });
      const admin1 = await createTestUser({ email: "safead1@test.com", name: "Safe Admin 1" });
      const admin2 = await createTestUser({ email: "safead2@test.com", name: "Safe Admin 2" });

      await createTestMembership(team.id, admin1.id, { role: "admin" });
      await createTestMembership(team.id, admin2.id, { role: "admin" });

      // Should succeed - admin2 is still there
      const result = await softDeleteUser(admin1.id);
      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(false);
    });

    it("should allow deleting user with no admin roles", async () => {
      const team = await createTestTeam({ name: "No Admin Team", key: "NAT" });
      const admin = await createTestUser({ email: "realadmin@test.com", name: "Real Admin" });
      const member = await createTestUser({ email: "plainmember@test.com", name: "Plain Member" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      // Should succeed - member is not an admin
      const result = await softDeleteUser(member.id);
      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(false);
    });

    it("should allow deleting user with no team memberships", async () => {
      const user = await createTestUser({ email: "nomembership@test.com", name: "No Membership" });

      // Should succeed - no memberships at all
      const result = await softDeleteUser(user.id);
      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(false);
    });
  });

  describe("Cannot Demote Last Admin", () => {
    it("should throw ForbiddenError when demoting the only admin to member", async () => {
      const team = await createTestTeam({ name: "Demote Guard Team", key: "DeMT" });
      const admin = await createTestUser({ email: "demoteadmin@test.com", name: "Demote Admin" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      await expect(
        updateMemberRole(team.id, admin.id, { role: "member" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw ForbiddenError when demoting the only admin to guest", async () => {
      const team = await createTestTeam({ name: "Guest Demote Team", key: "GDT" });
      const admin = await createTestUser({ email: "guestdemote@test.com", name: "Guest Demote" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      await expect(
        updateMemberRole(team.id, admin.id, { role: "guest" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should provide clear error message when trying to demote last admin", async () => {
      const team = await createTestTeam({ name: "Clear Error Team", key: "CET" });
      const admin = await createTestUser({ email: "clearerror@test.com", name: "Clear Error" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      try {
        await updateMemberRole(team.id, admin.id, { role: "member" });
        expect.fail("Should have thrown ForbiddenError");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).message).toContain("demote");
        expect((error as ForbiddenError).message).toContain("last admin");
      }
    });

    it("should allow demoting admin when there are multiple admins", async () => {
      const team = await createTestTeam({ name: "Multi Demote Team", key: "MDT" });
      const admin1 = await createTestUser({ email: "demote1@test.com", name: "Demote 1" });
      const admin2 = await createTestUser({ email: "demote2@test.com", name: "Demote 2" });

      await createTestMembership(team.id, admin1.id, { role: "admin" });
      await createTestMembership(team.id, admin2.id, { role: "admin" });

      // Should succeed - admin2 is still there
      const result = await updateMemberRole(team.id, admin1.id, { role: "member" });
      expect(result.role).toBe("member");
    });

    it("should allow promoting member to admin (not affected by guardrail)", async () => {
      const team = await createTestTeam({ name: "Promote Team", key: "PMT" });
      const admin = await createTestUser({ email: "promadmin@test.com", name: "Prom Admin" });
      const member = await createTestUser({ email: "prommember@test.com", name: "Prom Member" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      // Should succeed - promoting is always allowed
      const result = await updateMemberRole(team.id, member.id, { role: "admin" });
      expect(result.role).toBe("admin");
    });

    it("should allow changing member to guest (not affected by guardrail)", async () => {
      const team = await createTestTeam({ name: "M2G Team", key: "M2G" });
      const admin = await createTestUser({ email: "m2gadmin@test.com", name: "M2G Admin" });
      const member = await createTestUser({ email: "m2gmember@test.com", name: "M2G Member" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      // Should succeed - member to guest is always allowed
      const result = await updateMemberRole(team.id, member.id, { role: "guest" });
      expect(result.role).toBe("guest");
    });
  });

  describe("isLastAdmin Helper", () => {
    it("should return true when user is the only admin", async () => {
      const team = await createTestTeam({ name: "Is Last Team", key: "ILT" });
      const admin = await createTestUser({ email: "islast@test.com", name: "Is Last" });
      await createTestMembership(team.id, admin.id, { role: "admin" });

      const result = await isLastAdmin(team.id, admin.id);
      expect(result).toBe(true);
    });

    it("should return false when there are multiple admins", async () => {
      const team = await createTestTeam({ name: "Not Last Team", key: "NLT" });
      const admin1 = await createTestUser({ email: "notlast1@test.com", name: "Not Last 1" });
      const admin2 = await createTestUser({ email: "notlast2@test.com", name: "Not Last 2" });

      await createTestMembership(team.id, admin1.id, { role: "admin" });
      await createTestMembership(team.id, admin2.id, { role: "admin" });

      const result = await isLastAdmin(team.id, admin1.id);
      expect(result).toBe(false);
    });

    it("should return false when user is not an admin", async () => {
      const team = await createTestTeam({ name: "Not Admin Team", key: "NAd" });
      const admin = await createTestUser({ email: "realad@test.com", name: "Real Ad" });
      const member = await createTestUser({ email: "notad@test.com", name: "Not Ad" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      const result = await isLastAdmin(team.id, member.id);
      expect(result).toBe(false);
    });

    it("should return false when team has no admins", async () => {
      const team = await createTestTeam({ name: "No Admin Team", key: "NAD" });
      const member = await createTestUser({ email: "onlymember@test.com", name: "Only Member" });

      await createTestMembership(team.id, member.id, { role: "member" });

      const result = await isLastAdmin(team.id, member.id);
      expect(result).toBe(false);
    });
  });

  describe("getTeamsWhereUserIsLastAdmin Helper", () => {
    it("should return empty array when user is not admin of any team", async () => {
      const team = await createTestTeam({ name: "GTW None Team", key: "GN1" });
      const admin = await createTestUser({ email: "gtwadmin@test.com", name: "GTW Admin" });
      const member = await createTestUser({ email: "gtwmember@test.com", name: "GTW Member" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      const result = await getTeamsWhereUserIsLastAdmin(member.id);
      expect(result).toEqual([]);
    });

    it("should return team IDs where user is the last admin", async () => {
      const team1 = await createTestTeam({ name: "GTW Team 1", key: "GT1" });
      const team2 = await createTestTeam({ name: "GTW Team 2", key: "GT2" });
      const admin = await createTestUser({ email: "gtwlast@test.com", name: "GTW Last" });

      await createTestMembership(team1.id, admin.id, { role: "admin" });
      await createTestMembership(team2.id, admin.id, { role: "admin" });

      const result = await getTeamsWhereUserIsLastAdmin(admin.id);
      expect(result).toHaveLength(2);
      expect(result).toContain(team1.id);
      expect(result).toContain(team2.id);
    });

    it("should only return teams where user is the LAST admin", async () => {
      const team1 = await createTestTeam({ name: "GTW Mix 1", key: "GM1" });
      const team2 = await createTestTeam({ name: "GTW Mix 2", key: "GM2" });
      const admin1 = await createTestUser({ email: "gtwmix1@test.com", name: "GTW Mix 1" });
      const admin2 = await createTestUser({ email: "gtwmix2@test.com", name: "GTW Mix 2" });

      // team1: admin1 is the only admin
      await createTestMembership(team1.id, admin1.id, { role: "admin" });

      // team2: both admin1 and admin2 are admins
      await createTestMembership(team2.id, admin1.id, { role: "admin" });
      await createTestMembership(team2.id, admin2.id, { role: "admin" });

      const result = await getTeamsWhereUserIsLastAdmin(admin1.id);
      expect(result).toHaveLength(1);
      expect(result).toContain(team1.id);
      expect(result).not.toContain(team2.id);
    });
  });

  describe("Recovery Scenarios", () => {
    it("should allow operations after promoting another member to admin", async () => {
      const team = await createTestTeam({ name: "Recovery Team", key: "REC" });
      const admin = await createTestUser({ email: "recadmin@test.com", name: "Rec Admin" });
      const member = await createTestUser({ email: "recmember@test.com", name: "Rec Member" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      // Initially cannot remove admin
      await expect(removeMemberFromTeam(team.id, admin.id)).rejects.toThrow(ForbiddenError);

      // Promote member to admin
      await updateMemberRole(team.id, member.id, { role: "admin" });

      // Now can remove original admin
      await expect(removeMemberFromTeam(team.id, admin.id)).resolves.not.toThrow();
    });

    it("should allow deleting user after they're no longer last admin", async () => {
      const team = await createTestTeam({ name: "Delete Recovery", key: "DRE" });
      const admin = await createTestUser({ email: "dreadmin@test.com", name: "DRE Admin" });
      const member = await createTestUser({ email: "dremember@test.com", name: "DRE Member" });

      await createTestMembership(team.id, admin.id, { role: "admin" });
      await createTestMembership(team.id, member.id, { role: "member" });

      // Initially cannot delete admin
      await expect(softDeleteUser(admin.id)).rejects.toThrow(ForbiddenError);

      // Promote member to admin
      await updateMemberRole(team.id, member.id, { role: "admin" });

      // Now can delete original admin
      const result = await softDeleteUser(admin.id);
      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(false);
    });
  });
});
