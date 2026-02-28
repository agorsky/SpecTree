/**
 * Memory Compiler Service (ENG-66)
 *
 * Synthesizes AI notes, decisions, and patterns for an epic into a concise
 * briefing under 2000 tokens for injection into new sessions.
 */

import { prisma } from "../lib/db.js";

// =============================================================================
// Types
// =============================================================================

export interface CompiledBriefing {
  briefing: string;
  tokenCount: number;
  sources: string[];
}

// Rough token estimate: ~4 chars per token
const MAX_TOKENS = 2000;
const CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;

// =============================================================================
// Public Functions
// =============================================================================

/**
 * Compile a briefing for an epic by synthesizing AI notes, decisions, and patterns.
 * Returns a concise briefing under 2000 tokens.
 */
export async function compileBriefing(epicId: string): Promise<CompiledBriefing> {
  // Fetch all data sources in parallel
  const [epic, decisions, epicPatterns, globalPatterns] = await Promise.all([
    prisma.epic.findUnique({
      where: { id: epicId },
      select: {
        id: true,
        name: true,
        aiNotes: true,
        aiContext: true,
      },
    }),
    prisma.decision.findMany({
      where: { epicId },
      orderBy: { madeAt: "desc" },
      take: 20,
    }),
    prisma.pattern.findMany({
      where: { epicId },
      orderBy: { confidence: "desc" },
      take: 10,
    }),
    prisma.pattern.findMany({
      where: { epicId: null },
      orderBy: { confidence: "desc" },
      take: 10,
    }),
  ]);

  if (!epic) {
    return { briefing: "", tokenCount: 0, sources: [] };
  }

  const sources: string[] = [];
  const sections: string[] = [];

  // Section 1: Epic context
  if (epic.aiContext) {
    sections.push(`## Epic Context\n${truncate(epic.aiContext, 400)}`);
    sources.push("epic.aiContext");
  }

  // Section 2: Recent decisions (high-impact first)
  const highImpactDecisions = decisions.filter(
    (d) => d.impact === "high" || d.impact === "medium"
  );
  const relevantDecisions =
    highImpactDecisions.length > 0 ? highImpactDecisions.slice(0, 5) : decisions.slice(0, 5);

  if (relevantDecisions.length > 0) {
    const decisionLines = relevantDecisions.map(
      (d) => `- ${d.decision}${d.rationale ? `: ${d.rationale}` : ""}`
    );
    sections.push(`## Key Decisions\n${decisionLines.join("\n")}`);
    sources.push("decisions");
  }

  // Section 3: Patterns (epic-scoped + global)
  const allPatterns = [...epicPatterns, ...globalPatterns];
  if (allPatterns.length > 0) {
    const patternLines = allPatterns
      .slice(0, 8)
      .map(
        (p) =>
          `- [${p.category}] ${p.name}: ${p.description}${p.epicId === null ? " (global)" : ""}`
      );
    sections.push(`## Patterns & Conventions\n${patternLines.join("\n")}`);
    sources.push("patterns");
  }

  // Section 4: Session debriefs from AI notes
  const aiNotes = parseJsonArray<{
    type: string;
    content: string;
    sessionId?: string;
  }>(epic.aiNotes);

  const debriefNotes = aiNotes.filter((n) => n.type === "debrief");
  if (debriefNotes.length > 0) {
    // Take the most recent 3 debriefs
    const recentDebriefs = debriefNotes.slice(-3);
    const debriefLines = recentDebriefs.map((n) => truncate(n.content, 300));
    sections.push(`## Recent Session Debriefs\n${debriefLines.join("\n\n")}`);
    sources.push("debriefs");
  }

  // Section 5: Other AI notes (non-debrief)
  const otherNotes = aiNotes.filter((n) => n.type !== "debrief");
  if (otherNotes.length > 0) {
    const recentNotes = otherNotes.slice(-5);
    const noteLines = recentNotes.map((n) => `- [${n.type}] ${truncate(n.content, 100)}`);
    sections.push(`## AI Notes\n${noteLines.join("\n")}`);
    sources.push("aiNotes");
  }

  // Combine and truncate to stay under token limit
  let briefing = `# Briefing: ${epic.name}\n\n${sections.join("\n\n")}`;

  if (briefing.length > MAX_CHARS) {
    briefing = briefing.substring(0, MAX_CHARS - 20) + "\n\n[truncated]";
  }

  const tokenCount = Math.ceil(briefing.length / CHARS_PER_TOKEN);

  return { briefing, tokenCount, sources };
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

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
