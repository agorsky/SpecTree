/**
 * Git Module Exports
 *
 * Branch and merge utilities for the orchestrator.
 */

export { BranchManager, createBranchManager } from "./branch-manager.js";
export type { BranchManagerOptions } from "./branch-manager.js";

export { MergeCoordinator, createMergeCoordinator } from "./merge-coordinator.js";
export type { MergeOptions, MergeCoordinatorOptions } from "./merge-coordinator.js";
