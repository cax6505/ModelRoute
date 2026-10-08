"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Brain,
  Check,
  Clipboard,
  Code2,
  FileText,
  HelpCircle,
  Lightbulb,
  Languages,
  LoaderCircle,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
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

interface TraceStep {
  label: string;
  detail: string;
}

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
  trace?: TraceStep[];
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+?\*\*|__.+?__|~~.+?~~|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*[^*\n]+?\*|_[^_\n]+?_)/g;
  return text.split(tokenPattern).filter(Boolean).map((token, index) => {
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      return <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline decoration-[var(--accent-soft-strong)] underline-offset-2 hover:decoration-[var(--accent)]">{link[1]}</a>;
    }
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index} className="font-semibold text-[var(--ink)]">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("__") && token.endsWith("__")) {
      return <strong key={index} className="font-semibold text-[var(--ink)]">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("~~") && token.endsWith("~~")) {
      return <del key={index}>{token.slice(2, -2)}</del>;
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={index} className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[0.9em]">{token.slice(1, -1)}</code>;
    }
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

function MarkdownResponse({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let lineIndex = 0;
  let blockIndex = 0;

  const isBlockStart = (line: string) =>
    /^\s{0,3}(?:#{1,6}\s|```|~~~|>\s?|[-*_]\s*[-*_]\s*[-*_]|[-+*]\s+|\d+\.\s+)/.test(line);

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (!line.trim()) {
      lineIndex++;
      continue;
    }

    const fence = line.match(/^\s{0,3}(```+|~~~+)(.*)$/);
    if (fence) {
      const codeLines: string[] = [];
      const marker = fence[1][0];
      const language = fence[2].trim();
      lineIndex++;
      while (lineIndex < lines.length && !new RegExp(`^\\s{0,3}${marker}{3,}\\s*$`).test(lines[lineIndex])) {
        codeLines.push(lines[lineIndex]);
        lineIndex++;
      }
      if (lineIndex < lines.length) lineIndex++;
      blocks.push(
        <pre key={blockIndex++} className="my-4 overflow-x-auto rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--canvas)] p-4 font-mono text-xs leading-6 text-[var(--ink)]">
          <code data-language={language || undefined}>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const className = level <= 2 ? "mt-5 mb-2 text-lg font-semibold" : "mt-4 mb-1.5 text-base font-semibold";
      blocks.push(<h3 key={blockIndex++} className={`${className} text-[var(--ink)]`}>{renderInlineMarkdown(heading[2])}</h3>);
      lineIndex++;
      continue;
    }

    if (/^\s{0,3}(?:[-*_]\s*){3,}$/.test(line)) {
      blocks.push(<hr key={blockIndex++} className="my-5 border-[var(--border-strong)]" />);
      lineIndex++;
      continue;
    }

    const isTableDivider = (value: string) => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(value);
    if (line.includes("|") && lineIndex + 1 < lines.length && isTableDivider(lines[lineIndex + 1])) {
      const cells = (value: string) => value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      const headers = cells(line);
      lineIndex += 2;
      const rows: string[][] = [];
      while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
        rows.push(cells(lines[lineIndex]));
        lineIndex++;
      }
      blocks.push(
        <div key={blockIndex++} className="my-4 overflow-x-auto rounded-[var(--radius-1)] border border-[var(--border-hairline)]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[var(--surface-sunken)]"><tr>{headers.map((cell, index) => <th key={index} className="border-b border-[var(--border-hairline)] px-3 py-2 font-semibold">{renderInlineMarkdown(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-[var(--border-hairline)] last:border-0">{headers.map((_, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top">{renderInlineMarkdown(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const quoteLines: string[] = [];
      while (lineIndex < lines.length && /^\s{0,3}>/.test(lines[lineIndex])) {
        quoteLines.push(lines[lineIndex++].replace(/^\s{0,3}>\s?/, ""));
      }
      blocks.push(<blockquote key={blockIndex++} className="my-3 border-l-2 border-[var(--accent)] pl-4 text-[var(--ink-muted)]">{quoteLines.map((quoteLine) => <p key={quoteLine}>{renderInlineMarkdown(quoteLine)}</p>)}</blockquote>);
      continue;
    }

    const listMatch = line.match(/^\s{0,3}([-+*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d+\.$/.test(listMatch[1]);
      const items: string[] = [];
      while (lineIndex < lines.length) {
        const item = lines[lineIndex].match(/^\s{0,3}([-+*]|\d+\.)\s+(.+)$/);
        if (!item || /^\d+\.$/.test(item[1]) !== ordered) break;
        items.push(item[2]);
        lineIndex++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={blockIndex++} className={`my-3 space-y-1.5 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((item, index) => <li key={`${index}-${item}`} className="pl-1">{renderInlineMarkdown(item)}</li>)}</List>);
      continue;
    }

    const paragraphLines = [line];
    lineIndex++;
    while (lineIndex < lines.length && lines[lineIndex].trim() && !isBlockStart(lines[lineIndex])) {
      paragraphLines.push(lines[lineIndex]);
      lineIndex++;
    }
    blocks.push(<p key={blockIndex++} className="my-3 leading-7">{renderInlineMarkdown(paragraphLines.join(" "))}</p>);
  }

  return <>{blocks}</>;
}

