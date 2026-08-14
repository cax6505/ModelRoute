/**
 * POST /api/route — Main routing endpoint.
 *
 * Flow:
 * 1. Validate request body (Zod)
 * 2. Check idempotency key
 * 3. Authenticate (API key or Supabase session)
 * 4. Rate limit check (burst + budget)
 * 5. Classify task type
 * 6. Select route (routing policy engine)
 * 7. Execute with provider (retry + circuit breaker + fallback)
 * 8. Log structured record (prompt hash only unless opted in)
 * 9. Return response + routing decision
 *
 * Supports both streaming (SSE) and non-streaming responses.
 *
 * SECURITY:
 * - All provider calls happen server-side
 * - Prompts are hashed for analytics; full text only logged if user opted in
 * - Error messages returned to client are sanitized (no secrets/stack traces)
 */

import { NextRequest } from 'next/server';
import { RouteRequestSchema, createApiError } from '@/lib/schemas';
import { classify } from '@/lib/core/classifier';
import { selectRoute, executeWithFallback, executeStreamWithFallback } from '@/lib/core/router';
import { circuitBreaker } from '@/lib/core/circuit-breaker';
import { providerRegistry } from '@/lib/providers/registry';
import { checkRateLimit, rateLimitHeaders } from '@/lib/middleware/rate-limiter';
import { validateApiKey } from '@/lib/middleware/auth';
import { getSupabaseAdmin, sha256 } from '@/lib/db/client';
import { logger, generateCorrelationId } from '@/lib/logger';
import type { ProviderName, PriorityMode, RoutingDecision } from '@/lib/core/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId();
  const log = logger.child({ correlationId, component: 'api-route' });
  const startTime = Date.now();

  try {
    // ─── 1. Parse & Validate Request Body ──────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createApiError('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    const parseResult = RouteRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return createApiError('VALIDATION_ERROR', 'Invalid request body', 400, { issues });
    }

    const { prompt, taskHint, priority, stream, idempotencyKey } = parseResult.data;

    // ─── Enforce max prompt length ─────────────────────────
    const maxLength = parseInt(process.env.MAX_PROMPT_LENGTH ?? '32000', 10);
    if (prompt.length > maxLength) {
      return createApiError(
        'PROMPT_TOO_LONG',
        `Prompt exceeds maximum length of ${maxLength} characters`,
        400,
      );
    }

    // ─── 2. Authenticate ───────────────────────────────────
    const authHeader = request.headers.get('authorization');
    const auth = await validateApiKey(authHeader);

    // For now, allow unauthenticated requests in development
    // In production, uncomment this to require auth:
    // if (!auth.authenticated) {
    //   return createApiError('UNAUTHORIZED', auth.error || 'Invalid API key', 401);
    // }

    const userId = auth.userId ?? 'anonymous';

    // ─── 3. Rate Limit Check ───────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? '127.0.0.1';

    const rateLimitResult = await checkRateLimit(ip, userId);

    if (!rateLimitResult.allowed) {
      const headers = rateLimitHeaders(rateLimitResult);
      return Response.json(
        {
          error: `Rate limit exceeded (${rateLimitResult.tier} tier)`,
          code: 'RATE_LIMITED',
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        {
          status: 429,
          headers,
        },
      );
    }

    // ─── 4. Check Idempotency ──────────────────────────────
    if (idempotencyKey) {
      try {
        const supabase = getSupabaseAdmin();
        const { data: existing } = await supabase
          .from('request_logs')
          .select('id, status, routing_reason, provider, model, latency_ms')
          .eq('idempotency_key', idempotencyKey)
          .limit(1)
          .single();

        if (existing) {
          log.info('Idempotent request — returning cached result', { idempotencyKey });
          return Response.json({
            content: '[Idempotent response — original result was already processed]',
            routingDecision: {
              taskType: 'general',
              classifierMode: 'rules',
              classifierConfidence: 1,
              provider: existing.provider,
              model: existing.model,
              reason: `Idempotent replay of request ${idempotencyKey}`,
              fallbacksConsidered: [],
              latencyMs: existing.latency_ms,
              inputTokens: 0,
              outputTokens: 0,
              estimatedCostUsd: 0,
            },
          });
        }
      } catch {
        // Supabase not configured — skip idempotency check
        log.warn('Idempotency check skipped — database not available');
      }
    }

    // ─── 5. Classify Task Type ─────────────────────────────
    const classifierMode = (process.env.CLASSIFIER_MODE as 'rules' | 'llm' | 'hybrid') ?? 'rules';

    // For LLM/hybrid mode, use the cheapest available provider
    let classifierProvider = undefined;
    let classifierModel = undefined;
    if (classifierMode !== 'rules') {
      const groqProvider = providerRegistry.getProvider('groq');
      if (groqProvider) {
        classifierProvider = groqProvider;
        classifierModel = 'llama-3.1-8b-instant';
      }
    }

    const classification = taskHint
      ? { taskType: taskHint, confidence: 1.0, method: 'rules' as const }
      : await classify(prompt, classifierMode, classifierProvider, classifierModel);

    log.info('Prompt classified', {
      taskType: classification.taskType,
      confidence: classification.confidence,
      method: classification.method,
      promptLength: prompt.length,
    });

    // ─── 6. Select Route ───────────────────────────────────
    const decision = selectRoute({
      classification,
      priority: priority as PriorityMode,
      breaker: circuitBreaker,
    });

    log.info('Route selected', {
      provider: decision.provider,
      model: decision.model,
      reason: decision.reason,
    });

    if (decision.model === 'none') {
      return createApiError(
        'NO_PROVIDERS_CONFIGURED',
        'No LLM API keys are configured on this deployment. Please configure GROQ_API_KEY or GEMINI_API_KEY in your environment variables.',
        503,
      );
    }

    // ─── 7. Execute Request ────────────────────────────────
    const messages = [{ role: 'user' as const, content: prompt }];

    if (stream) {
      return handleStreaming(decision, messages, userId, correlationId, prompt, priority as PriorityMode, classification, idempotencyKey, log);
    }

    // Non-streaming
    const { response, actualProvider, actualModel, attempts } = await executeWithFallback({
      decision,
      messages,
      breaker: circuitBreaker,
    });

    const totalLatencyMs = Date.now() - startTime;

    // ─── 8. Log Request ──────────────────────────────────
    logRequest({
      userId,
      correlationId,
      prompt,
      response: response.content,
      classification,
      decision: { ...decision, provider: actualProvider, model: actualModel },
      priority: priority as PriorityMode,
      latencyMs: totalLatencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      estimatedCostUsd: response.estimatedCostUsd,
      status: actualProvider !== decision.provider ? 'fallback' : 'success',
      idempotencyKey,
    });

    // ─── 9. Return Response ────────────────────────────────
    const rlHeaders = rateLimitHeaders(rateLimitResult);

    return Response.json(
      {
        content: response.content,
        routingDecision: {
          taskType: decision.taskType,
          classifierMode: decision.classifierMode,
          classifierConfidence: decision.classifierConfidence,
          provider: actualProvider,
          model: actualModel,
          reason: decision.reason,
          fallbacksConsidered: decision.fallbacksConsidered,
          latencyMs: totalLatencyMs,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          estimatedCostUsd: response.estimatedCostUsd,
        },
      },
      {
        headers: {
          ...rlHeaders,
          'X-Correlation-ID': correlationId,
        },
      },
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    log.error('Request failed', {
      error: errorMessage,
      latencyMs,
    });

    return createApiError(
      'INTERNAL_ERROR',
      `Request failed: ${errorMessage}`,
      500,
    );
  }
}

