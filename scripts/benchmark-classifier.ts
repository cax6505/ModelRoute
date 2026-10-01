import {
  CLASSIFIER_BENCHMARK,
  runClassifierBenchmark,
} from "../src/lib/core/benchmark";

const report = runClassifierBenchmark();
console.log(
  `Classifier benchmark: ${report.correct}/${report.total} (${(report.accuracy * 100).toFixed(1)}%)`,
);
console.log("\nPer task:");
for (const [task, metrics] of Object.entries(report.byTask)) {
  console.log(
    `  ${task}: ${metrics.correct}/${metrics.total} (${(metrics.accuracy * 100).toFixed(1)}%)`,
  );
}
if (report.confusion.length) {
  console.log("\nConfusion:");
  for (const item of report.confusion) {
    console.log(`  ${item.expected} -> ${item.actual}: ${item.count}`);
  }
}
console.log(
  `\nCases are versioned in CLASSIFIER_BENCHMARK (${CLASSIFIER_BENCHMARK.length} prompts).`,
);
