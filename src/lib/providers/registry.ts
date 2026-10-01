/**
 * Provider Registry — singleton that manages all LLM provider instances.
 *
 * Only instantiates providers that have valid API keys configured.
 * Provides lookup by name, listing of available providers, and
 * model information aggregation.
 */

import type { LLMProvider, ProviderName, ModelInfo } from "@/lib/core/types";
import { GroqProvider } from "./groq";
import { GeminiProvider } from "./gemini";
import { OpenRouterProvider } from "./openrouter";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "provider-registry" });

class ProviderRegistry {
  private providers: Map<ProviderName, LLMProvider> = new Map();
  private initialized = false;

  /**
   * Initialize providers based on available API keys.
   * Called lazily on first access — not at module load time
   * to avoid crashing during Next.js build.
   *
   * In development mode, re-initializes on every access to pick up
   * env var changes without requiring a full server restart.
   */
  private init(): void {
    // In development, always re-read env vars to handle hot module reloads
    // and cases where env vars weren't available during initial module load.
    if (this.initialized && process.env.NODE_ENV !== "development") return;

    // If re-initializing in dev mode, only do so if providers are empty
    // (avoids unnecessary re-creation of provider instances on every call).
    if (this.initialized && this.providers.size > 0) return;

    this.initialized = true;
    this.providers.clear();

    // Groq
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      this.providers.set("groq", new GroqProvider(groqKey));
      log.info("Groq provider initialized");
    } else {
      log.warn("Groq provider not available: GROQ_API_KEY not set");
    }

    // Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.providers.set("gemini", new GeminiProvider(geminiKey));
      log.info("Gemini provider initialized");
    } else {
      log.warn("Gemini provider not available: GEMINI_API_KEY not set");
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      this.providers.set("openrouter", new OpenRouterProvider(openRouterKey));
      log.info("OpenRouter provider initialized");
    } else {
      log.warn("OpenRouter provider not available: OPENROUTER_API_KEY not set");
    }

    if (this.providers.size === 0) {
      log.error(
        "No LLM providers initialized — check that GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY is set in .env.local",
      );
    } else {
      log.info(
        `Provider registry initialized with ${this.providers.size} provider(s): ${Array.from(this.providers.keys()).join(", ")}`,
      );
    }
  }

  /**
   * Force re-initialization of providers.
   * Useful when env vars have changed at runtime.
   */
  reset(): void {
    this.initialized = false;
    this.providers.clear();
  }

  /**
   * Get a specific provider by name.
   * Returns undefined if the provider is not configured.
   */
  getProvider(name: ProviderName): LLMProvider | undefined {
    this.init();
    return this.providers.get(name);
  }

  /**
   * Get all available (configured) providers.
   */
  getAvailableProviders(): LLMProvider[] {
    this.init();
    return Array.from(this.providers.values());
  }

  /**
   * Get all available provider names.
   */
  getAvailableProviderNames(): ProviderName[] {
    this.init();
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a specific provider is configured.
   */
  hasProvider(name: ProviderName): boolean {
    this.init();
    return this.providers.has(name);
  }

  /**
   * Get all models across all configured providers.
   */
  getAllModels(): ModelInfo[] {
    this.init();
    const models: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.models);
    }
    return models;
  }

  /**
   * Find a specific model by ID across all providers.
   */
  findModel(
    modelId: string,
  ): { provider: LLMProvider; model: ModelInfo } | undefined {
    this.init();
    for (const provider of this.providers.values()) {
      const model = provider.models.find((m) => m.id === modelId);
      if (model) {
        return { provider, model };
      }
    }
    return undefined;
  }
}

/**
 * Singleton instance — uses globalThis to survive Next.js hot module reloads.
 * Without this, the module can be re-evaluated during HMR, creating a new
 * ProviderRegistry that may not have access to env vars yet.
 */
const globalForProviders = globalThis as unknown as {
  providerRegistry: ProviderRegistry | undefined;
};

export const providerRegistry =
  globalForProviders.providerRegistry ?? new ProviderRegistry();

if (process.env.NODE_ENV !== "production") {
  globalForProviders.providerRegistry = providerRegistry;
}
