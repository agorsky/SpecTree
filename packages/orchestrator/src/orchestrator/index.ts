/**
 * Orchestrator Module
 *
 * Core orchestration logic for the SpecTree Parallel Agent Orchestrator CLI.
 * This module provides:
 * - Plan generation from natural language prompts
 * - Execution orchestration (single and parallel agents)
 * - Phase-based execution management
 * - Agent pool for parallel agent execution
 */

// Plan Generator
export {
  PlanGenerator,
  PlanParsingError,
  generatePlan,
  type Complexity,
  type PlannedTask,
  type PlannedFeature,
  type PlannerResponse,
  type GeneratedTask,
  type GeneratedFeature,
  type GeneratedPlan,
  type GeneratePlanOptions,
} from "./plan-generator.js";

// Orchestrator
export {
  Orchestrator,
  createOrchestrator,
  type OrchestratorOptions,
  type RunOptions,
  type RunResult,
  type ItemResult,
  type ProgressEvent,
  type OrchestratorEvents,
} from "./orchestrator.js";

// Agent Pool
export {
  AgentPool,
  createAgentPool,
  type Agent,
  type AgentStatus,
  type AgentResult,
  type PoolStatus,
  type AgentPoolOptions,
  type AgentPoolEvents,
} from "./agent-pool.js";

// Phase Executor
export {
  PhaseExecutor,
  createPhaseExecutor,
  type ItemResult as PhaseItemResult,
  type PhaseResult,
  type PhaseExecutorOptions,
  type PhaseExecutorEvents,
  type TaskProgressEvent,
} from "./phase-executor.js";

// Recovery / Checkpoint Manager
export {
  CheckpointManager,
  createCheckpointManager,
  createExecutionState,
  findResumePoint,
  formatDuration,
  CHECKPOINT_VERSION,
  DEFAULT_STATE_DIR,
  CHECKPOINT_FILENAME,
  MAX_CHECKPOINT_AGE_MS,
  type ExecutionState,
  type InProgressItem,
  type CheckpointManagerOptions,
  type LoadCheckpointResult,
} from "./recovery.js";
