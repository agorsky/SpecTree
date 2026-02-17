/**
 * Session State Machine Service
 *
 * Implements a state machine to track AI session progress and enforce
 * compliance checkpoints before state transitions.
 *
 * States:
 * - STARTED: Session initialized, epic/feature selection
 * - PLANNING: Defining structured descriptions, execution metadata
 * - IMPLEMENTING: Writing code, making changes
 * - VALIDATING: Running tests and validations
 * - COMPLETING: Final checks before session end
 *
 * This is opt-in initially to avoid breaking existing workflows.
 */

import { prisma } from "../lib/db.js";
import { NotFoundError } from "../errors/index.js";

/**
 * Session states in the workflow
 */
export enum SessionState {
  STARTED = "STARTED",
  PLANNING = "PLANNING",
  IMPLEMENTING = "IMPLEMENTING",
  VALIDATING = "VALIDATING",
  COMPLETING = "COMPLETING",
}

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  [SessionState.STARTED]: [SessionState.PLANNING],
  [SessionState.PLANNING]: [SessionState.IMPLEMENTING],
  [SessionState.IMPLEMENTING]: [SessionState.VALIDATING],
  [SessionState.VALIDATING]: [SessionState.COMPLETING, SessionState.IMPLEMENTING], // Can go back to implementing if validations fail
  [SessionState.COMPLETING]: [], // Terminal state
};

/**
 * Result of a state transition attempt
 */
export interface TransitionResult {
  success: boolean;
  newState?: SessionState;
  errors?: string[];
  warnings?: string[];
}

/**
 * Get the current state of a session
 */
export async function getSessionState(sessionId: string): Promise<SessionState> {
  const session = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    select: { stateMachineState: true },
  });

  if (!session) {
    throw new NotFoundError(`Session ${sessionId} not found`);
  }

  // Default to STARTED if no state is set
  return (session.stateMachineState as SessionState) || SessionState.STARTED;
}

/**
 * Check preconditions for STARTED → PLANNING transition
 */
async function checkStartedToPlanning(sessionId: string): Promise<string[]> {
  const errors: string[] = [];

  const session = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    select: { epicId: true },
  });

  if (!session) {
    errors.push("Session not found");
    return errors;
  }

  // Precondition: Epic must be selected
  if (!session.epicId) {
    errors.push("Epic/feature must be selected before planning (epicId is null)");
  }

  return errors;
}

/**
 * Check preconditions for PLANNING → IMPLEMENTING transition
 */
async function checkPlanningToImplementing(sessionId: string): Promise<string[]> {
  const errors: string[] = [];

  const session = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    include: {
      epic: {
        include: {
          features: {
            select: {
              id: true,
              structuredDesc: true,
              executionOrder: true,
              estimatedComplexity: true,
            },
          },
        },
      },
    },
  });

  if (!session?.epic) {
    errors.push("Epic not found or not associated with session");
    return errors;
  }

  // Precondition: At least one feature must have structured description set
  const featuresWithDesc = session.epic.features.filter(
    (f) => f.structuredDesc && f.structuredDesc !== "null" && f.structuredDesc !== "{}"
  );

  if (featuresWithDesc.length === 0 && session.epic.features.length > 0) {
    errors.push(
      "At least one feature must have a structured description before implementing"
    );
  }

  // Check for required execution metadata
  const featuresWithoutExecOrder = session.epic.features.filter((f) => !f.executionOrder);
  const featuresWithoutComplexity = session.epic.features.filter((f) => !f.estimatedComplexity);

  if (featuresWithoutExecOrder.length > 0) {
    errors.push(
      `${featuresWithoutExecOrder.length} feature(s) missing executionOrder`
    );
  }

  if (featuresWithoutComplexity.length > 0) {
    errors.push(
      `${featuresWithoutComplexity.length} feature(s) missing estimatedComplexity`
    );
  }

  return errors;
}

/**
 * Check preconditions for IMPLEMENTING → VALIDATING transition
 */
