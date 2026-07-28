/**
 * Groq LLM Provider implementation.
 *
 * Uses the groq-sdk for OpenAI-compatible API access.
 * Available free-tier models: llama-3.1-8b-instant, llama-3.3-70b-versatile
 *
 * SECURITY: API key is only used server-side, never exposed to client.
 */

import Groq from 'groq-sdk';
import {
  type LLMProvider,
  type ModelInfo,
  type CompletionRequest,
  type CompletionResponse,
  type StreamChunk,
  type ProviderHealth,
  ProviderError,
} from '@/lib/core/types';
import { logger } from '@/lib/logger';

const GROQ_MODELS: ModelInfo[] = [
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    costPer1MInput: 0.05,
    costPer1MOutput: 0.08,
    capabilityTier: 1,
    avgLatencyMs: 200,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    contextWindow: 131_072,
    maxOutputTokens: 32_768,
    costPer1MInput: 0.59,
    costPer1MOutput: 0.79,
    capabilityTier: 3,
    avgLatencyMs: 800,
  },
];

export class GroqProvider implements LLMProvider {
  readonly name = 'groq' as const;
  readonly models = GROQ_MODELS;
  private client: Groq;
  private log = logger.child({ component: 'provider-groq' });

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? 30_000;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external signal if provided
    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await this.client.chat.completions.create(
        {
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
        },
        { signal: controller.signal },
      );

      const latencyMs = Date.now() - startTime;
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const model = this.models.find((m) => m.id === request.model) ?? GROQ_MODELS[0];

      return {
        content: response.choices[0]?.message?.content ?? '',
        model: request.model,
        provider: 'groq',
        inputTokens,
        outputTokens,
        latencyMs,
        estimatedCostUsd:
          (inputTokens / 1_000_000) * model.costPer1MInput +
          (outputTokens / 1_000_000) * model.costPer1MOutput,
      };
    } catch (error) {
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? 60_000;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          stream: true,
        },
        { signal: controller.signal },
      );

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? '';
        const finishReason = chunk.choices[0]?.finish_reason;

        const chunkUsage = (chunk as unknown as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
        if (chunkUsage) {
          inputTokens = chunkUsage.prompt_tokens ?? 0;
          outputTokens = chunkUsage.completion_tokens ?? 0;
        }

        if (finishReason === 'stop' || finishReason === 'length') {
          const latencyMs = Date.now() - startTime;
          const model = this.models.find((m) => m.id === request.model) ?? GROQ_MODELS[0];

          yield {
            content,
            done: true,
            usage: {
              inputTokens,
              outputTokens,
              latencyMs,
              estimatedCostUsd:
                (inputTokens / 1_000_000) * model.costPer1MInput +
                (outputTokens / 1_000_000) * model.costPer1MOutput,
            },
          };
        } else if (content) {
          yield { content, done: false };
        }
      }
    } catch (error) {
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      await this.client.models.list();
      return {
        name: 'groq',
        available: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'groq',
        available: false,
        latencyMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;

    // AbortController timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return new ProviderError(
        'Groq request timed out',
        'groq',
        408,
        true, // Timeouts are retryable
        error,
      );
    }

    // Groq SDK error
    if (error instanceof Groq.APIError) {
      const statusCode = error.status;
      const isRetryable = statusCode >= 500 || statusCode === 429;

      this.log.warn('Groq API error', {
        statusCode,
        isRetryable,
        message: error.message,
      });

      return new ProviderError(
        `Groq API error: ${error.message}`,
        'groq',
        statusCode,
        isRetryable,
        error,
      );
    }

    return new ProviderError(
      `Groq unknown error: ${error instanceof Error ? error.message : 'Unknown'}`,
      'groq',
      undefined,
      true,
      error,
    );
  }
}
