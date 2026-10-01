"use client";
import { useState } from "react";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import { DsButton, DsCard, DsEmptyState, DsMetricCard, DsProviderBadge } from "@/components/design-system";
interface Result { benchmarkId:string; prompt:string; expectedTaskType:string; actualTaskType:string; classificationCorrect:boolean; provider:string; model:string; latencyMs:number; qualityScore:number; }
export default function EvalPage() {
	const [running, setRunning] = useState(false);
	const [results, setResults] = useState<Result[]>([]);

	const run = async () => {
		setRunning(true);
		try {
			const response = await fetch("/api/eval", { method: "POST" });
			if (!response.ok) throw new Error("Eval failed");
			const payload = await response.json();
			setResults(payload.evalRun?.results ?? []);
		} catch {
			setResults([]);
		} finally {
			setRunning(false);
		}
	};

	const accuracy = results.length
		? Math.round(
				(results.filter((result) => result.classificationCorrect).length /
					results.length) *
					100,
			)
		: null;

	return (
		<div className="space-y-6 p-4 sm:p-8">
			<div className="flex justify-end">
				<DsButton onClick={run} isLoading={running} icon={<Play className="size-4" />}>
					Run suite
				</DsButton>
			</div>
			<div className="grid gap-4 sm:grid-cols-3">
				<DsMetricCard
					label="Classification accuracy"
					value={accuracy === null ? "—" : `${accuracy}%`}
					subtext={`${results.length} cases in latest run`}
				/>
				<DsMetricCard
					label="Provider quality"
					value="Not measured"
					subtext="The current suite is classification-only"
				/>
				<DsMetricCard
					label="Suite status"
					value={running ? "Running" : results.length ? "Complete" : "Ready"}
					subtext="Deterministic rule benchmark"
				/>
			</div>
			{!results.length && !running ? (
				<DsEmptyState
					title="No evaluation run yet"
					description="Run the deterministic classifier suite to record a routing result."
				/>
			) : (
				<DsCard
					title="Benchmark cases"
					subtitle="Classification and policy assignment. Provider quality is not fabricated."
				>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[700px] text-left text-xs">
							<thead className="border-b border-[var(--border-hairline)] text-[var(--ink-muted)]">
								<tr>
									{["Case", "Expected task", "Provider", "Latency", "Result"].map(
										(head) => (
											<th key={head} className="px-3 py-3 font-medium">
												{head}
											</th>
										),
									)}
								</tr>
							</thead>
							<tbody>
								{results.map((item) => (
									<tr key={item.benchmarkId} className="border-b border-[var(--border-hairline)]">
										<td className="max-w-[300px] truncate px-3 py-4">{item.prompt}</td>
										<td className="px-3 py-4">{item.expectedTaskType}</td>
										<td className="px-3 py-4">
											<DsProviderBadge provider={item.provider} />
										</td>
										<td className="px-3 py-4 font-mono">
											{item.latencyMs === null ? "Dry run" : `${item.latencyMs} ms`}
										</td>
										<td className="px-3 py-4">
											{item.classificationCorrect ? (
												<CheckCircle2 className="inline size-4 text-[var(--success)]" />
											) : (
												<XCircle className="inline size-4 text-[var(--danger)]" />
											)}{" "}
											Classification {item.actualTaskType}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</DsCard>
			)}
		</div>
	);
}
