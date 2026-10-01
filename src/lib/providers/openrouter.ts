import {
  type LLMProvider,
  type ModelInfo,
  type CompletionRequest,
  type CompletionResponse,
  type StreamChunk,
  type ProviderHealth,
  ProviderError,
} from "@/lib/core/types";
import { logger } from "@/lib/logger";

const OPENROUTER_MODELS: ModelInfo[] = [
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router",
    provider: "openrouter",
    contextWindow: 32_768,
    maxOutputTokens: 4_096,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    capabilityTier: 2,
    avgLatencyMs: 2500,
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 (Free)",
    provider: "openrouter",
    contextWindow: 163_840,
    maxOutputTokens: 4_096,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    capabilityTier: 3,
    avgLatencyMs: 5000,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (Free)",
    provider: "openrouter",
    contextWindow: 131_072,
    maxOutputTokens: 4_096,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    capabilityTier: 3,
    avgLatencyMs: 3000,
  },
];

type OpenRouterResponse = {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number };
};

export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter" as const;
  readonly models = OPENROUTER_MODELS;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly log = logger.child({ component: "provider-openrouter" });

  constructor(apiKey: string, baseUrl = "https://openrouter.ai/api/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    const response = await this.request(request, false);
    const data = await this.parseResponse(response);

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      model: request.model,
      provider: "openrouter",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - startTime,
      estimatedCostUsd: 0,
    };
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();
    const response = await this.request(request, true);
    if (!response.body) {
      throw new ProviderError(
        "OpenRouter returned an empty stream",
        "openrouter",
        502,
        true,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            yield {
              content: "",
              done: true,
              usage: {
                inputTokens,
                outputTokens,
                latencyMs: Date.now() - startTime,
                estimatedCostUsd: 0,
              },
            };
            return;
          }

          const chunk = JSON.parse(payload) as OpenRouterResponse;
          const content = chunk.choices?.[0]?.delta?.content ?? "";
          inputTokens = chunk.usage?.prompt_tokens ?? inputTokens;
          outputTokens = chunk.usage?.completion_tokens ?? outputTokens;
          if (content) yield { content, done: false };
        }

        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      content: "",
      done: true,
      usage: {
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
        estimatedCostUsd: 0,
      },
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return {
        name: "openrouter",
        available: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: "openrouter",
        available: false,
        latencyMs: Date.now() - startTime,
        errorMessage:
          error instanceof Error ? error.message : "OpenRouter not reachable",
      };
    }
  }

  private async request(
    request: CompletionRequest,
    stream: boolean,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? 30_000,
    );
    const abortRequest = () => controller.abort();
    request.signal?.addEventListener("abort", abortRequest, { once: true });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://modelroute.local",
          "X-Title": "ModelRoute",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          stream,
        }),
        signal: controller.signal,
      });

      if (!response.ok) return response;
      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown OpenRouter error";
      const isTimeout = error instanceof Error && error.name === "AbortError";
      this.log.warn("OpenRouter request failed", { message, isTimeout });
      throw new ProviderError(
        isTimeout
          ? "OpenRouter request timed out"
          : `OpenRouter request failed: ${message}`,
        "openrouter",
        isTimeout ? 408 : undefined,
        true,
        error,
      );
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", abortRequest);
    }
  }

  private async parseResponse(response: Response): Promise<OpenRouterResponse> {
    let data: OpenRouterResponse;
    try {
      data = (await response.json()) as OpenRouterResponse;
    } catch (error) {
      throw new ProviderError(
        "OpenRouter returned invalid JSON",
        "openrouter",
        response.status,
        true,
        error,
      );
    }

    if (!response.ok || data.error) {
      const statusCode = data.error?.code ?? response.status;
      throw new ProviderError(
        `OpenRouter API error: ${data.error?.message ?? response.statusText}`,
        "openrouter",
        statusCode,
        statusCode >= 500 || statusCode === 429,
      );
    }
    return data;
  }
}
