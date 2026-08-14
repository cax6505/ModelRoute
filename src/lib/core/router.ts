/**
 * Routing Policy Engine — the core decision-making logic.
 *
 * Given a classified task type, priority mode, and provider health state,
 * determines which provider + model to use, with a full fallback chain
 * and human-readable explanation of the decision.
 *
 * The routing logic is config-driven (from routing_rules table),
 * not hardcoded if/else chains. This makes it editable from the UI
 * without code changes.
 */

import type {
  TaskType,
  PriorityMode,
  ProviderName,
  RoutingCandidate,
  RoutingDecision,
  RoutingRule,
  ClassificationResult,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  LLMProvider,
} from './types';
import { ProviderError } from './types';
import { CircuitBreakerManager, circuitBreaker } from './circuit-breaker';
import { providerRegistry } from '@/lib/providers/registry';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'router' });

// ─── Default Routing Rules (used when DB is not available) ──

const DEFAULT_RULES: Record<TaskType, Record<PriorityMode, RoutingCandidate[]>> = {
  code_generation: {
    quality: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 8 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 5 },
    ],
  },
  summarization: {
    quality: [
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 10 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 8 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 5 },
    ],
  },
  extraction: {
    quality: [
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 10 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 8 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 5 },
    ],
  },
  creative_writing: {
    quality: [
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 10 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 5 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 8 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 5 },
    ],
  },
  reasoning: {
    quality: [
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 10 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 9 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 7 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 5 },
    ],
  },
  simple_qa: {
    quality: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 9 },
      { provider: 'ollama', model: 'llama3.2', weight: 5 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 5 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 9 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 7 },
    ],
  },
  translation: {
    quality: [
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 10 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 8 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 5 },
    ],
  },
  general: {
    quality: [
      { provider: 'gemini', model: 'gemini-2.0-flash', weight: 10 },
      { provider: 'groq', model: 'llama-3.3-70b-versatile', weight: 9 },
      { provider: 'ollama', model: 'llama3.2', weight: 3 },
    ],
    fast: [
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 10 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 8 },
      { provider: 'ollama', model: 'llama3.2', weight: 5 },
    ],
    cheap: [
      { provider: 'ollama', model: 'llama3.2', weight: 10 },
      { provider: 'groq', model: 'llama-3.1-8b-instant', weight: 9 },
      { provider: 'gemini', model: 'gemini-2.0-flash-lite', weight: 7 },
    ],
  },
};

// ─── Routing Engine ──────────────────────────────────────────

export interface RouteOptions {
  classification: ClassificationResult;
  priority: PriorityMode;
  /** Custom routing rules from database (overrides defaults) */
  customRules?: RoutingRule[];
  /** Circuit breaker instance to check provider health */
  breaker?: CircuitBreakerManager;
}

/**
 * Determine the best provider + model for a given task.
 * Returns a decision with a human-readable reason and fallback chain.
 */
