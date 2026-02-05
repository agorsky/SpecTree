/**
 * Local State Management for Orchestrator Sessions
 *
 * Manages local state file that tracks active orchestration sessions.
 * This allows the status command to show current progress and the
 * continue command to resume interrupted work.
 *
 * State is stored in ~/.spectree/state.json
 */

import Conf from "conf";
import type { Agent, AgentStatus } from "../orchestrator/agent-pool.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Serialized agent info for state storage
 */
export interface SerializedAgent {
  id: string;
  taskId: string;
  taskTitle: string;
  branch: string;
  status: AgentStatus;
  progress: number;
  startedAt: string; // ISO date string
  currentFile?: string;
  currentActivity?: string;
}

/**
 * Completed item record
 */
export interface CompletedItem {
  identifier: string;
  title: string;
  duration: number; // milliseconds
  completedAt: string; // ISO date string
}

/**
 * Session state representing an active orchestration
 */
export interface SessionState {
  /** Epic being orchestrated */
  epicId: string;
  /** Epic name for display */
  epicName: string;
  /** When the session started */
  startedAt: string; // ISO date string
  /** When the state was last updated */
  updatedAt: string; // ISO date string
  /** SpecTree session ID */
  sessionId?: string;
  /** Active agents (for parallel execution) */
  activeAgents: SerializedAgent[];
  /** Items completed in this session */
  completedItems: CompletedItem[];
  /** Items that failed */
  failedItems: string[];
  /** Total items in the epic */
  totalItems: number;
  /** Overall progress percentage (0-100) */
  progress: number;
  /** Current phase number (1-indexed) */
  currentPhase?: number;
  /** Total phases */
  totalPhases?: number;
  /** Next items waiting to be executed */
  upNext?: string[];
  /** Items blocking progress */
  blockedBy?: string[];
}

/**
 * Recent epic record for display when no active session
 */
export interface RecentEpic {
  id: string;
  name: string;
  progress: number;
  lastWorkedAt: string; // ISO date string
}

/**
 * Full state stored in local file
 */
interface StoredState {
  activeSession: SessionState | null;
  recentEpics: RecentEpic[];
}

// =============================================================================
// State Store
// =============================================================================

const stateStore = new Conf<StoredState>({
  projectName: "spectree",
  configName: "state",
  defaults: {
    activeSession: null,
    recentEpics: [],
  },
});

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the active orchestration session state.
 * Returns null if no active session.
 */
export function getActiveState(): SessionState | null {
  return stateStore.get("activeSession") as SessionState | null;
}

/**
 * Set the active orchestration session state.
 */
export function setActiveState(state: SessionState): void {
  // Update the updatedAt timestamp
  const updatedState: SessionState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  stateStore.set("activeSession", updatedState);
}

/**
 * Clear the active session (orchestration completed or abandoned).
 */
export function clearActiveState(): void {
  const activeSession = getActiveState();
  if (activeSession) {
    // Add to recent epics before clearing
    addRecentEpic({
      id: activeSession.epicId,
      name: activeSession.epicName,
      progress: activeSession.progress,
      lastWorkedAt: new Date().toISOString(),
    });
  }
  stateStore.set("activeSession", null);
}

/**
 * Update agents in the active session.
 */
export function updateActiveAgents(agents: Agent[]): void {
  const state = getActiveState();
  if (!state) return;

  const serializedAgents: SerializedAgent[] = agents.map((agent) => ({
    id: agent.id,
    taskId: agent.taskId,
    taskTitle: agent.item.title,
    branch: agent.branch,
    status: agent.status,
    progress: agent.progress,
    startedAt: agent.startedAt.toISOString(),
  }));

  setActiveState({
    ...state,
    activeAgents: serializedAgents,
  });
}

/**
 * Mark an item as completed in the active session.
 */
export function markItemCompleted(
  identifier: string,
  title: string,
  duration: number
): void {
  const state = getActiveState();
  if (!state) return;

  const completedItem: CompletedItem = {
    identifier,
    title,
    duration,
    completedAt: new Date().toISOString(),
  };

  // Remove from active agents if present
  const activeAgents = state.activeAgents.filter(
    (a) => a.taskId !== identifier
  );

  // Calculate new progress
  const completedCount = state.completedItems.length + 1;
  const progress =
    state.totalItems > 0
      ? Math.round((completedCount / state.totalItems) * 100)
      : 0;

  setActiveState({
    ...state,
    activeAgents,
    completedItems: [...state.completedItems, completedItem],
    progress,
  });
}

/**
 * Mark an item as failed in the active session.
 */
export function markItemFailed(identifier: string): void {
  const state = getActiveState();
  if (!state) return;

  // Remove from active agents if present
  const activeAgents = state.activeAgents.filter(
    (a) => a.taskId !== identifier
  );

  setActiveState({
    ...state,
    activeAgents,
    failedItems: [...state.failedItems, identifier],
  });
}

/**
 * Get list of recent epics.
 */
export function getRecentEpics(): RecentEpic[] {
  return stateStore.get("recentEpics") as RecentEpic[] ?? [];
}

/**
 * Add an epic to the recent list.
 */
export function addRecentEpic(epic: RecentEpic): void {
  const recentEpics = getRecentEpics();

  // Remove if already exists
  const filtered = recentEpics.filter((e) => e.id !== epic.id);

  // Add to front and limit to 10
  const updated = [epic, ...filtered].slice(0, 10);

  stateStore.set("recentEpics", updated);
}

/**
 * Get path to the state file (useful for debugging).
 */
export function getStatePath(): string {
  return stateStore.path;
}

/**
 * Reset all state (useful for testing).
 */
export function resetState(): void {
  stateStore.clear();
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate estimated time remaining based on completed items.
 * Returns milliseconds.
 */
export function estimateRemainingTime(state: SessionState): number | null {
  if (state.completedItems.length === 0) {
    return null;
  }

  // Calculate average duration per item
  const totalDuration = state.completedItems.reduce(
    (sum, item) => sum + item.duration,
    0
  );
  const avgDuration = totalDuration / state.completedItems.length;

  // Calculate remaining items
  const completedCount = state.completedItems.length;
  const remainingCount = state.totalItems - completedCount - state.failedItems.length;

  if (remainingCount <= 0) {
    return 0;
  }

  return Math.round(avgDuration * remainingCount);
}

/**
 * Format duration in human-readable format.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/**
 * Format relative time (e.g., "5 minutes ago", "2 hours ago").
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "yesterday";
  }

  return `${diffDays} days ago`;
}
