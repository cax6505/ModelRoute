'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, History as HistoryIcon } from 'lucide-react';

interface RequestLog {
  id: string;
  created_at: string;
  task_type: string;
  provider: string;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  status: string;
  routing_reason: string;
  priority: string;
  prompt_length: number;
  correlation_id: string;
}

const PROVIDER_STYLES: Record<string, string> = {
  groq: 'provider-badge-groq',
  gemini: 'provider-badge-gemini',
  ollama: 'provider-badge-ollama',
};

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
  fallback: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

const TASK_TYPE_COLORS: Record<string, string> = {
  code_generation: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  summarization: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  extraction: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  creative_writing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  reasoning: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  simple_qa: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  translation: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  general: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

const DEMO_LOGS: RequestLog[] = [
  {
    id: '1', created_at: new Date(Date.now() - 60000).toISOString(),
    task_type: 'code_generation', provider: 'groq', model: 'llama-3.3-70b-versatile',
    latency_ms: 1234, input_tokens: 156, output_tokens: 892, estimated_cost_usd: 0.000795,
    status: 'success', routing_reason: 'task_type=code_generation, priority=quality, top_candidate=groq/llama-3.3-70b-versatile',
    priority: 'quality', prompt_length: 89, correlation_id: 'mr_abc123',
  },
  {
    id: '2', created_at: new Date(Date.now() - 120000).toISOString(),
    task_type: 'simple_qa', provider: 'groq', model: 'llama-3.1-8b-instant',
    latency_ms: 287, input_tokens: 42, output_tokens: 128, estimated_cost_usd: 0.000012,
    status: 'success', routing_reason: 'task_type=simple_qa, priority=fast, top_candidate=groq/llama-3.1-8b-instant',
    priority: 'fast', prompt_length: 38, correlation_id: 'mr_def456',
  },
  {
    id: '3', created_at: new Date(Date.now() - 300000).toISOString(),
    task_type: 'summarization', provider: 'gemini', model: 'gemini-2.0-flash',
    latency_ms: 2150, input_tokens: 1200, output_tokens: 340, estimated_cost_usd: 0.000256,
    status: 'success', routing_reason: 'task_type=summarization, priority=quality, top_candidate=gemini/gemini-2.0-flash',
    priority: 'quality', prompt_length: 4200, correlation_id: 'mr_ghi789',
  },
  {
    id: '4', created_at: new Date(Date.now() - 600000).toISOString(),
    task_type: 'translation', provider: 'gemini', model: 'gemini-2.0-flash',
    latency_ms: 1800, input_tokens: 87, output_tokens: 95, estimated_cost_usd: 0.000047,
    status: 'fallback', routing_reason: 'Fallback: groq rate-limit reached (429), executed via gemini',
    priority: 'quality', prompt_length: 62, correlation_id: 'mr_jkl012',
  },
  {
    id: '5', created_at: new Date(Date.now() - 900000).toISOString(),
    task_type: 'reasoning', provider: 'ollama', model: 'llama3.2',
    latency_ms: 4500, input_tokens: 210, output_tokens: 680, estimated_cost_usd: 0,
    status: 'success', routing_reason: 'task_type=reasoning, priority=cheap, top_candidate=ollama/llama3.2',
    priority: 'cheap', prompt_length: 156, correlation_id: 'mr_mno345',
  },
];

export default function HistoryPage() {
  const [logs] = useState<RequestLog[]>(DEMO_LOGS);
  const [filterTask, setFilterTask] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = logs.filter((log) => {
    if (filterTask !== 'all' && log.task_type !== filterTask) return false;
    if (filterProvider !== 'all' && log.provider !== filterProvider) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#090a10]">
      {/* Console Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-white/10 bg-[#0d0e17] flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-indigo-400" />
            Request Logs & Audit Trail
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Inspect request metadata, classification tags, latency distributions, and policy resolution reasons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-zinc-400" />
          <Select value={filterTask} onValueChange={(val) => setFilterTask(val ?? 'all')}>
            <SelectTrigger className="w-[150px] h-9 text-xs bg-white/5 border-white/10 text-zinc-200">
              <SelectValue placeholder="Task Intent" />
            </SelectTrigger>
            <SelectContent className="bg-[#11121d] border-white/10 text-zinc-200">
              <SelectItem value="all">All Intent Types</SelectItem>
              <SelectItem value="code_generation">Code Generation</SelectItem>
              <SelectItem value="summarization">Summarization</SelectItem>
              <SelectItem value="extraction">Extraction</SelectItem>
              <SelectItem value="creative_writing">Creative</SelectItem>
              <SelectItem value="reasoning">Reasoning</SelectItem>
              <SelectItem value="simple_qa">Simple Q&A</SelectItem>
              <SelectItem value="translation">Translation</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterProvider} onValueChange={(val) => setFilterProvider(val ?? 'all')}>
            <SelectTrigger className="w-[140px] h-9 text-xs bg-white/5 border-white/10 text-zinc-200">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent className="bg-[#11121d] border-white/10 text-zinc-200">
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="groq">Groq</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val ?? 'all')}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-white/5 border-white/10 text-zinc-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#11121d] border-white/10 text-zinc-200">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="fallback">Fallback</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full">
        <div className="rounded-xl border border-white/10 bg-[#11121d] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d0e17] text-xs font-mono text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">Classified Intent</th>
                <th className="py-3.5 px-5">Assigned Target</th>
                <th className="py-3.5 px-5">Latency</th>
                <th className="py-3.5 px-5">Token Volume</th>
                <th className="py-3.5 px-5">Estimated Cost</th>
                <th className="py-3.5 px-5">Execution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filtered.map((log) => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-5 font-mono text-xs text-zinc-400">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-4 px-5">
                      <Badge className={`text-xs font-mono border ${TASK_TYPE_COLORS[log.task_type] ?? TASK_TYPE_COLORS.general}`}>
                        {log.task_type}
                      </Badge>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs font-mono ${PROVIDER_STYLES[log.provider]}`}>
                          {log.provider}
                        </Badge>
                        <span className="font-mono text-xs text-zinc-300">
                          {log.model}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono text-xs font-semibold text-white">
                      {log.latency_ms}ms
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-zinc-400">
                      {log.input_tokens} → {log.output_tokens}
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-emerald-400 font-medium">
                      ${log.estimated_cost_usd.toFixed(6)}
                    </td>
                    <td className="py-4 px-5">
                      <Badge className={`text-xs font-mono border ${STATUS_STYLES[log.status] ?? STATUS_STYLES.success}`}>
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={7} className="!bg-[#090a12] p-5 border-t border-white/5">
                        <div className="space-y-2">
                          <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider block">
                            Policy Resolution Reason
                          </span>
                          <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                            {log.routing_reason}
                          </p>
                          <div className="flex items-center gap-6 mt-3 text-xs font-mono text-zinc-400">
                            <span>Priority Mode: <span className="text-white font-semibold">{log.priority}</span></span>
                            <span>Prompt Length: <span className="text-white font-semibold">{log.prompt_length} chars</span></span>
                            <span>Correlation ID: <span className="text-zinc-300">{log.correlation_id}</span></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm font-mono text-zinc-500">
              No request logs match the selected filter criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
