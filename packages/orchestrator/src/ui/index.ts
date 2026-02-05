/**
 * UI Module
 *
 * Terminal-based UI components for the orchestrator CLI.
 * Provides progress display, agent status visualization, and
 * other terminal output utilities.
 */

// Progress Display
export {
  ProgressDisplay,
  createProgressDisplay,
  type ProgressDisplayOptions,
} from "./progress.js";

// Agent Status Display
export {
  AgentStatusDisplay,
  createAgentStatusDisplay,
  renderProgressBar,
  type AgentDisplayInfo,
  type AgentStatusDisplayOptions,
} from "./agent-status.js";