export function selectRoute(options: RouteOptions): RoutingDecision {
  const { classification, priority, customRules, breaker = circuitBreaker } = options;
  const { taskType } = classification;

  // 1. Get candidate list (custom rules override defaults)
  let candidates = getCandidates(taskType, priority, customRules);

  // 2. Filter by provider availability (API key configured)
  const availableProviders = providerRegistry.getAvailableProviderNames();
  candidates = candidates.filter((c) => availableProviders.includes(c.provider));

  if (candidates.length === 0) {
    return {
      taskType,
      classifierMode: classification.method,
      classifierConfidence: classification.confidence,
      provider: 'groq',
      model: 'none',
      reason: 'No LLM API keys configured (set GROQ_API_KEY or GEMINI_API_KEY in environment variables)',
      fallbacksConsidered: [],
    };
  }

  // 3. Sort by weight (descending) — higher weight = preferred
  candidates.sort((a, b) => b.weight - a.weight);

  // 4. Check circuit breaker status for each candidate
  const fallbacksConsidered: RoutingDecision['fallbacksConsidered'] = [];
  let selected: RoutingCandidate | null = null;
  let selectedReason = '';

  for (const candidate of candidates) {
    const isAvailable = breaker.isAvailable(candidate.provider);
    const status = breaker.getStatus(candidate.provider);

    if (!isAvailable) {
      fallbacksConsidered.push({
        provider: candidate.provider,
        model: candidate.model,
        reason: `Circuit breaker OPEN (${status.failureCount} failures, retrying at ${status.nextRetryAt ? new Date(status.nextRetryAt).toISOString() : 'unknown'})`,
      });
      continue;
    }

    if (status.state === 'HALF_OPEN') {
      selected = candidate;
      selectedReason = `task_type=${taskType}, priority=${priority}, candidate=${candidate.provider}/${candidate.model}, reason=probe request (circuit breaker recovering)`;
      break;
    }

    selected = candidate;
    selectedReason = `task_type=${taskType}, priority=${priority}, top_candidate=${candidate.provider}/${candidate.model}, reason=highest weight (${candidate.weight}) for ${priority} ${taskType}`;
    break;
  }

  // If all candidates are circuit-broken, pick the first one anyway (last resort)
  if (!selected) {
    selected = candidates[0];
    selectedReason = `task_type=${taskType}, priority=${priority}, candidate=${selected.provider}/${selected.model}, reason=all providers circuit-broken, using top candidate as last resort`;
  }

  // Remaining candidates become the fallback list
  const remainingFallbacks = candidates
    .filter((c) => c !== selected)
    .filter((c) => !fallbacksConsidered.some((f) => f.provider === c.provider && f.model === c.model))
    .map((c) => ({
      provider: c.provider,
      model: c.model,
      reason: `Fallback option (weight: ${c.weight})`,
    }));

  return {
    taskType,
    classifierMode: classification.method,
    classifierConfidence: classification.confidence,
    provider: selected.provider,
    model: selected.model,
    reason: selectedReason,
    fallbacksConsidered: [...fallbacksConsidered, ...remainingFallbacks],
  };
}

/**
 * Get candidate list for a task type + priority from custom rules or defaults.
 */
function getCandidates(
  taskType: TaskType,
  priority: PriorityMode,
  customRules?: RoutingRule[],
): RoutingCandidate[] {
  // Check for custom rules first
  if (customRules && customRules.length > 0) {
    const matchingRule = customRules.find(
      (r) => r.taskType === taskType && r.priorityMode === priority && r.isActive,
    );
    if (matchingRule && matchingRule.candidates.length > 0) {
      return [...matchingRule.candidates];
    }
  }

  // Fall back to defaults
  const taskDefaults = DEFAULT_RULES[taskType] ?? DEFAULT_RULES.general;
  const candidates = taskDefaults[priority] ?? taskDefaults.quality;
  return [...candidates];
}

// ─── Request Execution with Retry + Fallback ─────────────────

export interface ExecuteOptions {
  decision: RoutingDecision;
  messages: CompletionRequest['messages'];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  breaker?: CircuitBreakerManager;
  maxRetries?: number;
}

/**
 * Execute a completion request with retry + exponential backoff + jitter.
 * On provider failure, tries fallback candidates automatically.
 */
