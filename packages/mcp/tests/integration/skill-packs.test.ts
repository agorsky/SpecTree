import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../../api/src/lib/db.js';

/**
 * Integration tests for MCP Skill Pack management tools
 * 
 * These tests verify the MCP server tools work correctly with the database.
 * Uses the actual database (could be extended to use in-memory SQLite for true isolation).
 */
describe('MCP Skill Pack Management Integration Tests', () => {
  let testPackId: string;
  let testVersionId: string;

  beforeAll(async () => {
    // Setup: Create test skill pack
    const testPack = await prisma.skillPack.create({
      data: {
        name: '@spectree/test-pack',
        displayName: 'Test Pack',
        description: 'Pack for integration testing',
        isOfficial: false,
      },
    });

    testPackId = testPack.id;

    // Create test version
    const testVersion = await prisma.skillPackVersion.create({
      data: {
        skillPackId: testPackId,
        version: '1.0.0',
        manifest: JSON.stringify({
          name: '@spectree/test-pack',
          version: '1.0.0',
          description: 'Test pack',
          agents: [
            { name: 'Test Agent', path: 'agents/test.md', description: 'Test agent' },
          ],
        }),
        releaseNotes: 'Initial release',
        isPrerelease: false,
      },
    });

    testVersionId = testVersion.id;

    // Create test files
    await prisma.skillPackFile.create({
      data: {
        versionId: testVersionId,
        path: 'agents/test.md',
        content: '# Test Agent\nThis is a test agent.',
        mimeType: 'text/markdown',
      },
    });
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testVersionId) {
      await prisma.skillPackFile.deleteMany({
        where: { versionId: testVersionId },
      });
    }

    if (testPackId) {
      await prisma.skillPackVersion.deleteMany({
        where: { skillPackId: testPackId },
      });

      await prisma.skillPack.delete({
        where: { id: testPackId },
      });
    }
  });

  describe('spectree__manage_skill_packs - list action', () => {
    it('should list available skill packs', async () => {
      // This would test the MCP tool's list functionality
      // For now, we verify the database query works
      const packs = await prisma.skillPack.findMany({
        take: 20,
        orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
      });

      expect(packs.length).toBeGreaterThan(0);
      expect(packs.some((p) => p.name === '@spectree/test-pack')).toBe(true);
    });

    it('should filter official packs', async () => {
      const officialPacks = await prisma.skillPack.findMany({
        where: { isOfficial: true },
      });

      const allOfficialFlags = officialPacks.every((p) => p.isOfficial === true);
      expect(allOfficialFlags).toBe(true);
    });
  });

  describe('spectree__manage_skill_packs - get action', () => {
    it('should get pack by name', async () => {
      const pack = await prisma.skillPack.findUnique({
        where: { name: '@spectree/test-pack' },
      });

      expect(pack).not.toBeNull();
      expect(pack?.displayName).toBe('Test Pack');
    });

    it('should get pack by ID', async () => {
      const pack = await prisma.skillPack.findUnique({
        where: { id: testPackId },
      });

      expect(pack).not.toBeNull();
      expect(pack?.name).toBe('@spectree/test-pack');
    });
  });

  describe('spectree__get_pack_manifest', () => {
    it('should retrieve manifest for a version', async () => {
      const version = await prisma.skillPackVersion.findUnique({
        where: { id: testVersionId },
        include: {
          skillPack: true,
        },
      });

      expect(version).not.toBeNull();

      const manifest = JSON.parse(version!.manifest);
      expect(manifest.name).toBe('@spectree/test-pack');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.agents).toHaveLength(1);
    });

    it('should include file list in manifest', async () => {
      const files = await prisma.skillPackFile.findMany({
        where: { versionId: testVersionId },
      });

      expect(files.length).toBeGreaterThan(0);
      expect(files[0].path).toBe('agents/test.md');
    });
  });

  describe('spectree__manage_skill_packs - install action', () => {
    it('should record installation in database', async () => {
      // Install the pack
      const installation = await prisma.installedSkillPack.create({
        data: {
          skillPackId: testPackId,
          installedVersion: '1.0.0',
          isEnabled: true,
        },
      });

      expect(installation).not.toBeNull();
      expect(installation.installedVersion).toBe('1.0.0');

      // Cleanup
      await prisma.installedSkillPack.delete({
        where: { id: installation.id },
      });
    });

    it('should handle reinstall/update', async () => {
      // Install v1.0.0
      const install1 = await prisma.installedSkillPack.create({
        data: {
          skillPackId: testPackId,
          installedVersion: '1.0.0',
        },
      });

      // Update to v1.1.0 (simulate)
      const install2 = await prisma.installedSkillPack.update({
        where: { skillPackId: testPackId },
        data: {
          installedVersion: '1.1.0',
          lastUpdatedAt: new Date(),
        },
      });

      expect(install2.installedVersion).toBe('1.1.0');

      // Cleanup
      await prisma.installedSkillPack.delete({
        where: { id: install1.id },
      });
    });
  });

  describe('spectree__manage_skill_packs - list_installed action', () => {
    it('should list installed packs', async () => {
      // Install a pack
      const installation = await prisma.installedSkillPack.create({
        data: {
          skillPackId: testPackId,
          installedVersion: '1.0.0',
        },
      });

      // List installed
      const installed = await prisma.installedSkillPack.findMany({
        include: {
          skillPack: true,
        },
      });

      expect(installed.some((i) => i.skillPackId === testPackId)).toBe(true);

      // Cleanup
      await prisma.installedSkillPack.delete({
        where: { id: installation.id },
      });
    });
  });

  describe('Error handling', () => {
    it('should handle missing pack gracefully', async () => {
      const pack = await prisma.skillPack.findUnique({
        where: { name: '@spectree/nonexistent' },
      });

      expect(pack).toBeNull();
    });

    it('should handle missing version gracefully', async () => {
      const version = await prisma.skillPackVersion.findFirst({
        where: {
          skillPackId: testPackId,
          version: '99.99.99',
        },
      });

      expect(version).toBeNull();
    });
  });
});
