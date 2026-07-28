/**
 * Provider Registry — singleton that manages all LLM provider instances.
 *
 * Only instantiates providers that have valid API keys configured.
 * Provides lookup by name, listing of available providers, and
 * model information aggregation.
 */

import type { LLMProvider, ProviderName, ModelInfo } from '@/lib/core/types';
import { GroqProvider } from './groq';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'provider-registry' });

class ProviderRegistry {
  private providers: Map<ProviderName, LLMProvider> = new Map();
  private initialized = false;

  /**
   * Initialize providers based on available API keys.
   * Called lazily on first access — not at module load time
   * to avoid crashing during Next.js build.
   */
  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Groq
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      this.providers.set('groq', new GroqProvider(groqKey));
      log.info('Groq provider initialized');
    } else {
      log.warn('Groq provider not available: GROQ_API_KEY not set');
    }

    // Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.providers.set('gemini', new GeminiProvider(geminiKey));
      log.info('Gemini provider initialized');
    } else {
      log.warn('Gemini provider not available: GEMINI_API_KEY not set');
    }

    // Ollama — always attempt (it's local, no key needed)
    const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.providers.set('ollama', new OllamaProvider(ollamaUrl));
    log.info('Ollama provider initialized', { baseUrl: ollamaUrl });
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
  findModel(modelId: string): { provider: LLMProvider; model: ModelInfo } | undefined {
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

/** Singleton instance */
export const providerRegistry = new ProviderRegistry();
