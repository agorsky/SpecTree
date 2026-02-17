import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestEnvironment } from './setup.js';
import { FileManager } from '../../src/utils/file-manager.js';
import * as tar from 'tar';
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

describe('CLI install command E2E', () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.createTestRepo();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('should install a pack and create manifest', async () => {
    // Create a mock pack tarball
    const mockPack = await createMockPackTarball({
      'agents/planner.md': '# Planner Agent\nHelps plan projects.',
      'instructions/planning.md': '# Planning Instructions\nUse this for planning.',
    });

    // Initialize file manager
    const fileManager = new FileManager(testEnv.getTestDir());

    // Install the pack (simulating what install command does)
    const installedFiles = await fileManager.copyFilesToGithub(mockPack, '@spectree/planning');

    // Verify files were copied
    expect(installedFiles.length).toBeGreaterThan(0);
    expect(await testEnv.fileExists('.github/copilot-instructions/agents/planner.md')).toBe(true);
    expect(await testEnv.fileExists('.github/copilot-instructions/instructions/planning.md')).toBe(true);

    // Add to manifest
    await fileManager.addPackToManifest('@spectree/planning', '1.0.0', installedFiles);

    // Verify manifest was created
    expect(await testEnv.fileExists('.spectree/manifest.json')).toBe(true);

    const manifest = await testEnv.readJSON<{
      installedPacks: Record<string, { version: string; files: string[] }>;
    }>('.spectree/manifest.json');

    expect(manifest.installedPacks).toHaveProperty('@spectree/planning');
    expect(manifest.installedPacks['@spectree/planning'].version).toBe('1.0.0');
    expect(manifest.installedPacks['@spectree/planning'].files).toHaveLength(installedFiles.length);
  });

  it('should handle file conflicts gracefully', async () => {
    // Pre-create a file that will conflict
    await testEnv.writeFile('.github/copilot-instructions/agents/planner.md', '# Existing content');

    // Create a mock pack with the same file
    const mockPack = await createMockPackTarball({
      'agents/planner.md': '# New Planner Agent',
    });

    const fileManager = new FileManager(testEnv.getTestDir());

    // Install should overwrite (this is current behavior - could be made configurable)
    const installedFiles = await fileManager.copyFilesToGithub(mockPack, '@spectree/planning');

    expect(installedFiles.length).toBeGreaterThan(0);

    // Verify file was overwritten
    const content = await testEnv.readFile('.github/copilot-instructions/agents/planner.md');
    expect(content).toContain('# New Planner Agent');
  });

  it('should handle empty pack gracefully', async () => {
    // Create an empty tarball with at least one file (tar requires files)
    const mockPack = await createMockPackTarball({
      '.empty': '', // Empty file to satisfy tar requirements
    });

    const fileManager = new FileManager(testEnv.getTestDir());

    // Should install the empty file
    const installedFiles = await fileManager.copyFilesToGithub(mockPack, '@spectree/empty');

    // Should have the .empty file
    expect(installedFiles.length).toBeGreaterThan(0);
  });

  it('should extract nested directory structures', async () => {
    const mockPack = await createMockPackTarball({
      'agents/subfolder/nested-agent.md': '# Nested Agent',
      'instructions/sub1/sub2/deep-instruction.md': '# Deep Instruction',
    });

    const fileManager = new FileManager(testEnv.getTestDir());
    const installedFiles = await fileManager.copyFilesToGithub(mockPack, '@spectree/nested');

    expect(installedFiles.length).toBe(2);
    expect(
      await testEnv.fileExists('.github/copilot-instructions/agents/subfolder/nested-agent.md')
    ).toBe(true);
    expect(
      await testEnv.fileExists(
        '.github/copilot-instructions/instructions/sub1/sub2/deep-instruction.md'
      )
    ).toBe(true);
  });
});

/**
 * Helper function to create a mock pack tarball for testing
 */
async function createMockPackTarball(files: Record<string, string>): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spectree-mock-pack-'));

  try {
    // Write all files to temp directory
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    // Create tarball
    const tarballPath = path.join(tmpDir, 'pack.tar.gz');
    await tar.create(
      {
        gzip: true,
        portable: true,
        file: tarballPath,
        cwd: tmpDir,
      },
      Object.keys(files)
    );

    // Read tarball into buffer
    const buffer = await fs.readFile(tarballPath);

    // Clean up
    await fs.rm(tmpDir, { recursive: true, force: true });

    return buffer;
  } catch (error) {
    // Clean up on error
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw error;
  }
}
