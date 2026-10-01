"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Play, RotateCcw, Save, Sliders } from "lucide-react";
import { PRIORITY_MODES, TASK_TYPES } from "@/lib/core/types";
import {
  DsButton,
  DsCard,
  DsProviderBadge,
  SegmentedControl,
} from "@/components/design-system";
interface Candidate {
  provider: "groq" | "gemini" | "openrouter";
  model: string;
  weight: number;
}
const defaults: Candidate[] = [
  { provider: "groq", model: "openai/gpt-oss-120b", weight: 10 },
  { provider: "gemini", model: "gemini-3.5-flash", weight: 8 },
  { provider: "openrouter", model: "openrouter/free", weight: 2 },
];
export default function RulesEditorPage() {
  const [task, setTask] = useState<string>(TASK_TYPES[0]);
  const [priority, setPriority] = useState("quality");
  const [candidates, setCandidates] = useState(defaults);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [simulationPrompt, setSimulationPrompt] = useState(
    "Write a resilient TypeScript API client with retries and typed errors.",
  );
  const [simulation, setSimulation] = useState<{
    classification: { taskType: string; confidence: number };
    decision: {
      provider: string;
      model: string;
      reason: string;
      fallbacksConsidered: Array<{ provider: string; model: string; reason: string }>;
    };
  } | null>(null);
  const [simulating, setSimulating] = useState(false);
  useEffect(() => {
    void fetch("/api/rules")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          payload: {
            rules?: Array<{
              task_type: string;
              priority_mode: string;
              candidates: Candidate[];
            }>;
          } | null,
        ) => {
          const rule = payload?.rules?.find(
            (item) =>
              item.task_type === task && item.priority_mode === priority,
          );
          if (rule?.candidates?.length) setCandidates(rule.candidates);
        },
      )
      .catch(() => setMessage("Routing rules could not be loaded."));
  }, [priority, task]);
  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: task,
          priorityMode: priority,
          candidates,
          isActive: true,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      setDirty(false);
      setMessage("Policy saved.");
    } catch {
      setMessage("Policy could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const move = (index: number, direction: number) => {
    const next = [...candidates];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((item, i) => (item.weight = 10 - i * 2));
    setCandidates(next);
    setDirty(true);
  };
  const simulate = async () => {
    setSimulating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rules/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: simulationPrompt, priority }),
      });
      if (!response.ok) throw new Error("Simulation failed");
      setSimulation(await response.json());
    } catch {
      setMessage("Policy simulation could not be completed.");
    } finally {
      setSimulating(false);
    }
  };
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <DsCard
        title="Policy matrix"
        subtitle="Select a task and priority to inspect its ranked candidate chain."
      >
        <div className="flex flex-wrap gap-4">
          <label className="text-xs text-[var(--ink-muted)]">
            Task type
            <select
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="mt-2 block h-10 rounded-[var(--radius-2)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
            >
              {TASK_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <div>
            <span className="block text-xs text-[var(--ink-muted)]">
              Priority
            </span>
            <div className="mt-2">
              <SegmentedControl
                options={PRIORITY_MODES.map((item) => ({
                  value: item,
                  label: item[0].toUpperCase() + item.slice(1),
                }))}
                value={priority}
                onChange={setPriority}
              />
            </div>
          </div>
        </div>
      </DsCard>
      <DsCard
        title="Policy simulator"
        subtitle="Preview classification and fallback behavior without spending provider quota."
        headerAction={
          <DsButton
            size="sm"
            onClick={simulate}
            disabled={!simulationPrompt.trim()}
            isLoading={simulating}
            icon={simulating ? <LoaderCircle className="size-4" /> : <Play className="size-4" />}
          >
            Simulate
          </DsButton>
        }
      >
        <textarea
          value={simulationPrompt}
          onChange={(event) => setSimulationPrompt(event.target.value)}
          className="min-h-24 w-full resize-y rounded-[var(--radius-1)] border border-[var(--border-strong)] bg-[var(--surface)] p-3 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="Prompt to simulate"
        />
        {simulation && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-1)] bg-[var(--surface-sunken)] p-3">
              <span className="block text-xs text-[var(--ink-muted)]">Classification</span>
              <span className="mt-1 block font-mono text-sm">{simulation.classification.taskType}</span>
              <span className="mt-1 block text-xs text-[var(--ink-muted)]">
                {Math.round(simulation.classification.confidence * 100)}% confidence
              </span>
            </div>
            <div className="rounded-[var(--radius-1)] bg-[var(--accent-soft)] p-3">
              <span className="block text-xs text-[var(--ink-muted)]">Selected route</span>
              <span className="mt-1 block font-mono text-sm">
                {simulation.decision.provider}/{simulation.decision.model}
              </span>
              <span className="mt-1 block text-xs text-[var(--ink-muted)]">No provider call made</span>
            </div>
            <p className="text-xs leading-5 text-[var(--ink-muted)] sm:col-span-2">
              {simulation.decision.reason}
            </p>
          </div>
        )}
      </DsCard>
      <DsCard
        title={
          <span className="flex items-center gap-2">
            <Sliders className="size-4 text-[var(--accent)]" />
            Candidate chain
          </span>
        }
        subtitle={`${task} · ${priority}`}
      >
        <div className="space-y-3">
          {candidates.map((candidate, index) => (
            <div
              key={candidate.provider}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-2)] border p-4 ${index === 0 ? "border-[var(--accent-soft-strong)] bg-[var(--accent-soft)]" : "border-[var(--border-hairline)]"}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[var(--ink-faint)]">
                  0{index + 1}
                </span>
                <DsProviderBadge provider={candidate.provider} />
                <span className="font-mono text-xs">{candidate.model}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-[var(--ink-muted)]">
                  Weight {candidate.weight}
                </span>
                <button
                  type="button"
                  aria-label="Move candidate up"
                  disabled={!index}
                  onClick={() => move(index, -1)}
                  className="text-[var(--ink-muted)] disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move candidate down"
                  disabled={index === candidates.length - 1}
                  onClick={() => move(index, 1)}
                  className="text-[var(--ink-muted)] disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DsCard>
      <DsCard
        title="Circuit breaker"
        subtitle="Tune resilience thresholds for the next policy save."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            ["Error threshold", "failures"],
            ["Window", "seconds"],
            ["Cooldown", "seconds"],
          ].map(([label, unit]) => (
            <label key={label} className="text-sm">
              <span className="block text-xs text-[var(--ink-muted)]">
                {label}
              </span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  defaultValue={label === "Error threshold" ? "5" : "30"}
                  className="h-10 w-full rounded-[var(--radius-2)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 font-mono"
                />
                <span className="text-xs text-[var(--ink-faint)]">{unit}</span>
              </div>
            </label>
          ))}
        </div>
      </DsCard>
      {dirty && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-[var(--radius-2)] border border-[var(--accent-soft-strong)] bg-[var(--surface)] p-3 shadow-[var(--shadow-floating)]">
          <span className="text-sm font-medium">Unsaved policy changes</span>
          <div className="flex gap-2">
            <DsButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setCandidates(defaults);
                setDirty(false);
              }}
              icon={<RotateCcw className="size-4" />}
            >
              Discard
            </DsButton>
            <DsButton
              size="sm"
              onClick={save}
              isLoading={saving}
              icon={<Save className="size-4" />}
            >
              Save
            </DsButton>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-[var(--ink-muted)]">
          {message}
        </p>
      )}
    </div>
  );
}
