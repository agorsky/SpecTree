export interface TaskPhaseItem {
  id: string;
  title: string;
  featureId: string;
  featureTitle: string;
  executionOrder: number;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string[];
}

export interface TaskPhase {
  phaseKey: string;
  items: TaskPhaseItem[];
}

export interface ExecutionPlan {
  epicId: string;
  phases: TaskPhase[];
}
