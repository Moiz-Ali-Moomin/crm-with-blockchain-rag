import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

// ── Pipeline DTOs ────────────────────────────────────────────────────────────

export const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(255),
  isDefault: z.boolean().default(false),
});

export const UpdatePipelineSchema = CreatePipelineSchema.partial();

export const FilterPipelineSchema = PaginationSchema.extend({
  isDefault: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

// ── Stage DTOs ───────────────────────────────────────────────────────────────

export const CreateStageSchema = z.object({
  name: z.string().min(1).max(255),
  position: z.number().int().nonnegative(),
  probability: z.number().min(0).max(1).default(0),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
  color: z.string().max(20).optional(),
});

export const UpdateStageSchema = CreateStageSchema.partial();

export const ReorderStagesSchema = z.object({
  stageIds: z.array(z.string().uuid()).min(1),
});

// ── Inferred types ───────────────────────────────────────────────────────────

export type CreatePipelineDto = z.infer<typeof CreatePipelineSchema>;
export type UpdatePipelineDto = z.infer<typeof UpdatePipelineSchema>;
export type FilterPipelineDto = z.infer<typeof FilterPipelineSchema>;
export type CreateStageDto = z.infer<typeof CreateStageSchema>;
export type UpdateStageDto = z.infer<typeof UpdateStageSchema>;
export type ReorderStagesDto = z.infer<typeof ReorderStagesSchema>;
