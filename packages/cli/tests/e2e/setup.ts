import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import os from 'os';

/**
 * E2E test helper utilities
 */
export class TestEnvironment {
  private testDir: string | null = null;
  private originalCwd: string;

  constructor() {
    this.originalCwd = process.cwd();
  }

  /**
   * Create an isolated test repository
   */
  async createTestRepo(): Promise<string> {
    // Create a temporary directory
    this.testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spectree-test-'));

    // Initialize basic structure
    await fs.mkdir(path.join(this.testDir, '.github'), { recursive: true });
    await fs.mkdir(path.join(this.testDir, '.spectree'), { recursive: true });

    // Change to test directory
    process.chdir(this.testDir);

    return this.testDir;
  }

  /**
   * Clean up test repository
   */
  async cleanup(): Promise<void> {
    // Restore original directory
    process.chdir(this.originalCwd);

    // Remove test directory
    if (this.testDir && existsSync(this.testDir)) {
      await fs.rm(this.testDir, { recursive: true, force: true });
      this.testDir = null;
    }
  }

  /**
   * Get the test directory path
   */
  getTestDir(): string {
    if (!this.testDir) {
      throw new Error('Test directory not created. Call createTestRepo() first.');
    }
    return this.testDir;
  }

  /**
   * Check if a file exists in the test repo
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.getTestDir(), relativePath);
    return existsSync(fullPath);
  }

  /**
   * Read a file from the test repo
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.getTestDir(), relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Write a file to the test repo
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.getTestDir(), relativePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Read JSON file
   */
  async readJSON<T = unknown>(relativePath: string): Promise<T> {
    const content = await this.readFile(relativePath);
    return JSON.parse(content) as T;
  }

  /**
   * Write JSON file
   */
  async writeJSON(relativePath: string, data: unknown): Promise<void> {
    await this.writeFile(relativePath, JSON.stringify(data, null, 2));
  }
}

/**
 * Mock API server for testing
 */
export class MockAPIServer {
  private mockPacks: Map<string, MockPackData> = new Map();

  /**
   * Add a mock skill pack
   */
  addMockPack(name: string, version: string, files: Record<string, string>): void {
    this.mockPacks.set(name, {
      name,
      version,
      files,
    });
  }

  /**
   * Get mock pack data
   */
  getMockPack(name: string): MockPackData | undefined {
    return this.mockPacks.get(name);
  }

  /**
   * Clear all mock packs
   */
  clear(): void {
    this.mockPacks.clear();
  }
}

interface MockPackData {
  name: string;
  version: string;
  files: Record<string, string>;
}
