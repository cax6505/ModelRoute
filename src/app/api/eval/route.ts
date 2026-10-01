import { selectRoute } from "@/lib/core/router";
import { classifyWithRules } from "@/lib/core/classifier";
import { createApiError } from "@/lib/schemas";
import { CLASSIFIER_BENCHMARK } from "@/lib/core/benchmark";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ benchmarks: CLASSIFIER_BENCHMARK });
}

export async function POST() {
  try {
    const results = CLASSIFIER_BENCHMARK.map((item) => {
      const classification = classifyWithRules(item.prompt);
      const decision = selectRoute({ classification, priority: "quality" });
      const correct = classification.taskType === item.taskType;

      return {
        benchmarkId: item.id,
        prompt: item.prompt,
        expectedTaskType: item.taskType,
        actualTaskType: classification.taskType,
        classificationCorrect: correct,
        provider: decision.provider,
        model: decision.model,
        latencyMs: null,
        qualityScore: null,
        executionMode: "classification_only",
      };
    });

    const correctCount = results.filter((r) => r.classificationCorrect).length;
    const accuracy = Math.round((correctCount / results.length) * 100);

    return Response.json({
      evalRun: {
        id: crypto.randomUUID(),
        name: `Eval Run ${new Date().toLocaleTimeString()}`,
        status: "completed",
        totalPrompts: results.length,
        accuracyScore: accuracy,
        executionMode: "classification_only",
        results,
        completedAt: new Date().toISOString(),
      },
    });
  } catch {
    return createApiError(
      "INTERNAL_ERROR",
      "Failed to run eval benchmark",
      500,
    );
  }
}
