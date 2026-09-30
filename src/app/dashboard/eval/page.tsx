"use client";
import { useState } from "react";
import { CheckCircle2, Play, Star, XCircle } from "lucide-react";
import {
  DsButton,
  DsCard,
  DsMetricCard,
  DsProviderBadge,
} from "@/components/design-system";
interface Result {
  benchmarkId: string;
  prompt: string;
  expectedTaskType: string;
  actualTaskType: string;
  classificationCorrect: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  qualityScore: number;
}
const seed: Result[] = [
  {
    benchmarkId: "b1",
    prompt: "Write a Python function to check if a string is a palindrome",
    expectedTaskType: "code_generation",
    actualTaskType: "code_generation",
    classificationCorrect: true,
    provider: "groq",
    model: "openai/gpt-oss-120b",
    latencyMs: 310,
    qualityScore: 5,
  },
  {
    benchmarkId: "b2",
    prompt: "Summarize the core differences between RPC and REST APIs",
    expectedTaskType: "summarization",
    actualTaskType: "summarization",
    classificationCorrect: true,
    provider: "gemini",
    model: "gemini-3.5-flash",
    latencyMs: 820,
    qualityScore: 5,
  },
  {
    benchmarkId: "b3",
    prompt: "Translate a short notification into French",
    expectedTaskType: "translation",
    actualTaskType: "translation",
    classificationCorrect: true,
    provider: "gemini",
    model: "gemini-3.5-flash",
    latencyMs: 420,
    qualityScore: 4,
  },
];
export default function EvalPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(seed);
  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/eval", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.evalRun?.results) setResults(data.evalRun.results);
      }
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex justify-end">
        <DsButton
          onClick={run}
          isLoading={running}
          icon={<Play className="size-4" />}
        >
          Run suite
        </DsButton>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <DsMetricCard
          label="Classification accuracy"
          value="100%"
          subtext={`${results.length} cases evaluated`}
        />
        <DsMetricCard
          label="Average quality"
          value="4.7 / 5"
          subtext="LLM-as-judge score"
        />
        <DsMetricCard
          label="Suite status"
          value={running ? "Running" : "Ready"}
          subtext="Rule engine benchmark"
        />
      </div>
      <DsCard
        title="Benchmark cases"
        subtitle="Classification, provider assignment, latency, and quality in one scan."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-[var(--border-hairline)] text-[var(--ink-muted)]">
              <tr>
                {[
                  "Case",
                  "Expected task",
                  "Provider",
                  "Latency",
                  "Quality",
                ].map((head) => (
                  <th key={head} className="px-3 py-3 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((item) => (
                <tr
                  key={item.benchmarkId}
                  className="border-b border-[var(--border-hairline)]"
                >
                  <td className="max-w-[300px] truncate px-3 py-4">
                    {item.classificationCorrect ? (
                      <CheckCircle2 className="mr-2 inline size-4 text-[var(--success)]" />
                    ) : (
                      <XCircle className="mr-2 inline size-4 text-[var(--danger)]" />
                    )}
                    {item.prompt}
                  </td>
                  <td className="px-3 py-4 font-mono text-[var(--ink-muted)]">
                    {item.expectedTaskType}
                  </td>
                  <td className="px-3 py-4">
                    <DsProviderBadge provider={item.provider} />
                  </td>
                  <td className="px-3 py-4 font-mono tabular-nums">
                    {item.latencyMs} ms
                  </td>
                  <td className="px-3 py-4 text-[var(--warning)]">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`inline size-3 ${i < item.qualityScore ? "fill-[var(--warning)]" : ""}`}
                      />
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DsCard>
    </div>
  );
}
