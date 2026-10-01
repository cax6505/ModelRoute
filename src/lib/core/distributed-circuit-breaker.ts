import { Redis } from "@upstash/redis";
import type { CircuitState, ProviderName } from "./types";
import { CircuitBreakerManager } from "./circuit-breaker";
import { logger } from "@/lib/logger";

interface DistributedCircuitConfig {
  failureThreshold: number;
  rollingWindowSeconds: number;
  cooldownSeconds: number;
}

const defaultConfig: DistributedCircuitConfig = {
  failureThreshold: 5,
  rollingWindowSeconds: 60,
  cooldownSeconds: 30,
};

export class DistributedCircuitBreaker {
  private readonly redis: Redis | null;
  private readonly local: CircuitBreakerManager;
  private readonly config: DistributedCircuitConfig;
  private readonly log = logger.child({
    component: "distributed-circuit-breaker",
  });

  constructor(config: Partial<DistributedCircuitConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.local = new CircuitBreakerManager({
      failureThreshold: this.config.failureThreshold,
      rollingWindowMs: this.config.rollingWindowSeconds * 1000,
      cooldownMs: this.config.cooldownSeconds * 1000,
    });
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    this.redis =
      url && token && !url.includes("localhost") && !token.includes("dummy")
        ? new Redis({ url, token })
        : null;
  }

  async isAvailable(provider: ProviderName): Promise<boolean> {
    if (!this.redis) return this.local.isAvailable(provider);

    try {
      const state = await this.redis.get<CircuitState>(this.stateKey(provider));
      if (state !== "OPEN") return true;

      const probeClaimed = await this.redis.set(
        this.probeKey(provider),
        "claimed",
        { nx: true, ex: this.config.cooldownSeconds },
      );
      if (probeClaimed === "OK") {
        await this.redis.set(this.stateKey(provider), "HALF_OPEN", {
          ex: this.config.cooldownSeconds,
        });
        return true;
      }
      return false;
    } catch (error) {
      this.log.error("Distributed circuit check failed; using local state", {
        provider,
        error: error instanceof Error ? error.message : "Unknown",
      });
      return this.local.isAvailable(provider);
    }
  }

  async recordSuccess(provider: ProviderName): Promise<void> {
    if (!this.redis) {
      this.local.recordSuccess(provider);
      return;
    }
    try {
      await Promise.all([
        this.redis.del(this.failureKey(provider)),
        this.redis.del(this.stateKey(provider)),
        this.redis.del(this.probeKey(provider)),
      ]);
    } catch (error) {
      this.log.error("Distributed circuit success update failed", {
        provider,
        error: error instanceof Error ? error.message : "Unknown",
      });
      this.local.recordSuccess(provider);
    }
  }

  async recordFailure(provider: ProviderName): Promise<void> {
    if (!this.redis) {
      this.local.recordFailure(provider);
      return;
    }
    try {
      const failures = await this.redis.incr(this.failureKey(provider));
      if (failures === 1) {
        await this.redis.expire(
          this.failureKey(provider),
          this.config.rollingWindowSeconds,
        );
      }
      if (failures >= this.config.failureThreshold) {
        await this.redis.set(this.stateKey(provider), "OPEN", {
          ex: this.config.cooldownSeconds,
        });
        await this.redis.del(this.probeKey(provider));
      }
    } catch (error) {
      this.log.error("Distributed circuit failure update failed", {
        provider,
        error: error instanceof Error ? error.message : "Unknown",
      });
      this.local.recordFailure(provider);
    }
  }

  async getStatus(provider: ProviderName) {
    if (!this.redis) return this.local.getStatus(provider);
    try {
      const [state, failures, ttl] = await Promise.all([
        this.redis.get<CircuitState>(this.stateKey(provider)),
        this.redis.get<number>(this.failureKey(provider)),
        this.redis.ttl(this.stateKey(provider)),
      ]);
      const normalizedState = state ?? "CLOSED";
      return {
        provider,
        state: normalizedState,
        failureCount: failures ?? 0,
        lastFailureAt: null,
        nextRetryAt:
          normalizedState === "OPEN" && ttl > 0
            ? Date.now() + ttl * 1000
            : null,
      };
    } catch {
      return this.local.getStatus(provider);
    }
  }

  private stateKey(provider: ProviderName) {
    return `mr:circuit:${provider}:state`;
  }

  private failureKey(provider: ProviderName) {
    return `mr:circuit:${provider}:failures`;
  }

  private probeKey(provider: ProviderName) {
    return `mr:circuit:${provider}:probe`;
  }
}

export const distributedCircuitBreaker = new DistributedCircuitBreaker();
