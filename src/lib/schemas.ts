import { z } from 'zod';
import { TASK_TYPES, PRIORITY_MODES, PROVIDER_NAMES } from '@/lib/core/types';

/**
 * Zod schemas for all external input/output boundaries.
 * Every API request body is validated against these schemas
 * before reaching business logic.
 */

// ─── API Route Request ───────────────────────────────────────

export const RouteRequestSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty')
    .max(100_000, 'Prompt exceeds maximum length'),
  taskHint: z.enum(TASK_TYPES).optional(),
  priority: z.enum(PRIORITY_MODES).optional().default('quality'),
  stream: z.boolean().optional().default(false),
  idempotencyKey: z.string().uuid().optional(),
});

export type RouteRequest = z.infer<typeof RouteRequestSchema>;

// ─── API Route Response ──────────────────────────────────────

export const RoutingDecisionResponseSchema = z.object({
  taskType: z.enum(TASK_TYPES),
  classifierMode: z.enum(['rules', 'llm', 'hybrid'] as const),
  classifierConfidence: z.number().min(0).max(1),
  provider: z.enum(PROVIDER_NAMES),
  model: z.string(),
  reason: z.string(),
  fallbacksConsidered: z.array(
    z.object({
      provider: z.enum(PROVIDER_NAMES),
      model: z.string(),
      reason: z.string(),
    }),
  ),
  latencyMs: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  estimatedCostUsd: z.number(),
});

export const RouteResponseSchema = z.object({
  content: z.string(),
  routingDecision: RoutingDecisionResponseSchema,
});

export type RouteResponse = z.infer<typeof RouteResponseSchema>;

// ─── API Key Management ─────────────────────────────────────

export const CreateApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Key name is required')
    .max(100, 'Key name too long'),
  rateLimitRpm: z.number().int().positive().max(1000).optional().default(60),
});

export type CreateApiKeyRequest = z.infer<typeof CreateApiKeySchema>;

// ─── Routing Rules ───────────────────────────────────────────

export const RoutingCandidateSchema = z.object({
  provider: z.enum(PROVIDER_NAMES),
  model: z.string().min(1),
  weight: z.number().min(0).max(100).default(1),
});

export const UpdateRoutingRuleSchema = z.object({
  taskType: z.enum(TASK_TYPES),
  priorityMode: z.enum(PRIORITY_MODES),
  candidates: z.array(RoutingCandidateSchema).min(1),
  isActive: z.boolean().optional().default(true),
});

export type UpdateRoutingRuleRequest = z.infer<typeof UpdateRoutingRuleSchema>;

// ─── Eval ────────────────────────────────────────────────────

export const StartEvalSchema = z.object({
  name: z.string().min(1).max(200),
  useJudge: z.boolean().optional().default(false),
});

export type StartEvalRequest = z.infer<typeof StartEvalSchema>;

export const ScoreEvalResultSchema = z.object({
  benchmarkId: z.string().uuid(),
  qualityScore: z.number().int().min(1).max(5),
});

export type ScoreEvalResultRequest = z.infer<typeof ScoreEvalResultSchema>;

// ─── History Query ───────────────────────────────────────────

export const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  taskType: z.enum(TASK_TYPES).optional(),
  provider: z.enum(PROVIDER_NAMES).optional(),
  status: z.enum(['success', 'error', 'fallback'] as const).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sortBy: z
    .enum(['created_at', 'latency_ms', 'estimated_cost_usd'] as const)
    .optional()
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc'] as const).optional().default('desc'),
});

export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

// ─── Stats Query ─────────────────────────────────────────────

export const StatsQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all'] as const).optional().default('7d'),
});

export type StatsQuery = z.infer<typeof StatsQuerySchema>;

// ─── Helper: Structured API Error ────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Create a standardized API error response.
 * SECURITY: Never include raw prompts, API keys, or stack traces.
 */
export function createApiError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  const body: ApiError = { error: message, code, details };
  return Response.json(body, { status });
}
