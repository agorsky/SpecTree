import { z } from "zod";

/**
 * Validation schemas for AI Context entities.
 * These schemas support the AI session context feature for cross-session continuity.
 */

/**
 * Valid types for AI notes
 */
export const aiNoteTypeValues = [
  "observation",
  "decision",
  "blocker",
  "next-step",
  "context",
] as const;
export type AiNoteType = (typeof aiNoteTypeValues)[number];

/**
 * Schema for a single AI note
 */
export const aiNoteSchema = z.object({
  timestamp: z.string().datetime(),
  sessionId: z.string().max(255).optional(),
  type: z.enum(aiNoteTypeValues),
  content: z.string().min(1).max(10000),
});

export type AiNote = z.infer<typeof aiNoteSchema>;

/**
 * Entity type for AI context operations
 */
export const entityTypeValues = ["feature", "task"] as const;
export type EntityType = (typeof entityTypeValues)[number];

/**
 * Schema for appending an AI note
 */
export const appendAiNoteSchema = z.object({
  type: z.enum(aiNoteTypeValues).describe(
    "The type of note: 'observation' (what was noticed), 'decision' (choice made and why), " +
    "'blocker' (what's preventing progress), 'next-step' (what should happen next), " +
    "'context' (general context/background info)"
  ),
  content: z.string().min(1).max(10000).describe(
    "The content of the note. Should be clear and actionable for future AI sessions."
  ),
  sessionId: z.string().max(255).optional().describe(
    "Optional identifier for the AI session adding this note."
  ),
});

export type AppendAiNoteInput = z.infer<typeof appendAiNoteSchema>;

/**
 * Schema for setting AI context
 */
export const setAiContextSchema = z.object({
  context: z.string().max(50000).describe(
    "Structured context for AI consumption. Can be free-form text or structured data. " +
    "This replaces the entire context field."
  ),
  sessionId: z.string().max(255).optional().describe(
    "Optional identifier for the AI session setting this context."
  ),
});

export type SetAiContextInput = z.infer<typeof setAiContextSchema>;

/**
 * Response schema for AI context retrieval
 */
export const aiContextResponseSchema = z.object({
  aiContext: z.string().nullable(),
  aiNotes: z.array(aiNoteSchema),
  lastAiSessionId: z.string().nullable(),
  lastAiUpdateAt: z.string().datetime().nullable(),
});

export type AiContextResponse = z.infer<typeof aiContextResponseSchema>;
