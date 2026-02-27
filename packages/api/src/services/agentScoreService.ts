import { prisma } from "../lib/db.js";
import { NotFoundError } from "../errors/index.js";

// =============================================================================
// Point values
// =============================================================================

const DEDUCTION_MAP: Record<string, number> = {
  none: 0,
  minor: 5,
  major: 15,
  critical: 30,
};

const CONVICTION_BONUS = 10;
const FALSE_BUST_PENALTY = 10;
const CLEAN_CYCLE_BONUS = 5;

// =============================================================================
// Helpers
// =============================================================================

async function getOrThrow(agentName: string) {
  const record = await prisma.agentScore.findUnique({
    where: { agentName },
  });
  if (!record) {
    throw new NotFoundError(`Agent score for '${agentName}' not found`);
  }
  return record;
}

// =============================================================================
// Service Methods
// =============================================================================

export async function getScore(agentName: string) {
  return getOrThrow(agentName);
}

export async function getLeaderboard() {
  return prisma.agentScore.findMany({
    orderBy: { totalScore: "desc" },
  });
}

export async function updateOnVerdict(
  agentName: string,
  deductionLevel: string
) {
  const points = DEDUCTION_MAP[deductionLevel] ?? 0;

  await getOrThrow(agentName);

  if (points === 0) {
    return prisma.agentScore.update({
      where: { agentName },
      data: {
        bustsReceived: { increment: 1 },
      },
    });
  }

  return prisma.agentScore.update({
    where: { agentName },
    data: {
      totalScore: { decrement: points },
      bustsReceived: { increment: 1 },
    },
  });
}

export async function updateOnConviction(barneyName: string) {
  await getOrThrow(barneyName);

  return prisma.agentScore.update({
    where: { agentName: barneyName },
    data: {
      totalScore: { increment: CONVICTION_BONUS },
      bustsIssued: { increment: 1 },
    },
  });
}

export async function updateOnFalseBust(barneyName: string) {
  await getOrThrow(barneyName);

  return prisma.agentScore.update({
    where: { agentName: barneyName },
    data: {
      totalScore: { decrement: FALSE_BUST_PENALTY },
      bustsIssued: { increment: 1 },
    },
  });
}

export async function updateOnCleanCycle(agentName: string) {
  await getOrThrow(agentName);

  return prisma.agentScore.update({
    where: { agentName },
    data: {
      totalScore: { increment: CLEAN_CYCLE_BONUS },
      cleanCycles: { increment: 1 },
    },
  });
}

export async function setLastAudit(agentName: string) {
  await getOrThrow(agentName);

  return prisma.agentScore.update({
    where: { agentName },
    data: {
      lastAuditAt: new Date(),
    },
  });
}

export async function adjustScore(
  agentName: string,
  delta: number,
  _reason: string
) {
  await getOrThrow(agentName);

  if (delta >= 0) {
    return prisma.agentScore.update({
      where: { agentName },
      data: {
        totalScore: { increment: delta },
      },
    });
  }

  return prisma.agentScore.update({
    where: { agentName },
    data: {
      totalScore: { decrement: Math.abs(delta) },
    },
  });
}
