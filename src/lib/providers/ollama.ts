/**
 * Ollama LLM Provider implementation.
 *
 * Uses the ollama npm package for local model inference.
 * Default model: llama3.2 (configurable).
 *
 * Ollama is the fallback/offline provider:
 * - Zero cost (runs locally)
 * - Good for privacy-sensitive requests
 * - Good for dev-mode testing
 * - Will be unavailable in serverless (Vercel) unless OLLAMA_BASE_URL
 *   points to an accessible host.
 */

import { Ollama } from 'ollama';
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

const OLLAMA_MODELS: ModelInfo[] = [
  {
    id: 'llama3.2',
    name: 'Llama 3.2 (Local)',
    provider: 'ollama',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    capabilityTier: 2,
    avgLatencyMs: 3000,
  },
];

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama' as const;
  readonly models = OLLAMA_MODELS;
  private client: Ollama;
  private log = logger.child({ component: 'provider-ollama' });

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.client = new Ollama({ host: baseUrl });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? 60_000; // Longer timeout for local models

    try {
      const result = await Promise.race([
        this.client.chat({
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens ?? 4096,
          },
          stream: false,
        }),
        this.createTimeout(timeoutMs),
      ]);

      if (!result || !('message' in result)) {
        throw new ProviderError('Ollama request timed out', 'ollama', 408, true);
      }

      const latencyMs = Date.now() - startTime;
      const inputTokens = result.prompt_eval_count ?? 0;
      const outputTokens = result.eval_count ?? 0;

      return {
        content: result.message.content,
        model: request.model,
        provider: 'ollama',
        inputTokens,
        outputTokens,
        latencyMs,
        estimatedCostUsd: 0, // Local inference is free
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    try {
      const stream = await this.client.chat({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 4096,
        },
        stream: true,
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        if (chunk.done) {
          inputTokens = chunk.prompt_eval_count ?? 0;
          outputTokens = chunk.eval_count ?? 0;
          const latencyMs = Date.now() - startTime;

          yield {
            content: chunk.message.content,
            done: true,
            usage: {
              inputTokens,
              outputTokens,
              latencyMs,
              estimatedCostUsd: 0,
            },
          };
        } else {
          yield {
            content: chunk.message.content,
            done: false,
          };
        }
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      await this.client.list();
      return {
        name: 'ollama',
        available: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'ollama',
        available: false,
        latencyMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Ollama not reachable',
      };
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new ProviderError('Ollama request timed out', 'ollama', 408, true)),
        ms,
      ),
    );
  }

  private normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;

    const message = error instanceof Error ? error.message : 'Unknown Ollama error';

    // Connection errors (Ollama not running)
    const isConnectionError =
      message.includes('ECONNREFUSED') ||
      message.includes('fetch failed') ||
      message.includes('network');

    this.log.warn('Ollama error', {
      message,
      isConnectionError,
    });

    return new ProviderError(
      `Ollama error: ${message}`,
      'ollama',
      isConnectionError ? 503 : undefined,
      !isConnectionError, // Connection errors are not retryable (Ollama is down)
      error,
    );
  }
}
