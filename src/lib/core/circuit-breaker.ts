/**
 * Per-provider circuit breaker.
 *
 * Three states:
 * - CLOSED: healthy, all requests pass through
 * - OPEN: provider is failing, reject requests immediately
 * - HALF_OPEN: testing recovery, allow one probe request
 *
 * Configuration:
 * - failureThreshold: failures in the rolling window before tripping
 * - rollingWindowMs: time window for counting failures
 * - cooldownMs: time to wait before moving from OPEN to HALF_OPEN
 */

import type { CircuitState, CircuitBreakerStatus, ProviderName } from './types';
import { logger } from '@/lib/logger';

export interface CircuitBreakerConfig {
  /** Number of failures to trip the breaker */
  failureThreshold: number;
  /** Rolling window in ms for counting failures */
  rollingWindowMs: number;
  /** Cooldown in ms before testing recovery */
  cooldownMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  rollingWindowMs: 60_000,  // 1 minute
  cooldownMs: 30_000,        // 30 seconds
};

interface ProviderCircuit {
  state: CircuitState;
  failures: number[];        // timestamps of recent failures
  lastFailureAt: number | null;
  openedAt: number | null;
}

/**
 * Manages circuit breakers for all LLM providers.
 * In-memory implementation — fine for serverless because each
 * invocation is short-lived. For persistent state across cold starts,
 * integrate with Redis/Upstash if needed later.
 */
export class CircuitBreakerManager {
  private circuits: Map<ProviderName, ProviderCircuit> = new Map();
  private config: CircuitBreakerConfig;
  private log = logger.child({ component: 'circuit-breaker' });

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a provider is available (not in OPEN state).
   * Also handles HALF_OPEN transition from OPEN after cooldown.
   */
  isAvailable(provider: ProviderName): boolean {
    const circuit = this.getCircuit(provider);

    if (circuit.state === 'CLOSED') {
      return true;
    }

    if (circuit.state === 'OPEN') {
      // Check if cooldown has elapsed → transition to HALF_OPEN
      if (
        circuit.openedAt &&
        Date.now() - circuit.openedAt >= this.config.cooldownMs
      ) {
        circuit.state = 'HALF_OPEN';
        this.log.info(`Circuit for ${provider} moved to HALF_OPEN (cooldown elapsed)`, {
          provider,
        });
        return true; // Allow one probe request
      }
      return false;
    }

    // HALF_OPEN — allow the probe request
    return true;
  }

  /**
   * Record a successful request. Resets the circuit to CLOSED.
   */
  recordSuccess(provider: ProviderName): void {
    const circuit = this.getCircuit(provider);

    if (circuit.state === 'HALF_OPEN') {
      this.log.info(`Circuit for ${provider} recovered → CLOSED`, { provider });
    }

    circuit.state = 'CLOSED';
    circuit.failures = [];
    circuit.openedAt = null;
  }

  /**
   * Record a failed request. May trip the circuit to OPEN.
   */
  recordFailure(provider: ProviderName): void {
    const circuit = this.getCircuit(provider);
    const now = Date.now();

    // If in HALF_OPEN and the probe failed, go back to OPEN
    if (circuit.state === 'HALF_OPEN') {
      circuit.state = 'OPEN';
      circuit.openedAt = now;
      circuit.lastFailureAt = now;
      this.log.warn(`Circuit for ${provider} probe failed → OPEN`, { provider });
      return;
    }

    // Add failure timestamp and prune old ones outside the rolling window
    circuit.failures.push(now);
    circuit.failures = circuit.failures.filter(
      (t) => now - t < this.config.rollingWindowMs,
    );
    circuit.lastFailureAt = now;

    // Check if we've exceeded the threshold
    if (circuit.failures.length >= this.config.failureThreshold) {
      circuit.state = 'OPEN';
      circuit.openedAt = now;
      this.log.warn(
        `Circuit for ${provider} tripped → OPEN (${circuit.failures.length} failures in ${this.config.rollingWindowMs}ms window)`,
        { provider, failureCount: circuit.failures.length },
      );
    }
  }

  /**
   * Get the current status of a provider's circuit breaker.
   */
  getStatus(provider: ProviderName): CircuitBreakerStatus {
    const circuit = this.getCircuit(provider);

    // Re-check for OPEN → HALF_OPEN transition
    if (
      circuit.state === 'OPEN' &&
      circuit.openedAt &&
      Date.now() - circuit.openedAt >= this.config.cooldownMs
    ) {
      circuit.state = 'HALF_OPEN';
    }

    return {
      provider,
      state: circuit.state,
      failureCount: circuit.failures.filter(
        (t) => Date.now() - t < this.config.rollingWindowMs,
      ).length,
      lastFailureAt: circuit.lastFailureAt,
      nextRetryAt:
        circuit.state === 'OPEN' && circuit.openedAt
          ? circuit.openedAt + this.config.cooldownMs
          : null,
    };
  }

  /**
   * Get status of all tracked providers.
   */
  getAllStatus(): CircuitBreakerStatus[] {
    const providers: ProviderName[] = ['groq', 'gemini', 'ollama'];
    return providers.map((p) => this.getStatus(p));
  }

  /**
   * Reset a specific provider's circuit breaker (manual override).
   */
  reset(provider: ProviderName): void {
    this.circuits.set(provider, {
      state: 'CLOSED',
      failures: [],
      lastFailureAt: null,
      openedAt: null,
    });
    this.log.info(`Circuit for ${provider} manually reset → CLOSED`, { provider });
  }

  private getCircuit(provider: ProviderName): ProviderCircuit {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: 'CLOSED',
        failures: [],
        lastFailureAt: null,
        openedAt: null,
      });
    }
    return this.circuits.get(provider)!;
  }
}

/** Singleton instance for the application */
export const circuitBreaker = new CircuitBreakerManager();
