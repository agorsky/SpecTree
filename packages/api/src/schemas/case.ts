import { z } from "zod";

const caseStatusValues = ["open", "hearing", "verdict", "corrected", "dismissed"] as const;
export type CaseStatus = (typeof caseStatusValues)[number];

const caseVerdictValues = ["guilty", "not_guilty", "dismissed"] as const;
export type CaseVerdict = (typeof caseVerdictValues)[number];

const deductionLevelValues = ["none", "minor", "major", "critical"] as const;
export type DeductionLevel = (typeof deductionLevelValues)[number];

const severityValues = ["minor", "major", "critical"] as const;

const evidenceItemSchema = z.object({
  type: z.string().min(1).max(100),
  reference: z.string().min(1).max(500),
  description: z.string().min(1).max(2000),
});

export const fileCaseSchema = z.object({
  accusedAgent: z.string().min(1).max(255),
  lawId: z.string().uuid(),
  evidence: z.array(evidenceItemSchema).min(1),
  severity: z.enum(severityValues),
  filedBy: z.string().min(1).max(255).optional(),
});

export const issueVerdictSchema = z.object({
  verdict: z.enum(caseVerdictValues),
  verdictReason: z.string().min(1).max(5000),
  deductionLevel: z.enum(deductionLevelValues),
});

export const dismissCaseSchema = z.object({
  reason: z.string().min(1).max(5000),
});

export const listCasesQuerySchema = z.object({
  status: z.enum(caseStatusValues).optional(),
  accusedAgent: z.string().optional(),
  severity: z.enum(severityValues).optional(),
  lawId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

export type FileCaseInput = z.infer<typeof fileCaseSchema>;
export type IssueVerdictInput = z.infer<typeof issueVerdictSchema>;
export type DismissCaseInput = z.infer<typeof dismissCaseSchema>;
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>;
