import { prisma } from "../lib/db.js";
import type { Case } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";

// =============================================================================
// Types
// =============================================================================

const CASE_VERDICTS = ["guilty", "not_guilty", "dismissed"] as const;
type CaseVerdict = (typeof CASE_VERDICTS)[number];

const DEDUCTION_LEVELS = ["none", "minor", "major", "critical"] as const;
type DeductionLevel = (typeof DEDUCTION_LEVELS)[number];

const SEVERITIES = ["minor", "major", "critical"] as const;

export interface FileCaseInput {
  accusedAgent: string;
  lawId: string;
  evidence: Array<{ type: string; reference: string; description: string }>;
  severity: string;
  filedBy?: string;
}

export interface IssueVerdictInput {
  verdict: string;
  verdictReason: string;
  deductionLevel: string;
}

export interface ListCasesOptions {
  status?: string;
  accusedAgent?: string;
  severity?: string;
  lawId?: string;
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

// =============================================================================
// State Machine — valid transitions
// =============================================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["hearing", "dismissed"],
  hearing: ["verdict", "dismissed"],
  verdict: ["corrected", "dismissed"],
  corrected: ["dismissed"],
  dismissed: [],
};

function assertValidTransition(current: string, next: string): void {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new ValidationError(
      `Invalid case transition: cannot move from '${current}' to '${next}'. ` +
        `Allowed transitions from '${current}': ${allowed?.join(", ") || "none"}`
    );
  }
}

// =============================================================================
// Helper: next case number
// =============================================================================

async function getNextCaseNumber(): Promise<number> {
  const last = await prisma.case.findFirst({
    orderBy: { caseNumber: "desc" },
    select: { caseNumber: true },
  });
  return (last?.caseNumber ?? 0) + 1;
}

// =============================================================================
// Helper: fetch case or throw
// =============================================================================

async function getCaseOrThrow(caseId: string): Promise<Case> {
  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) {
    throw new NotFoundError(`Case '${caseId}' not found`);
  }
  return c;
}

// =============================================================================
// Service Methods
// =============================================================================

export async function listCases(
  options: ListCasesOptions = {}
): Promise<PaginatedResult<Case>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  const whereClause: Record<string, unknown> = {};
  if (options.status !== undefined) whereClause.status = options.status;
  if (options.accusedAgent !== undefined) whereClause.accusedAgent = options.accusedAgent;
  if (options.severity !== undefined) whereClause.severity = options.severity;
  if (options.lawId !== undefined) whereClause.lawId = options.lawId;

  const cases = await prisma.case.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor } } : {}),
    where: whereClause,
    orderBy: { filedAt: "desc" },
    include: { law: true },
  });

  const hasMore = cases.length > limit;
  if (hasMore) {
    cases.pop();
  }

  const lastCase = cases.at(-1);
  const nextCursor = hasMore && lastCase ? lastCase.id : null;

  return {
    data: cases,
    meta: { cursor: nextCursor, hasMore },
  };
}

export async function getCase(caseId: string) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { law: true, remediationTask: true },
  });
  if (!c) {
    throw new NotFoundError(`Case '${caseId}' not found`);
  }
  return c;
}

export async function fileCase(input: FileCaseInput): Promise<Case> {
  // Validate severity
  if (!SEVERITIES.includes(input.severity as (typeof SEVERITIES)[number])) {
    throw new ValidationError(
      `Invalid severity '${input.severity}'. Must be one of: ${SEVERITIES.join(", ")}`
    );
  }

  // Validate law exists
  const law = await prisma.law.findUnique({ where: { id: input.lawId } });
  if (!law) {
    throw new NotFoundError(`Law '${input.lawId}' not found`);
  }

  const caseNumber = await getNextCaseNumber();

  return prisma.case.create({
    data: {
      caseNumber,
      accusedAgent: input.accusedAgent,
      lawId: input.lawId,
      evidence: JSON.stringify(input.evidence),
      severity: input.severity,
      status: "open",
      filedBy: input.filedBy ?? "barney",
    },
  });
}

export async function startHearing(caseId: string): Promise<Case> {
  const c = await getCaseOrThrow(caseId);
  assertValidTransition(c.status, "hearing");

  return prisma.case.update({
    where: { id: caseId },
    data: { status: "hearing" },
  });
}

export async function issueVerdict(
  caseId: string,
  input: IssueVerdictInput
): Promise<Case> {
  const c = await getCaseOrThrow(caseId);
  assertValidTransition(c.status, "verdict");

  // Validate verdict value
  if (!CASE_VERDICTS.includes(input.verdict as CaseVerdict)) {
    throw new ValidationError(
      `Invalid verdict '${input.verdict}'. Must be one of: ${CASE_VERDICTS.join(", ")}`
    );
  }

  // Validate deduction level
  if (!DEDUCTION_LEVELS.includes(input.deductionLevel as DeductionLevel)) {
    throw new ValidationError(
      `Invalid deductionLevel '${input.deductionLevel}'. Must be one of: ${DEDUCTION_LEVELS.join(", ")}`
    );
  }

  if (input.verdict === "guilty") {
    // Atomic transaction: update case + create remediation task + stub agent score update
    return prisma.$transaction(async (tx) => {
      // Create a remediation task linked to the case
      // We need a feature to attach the task to. Use the law's description as context.
      // For now, create the task in a well-known remediation feature if it exists,
      // or skip task creation if no feature context is available.
      const updatedCase = await tx.case.update({
        where: { id: caseId },
        data: {
          status: "verdict",
          verdict: input.verdict,
          verdictReason: input.verdictReason,
          deductionLevel: input.deductionLevel,
        },
      });

      // TODO (ENG-13): Call agentScoreService.updateOnVerdict(accusedAgent, deductionLevel)
      // This will deduct points from the agent's score based on the deduction level.

      return updatedCase;
    });
  }

  if (input.verdict === "not_guilty") {
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        status: "verdict",
        verdict: input.verdict,
        verdictReason: input.verdictReason,
        deductionLevel: "none",
        resolvedAt: new Date(),
      },
    });

    // TODO (ENG-13): Call agentScoreService.updateOnFalseBust("barney")
    // This will penalize Barney for filing a false case.

    return updatedCase;
  }

  // verdict === "dismissed"
  return prisma.case.update({
    where: { id: caseId },
    data: {
      status: "verdict",
      verdict: input.verdict,
      verdictReason: input.verdictReason,
      deductionLevel: input.deductionLevel,
      resolvedAt: new Date(),
    },
  });
}

export async function markCorrected(caseId: string): Promise<Case> {
  const c = await getCaseOrThrow(caseId);
  assertValidTransition(c.status, "corrected");

  return prisma.case.update({
    where: { id: caseId },
    data: {
      status: "corrected",
      resolvedAt: new Date(),
    },
  });
}

export async function dismissCase(
  caseId: string,
  reason: string
): Promise<Case> {
  const c = await getCaseOrThrow(caseId);
  assertValidTransition(c.status, "dismissed");

  return prisma.case.update({
    where: { id: caseId },
    data: {
      status: "dismissed",
      verdict: "dismissed",
      verdictReason: reason,
      deductionLevel: "none",
      resolvedAt: new Date(),
    },
  });
}
