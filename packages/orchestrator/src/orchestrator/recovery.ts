/**
 * Recovery State Module for SpecTree Orchestrator
 *
 * Provides checkpoint saving and crash recovery functionality.
 * Allows orchestration to resume from the last saved state after crashes or interruptions.
 *
 * Features:
 * - Automatic checkpointing during execution
 * - Version-aware checkpoint format for compatibility
 * - Graceful handling of stale or invalid checkpoints
 * - JSON-serializable state for persistence
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { type SerializedError, serializeError } from "../errors.js";

// =============================================================================
// Constants
// =============================================================================

/** Current checkpoint format version for compatibility checks */
export const CHECKPOINT_VERSION = "1.0.0";

/** Default directory for checkpoint files */
export const DEFAULT_STATE_DIR = path.join(os.homedir(), ".spectree");

/** Default checkpoint filename */
export const CHECKPOINT_FILENAME = "checkpoint.json";

/** Maximum age for a checkpoint to be considered valid (24 hours) */
export const MAX_CHECKPOINT_AGE_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

/**
 * Item currently being executed when checkpoint was saved
 */
export interface InProgressItem {
  /** Item ID (UUID) */
  id: string;
  /** Item identifier (e.g., "COM-5") */
  identifier: string;
  /** ID of the agent working on this item */
  agentId: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Branch the item is being worked on */
  branch?: string;
}

/**
 * Execution state that can be saved and restored
 */
export interface ExecutionState {
  /** Checkpoint format version for compatibility */
  version: string;
  /** Epic ID being executed */
  epicId: string;
  /** Epic identifier (e.g., "EPC-1") */
  epicIdentifier?: string;
  /** Session ID for tracking */
  sessionId: string;
  /** Current phase number (0-indexed) */
  currentPhase: number;
  /** Total number of phases */
  totalPhases: number;
  /** Array of completed item IDs */
  completedItems: string[];
  /** Array of completed item identifiers */
  completedIdentifiers: string[];
  /** Items in progress when checkpointed */
  inProgressItems: InProgressItem[];
  /** ISO timestamp when orchestration started */
  startedAt: string;
  /** ISO timestamp of last checkpoint update */
  lastUpdated: string;
  /** Git branch orchestration is running on */
  gitBranch: string;
  /** Base branch for merging (if applicable) */
  baseBranch?: string;
  /** Working directory */
  cwd?: string;
  /** Error that caused the checkpoint (if any) */
  error?: SerializedError;
  /** Whether orchestration was paused (vs crashed) */
  paused?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for CheckpointManager
 */
export interface CheckpointManagerOptions {
  /** Directory to store checkpoint files */
  stateDir?: string;
  /** Custom checkpoint filename */
  filename?: string;
  /** Maximum checkpoint age before considered stale (ms) */
  maxAgeMs?: number;
}

/**
 * Result of loading a checkpoint
 */
export interface LoadCheckpointResult {
  /** The loaded checkpoint state, or null if not found/invalid */
  state: ExecutionState | null;
  /** Reason if checkpoint was not loaded */
  reason?: "not_found" | "invalid_format" | "version_mismatch" | "expired" | "corrupted";
  /** Error message if applicable */
  message?: string;
}

// =============================================================================
// CheckpointManager Class
// =============================================================================

/**
 * Manages checkpoint saving and loading for crash recovery.
 *
 * @example
 * ```typescript
 * const manager = new CheckpointManager();
 *
 * // Save checkpoint during execution
 * await manager.saveCheckpoint({
 *   version: CHECKPOINT_VERSION,
 *   epicId: "123",
 *   sessionId: "session-1",
 *   currentPhase: 0,
 *   totalPhases: 3,
 *   completedItems: [],
 *   completedIdentifiers: [],
 *   inProgressItems: [],
 *   startedAt: new Date().toISOString(),
 *   lastUpdated: new Date().toISOString(),
 *   gitBranch: "main",
 * });
 *
 * // Load checkpoint on restart
 * const { state } = await manager.loadCheckpoint();
 * if (state) {
 *   console.log(`Resuming from phase ${state.currentPhase}`);
 * }
 * ```
 */
export class CheckpointManager {
  private readonly stateDir: string;
  private readonly filename: string;
  private readonly maxAgeMs: number;

  constructor(options: CheckpointManagerOptions = {}) {
    this.stateDir = options.stateDir ?? DEFAULT_STATE_DIR;
    this.filename = options.filename ?? CHECKPOINT_FILENAME;
    this.maxAgeMs = options.maxAgeMs ?? MAX_CHECKPOINT_AGE_MS;
  }

  /**
   * Get the full path to the checkpoint file.
   */
  get checkpointPath(): string {
    return path.join(this.stateDir, this.filename);
  }