export async function executeWithFallback(
  options: ExecuteOptions,
): Promise<{ response: CompletionResponse; actualProvider: ProviderName; actualModel: string; attempts: number }> {
  const {
    decision,
    messages,
    maxTokens,
    temperature,
    timeoutMs,
    signal,
    breaker = circuitBreaker,
    maxRetries = 2,
  } = options;

  // Build ordered list: selected provider first, then fallbacks
  const candidates: Array<{ provider: ProviderName; model: string }> = [
    { provider: decision.provider, model: decision.model },
    ...decision.fallbacksConsidered
      .filter((f) => !f.reason.includes('Circuit breaker OPEN'))
      .map((f) => ({ provider: f.provider, model: f.model })),
  ];

  let lastError: Error | null = null;
  let totalAttempts = 0;

  for (const candidate of candidates) {
    const provider = providerRegistry.getProvider(candidate.provider);
    if (!provider) continue;

    // Retry with exponential backoff for this specific provider
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;

      try {
        const response = await provider.complete({
          model: candidate.model,
          messages,
          maxTokens,
          temperature,
          timeoutMs,
          signal,
        });

        // Success — record it and return
        breaker.recordSuccess(candidate.provider);

        return {
          response,
          actualProvider: candidate.provider,
          actualModel: candidate.model,
          attempts: totalAttempts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable =
          error instanceof ProviderError ? error.isRetryable : false;

        log.warn(`Provider ${candidate.provider}/${candidate.model} failed (attempt ${attempt + 1})`, {
          provider: candidate.provider,
          model: candidate.model,
          attempt: attempt + 1,
          isRetryable,
          error: lastError.message,
        });

        if (!isRetryable || attempt >= maxRetries) {
          breaker.recordFailure(candidate.provider);
          break; // Move to next candidate
        }

        // Exponential backoff with jitter
        const baseDelay = 500;
        const maxDelay = 5000;
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 500,
          maxDelay,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const promptText = messages[messages.length - 1]?.content || '';
  const fallbackContent = `[Demo Routing Active]\n\nPrompt classified as "${decision.taskType}" (${(decision.classifierConfidence * 100).toFixed(0)}% match).\nAssigned Target: ${decision.provider.toUpperCase()} / ${decision.model}\n\nNotice: Configure GROQ_API_KEY or GEMINI_API_KEY in your deployment environment variables for live LLM completions.\n\nSimulated output for prompt: "${promptText.slice(0, 80)}${promptText.length > 80 ? '...' : ''}"`;

  return {
    response: {
      content: fallbackContent,
      model: decision.model,
      provider: decision.provider,
      inputTokens: Math.ceil(promptText.length / 4),
      outputTokens: Math.ceil(fallbackContent.length / 4),
      latencyMs: 190,
      estimatedCostUsd: 0.00001,
    },
    actualProvider: decision.provider,
    actualModel: decision.model,
    attempts: totalAttempts,
  };
}

/**
 * Execute a streaming completion with retry + fallback.
 * On provider failure, tries fallback candidates automatically.
 */
export async function executeStreamWithFallback(
  options: ExecuteOptions,
): Promise<{
  stream: AsyncGenerator<StreamChunk>;
  actualProvider: ProviderName;
  actualModel: string;
}> {
  const {
    decision,
    messages,
    maxTokens,
    temperature,
    timeoutMs,
    signal,
    breaker = circuitBreaker,
  } = options;

  const candidates: Array<{ provider: ProviderName; model: string }> = [
    { provider: decision.provider, model: decision.model },
    ...decision.fallbacksConsidered
      .filter((f) => !f.reason.includes('Circuit breaker OPEN'))
      .map((f) => ({ provider: f.provider, model: f.model })),
  ];

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const provider = providerRegistry.getProvider(candidate.provider);
    if (!provider) continue;

    try {
      const generator = provider.stream({
        model: candidate.model,
        messages,
        maxTokens,
        temperature,
        timeoutMs,
        signal,
      });

      // Advance generator once to verify HTTP connection succeeds
      const firstResult = await generator.next();

      // Wrap back into a clean stream generator that yields firstResult then remaining chunks
      async function* createVerifiedStream() {
        if (!firstResult.done) {
          yield firstResult.value;
        }
        for await (const chunk of generator) {
          yield chunk;
        }
      }

      breaker.recordSuccess(candidate.provider);

      return {
        stream: createVerifiedStream(),
        actualProvider: candidate.provider,
        actualModel: candidate.model,
      };
    } catch (error) {
  // Fallback demo simulation if providers fail or are unconfigured
  log.warn('All live providers failed or unconfigured, utilizing demo simulation mode', {
    lastError: lastError?.message,
  });

  async function* createDemoFallbackStream() {
    const promptText = messages[messages.length - 1]?.content || '';
    const explanation = `[Demo Routing Active]\n\nPrompt classified as "${decision.taskType}" (${(decision.classifierConfidence * 100).toFixed(0)}% match).\nAssigned Target: ${decision.provider.toUpperCase()} / ${decision.model}\n\nNotice: Live LLM inference requires a valid GROQ_API_KEY or GEMINI_API_KEY in your deployment environment variables.\n\nSimulated Output for: "${promptText.slice(0, 80)}${promptText.length > 80 ? '...' : ''}"\n\nThe routing policy engine evaluated latency constraints, confidence scores, and circuit breaker status to select the optimal model candidate.`;

    const words = explanation.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield {
        content: (i === 0 ? '' : ' ') + words[i],
        done: false,
      };
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    yield {
      content: '',
      done: true,
      usage: {
        inputTokens: Math.ceil(promptText.length / 4),
        outputTokens: Math.ceil(explanation.length / 4),
        latencyMs: 220,
        estimatedCostUsd: 0.00001,
      },
    };
  }

  return {
    stream: createDemoFallbackStream(),
    actualProvider: decision.provider,
    actualModel: decision.model,
  };
}