const workloadOptions = [
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
  {
    title: "Reasoning review",
    task: "reasoning",
    icon: Lightbulb,
    prompt:
      "Compare a queue and a stack, then recommend which one fits a browser history implementation and explain why.",
  },
  {
    title: "Quick answer",
    task: "simple_qa",
    icon: HelpCircle,
    prompt: "What does an HTTP 404 status code mean, and what is the usual fix?",
  },
  {
    title: "Creative brief",
    task: "creative_writing",
    icon: PenLine,
    prompt:
      "Write three playful product taglines for a calm, reliable API gateway.",
  },
  {
    title: "Open-ended planning",
    task: "general",
    icon: Brain,
    prompt:
      "Help me decide how to organize a small team's first week of reliability work.",
  },
];
export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState("");
  const [priority, setPriority] = useState("quality");
  const [taskHint, setTaskHint] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [response, setResponse] = useState("");
  const [routingDecision, setRoutingDecision] =
    useState<RoutingDecision | null>(null);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [visibleWorkloads, setVisibleWorkloads] = useState(() =>
    workloadOptions.slice(0, 4),
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const responseViewportRef = useRef<HTMLDivElement>(null);
  const followResponseRef = useRef(true);
  useEffect(() => {
    const viewport = responseViewportRef.current;
    if (viewport && followResponseRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [response]);
  useEffect(() => {
    const shuffled = [...workloadOptions].sort(() => Math.random() - 0.5);
    const frame = window.requestAnimationFrame(() => {
      setVisibleWorkloads(shuffled.slice(0, 4));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isStreaming) return;
    setIsStreaming(true);
    setResponse("");
    setRoutingDecision(null);
    setTrace([]);
    setError(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
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
        signal: abortController.signal,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
          retryAfterMs?: number;
        } | null;
        const retryAfterSeconds = payload?.retryAfterMs
          ? Math.ceil(payload.retryAfterMs / 1000)
          : null;
        throw new Error(
          payload?.error ??
            (res.status === 429
              ? `Too many requests. Please retry in ${retryAfterSeconds ?? 60} seconds.`
              : `HTTP ${res.status}`),
        );
      }
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
            if (parsed.taskType && parsed.provider && parsed.reason) {
              setRoutingDecision(parsed);
              setTrace(parsed.trace ?? []);
            }
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
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Route cancelled. Partial output has been preserved.");
      } else {
        setError(err instanceof Error ? err.message : "Execution failed");
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [isStreaming, priority, prompt, taskHint]);
  const cancelRoute = () => abortControllerRef.current?.abort();
  const copyResponse = () => {
    if (!response) return;
    void navigator.clipboard.writeText(response);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
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
              className="min-h-[290px] w-full resize-y border-0 bg-transparent font-mono text-[15px] leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
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
                    onValueChange={(value) => setTaskHint(value === "auto" ? "" : value ?? "")}
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
                onClick={isStreaming ? cancelRoute : handleSubmit}
                disabled={!prompt.trim()}
                isLoading={false}
                icon={isStreaming ? <X className="size-4" /> : <Send className="size-4" />}
              >
                {isStreaming ? "Cancel route" : "Execute route"}{" "}
                {!isStreaming && <span className="font-mono text-xs opacity-70">⌘↵</span>}
              </DsButton>
            </div>
          </DsCard>
        </div>
        <div className="space-y-5">
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
              {trace.length > 0 && (
                <div className="mt-4 border-t border-[var(--border-hairline)] pt-4">
                  <p className="mb-3 text-xs font-medium text-[var(--ink-muted)]">
                    Decision trace
                  </p>
                  <ol className="space-y-3">
                    {trace.map((step, index) => (
                      <li key={step.label} className="flex gap-3 text-xs">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-mono text-[var(--accent)]">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <strong className="block font-medium text-[var(--ink)]">
                            {step.label}
                          </strong>
                          <span className="mt-0.5 block break-words leading-5 text-[var(--ink-muted)]">
                            {step.detail}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </DsCard>
          ) : (
            <DsEmptyState
              title="No route resolved"
              description="Choose a sample or write a prompt to see the classifier and provider decision."
              icon={<Brain className="size-5" />}
            />
          )}
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--ink-muted)]">
              <Sparkles className="size-4 text-[var(--accent)]" />
              Try a workload
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleWorkloads.map((workload) => (
                <button
                  key={workload.title}
                  type="button"
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
      </div>
      <DsCard
        title="Streamed response"
        subtitle={isStreaming ? "Response is streaming" : undefined}
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
        <div
          ref={responseViewportRef}
          onScroll={(event) => {
            const viewport = event.currentTarget;
            followResponseRef.current =
              viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48;
          }}
          className="max-h-[min(60vh,640px)] min-h-32 overflow-y-auto rounded-[var(--radius-1)] bg-[var(--surface-sunken)] p-4 sm:p-5"
          aria-live="polite"
          aria-busy={isStreaming}
        >
          <div className="max-w-5xl break-words font-sans text-sm text-[var(--ink)]">
            {response ? <MarkdownResponse content={response} /> :
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
            {isStreaming && response && <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-[var(--accent)]" aria-label="Response is streaming" />}
          </div>
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
  );
}