  /**
   * Save the current execution state to a checkpoint file.
   *
   * @param state - The execution state to save
   * @throws If the state directory cannot be created or file cannot be written
   */
  async saveCheckpoint(state: ExecutionState): Promise<void> {
    // Ensure state directory exists
    await fs.mkdir(this.stateDir, { recursive: true });

    // Update timestamp
    const stateToSave: ExecutionState = {
      ...state,
      version: CHECKPOINT_VERSION,
      lastUpdated: new Date().toISOString(),
    };

    // Write atomically using temp file + rename
    const tempPath = `${this.checkpointPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(stateToSave, null, 2), "utf-8");
    await fs.rename(tempPath, this.checkpointPath);
  }

  /**
   * Load the last saved checkpoint if it exists and is valid.
   *
   * @returns The checkpoint state and status information
   */
  async loadCheckpoint(): Promise<LoadCheckpointResult> {
    try {
      // Check if file exists
      const exists = await this.hasCheckpointFile();
      if (!exists) {
        return { state: null, reason: "not_found" };
      }

      // Read and parse
      const content = await fs.readFile(this.checkpointPath, "utf-8");
      let state: unknown;
      try {
        state = JSON.parse(content);
      } catch {
        return {
          state: null,
          reason: "corrupted",
          message: "Checkpoint file is not valid JSON",
        };
      }

      // Validate structure
      if (!this.isValidCheckpointStructure(state)) {
        return {
          state: null,
          reason: "invalid_format",
          message: "Checkpoint file has invalid structure",
        };
      }

      const checkpoint = state as ExecutionState;

      // Check version compatibility
      if (!this.isVersionCompatible(checkpoint.version)) {
        return {
          state: null,
          reason: "version_mismatch",
          message: `Checkpoint version ${checkpoint.version} is not compatible with ${CHECKPOINT_VERSION}`,
        };
      }

      // Check if expired
      if (this.isExpired(checkpoint)) {
        return {
          state: null,
          reason: "expired",
          message: `Checkpoint is older than ${this.maxAgeMs / 1000 / 60 / 60} hours`,
        };
      }

      return { state: checkpoint };
    } catch (error) {
      // File read error or other unexpected error
      const message = error instanceof Error ? error.message : String(error);
      return {
        state: null,
        reason: "corrupted",
        message: `Failed to read checkpoint: ${message}`,
      };
    }
  }

  /**
   * Clear the checkpoint file (call after successful completion).
   */
  async clearCheckpoint(): Promise<void> {
    try {
      await fs.unlink(this.checkpointPath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Check if a valid checkpoint exists.
   *
   * @returns true if a valid, non-expired checkpoint exists
   */
  async hasValidCheckpoint(): Promise<boolean> {
    const { state } = await this.loadCheckpoint();
    return state !== null;
  }

  /**
   * Update an existing checkpoint with new in-progress items.
   *
   * @param updates - Partial state updates to apply
   * @returns The updated state, or null if no checkpoint exists
   */
  async updateCheckpoint(
    updates: Partial<Omit<ExecutionState, "version" | "startedAt">>
  ): Promise<ExecutionState | null> {
    const { state } = await this.loadCheckpoint();
    if (!state) {
      return null;
    }

    const updatedState: ExecutionState = {
      ...state,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    await this.saveCheckpoint(updatedState);
    return updatedState;
  }

  /**
   * Mark an item as completed in the checkpoint.
   *
   * @param itemId - The item ID to mark as completed
   * @param identifier - The item identifier (e.g., "COM-5")
   * @returns The updated state, or null if no checkpoint exists
   */
  async markItemCompleted(
    itemId: string,
    identifier: string
  ): Promise<ExecutionState | null> {
    const { state } = await this.loadCheckpoint();
    if (!state) {
      return null;
    }

    // Add to completed, remove from in-progress
    const completedItems = state.completedItems.includes(itemId)
      ? state.completedItems
      : [...state.completedItems, itemId];

    const completedIdentifiers = state.completedIdentifiers.includes(identifier)
      ? state.completedIdentifiers
      : [...state.completedIdentifiers, identifier];

    const inProgressItems = state.inProgressItems.filter(
      (item) => item.id !== itemId
    );

    return this.updateCheckpoint({
      completedItems,
      completedIdentifiers,
      inProgressItems,
    });
  }

  /**
   * Mark an item as in-progress in the checkpoint.
   *
   * @param item - The item to mark as in-progress
   * @returns The updated state, or null if no checkpoint exists
   */
  async markItemInProgress(item: InProgressItem): Promise<ExecutionState | null> {
    const { state } = await this.loadCheckpoint();
    if (!state) {
      return null;
    }

    // Remove existing entry for this item (if any) and add new one
    const inProgressItems = [
      ...state.inProgressItems.filter((i) => i.id !== item.id),
      item,
    ];

    return this.updateCheckpoint({ inProgressItems });
  }

  /**
   * Save an error state to the checkpoint for later recovery.
   *
   * @param error - The error that occurred
   * @param paused - Whether this was an intentional pause (vs crash)
   */
  async saveErrorState(error: unknown, paused = false): Promise<void> {
    const { state } = await this.loadCheckpoint();
    if (!state) {
      return;
    }

    await this.saveCheckpoint({
      ...state,
      error: serializeError(error),
      paused,
    });
  }

  /**
   * Get checkpoint metadata for display purposes.
   */
  async getCheckpointInfo(): Promise<{
    exists: boolean;
    epicId?: string;
    epicIdentifier?: string;
    completedCount?: number;
    inProgressCount?: number;
    currentPhase?: number;
    totalPhases?: number;
    lastUpdated?: string;
    age?: string;
    hasError?: boolean;
    isPaused?: boolean;
  }> {
    const { state } = await this.loadCheckpoint();

    if (!state) {
      return { exists: false };
    }

    const lastUpdatedDate = new Date(state.lastUpdated);
    const ageMs = Date.now() - lastUpdatedDate.getTime();

    // Build result object conditionally to satisfy exactOptionalPropertyTypes
    const result: {
      exists: boolean;
      epicId?: string;
      epicIdentifier?: string;
      completedCount?: number;
      inProgressCount?: number;
      currentPhase?: number;
      totalPhases?: number;
      lastUpdated?: string;
      age?: string;
      hasError?: boolean;
      isPaused?: boolean;
    } = {
      exists: true,
      epicId: state.epicId,
      completedCount: state.completedItems.length,
      inProgressCount: state.inProgressItems.length,
      currentPhase: state.currentPhase,
      totalPhases: state.totalPhases,
      lastUpdated: state.lastUpdated,
      age: formatDuration(ageMs),
      hasError: state.error !== undefined,
    };
    if (state.epicIdentifier) result.epicIdentifier = state.epicIdentifier;
    if (state.paused !== undefined) result.isPaused = state.paused;

    return result;
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  /**
   * Check if the checkpoint file exists.
   */
  private async hasCheckpointFile(): Promise<boolean> {
    try {
      await fs.access(this.checkpointPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate that an object has the required checkpoint structure.
   */
  private isValidCheckpointStructure(obj: unknown): obj is ExecutionState {
    if (typeof obj !== "object" || obj === null) {
      return false;
    }

    const state = obj as Record<string, unknown>;

    // Required string fields
    const requiredStrings = [
      "version",
      "epicId",
      "sessionId",
      "startedAt",
      "lastUpdated",
      "gitBranch",
    ];
    for (const field of requiredStrings) {
      if (typeof state[field] !== "string") {
        return false;
      }
    }

    // Required number fields
    if (
      typeof state["currentPhase"] !== "number" ||
      typeof state["totalPhases"] !== "number"
    ) {
      return false;
    }

    // Required array fields
    if (
      !Array.isArray(state["completedItems"]) ||
      !Array.isArray(state["completedIdentifiers"]) ||
      !Array.isArray(state["inProgressItems"])
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if a checkpoint version is compatible with current version.
   * Currently only exact match is supported.
   */
  private isVersionCompatible(version: string): boolean {
    // For now, require exact version match
    // In the future, we could support minor version differences
    const [currentMajor] = CHECKPOINT_VERSION.split(".");
    const [checkpointMajor] = version.split(".");
    return currentMajor === checkpointMajor;
  }

  /**
   * Check if a checkpoint has expired.
   */
  private isExpired(state: ExecutionState): boolean {
    const lastUpdated = new Date(state.lastUpdated);
    const age = Date.now() - lastUpdated.getTime();
    return age > this.maxAgeMs;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ago`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return `${seconds}s ago`;
}

/**
 * Create a new execution state for starting orchestration.
 *
 * @param epicId - Epic ID to execute
 * @param sessionId - Session ID for tracking
 * @param gitBranch - Current git branch
 * @param totalPhases - Total number of phases in execution plan
 * @param options - Additional options
 * @returns A new ExecutionState ready for checkpointing
 */
export function createExecutionState(
  epicId: string,
  sessionId: string,
  gitBranch: string,
  totalPhases: number,
  options?: {
    epicIdentifier?: string;
    baseBranch?: string;
    cwd?: string;
    metadata?: Record<string, unknown>;
  }
): ExecutionState {
  const now = new Date().toISOString();
  
  // Build state object conditionally to satisfy exactOptionalPropertyTypes
  const state: ExecutionState = {
    version: CHECKPOINT_VERSION,
    epicId,
    sessionId,
    currentPhase: 0,
    totalPhases,
    completedItems: [],
    completedIdentifiers: [],
    inProgressItems: [],
    startedAt: now,
    lastUpdated: now,
    gitBranch,
  };
  if (options?.epicIdentifier) state.epicIdentifier = options.epicIdentifier;
  if (options?.baseBranch) state.baseBranch = options.baseBranch;
  if (options?.cwd) state.cwd = options.cwd;
  if (options?.metadata) state.metadata = options.metadata;

  return state;
}

/**
 * Find the resume point from a checkpoint.
 *
 * @param state - The checkpoint state
 * @returns Information about where to resume execution
 */
export function findResumePoint(state: ExecutionState): {
  phase: number;
  skipItems: string[];
  retryItems: string[];
} {
  return {
    phase: state.currentPhase,
    skipItems: state.completedItems,
    // Items that were in-progress should be retried
    retryItems: state.inProgressItems.map((item) => item.id),
  };
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new CheckpointManager instance.
 *
 * @param options - Manager options
 * @returns A new CheckpointManager instance
 */
export function createCheckpointManager(
  options?: CheckpointManagerOptions
): CheckpointManager {
  return new CheckpointManager(options);
}
