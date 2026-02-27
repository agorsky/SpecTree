import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export interface LocalManifest {
  installedPacks: Record<string, {
      version: string;
      installedAt: string;
      files: string[];
    }>;
}

export class FileManager {
  private manifestPath: string;
  private githubDir: string;
  private dispatcherDir: string;

  constructor(projectRoot?: string) {
    const root = projectRoot ?? process.cwd();
    this.githubDir = path.join(root, '.github');
    this.dispatcherDir = path.join(root, '.dispatcher');
    this.manifestPath = path.join(this.dispatcherDir, 'manifest.json');
  }

  async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.githubDir, { recursive: true });
    await fs.mkdir(this.dispatcherDir, { recursive: true });
  }

  async readManifest(): Promise<LocalManifest> {
    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      return JSON.parse(content) as LocalManifest;
    } catch {
      // Return empty manifest if file doesn't exist
      return { installedPacks: {} };
    }
  }

  async writeManifest(manifest: LocalManifest): Promise<void> {
    await this.ensureDirectories();
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  async addPackToManifest(packName: string, version: string, files: string[]): Promise<void> {
    const manifest = await this.readManifest();
    manifest.installedPacks[packName] = {
      version,
      installedAt: new Date().toISOString(),
      files,
    };
    await this.writeManifest(manifest);
  }

  async removePackFromManifest(packName: string): Promise<void> {
    const manifest = await this.readManifest();
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete manifest.installedPacks[packName];
    await this.writeManifest(manifest);
  }

  async copyFilesToGithub(filesBuffer: Buffer, _packName: string): Promise<string[]> {
    await this.ensureDirectories();
    
    // Extract tar.gz archive
    const tar = await import('tar');
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    // Create a temporary directory for extraction
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dispatcher-extract-'));

    try {
      // Write buffer to temp file
      const tarPath = path.join(tmpDir, 'pack.tar.gz');
      await fs.writeFile(tarPath, filesBuffer);

      // Extract to temp directory
      await tar.extract({
        file: tarPath,
        cwd: tmpDir,
      });

      // Get list of extracted files
      const extractedFiles = await this.getAllFiles(tmpDir);
      const installedFiles: string[] = [];

      // Copy extracted files to project root (pack paths include .github/ prefix)
      const targetDir = path.dirname(this.githubDir);
      await fs.mkdir(targetDir, { recursive: true });

      for (const file of extractedFiles) {
        // Skip the tarball itself
        if (file === 'pack.tar.gz') continue;

        const sourcePath = path.join(tmpDir, file);
        const targetPath = path.join(targetDir, file);
        const targetFileDir = path.dirname(targetPath);

        // Ensure target directory exists
        await fs.mkdir(targetFileDir, { recursive: true });

        // Copy file
        await fs.copyFile(sourcePath, targetPath);

        // Track relative path from .github/
        const relativePath = path.relative(this.githubDir, targetPath);
        installedFiles.push(relativePath);
      }

      // Clean up temp directory
      await fs.rm(tmpDir, { recursive: true, force: true });

      return installedFiles;
    } catch (error) {
      // Clean up temp directory on error
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Recursively get all files in a directory
   */
  private async getAllFiles(dir: string, baseDir?: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const base = baseDir ?? dir;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const nestedFiles = await this.getAllFiles(fullPath, base);
        files.push(...nestedFiles);
      } else if (entry.isFile()) {
        const relativePath = path.relative(base, fullPath);
        files.push(relativePath);
      }
    }

    return files;
  }

  async deletePackFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        const fullPath = path.join(this.githubDir, file);
        await fs.unlink(fullPath);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }
  }

  async mergeMcpConfig(newConfig: Record<string, unknown>): Promise<void> {
    const mcpConfigPath = path.join(this.githubDir, 'copilot-instructions', 'mcp.json');
    
    let existingConfig: Record<string, unknown> = {};
    if (existsSync(mcpConfigPath)) {
      const content = await fs.readFile(mcpConfigPath, 'utf-8');
      existingConfig = JSON.parse(content) as Record<string, unknown>;
    }

    // Merge configs - new tools are added, existing tools are preserved
    const mergedConfig = {
      ...existingConfig,
      mcpServers: {
        ...((existingConfig.mcpServers ?? {}) as Record<string, unknown>),
        ...((newConfig.mcpServers ?? {}) as Record<string, unknown>),
      },
    };

    await fs.mkdir(path.dirname(mcpConfigPath), { recursive: true });
    await fs.writeFile(mcpConfigPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
  }

  githubDirExists(): boolean {
    return existsSync(this.githubDir);
  }

  dispatcherDirExists(): boolean {
    return existsSync(this.dispatcherDir);
  }
}
