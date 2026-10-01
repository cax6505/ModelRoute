import { describe, expect, it } from "vitest";
import { runClassifierBenchmark } from "@/lib/core/benchmark";

describe("classifier benchmark", () => {
  it("keeps a measurable baseline across every task type", () => {
    const report = runClassifierBenchmark();

    expect(report.total).toBe(32);
    expect(report.accuracy).toBeGreaterThanOrEqual(0.9);
    expect(Object.keys(report.byTask)).toHaveLength(8);
    expect(report.byTask.translation.accuracy).toBe(1);
    expect(report.byTask.general.accuracy).toBe(1);
  });
});
