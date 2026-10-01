import { CLASSIFIER_BENCHMARK } from "../src/lib/core/benchmark";

interface RoutingResult {
  caseId: string;
  expectedTaskType: string;
  actualTaskType: string | null;
  provider: string | null;
  model: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  status: "success" | "fallback" | "error";
  error?: string;
}

const baseUrl = process.env.MODELROUTE_URL ?? "http://localhost:3000";
const apiKey = process.env.MODELROUTE_API_KEY;
const iterations = Math.max(1, Number(process.env.BENCHMARK_ITERATIONS ?? "1"));

if (!apiKey) {
  console.error("Set MODELROUTE_API_KEY to run the live routing benchmark.");
  process.exit(1);
}

const results: RoutingResult[] = [];
for (let iteration = 0; iteration < iterations; iteration++) {
  for (const item of CLASSIFIER_BENCHMARK) {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}/api/route`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: item.prompt, priority: "quality" }),
      });
      const payload = (await response.json()) as {
        content?: string;
        routingDecision?: {
          taskType?: string;
          provider?: string;
          model?: string;
          latencyMs?: number;
          inputTokens?: number;
          outputTokens?: number;
          estimatedCostUsd?: number;
          executionStatus?: "success" | "fallback";
        };
        error?: string;
      };
      const decision = payload.routingDecision;
      results.push({
        caseId: item.id,
        expectedTaskType: item.taskType,
        actualTaskType: decision?.taskType ?? null,
        provider: decision?.provider ?? null,
        model: decision?.model ?? null,
        latencyMs:
          decision?.latencyMs ?? Math.round(performance.now() - startedAt),
        inputTokens: decision?.inputTokens ?? null,
        outputTokens: decision?.outputTokens ?? null,
        estimatedCostUsd: decision?.estimatedCostUsd ?? null,
        status: response.ok
          ? (decision?.executionStatus ?? "success")
          : "error",
        error: response.ok
          ? undefined
          : (payload.error ?? `HTTP ${response.status}`),
      });
    } catch (error) {
      results.push({
        caseId: item.id,
        expectedTaskType: item.taskType,
        actualTaskType: null,
        provider: null,
        model: null,
        latencyMs: Math.round(performance.now() - startedAt),
        inputTokens: null,
        outputTokens: null,
        estimatedCostUsd: null,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

const successful = results.filter((item) => item.status !== "error");
const correct = successful.filter(
  (item) => item.actualTaskType === item.expectedTaskType,
).length;
const fallbacks = successful.filter(
  (item) => item.status === "fallback",
).length;
const latencies = successful
  .map((item) => item.latencyMs)
  .filter((value): value is number => value !== null)
  .sort((a, b) => a - b);
const percentile = (value: number) =>
  latencies.length
    ? latencies[
        Math.min(latencies.length - 1, Math.floor(latencies.length * value))
      ]
    : null;
const totalCost = successful.reduce(
  (sum, item) => sum + (item.estimatedCostUsd ?? 0),
  0,
);

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      baseUrl,
      iterations,
      summary: {
        requests: results.length,
        successful: successful.length,
        errors: results.length - successful.length,
        classificationAccuracy: successful.length
          ? correct / successful.length
          : 0,
        p50LatencyMs: percentile(0.5),
        p95LatencyMs: percentile(0.95),
        reportedCostUsd: totalCost,
        fallbackObservations: fallbacks,
        fallbackRate: successful.length ? fallbacks / successful.length : 0,
        qualityScore: null,
        qualityNote:
          "Answer quality requires a declared judge or human review; no score is fabricated.",
      },
      results,
    },
    null,
    2,
  ),
);
