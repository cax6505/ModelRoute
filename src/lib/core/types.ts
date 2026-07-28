/**
 * Core domain types for ModelRoute.
 * These types are framework-agnostic and used across the entire core layer.
 */

// ─── Task Types ──────────────────────────────────────────────

export const TASK_TYPES = [
  'code_generation',
  'summarization',
  'extraction',
  'creative_writing',
  'reasoning',
  'simple_qa',
  'translation',
  'general',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

// ─── Priority Modes ──────────────────────────────────────────

export const PRIORITY_MODES = ['fast', 'quality', 'cheap'] as const;
export type PriorityMode = (typeof PRIORITY_MODES)[number];

// ─── Provider Names ──────────────────────────────────────────

export const PROVIDER_NAMES = ['groq', 'gemini', 'ollama'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

// ─── Messages ────────────────────────────────────────────────

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── LLM Provider Interface ─────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderName;
  contextWindow: number;
  maxOutputTokens: number;
  /** Cost per 1M input tokens in USD (even if free, track published rate) */
  costPer1MInput: number;
  /** Cost per 1M output tokens in USD */
  costPer1MOutput: number;
  /** Capability tier: 1 (fastest/simplest) → 3 (most capable) */
  capabilityTier: 1 | 2 | 3;
  /** Average latency in ms for a typical request */
  avgLatencyMs: number;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: ProviderName;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  /** Only present on the final chunk */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    estimatedCostUsd: number;
  };
}

export interface ProviderHealth {
  name: ProviderName;
  available: boolean;
  latencyMs?: number;
  errorMessage?: string;
}

export interface LLMProvider {
  readonly name: ProviderName;
  readonly models: ModelInfo[];

  /** Non-streaming completion */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /** Streaming completion — yields chunks as they arrive */
  stream(request: CompletionRequest): AsyncGenerator<StreamChunk>;

  /** Quick health check — is this provider reachable? */
  healthCheck(): Promise<ProviderHealth>;
}

// ─── Provider Errors ─────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderName,
    public readonly statusCode: number | undefined,
    public readonly isRetryable: boolean,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ─── Classification ──────────────────────────────────────────

export interface ClassificationResult {
  taskType: TaskType;
  confidence: number;
  method: 'rules' | 'llm' | 'hybrid';
}

// ─── Routing ─────────────────────────────────────────────────

export interface RoutingCandidate {
  provider: ProviderName;
  model: string;
  weight: number;
}

export interface RoutingRule {
  id: string;
  userId: string | null;
  taskType: TaskType;
  priorityMode: PriorityMode;
  candidates: RoutingCandidate[];
  isActive: boolean;
}

export interface RoutingDecision {
  taskType: TaskType;
  classifierMode: 'rules' | 'llm' | 'hybrid';
  classifierConfidence: number;
  provider: ProviderName;
  model: string;
  reason: string;
  fallbacksConsidered: Array<{
    provider: ProviderName;
    model: string;
    reason: string;
  }>;
}

// ─── Circuit Breaker ─────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  provider: ProviderName;
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number | null;
  nextRetryAt: number | null;
}

// ─── Request Logging ─────────────────────────────────────────

export interface RequestLogEntry {
  id?: string;
  userId: string;
  correlationId: string;
  promptHash: string;
  promptLength: number;
  promptText?: string | null;
  responseText?: string | null;
  taskType: TaskType;
  classifierMode: 'rules' | 'llm' | 'hybrid';
  provider: ProviderName;
  model: string;
  routingReason: string;
  priority: PriorityMode;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: 'success' | 'error' | 'fallback';
  errorMessage?: string | null;
  idempotencyKey?: string | null;
  createdAt?: string;
}

// ─── Eval ────────────────────────────────────────────────────

export interface BenchmarkPrompt {
  id: string;
  prompt: string;
  taskType: TaskType;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedOutputHint?: string;
}

export interface EvalResult {
  benchmarkId: string;
  prompt: string;
  expectedTaskType: TaskType;
  actualTaskType: TaskType;
  classificationCorrect: boolean;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  qualityScore?: number;
  response?: string;
}

export interface EvalRun {
  id: string;
  userId: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  totalPrompts: number;
  completedPrompts: number;
  avgQualityScore?: number;
  results: EvalResult[];
  createdAt: string;
  completedAt?: string;
}
