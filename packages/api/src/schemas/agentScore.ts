import { z } from "zod";

export const adjustScoreSchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(1).max(2000),
});

export type AdjustScoreInput = z.infer<typeof adjustScoreSchema>;
