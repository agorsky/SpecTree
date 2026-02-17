import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export interface PackManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  files: {
    agents?: string[];
    skills?: string[];
    instructions?: string[];
    mcpConfig?: string;
  };
}

export interface BundledPack {
  manifest: PackManifest;
  files: {
    [filePath: string]: string;
  };
}

export class PackBundler {
  private packRoot: string;

  constructor(packRoot?: string) {
    this.packRoot = packRoot || process.cwd();
  }

  async readPackManifest(): Promise<PackManifest> {
    const manifestPath = path.join(this.packRoot, '.spectree', 'pack.json');

    if (!existsSync(manifestPath)) {
      throw new Error('Pack manifest not found at .spectree/pack.json');
    }

    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    // Validate required fields
    if (!manifest.name || !manifest.version || !manifest.description) {
      throw new Error(
        'Invalid pack manifest: name, version, and description are required'
      );
    }

    // Validate version format (basic semver check)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error(
        `Invalid version format: ${manifest.version}. Expected semver format (e.g., 1.0.0)`
      );
    }

    return manifest;
  }

  async bundlePack(): Promise<BundledPack> {
    const manifest = await this.readPackManifest();
    const files: { [filePath: string]: string } = {};

    const githubDir = path.join(this.packRoot, '.github');

    // Collect agent files
    if (manifest.files.agents) {
      for (const agentFile of manifest.files.agents) {
        const fullPath = path.join(githubDir, 'agents', agentFile);
        if (!existsSync(fullPath)) {
          throw new Error(`Agent file not found: ${agentFile}`);
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        files[`agents/${agentFile}`] = content;
      }
    }

    // Collect skill files
    if (manifest.files.skills) {
      for (const skillFile of manifest.files.skills) {
        const fullPath = path.join(githubDir, 'skills', skillFile);
        if (!existsSync(fullPath)) {
          throw new Error(`Skill file not found: ${skillFile}`);
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        files[`skills/${skillFile}`] = content;
      }
    }

    // Collect instruction files
    if (manifest.files.instructions) {
      for (const instructionFile of manifest.files.instructions) {
        const fullPath = path.join(githubDir, 'instructions', instructionFile);
        if (!existsSync(fullPath)) {
          throw new Error(`Instruction file not found: ${instructionFile}`);
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        files[`instructions/${instructionFile}`] = content;
      }
    }

    // Collect MCP config if specified
    if (manifest.files.mcpConfig) {
      const fullPath = path.join(githubDir, manifest.files.mcpConfig);
      if (!existsSync(fullPath)) {
        throw new Error(`MCP config file not found: ${manifest.files.mcpConfig}`);
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      files[manifest.files.mcpConfig] = content;
    }

    return {
      manifest,
      files,
    };
  }

  async validatePack(_dryRun: boolean = false): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    fileCount: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let fileCount = 0;

    try {
      const manifest = await this.readPackManifest();
      const githubDir = path.join(this.packRoot, '.github');

      // Check if .github directory exists
      if (!existsSync(githubDir)) {
        errors.push('.github directory not found');
        return { valid: false, errors, warnings, fileCount };
      }

      // Validate each file exists
      const allFiles = [
        ...(manifest.files.agents?.map((f) => `agents/${f}`) || []),
        ...(manifest.files.skills?.map((f) => `skills/${f}`) || []),
        ...(manifest.files.instructions?.map((f) => `instructions/${f}`) || []),
      ];

      if (manifest.files.mcpConfig) {
        allFiles.push(manifest.files.mcpConfig);
      }

      for (const file of allFiles) {
        const fullPath = path.join(githubDir, file);
        if (!existsSync(fullPath)) {
          errors.push(`File not found: ${file}`);
        } else {
          fileCount++;
        }
      }

      // Warnings
      if (fileCount === 0) {
        warnings.push('No files to publish');
      }

      if (!manifest.author) {
        warnings.push('No author specified in manifest');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        fileCount,
      };
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
      return { valid: false, errors, warnings, fileCount: 0 };
    }
  }
}
