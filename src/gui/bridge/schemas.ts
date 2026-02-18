import { z } from "zod";

export const historyQuerySchema = z.object({
  argKey: z.string().min(1),
});

export const historyBodySchema = z.object({
  argKey: z.string(),
  value: z.string(),
});

export const browsePathBodySchema = z.object({
  path: z.string(),
});

export const runRequestSchema = z.object({
  command: z.string(),
  args: z.record(z.unknown()),
});

export const historyFileSchema = z.object({
  records: z.record(z.unknown()),
});

