import { z } from 'zod';

export const travelSchema = z.object({
  transport_mode: z.enum(['air', 'road', 'rail', 'sea']),
  origin: z.string().trim().min(1).max(200),
  destination: z.string().trim().min(1).max(200),
  weight_kg: z.number().positive(),
}).strict();

export const emissionsSchema = z.object({
  emissions: z.object({ wtw: z.number().nonnegative() }),
}).passthrough();
