/**
 * Debrief Service (ENG-64)
 *
 * Extracts structured session debriefs from session data.
 * Pulls decisions, blockers, patterns, and key outcomes from session context
 * and stores them as AI notes on the epic for cross-session continuity.
 */

import { prisma } from "../lib/db.js";

// =============================================================================
// Types
// =============================================================================

export interface SessionDebrief {
  summary: string;
  decisions: string[];
  blockers: string[];
  patterns: string[];
  nextSteps: string[];
  itemsCompleted: string[];
}

interface SessionData {
  id: string;
  epicId: string;
  summary: string | null;
  nextSteps: string | null;
  blockers: string | null;
  decisions: string | null;
  itemsWorkedOn: string | null;
}

// =============================================================================
// Public Functions
// =============================================================================

/**
 * Extract a structured debrief from session data.
 * Pulls decisions, blockers, patterns from session context.
 */
export function extractDebrief(sessionData: SessionData): SessionDebrief {
  const decisions = parseJsonArray<{ decision: string; rationale?: string }>(
    sessionData.decisions
  ).map((d) => d.rationale ? `${d.decision}: ${d.rationale}` : d.decision);

  const blockers = parseJsonArray<string>(sessionData.blockers);
  const nextSteps = parseJsonArray<string>(sessionData.nextSteps);

  const itemsWorkedOn = parseJsonArray<{
    type: string;
    identifier: string;
    action: string;
  }>(sessionData.itemsWorkedOn);

  const itemsCompleted = itemsWorkedOn
    .filter((item) => item.action === "completed")
    .map((item) => item.identifier);

  // Extract patterns from decisions (decisions that describe reusable approaches)
  const patterns = extractPatterns(decisions, sessionData.summary);

  return {
    summary: sessionData.summary ?? "Session completed without summary.",
    decisions,
    blockers,
    patterns,
    nextSteps,
    itemsCompleted,
  };
}

/**
 * Store a session debrief as an AI note on the epic.
 * Called after endSession completes.
 */
export async function storeDebrief(
  epicId: string,
  sessionId: string,
  debrief: SessionDebrief
): Promise<void> {
  // Build a concise debrief note
  const parts: string[] = [];
  parts.push(`[Session Debrief: ${sessionId}]`);

  if (debrief.summary) {
    parts.push(`Summary: ${debrief.summary}`);
  }

  if (debrief.itemsCompleted.length > 0) {
    parts.push(`Completed: ${debrief.itemsCompleted.join(", ")}`);
  }

  if (debrief.decisions.length > 0) {
    parts.push(`Decisions: ${debrief.decisions.join("; ")}`);
  }

  if (debrief.blockers.length > 0) {
    parts.push(`Blockers: ${debrief.blockers.join("; ")}`);
  }

  if (debrief.patterns.length > 0) {
    parts.push(`Patterns: ${debrief.patterns.join("; ")}`);
  }

  if (debrief.nextSteps.length > 0) {
    parts.push(`Next Steps: ${debrief.nextSteps.join("; ")}`);
  }

  const noteContent = parts.join("\n");

  // Append as AI note on the epic
  const epic = await prisma.epic.findUnique({
    where: { id: epicId },
    select: { aiNotes: true },
  });

  if (!epic) return;

  const existingNotes = parseJsonArray<Record<string, unknown>>(epic.aiNotes);
  existingNotes.push({
    type: "debrief",
    content: noteContent,
    sessionId,
    timestamp: new Date().toISOString(),
  });

  await prisma.epic.update({
    where: { id: epicId },
    data: {
      aiNotes: JSON.stringify(existingNotes),
      lastAiSessionId: sessionId,
      lastAiUpdateAt: new Date(),
    },
  });

  // Cross-epic pattern promotion (ENG-68): check if any patterns
  // should be promoted to global
  await promotePatterns();
}

/**
 * Promote patterns to global when the same pattern name appears across 3+ epics.
 * Sets epicId=null for patterns that have become cross-epic conventions.
 */
export async function promotePatterns(): Promise<number> {
  // Find pattern names that appear across 3+ distinct epics
  const allPatterns = await prisma.pattern.findMany({
    where: {
      epicId: { not: null },
    },
    select: {
      id: true,
      name: true,
      epicId: true,
      confidence: true,
      description: true,
      category: true,
    },
  });

  // Group by name, count distinct epicIds
  const patternsByName = new Map<
    string,
    Array<{ id: string; epicId: string | null; confidence: number; description: string; category: string }>
  >();

  for (const p of allPatterns) {
    const existing = patternsByName.get(p.name) ?? [];
    existing.push(p);
    patternsByName.set(p.name, existing);
  }

  let promoted = 0;

  for (const [name, instances] of patternsByName) {
    // Count distinct epics
    const distinctEpics = new Set(instances.map((i) => i.epicId));
    if (distinctEpics.size < 3) continue;

    // Check if a global pattern already exists for this name
    const existingGlobal = await prisma.pattern.findFirst({
      where: { name, epicId: null },
    });

    if (existingGlobal) continue;

    // Promote: create a global pattern with the highest confidence instance's data
    const bestInstance = instances.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    await prisma.pattern.create({
      data: {
        epicId: null,
        name,
        category: bestInstance.category,
        description: bestInstance.description,
        source: "promoted",
        confidence: Math.min(bestInstance.confidence + 0.1, 1.0),
      },
    });

    promoted++;
  }

  return promoted;
}

// =============================================================================
// Private Helpers
// =============================================================================

function parseJsonArray<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Extract patterns from decisions and summary text.
 * Looks for recurring approaches, conventions, and reusable techniques.
 */
function extractPatterns(decisions: string[], summary: string | null): string[] {
  const patterns: string[] = [];

  // Pattern keywords that indicate reusable approaches
  const patternIndicators = [
    { keyword: "pattern", extract: true },
    { keyword: "convention", extract: true },
    { keyword: "approach", extract: true },
    { keyword: "always", extract: true },
    { keyword: "best practice", extract: true },
    { keyword: "standard", extract: true },
  ];

  for (const decision of decisions) {
    const lower = decision.toLowerCase();
    for (const indicator of patternIndicators) {
      if (lower.includes(indicator.keyword)) {
        patterns.push(decision);
        break;
      }
    }
  }

  // Also check summary for pattern mentions
  if (summary) {
    const sentences = summary.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (
        lower.includes("pattern") ||
        lower.includes("convention") ||
        lower.includes("reusable")
      ) {
        patterns.push(sentence.trim());
      }
    }
  }

  return [...new Set(patterns)];
}
