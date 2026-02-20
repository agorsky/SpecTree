import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestEnvironment } from './setup.js';
import { FileManager } from '../../src/utils/file-manager.js';
import * as tar from 'tar';
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

describe('CLI update command E2E', () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.createTestRepo();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('should update an installed pack to a new version', async () => {
    const fileManager = new FileManager(testEnv.getTestDir());

    // Install v1.0.0
    const packV1 = await createMockPackTarball({
      '.github/agents/planner.md': '# Planner v1.0.0',
    });

    const filesV1 = await fileManager.copyFilesToGithub(packV1, '@spectree/planning');
    await fileManager.addPackToManifest('@spectree/planning', '1.0.0', filesV1);

    // Verify v1 is installed
    let manifest = await fileManager.readManifest();
    expect(manifest.installedPacks['@spectree/planning'].version).toBe('1.0.0');

    let content = await testEnv.readFile('.github/agents/planner.md');
    expect(content).toContain('v1.0.0');

    // Update to v2.0.0
    const packV2 = await createMockPackTarball({
      '.github/agents/planner.md': '# Planner v2.0.0\nNew features!',
    });

    const filesV2 = await fileManager.copyFilesToGithub(packV2, '@spectree/planning');
    await fileManager.addPackToManifest('@spectree/planning', '2.0.0', filesV2);

    // Verify v2 is installed
    manifest = await fileManager.readManifest();
    expect(manifest.installedPacks['@spectree/planning'].version).toBe('2.0.0');

    content = await testEnv.readFile('.github/agents/planner.md');
    expect(content).toContain('v2.0.0');
    expect(content).toContain('New features!');
  });

  it('should handle adding new files during update', async () => {
    const fileManager = new FileManager(testEnv.getTestDir());

    // Install v1.0.0 with one file
    const packV1 = await createMockPackTarball({
      '.github/agents/planner.md': '# Planner',
    });

    await fileManager.copyFilesToGithub(packV1, '@spectree/planning');
    await fileManager.addPackToManifest('@spectree/planning', '1.0.0', ['agents/planner.md']);

    // Update to v2.0.0 with additional files
    const packV2 = await createMockPackTarball({
      '.github/agents/planner.md': '# Planner',
      '.github/agents/executor.md': '# Executor',
      '.github/instructions/new-guide.md': '# New Guide',
    });

    const filesV2 = await fileManager.copyFilesToGithub(packV2, '@spectree/planning');
    await fileManager.addPackToManifest('@spectree/planning', '2.0.0', filesV2);

    // Verify new files exist
    expect(await testEnv.fileExists('.github/agents/executor.md')).toBe(true);
    expect(await testEnv.fileExists('.github/instructions/new-guide.md')).toBe(true);

    // Verify manifest tracks all files
    const manifest = await fileManager.readManifest();
    expect(manifest.installedPacks['@spectree/planning'].files.length).toBe(filesV2.length);
  });

  it('should handle removing files during update', async () => {
    const fileManager = new FileManager(testEnv.getTestDir());

    // Install v1.0.0 with multiple files
    const packV1 = await createMockPackTarball({
      '.github/agents/planner.md': '# Planner',
      '.github/agents/old-agent.md': '# Old Agent',
    });

    const filesV1 = await fileManager.copyFilesToGithub(packV1, '@spectree/planning');
    await fileManager.addPackToManifest('@spectree/planning', '1.0.0', filesV1);

    // Update to v2.0.0 with fewer files
    const packV2 = await createMockPackTarball({
      '.github/agents/planner.md': '# Planner Updated',
    });

    const filesV2 = await fileManager.copyFilesToGithub(packV2, '@spectree/planning');

    // Delete old files that are no longer in the pack
    const oldFiles = filesV1.filter((f) => !filesV2.includes(f));
    await fileManager.deletePackFiles(oldFiles);

    await fileManager.addPackToManifest('@spectree/planning', '2.0.0', filesV2);

    // Verify old file is removed
    expect(await testEnv.fileExists('.github/agents/old-agent.md')).toBe(false);

    // Verify new file exists
    expect(await testEnv.fileExists('.github/agents/planner.md')).toBe(true);
  });
});

/**
 * Helper to create mock pack tarball
 */
async function createMockPackTarball(files: Record<string, string>): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spectree-mock-pack-'));

  try {
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    }

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

    const buffer = await fs.readFile(tarballPath);
    await fs.rm(tmpDir, { recursive: true, force: true });

    return buffer;
  } catch (error) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw error;
  }
}
