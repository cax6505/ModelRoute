"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Save, Sliders } from "lucide-react";
import { PRIORITY_MODES, TASK_TYPES } from "@/lib/core/types";
import {
  DsButton,
  DsCard,
  DsProviderBadge,
  SegmentedControl,
} from "@/components/design-system";
interface Candidate {
  provider: "groq" | "gemini" | "ollama";
  model: string;
  weight: number;
}
const defaults: Candidate[] = [
  { provider: "groq", model: "openai/gpt-oss-120b", weight: 10 },
  { provider: "gemini", model: "gemini-3.5-flash", weight: 8 },
  { provider: "ollama", model: "llama3.2", weight: 3 },
];
export default function RulesEditorPage() {
  const [task, setTask] = useState<string>(TASK_TYPES[0]);
  const [priority, setPriority] = useState("quality");
  const [candidates, setCandidates] = useState(defaults);
  const [dirty, setDirty] = useState(false);
  const move = (index: number, direction: number) => {
    const next = [...candidates];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((item, i) => (item.weight = 10 - i * 2));
    setCandidates(next);
    setDirty(true);
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
              onClick={() => setDirty(false)}
              icon={<Save className="size-4" />}
            >
              Save
            </DsButton>
          </div>
        </div>
      )}
    </div>
  );
}
