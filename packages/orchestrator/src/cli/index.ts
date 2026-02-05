/**
 * CLI Commands Registry
 */

export { runCommand } from "./commands/run.js";
export { continueCommand } from "./commands/continue.js";
export { statusCommand, type StatusOptions } from "./commands/status.js";
export { authCommand, getApiToken, getApiUrl, isAuthenticated } from "./commands/auth.js";
export { pauseCommand, type PauseOptions } from "./commands/pause.js";
export {
  resumeCommand,
  canResume,
  getResumePreview,
  getPausedAgentCount,
  getRunningAgentCount,
  type ResumeOptions,
  type ResumeResult,
} from "./commands/resume.js";

// State management
export {
  getActiveState,
  setActiveState,
  clearActiveState,
  updateActiveAgents,
  markItemCompleted,
  markItemFailed,
  getRecentEpics,
  addRecentEpic,
  getStatePath,
  resetState,
  estimateRemainingTime,
  formatDuration,
  formatRelativeTime,
  type SessionState,
  type SerializedAgent,
  type CompletedItem,
  type RecentEpic,
} from "./state.js";
