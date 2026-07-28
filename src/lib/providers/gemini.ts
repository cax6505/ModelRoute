/**
 * Gemini LLM Provider implementation.
 *
 * Uses @google/generative-ai SDK for Google Gemini API access.
 * Free-tier models: gemini-2.0-flash, gemini-2.0-flash-lite
 *
 * SECURITY: API key is only used server-side, never exposed to client.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
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

const GEMINI_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    costPer1MInput: 0.10,
    costPer1MOutput: 0.40,
    capabilityTier: 2,
    avgLatencyMs: 1200,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    costPer1MInput: 0.02,
    costPer1MOutput: 0.10,
    capabilityTier: 1,
    avgLatencyMs: 600,
  },
];

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini' as const;
  readonly models = GEMINI_MODELS;
  private genAI: GoogleGenerativeAI;
  private log = logger.child({ component: 'provider-gemini' });

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? 30_000;

    const model = this.genAI.getGenerativeModel({
      model: request.model,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
    });

    try {
      const result = await Promise.race([
        model.generateContent(
          this.formatMessages(request.messages),
        ),
        this.createTimeout(timeoutMs),
      ]);

      if (!result || !('response' in result)) {
        throw new ProviderError('Gemini request timed out', 'gemini', 408, true);
      }

      const response = result.response;
      const latencyMs = Date.now() - startTime;
      const text = response.text();
      const usage = response.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;
      const modelInfo = this.models.find((m) => m.id === request.model) ?? GEMINI_MODELS[0];

      return {
        content: text,
        model: request.model,
        provider: 'gemini',
        inputTokens,
        outputTokens,
        latencyMs,
        estimatedCostUsd:
          (inputTokens / 1_000_000) * modelInfo.costPer1MInput +
          (outputTokens / 1_000_000) * modelInfo.costPer1MOutput,
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();

    const model = this.genAI.getGenerativeModel({
      model: request.model,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
    });

    try {
      const result = await model.generateContentStream(
        this.formatMessages(request.messages),
      );

      let inputTokens = 0;
      let outputTokens = 0;
      let lastChunk = false;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        const usage = chunk.usageMetadata;

        if (usage) {
          inputTokens = usage.promptTokenCount ?? inputTokens;
          outputTokens = usage.candidatesTokenCount ?? outputTokens;
        }

        // Check if this is the final chunk
        if (chunk.candidates?.[0]?.finishReason) {
          lastChunk = true;
        }

        if (lastChunk) {
          const latencyMs = Date.now() - startTime;
          const modelInfo = this.models.find((m) => m.id === request.model) ?? GEMINI_MODELS[0];

          yield {
            content: text,
            done: true,
            usage: {
              inputTokens,
              outputTokens,
              latencyMs,
              estimatedCostUsd:
                (inputTokens / 1_000_000) * modelInfo.costPer1MInput +
                (outputTokens / 1_000_000) * modelInfo.costPer1MOutput,
            },
          };
        } else if (text) {
          yield { content: text, done: false };
        }
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      await model.generateContent('test');
      return {
        name: 'gemini',
        available: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'gemini',
        available: false,
        latencyMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert our Message[] format to Gemini's content format.
   * System messages are prepended to the first user message.
   */
  private formatMessages(messages: CompletionRequest['messages']): string {
    const parts: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        parts.push(`[System Instructions]\n${msg.content}\n[End System Instructions]\n`);
      } else if (msg.role === 'user') {
        parts.push(msg.content);
      } else if (msg.role === 'assistant') {
        parts.push(`[Previous Assistant Response]\n${msg.content}\n`);
      }
    }

    return parts.join('\n');
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new ProviderError('Gemini request timed out', 'gemini', 408, true)), ms),
    );
  }

  private normalizeError(error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;

    const message = error instanceof Error ? error.message : 'Unknown Gemini error';
    const isRateLimit = message.includes('429') || message.includes('RESOURCE_EXHAUSTED');
    const isServerError = message.includes('500') || message.includes('503');
    const isRetryable = isRateLimit || isServerError;

    const statusCode = isRateLimit ? 429 : isServerError ? 500 : undefined;

    this.log.warn('Gemini API error', {
      statusCode,
      isRetryable,
      message,
    });

    return new ProviderError(
      `Gemini error: ${message}`,
      'gemini',
      statusCode,
      isRetryable,
      error,
    );
  }
}