async function checkImplementingToValidating(sessionId: string): Promise<string[]> {
  const errors: string[] = [];

  // Precondition: Code changes should be committed (check for git commits or code context)
  const session = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    include: {
      epic: {
        include: {
          features: {
            select: {
              gitCommits: true,
              relatedFiles: true,
            },
          },
        },
      },
    },
  });

  if (!session?.epic) {
    errors.push("Epic not found or not associated with session");
    return errors;
  }

  // Check if any features have code changes tracked
  const hasCodeChanges = session.epic.features.some(
    (f) => {
      const commits = f.gitCommits ? JSON.parse(f.gitCommits) : [];
      const files = f.relatedFiles ? JSON.parse(f.relatedFiles) : [];
      return commits.length > 0 || files.length > 0;
    }
  );

  if (!hasCodeChanges) {
    errors.push(
      "No code changes detected. Link files or commits before validating " +
      "(use spectree__link_code_file or spectree__link_commit)"
    );
  }

  return errors;
}

/**
 * Check preconditions for VALIDATING → COMPLETING transition
 */
async function checkValidatingToCompleting(sessionId: string): Promise<string[]> {
  const errors: string[] = [];

  // Precondition: Validations must have passed
  const session = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    include: {
      epic: {
        include: {
          features: {
            include: {
              tasks: {
                select: {
                  validationChecks: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session?.epic) {
    errors.push("Epic not found or not associated with session");
    return errors;
  }

  // Check validation status for all tasks
  let totalValidations = 0;
  let passedValidations = 0;
  let failedValidations = 0;

  for (const feature of session.epic.features) {
    for (const task of feature.tasks) {
      if (task.validationChecks) {
        try {
          const checks = JSON.parse(task.validationChecks);
          if (Array.isArray(checks)) {
            for (const check of checks) {
              totalValidations++;
              if (check.status === "passed") {
                passedValidations++;
              } else if (check.status === "failed") {
                failedValidations++;
              }
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }
  }

  if (totalValidations > 0 && failedValidations > 0) {
    errors.push(
      `${failedValidations} validation check(s) failed. Fix failures before completing.`
    );
  }

  if (totalValidations === 0) {
    errors.push(
      "No validation checks defined. Add validation checks to tasks before completing."
    );
  }

  return errors;
}

/**
 * Enforce state transition with precondition checks
 */
export async function enforceTransition(
  sessionId: string,
  targetState: SessionState,
  force: boolean = false
): Promise<TransitionResult> {
  // Get current state
  const currentState = await getSessionState(sessionId);

  // Check if transition is valid
  const allowedTransitions = VALID_TRANSITIONS[currentState];
  if (!allowedTransitions.includes(targetState)) {
    return {
      success: false,
      errors: [
        `Invalid transition from ${currentState} to ${targetState}. ` +
        `Allowed transitions: ${allowedTransitions.join(", ") || "none (terminal state)"}`,
      ],
    };
  }

  // Check preconditions (unless forced)
  let preconditionErrors: string[] = [];
  if (!force) {
    switch (`${currentState}->${targetState}`) {
      case `${SessionState.STARTED}->${SessionState.PLANNING}`:
        preconditionErrors = await checkStartedToPlanning(sessionId);
        break;
      case `${SessionState.PLANNING}->${SessionState.IMPLEMENTING}`:
        preconditionErrors = await checkPlanningToImplementing(sessionId);
        break;
      case `${SessionState.IMPLEMENTING}->${SessionState.VALIDATING}`:
        preconditionErrors = await checkImplementingToValidating(sessionId);
        break;
      case `${SessionState.VALIDATING}->${SessionState.COMPLETING}`:
        preconditionErrors = await checkValidatingToCompleting(sessionId);
        break;
    }
  }

  if (preconditionErrors.length > 0 && !force) {
    return {
      success: false,
      errors: preconditionErrors,
    };
  }

  // Perform the transition
  await prisma.aiSession.update({
    where: { id: sessionId },
    data: { stateMachineState: targetState },
  });

  // Log the transition
  console.log(
    `[Session State Machine] ${sessionId}: ${currentState} → ${targetState}` +
    (force ? " (forced)" : "")
  );

  // Build result with proper type handling
  const result: TransitionResult = {
    success: true,
    newState: targetState,
  };
  
  if (force && preconditionErrors.length > 0) {
    result.warnings = preconditionErrors;
  }

  return result;
}

/**
 * Get allowed next states from current state
 */
export async function getAllowedTransitions(sessionId: string): Promise<SessionState[]> {
  const currentState = await getSessionState(sessionId);
  return VALID_TRANSITIONS[currentState];
}