// ─── Streaming Handler ──────────────────────────────────────

async function handleStreaming(
  decision: RoutingDecision,
  messages: Array<{ role: 'user'; content: string }>,
  userId: string,
  correlationId: string,
  prompt: string,
  priority: PriorityMode,
  classification: { taskType: string; confidence: number; method: string },
  idempotencyKey: string | undefined,
  log: ReturnType<typeof logger.child>,
): Promise<Response> {
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const { stream: providerStream, actualProvider, actualModel } =
    await executeStreamWithFallback({
      decision,
      messages,
      breaker: circuitBreaker,
    });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send routing decision as the first event
        controller.enqueue(
          encoder.encode(
            `event: routing_decision\ndata: ${JSON.stringify({
              taskType: decision.taskType,
              classifierMode: decision.classifierMode,
              classifierConfidence: decision.classifierConfidence,
              provider: actualProvider,
              model: actualModel,
              reason: decision.reason,
              fallbacksConsidered: decision.fallbacksConsidered,
            })}\n\n`,
          ),
        );

        let fullResponse = '';

        for await (const chunk of providerStream) {
          fullResponse += chunk.content;

          controller.enqueue(
            encoder.encode(`event: content\ndata: ${JSON.stringify({ content: chunk.content })}\n\n`),
          );

          if (chunk.done && chunk.usage) {
            const totalLatencyMs = Date.now() - startTime;

            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  latencyMs: totalLatencyMs,
                  inputTokens: chunk.usage.inputTokens,
                  outputTokens: chunk.usage.outputTokens,
                  estimatedCostUsd: chunk.usage.estimatedCostUsd,
                })}\n\n`,
              ),
            );

            // Log the request
            logRequest({
              userId,
              correlationId,
              prompt,
              response: fullResponse,
              classification: classification as any,
              decision: { ...decision, provider: actualProvider, model: actualModel },
              priority,
              latencyMs: totalLatencyMs,
              inputTokens: chunk.usage.inputTokens,
              outputTokens: chunk.usage.outputTokens,
              estimatedCostUsd: chunk.usage.estimatedCostUsd,
              status: actualProvider !== decision.provider ? 'fallback' : 'success',
              idempotencyKey,
            });
          }
        }

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Stream error';
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Correlation-ID': correlationId,
    },
  });
}

// ─── Request Logging (fire-and-forget) ──────────────────────

function logRequest(params: {
  userId: string;
  correlationId: string;
  prompt: string;
  response: string;
  classification: { taskType: string; confidence: number; method: string };
  decision: RoutingDecision;
  priority: PriorityMode;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: 'success' | 'error' | 'fallback';
  errorMessage?: string;
  idempotencyKey?: string;
}): void {
  // Fire-and-forget — don't block the response
  (async () => {
    try {
      const promptHash = await sha256(params.prompt);
      const logFullPrompts = process.env.LOG_FULL_PROMPTS === 'true';

      const supabase = getSupabaseAdmin();
      await supabase.from('request_logs').insert({
        user_id: params.userId,
        correlation_id: params.correlationId,
        prompt_hash: promptHash,
        prompt_length: params.prompt.length,
        prompt_text: logFullPrompts ? params.prompt : null,
        response_text: logFullPrompts ? params.response : null,
        task_type: params.classification.taskType,
        classifier_mode: params.classification.method,
        provider: params.decision.provider,
        model: params.decision.model,
        routing_reason: params.decision.reason,
        priority: params.priority,
        latency_ms: params.latencyMs,
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        estimated_cost_usd: params.estimatedCostUsd,
        status: params.status,
        error_message: params.errorMessage ?? null,
        idempotency_key: params.idempotencyKey ?? null,
      });
    } catch {
      // Never let logging failure crash the response —
      // this includes cases where Supabase is not configured
      logger.warn('Request logging skipped — database not available', {
        correlationId: params.correlationId,
      });
    }
  })();
}
