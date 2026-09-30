"use client";

import { useCallback, useState } from "react";
import {
  Activity,
  Brain,
  Check,
  Clipboard,
  Code2,
  FileText,
  Languages,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DsButton,
  DsCard,
  DsEmptyState,
  DsIntentBadge,
  DsProviderBadge,
  SegmentedControl,
} from "@/components/design-system";
import { motionDuration, motionEasing } from "@/lib/motion";

interface RoutingDecision {
  taskType: string;
  classifierMode: string;
  classifierConfidence: number;
  provider: string;
  model: string;
  reason: string;
  fallbacksConsidered: Array<{
    provider: string;
    model: string;
    reason: string;
  }>;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}
const workloads = [
  {
    title: "Code synthesis",
    task: "code_generation",
    icon: Code2,
    prompt:
      "Write an optimized Python function to check if a number is prime. Include type hints and time complexity analysis.",
  },
  {
    title: "Technical summary",
    task: "summarization",
    icon: FileText,
    prompt:
      "Summarize the core architectural differences between REST APIs and GraphQL in 3 concise bullet points.",
  },
  {
    title: "Entity extraction",
    task: "extraction",
    icon: Sparkles,
    prompt:
      'Extract customer emails, order IDs, and totals into valid JSON: "User john@example.com created order #ORD-9981 totaling $149.50."',
  },
  {
    title: "Technical translation",
    task: "translation",
    icon: Languages,
    prompt:
      'Translate this notification into French: "Your API key quota is operating at 80% capacity. Upgrade to prevent interruption."',
  },
];
const stages = ["Prompt", "Classifier", "Breaker", "Provider"];

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState("");
  const [priority, setPriority] = useState("quality");
  const [taskHint, setTaskHint] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [response, setResponse] = useState("");
  const [routingDecision, setRoutingDecision] =
    useState<RoutingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isStreaming) return;
    setIsStreaming(true);
    setResponse("");
    setRoutingDecision(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        priority,
        stream: true,
      };
      if (taskHint) body.taskHint = taskHint;
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream available");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.taskType && parsed.provider && parsed.reason)
              setRoutingDecision(parsed);
            else if (parsed.content !== undefined)
              setResponse((current) => current + parsed.content);
            else if (parsed.latencyMs !== undefined)
              setRoutingDecision((current) =>
                current ? { ...current, ...parsed } : null,
              );
            else if (parsed.error) setError(parsed.error);
          } catch {
            /* Ignore partial JSON frames. */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, priority, prompt, taskHint]);
  const copyResponse = () => {
    if (!response) return;
    void navigator.clipboard.writeText(response);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const activeStage = isStreaming ? 3 : routingDecision ? 4 : prompt ? 1 : 0;
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.92fr)]">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--accent)]">
                Compose
              </p>
              <h2 className="text-lg font-semibold">
                A prompt, routed with intent.
              </h2>
            </div>
            <span className="font-mono text-xs tabular-nums text-[var(--ink-muted)]">
              {prompt.length} / 100,000
            </span>
          </div>
          <DsCard
            className="overflow-hidden"
            title="Prompt input"
            subtitle="The router classifies the task, checks provider health, and selects the strongest available path."
          >
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the work you want a model to do..."
              className="min-h-[260px] w-full resize-y border-0 bg-transparent font-mono text-[15px] leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
            />
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border-hairline)] pt-4">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--ink-muted)]">
                    Priority
                  </label>
                  <SegmentedControl
                    options={[
                      { value: "quality", label: "Quality" },
                      { value: "fast", label: "Fast" },
                      { value: "cheap", label: "Cheap" },
                    ]}
                    value={priority}
                    onChange={setPriority}
                  />
                </div>
                <div>
                  <label
                    htmlFor="task-hint-select"
                    className="mb-2 block text-xs font-medium text-[var(--ink-muted)]"
                  >
                    Classification override
                  </label>
                  <Select
                    value={taskHint}
                    onValueChange={(value) => setTaskHint(value ?? "")}
                  >
                    <SelectTrigger
                      id="task-hint-select"
                      className="h-9 w-[180px] border-[var(--border-strong)] bg-[var(--surface)] text-xs"
                    >
                      <SelectValue placeholder="Auto-classify" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-classify</SelectItem>
                      <SelectItem value="code_generation">
                        Code generation
                      </SelectItem>
                      <SelectItem value="summarization">
                        Summarization
                      </SelectItem>
                      <SelectItem value="extraction">Extraction</SelectItem>
                      <SelectItem value="creative_writing">
                        Creative writing
                      </SelectItem>
                      <SelectItem value="reasoning">Reasoning</SelectItem>
                      <SelectItem value="simple_qa">Simple Q&A</SelectItem>
                      <SelectItem value="translation">Translation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DsButton
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                isLoading={isStreaming}
                icon={<Send className="size-4" />}
              >
                Execute route{" "}
                <span className="font-mono text-xs opacity-70">⌘↵</span>
              </DsButton>
            </div>
          </DsCard>
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)]">
              <Sparkles className="size-4 text-[var(--accent)]" />
              Try a workload
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {workloads.map((workload) => (
                <button
                  type="button"
                  key={workload.title}
                  onClick={() => {
                    setPrompt(workload.prompt);
                    setTaskHint(workload.task);
                  }}
                  className="group rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] hover:-translate-y-0.5 hover:border-[var(--accent-soft-strong)] hover:shadow-[var(--shadow-raised)]"
                >
                  <workload.icon className="size-4 text-[var(--accent)]" />
                  <span className="mt-3 block text-sm font-medium">
                    {workload.title}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                    {workload.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <DsCard
            title="Route pipeline"
            subtitle="A live view of the decision path."
            headerAction={
              <span className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                <Activity className="size-3.5" />
                {isStreaming
                  ? "Running"
                  : routingDecision
                    ? "Resolved"
                    : "Ready"}
              </span>
            }
          >
            <div className="relative grid grid-cols-4 gap-2 py-4">
              {stages.map((stage, index) => (
                <div key={stage} className="relative z-10 text-center">
                  <div
                    className={`mx-auto flex size-10 items-center justify-center rounded-full border text-xs font-medium transition-colors duration-[var(--duration-base)] ${index < activeStage ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink-muted)]"}`}
                  >
                    {index + 1}
                  </div>
                  <span className="mt-2 block text-xs text-[var(--ink-muted)]">
                    {stage}
                  </span>
                </div>
              ))}
              <div className="absolute left-[12%] right-[12%] top-9 h-px bg-[var(--border-strong)]" />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.max(0, (activeStage - 1) / 3) }}
                transition={{
                  duration: motionDuration.base,
                  ease: motionEasing.emphasized,
                }}
                className="absolute left-[12%] right-[12%] top-9 h-px origin-left bg-[var(--accent)]"
              />
            </div>
          </DsCard>
          {routingDecision ? (
            <DsCard
              title="Routing decision"
              headerAction={
                <DsProviderBadge provider={routingDecision.provider} />
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [
                    "Task type",
                    <DsIntentBadge
                      key="intent"
                      intent={routingDecision.taskType}
                    />,
                  ],
                  ["Model", routingDecision.model],
                  [
                    "Confidence",
                    `${Math.round(routingDecision.classifierConfidence * 100)}%`,
                  ],
                  [
                    "Latency",
                    routingDecision.latencyMs
                      ? `${routingDecision.latencyMs} ms`
                      : "Pending",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-[var(--radius-1)] bg-[var(--surface-sunken)] p-3"
                  >
                    <span className="block text-xs text-[var(--ink-muted)]">
                      {label}
                    </span>
                    <span className="mt-1 block truncate font-mono text-xs font-medium">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{
                    width: `${routingDecision.classifierConfidence * 100}%`,
                  }}
                />
              </div>
              <details className="mt-4 border-t border-[var(--border-hairline)] pt-4">
                <summary className="cursor-pointer text-xs font-medium text-[var(--ink-muted)]">
                  Why this route
                </summary>
                <p className="mt-3 font-mono text-xs leading-6 text-[var(--ink-muted)]">
                  {routingDecision.reason}
                </p>
              </details>
            </DsCard>
          ) : (
            <DsEmptyState
              title="No route resolved"
              description="Choose a sample or write a prompt to see the classifier and provider decision."
              icon={<Brain className="size-5" />}
            />
          )}
          <DsCard
            title="Streamed response"
            headerAction={
              response && (
                <DsButton
                  variant="ghost"
                  size="sm"
                  onClick={copyResponse}
                  icon={
                    copied ? (
                      <Check className="size-4 text-[var(--success)]" />
                    ) : (
                      <Clipboard className="size-4" />
                    )
                  }
                >
                  {copied ? "Copied" : "Copy"}
                </DsButton>
              )
            }
          >
            <div className="min-h-[220px] whitespace-pre-wrap font-mono text-sm leading-7 text-[var(--ink)]">
              {response ||
                (isStreaming ? (
                  <span className="flex items-center gap-2 text-[var(--ink-muted)]">
                    <LoaderCircle className="size-4 animate-spin" />
                    Waiting for the first token...
                  </span>
                ) : (
                  <span className="text-[var(--ink-faint)]">
                    The provider response will appear here.
                  </span>
                ))}
              {isStreaming && response && (
                <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-[var(--accent)]" />
              )}
            </div>
          </DsCard>
          {error && (
            <div
              role="alert"
              className="rounded-[var(--radius-2)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]"
            >
              <ShieldCheck className="mr-2 inline size-4" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
