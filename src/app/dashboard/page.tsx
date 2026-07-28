'use client';

import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Send,
  Zap,
  Brain,
  DollarSign,
  Clock,
  Sparkles,
  Copy,
  Check,
  Code2,
  FileText,
  Boxes,
  Languages,
  ShieldCheck,
  Terminal as TerminalIcon,
  Cpu,
  Loader2,
} from 'lucide-react';
import {
  DsButton,
  DsProviderBadge,
  DsIntentBadge,
  DsCard,
  DsEmptyState,
} from '@/components/design-system';

interface RoutingDecision {
  taskType: string;
  classifierMode: string;
  classifierConfidence: number;
  provider: string;
  model: string;
  reason: string;
  fallbacksConsidered: Array<{ provider: string; model: string; reason: string }>;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

const BENCHMARK_WORKLOADS = [
  {
    title: 'Code Synthesis',
    task: 'code_generation',
    icon: Code2,
    prompt: 'Write an optimized Python function to check if a number is prime. Include type hints and time complexity analysis.',
  },
  {
    title: 'Technical Summarization',
    task: 'summarization',
    icon: FileText,
    prompt: 'Summarize the core architectural differences between REST APIs and GraphQL in 3 concise bullet points.',
  },
  {
    title: 'Entity Extraction',
    task: 'extraction',
    icon: Boxes,
    prompt: 'Extract all customer emails, order IDs, and total amounts into valid JSON from this log: "User john@example.com created order #ORD-9981 totaling $149.50 on 2026-03-12."',
  },
  {
    title: 'Technical Translation',
    task: 'translation',
    icon: Languages,
    prompt: 'Translate this notification into French: "Your API key quota is operating at 80% capacity. Upgrade to prevent interruption."',
  },
];

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState('');
  const [priority, setPriority] = useState<string>('quality');
  const [taskHint, setTaskHint] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [response, setResponse] = useState('');
  const [routingDecision, setRoutingDecision] = useState<RoutingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isStreaming) return;

    setIsStreaming(true);
    setResponse('');
    setRoutingDecision(null);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        priority,
        stream: true,
      };

      if (taskHint) {
        body.taskHint = taskHint;
      }

      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream available');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.taskType && parsed.provider && parsed.reason) {
                setRoutingDecision(parsed);
              } else if (parsed.content !== undefined) {
                setResponse((prev) => prev + parsed.content);
              } else if (parsed.latencyMs !== undefined) {
                setRoutingDecision((prev) =>
                  prev ? { ...prev, ...parsed } : null,
                );
              } else if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsStreaming(false);
    }
  }, [prompt, priority, taskHint, isStreaming]);

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#07080e]">
      {/* Console Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 bg-[#0c0d15] flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <TerminalIcon className="w-5 h-5 text-indigo-400" />
            Playground Studio
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Evaluate prompt classification, policy execution, and latency tradeoffs across model providers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs font-mono border-indigo-500/40 text-indigo-300 bg-indigo-500/10 px-3 py-1">
            POST /api/route
          </Badge>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-mono px-3 py-1 flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Circuit Breaker Active
          </Badge>
        </div>
      </header>

      {/* Main Split Studio Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden p-8 gap-8 max-w-7xl mx-auto w-full">
        
        {/* Left Column: Workload Selector & Prompt Input (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6 overflow-y-auto pr-1">
          
          {/* Preset Cards */}
          <div className="space-y-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Sample Benchmark Workloads
            </span>

            <div className="grid grid-cols-2 gap-3">
              {BENCHMARK_WORKLOADS.map((item) => (
                <button
                  key={item.title}
                  onClick={() => {
                    setPrompt(item.prompt);
                    setTaskHint(item.task);
                  }}
                  className="p-3.5 rounded-2xl border border-white/10 bg-[#11131f] hover:bg-[#161829] hover:border-indigo-500/50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-indigo-300 mb-1">
                    <item.icon className="w-4 h-4 text-indigo-400" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono line-clamp-1">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Main Input Textarea Container */}
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Input Prompt Definition
              </label>
              <span className="text-xs font-mono text-slate-400">{prompt.length} chars</span>
            </div>

            <div className="flex-1 flex flex-col rounded-2xl border border-white/10 bg-[#11131f] focus-within:border-indigo-500/60 transition-all overflow-hidden">
              <Textarea
                placeholder="Type prompt content here to test live model routing..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 bg-transparent border-0 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 p-5 leading-relaxed resize-none min-h-[220px]"
                id="prompt-input"
              />

              {/* Controls Bar */}
              <div className="p-4 border-t border-white/10 bg-[#0c0d15] flex flex-wrap items-center justify-between gap-4">
                
                <div className="flex items-center gap-3">
                  {/* Priority Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">Priority Policy</span>
                    <Select value={priority} onValueChange={(val) => val && setPriority(val)}>
                      <SelectTrigger className="w-[145px] h-9 text-xs bg-white/5 border-white/10 text-slate-200" id="priority-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
                        <SelectItem value="quality">
                          <span className="flex items-center gap-2"><Brain className="w-3.5 h-3.5 text-purple-400" /> Quality</span>
                        </SelectItem>
                        <SelectItem value="fast">
                          <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-400" /> Fast</span>
                        </SelectItem>
                        <SelectItem value="cheap">
                          <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cheap</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Task Hint Override */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">Classification Override</span>
                    <Select value={taskHint} onValueChange={(val) => setTaskHint(val ?? '')}>
                      <SelectTrigger className="w-[155px] h-9 text-xs bg-white/5 border-white/10 text-slate-200" id="task-hint-select">
                        <SelectValue placeholder="Auto-Classify" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
                        <SelectItem value="auto">Auto-Classify</SelectItem>
                        <SelectItem value="code_generation">Code Generation</SelectItem>
                        <SelectItem value="summarization">Summarization</SelectItem>
                        <SelectItem value="extraction">Extraction</SelectItem>
                        <SelectItem value="creative_writing">Creative Writing</SelectItem>
                        <SelectItem value="reasoning">Reasoning</SelectItem>
                        <SelectItem value="simple_qa">Simple Q&A</SelectItem>
                        <SelectItem value="translation">Translation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Shared DsButton Component */}
                <DsButton
                  onClick={handleSubmit}
                  isLoading={isStreaming}
                  disabled={!prompt.trim()}
                  icon={<Send className="w-4 h-4" />}
                  id="submit-btn"
                >
                  Execute Route
                </DsButton>
              </div>
            </div>
          </div>
        </div>

        {/* Right Output Column (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-6 overflow-y-auto">
          
          {/* Diagnostic Card using DsCard */}
          {routingDecision ? (
            <DsCard
              isHero
              title={
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>Policy Execution Resolution & Diagnostics</span>
                </div>
              }
              headerAction={
                <div className="flex items-center gap-4 font-mono text-xs">
                  {routingDecision.latencyMs && (
                    <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> {routingDecision.latencyMs}ms
                    </span>
                  )}
                  {routingDecision.estimatedCostUsd !== undefined && (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <DollarSign className="w-3.5 h-3.5" /> ${routingDecision.estimatedCostUsd.toFixed(6)}
                    </span>
                  )}
                </div>
              }
            >
              <div className="space-y-4">
                {/* 4 Metric Badges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                      Classified Intent
                    </span>
                    <DsIntentBadge intent={routingDecision.taskType} />
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                      Assigned Provider
                    </span>
                    <DsProviderBadge provider={routingDecision.provider} />
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                      Primary Model
                    </span>
                    <span className="font-mono text-xs text-white font-bold block truncate">
                      {routingDecision.model}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                      Classifier Confidence
                    </span>
                    <span className="font-mono text-xs text-emerald-400 font-bold block">
                      {(routingDecision.classifierConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Explanation */}
                <div className="p-4 rounded-xl bg-[#07080e] border border-white/5">
                  <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                    Policy Match Explanation
                  </span>
                  <p className="text-xs font-mono text-slate-300 leading-relaxed">
                    {routingDecision.reason}
                  </p>
                </div>

                {/* Fallback candidate chain */}
                {routingDecision.fallbacksConsidered.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                      Fallback Candidate Chain
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {routingDecision.fallbacksConsidered.map((f, i) => (
                        <div key={i} className="text-xs font-mono px-3 py-1 rounded-lg bg-white/[0.02] border border-white/5 text-slate-300">
                          <span className="text-slate-100 font-semibold">{f.provider}</span> / {f.model}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DsCard>
          ) : (
            <DsEmptyState
              title="No Execution Active"
              description="Select a sample workload preset on the left or enter a custom prompt to execute routing diagnostics."
            />
          )}

          {/* Response Terminal */}
          <div className="flex-1 flex flex-col rounded-2xl border border-white/10 bg-[#0c0d15] overflow-hidden min-h-[360px]">
            <div className="h-11 px-5 bg-[#11131f] border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="text-xs font-mono text-slate-400 ml-3">output_stream.txt</span>
              </div>

              {response && (
                <DsButton variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                  {copied ? 'Copied Output' : 'Copy Output'}
                </DsButton>
              )}
            </div>

            <div className="flex-1 p-6 font-mono text-sm text-slate-100 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text">
              {response ? (
                <>
                  {response}
                  {isStreaming && <span className="inline-block w-2 h-4 bg-indigo-400 ml-1 animate-pulse" />}
                </>
              ) : isStreaming ? (
                <div className="flex items-center gap-3 text-indigo-400 font-mono text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Streaming model output from designated provider endpoint...</span>
                </div>
              ) : (
                <span className="text-slate-500 font-mono italic text-xs">
                  // Streamed output from the assigned model will render here in real time...
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
