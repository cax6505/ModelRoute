'use client';

import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, History as HistoryIcon } from 'lucide-react';
import {
  DsProviderBadge,
  DsStatusBadge,
  DsIntentBadge,
} from '@/components/design-system';

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
    <div className="h-full flex flex-col overflow-hidden bg-[#07080e]">
      {/* Console Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 bg-[#0c0d15] flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <HistoryIcon className="w-5 h-5 text-indigo-400" />
            Request Audit Logs
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Inspect request metadata, classification tags, latency distributions, and policy resolution reasons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={filterTask} onValueChange={(val) => setFilterTask(val ?? 'all')}>
            <SelectTrigger className="w-[155px] h-9 text-xs bg-white/5 border-white/10 text-slate-200">
              <SelectValue placeholder="Task Intent" />
            </SelectTrigger>
            <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
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
            <SelectTrigger className="w-[140px] h-9 text-xs bg-white/5 border-white/10 text-slate-200">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="groq">Groq</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val ?? 'all')}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-white/5 border-white/10 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="fallback">Fallback</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Main Table View Area */}
      <div className="flex-1 overflow-auto p-8 max-w-7xl mx-auto w-full">
        <div className="rounded-2xl border border-white/10 bg-[#11131f] overflow-hidden shadow-xl shadow-black/40">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0c0d15] text-xs font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6 text-left">Timestamp</th>
                <th className="py-4 px-6 text-left">Classified Intent</th>
                <th className="py-4 px-6 text-left">Assigned Provider & Model</th>
                <th className="py-4 px-6 text-right">Latency</th>
                <th className="py-4 px-6 text-right">Tokens (In → Out)</th>
                <th className="py-4 px-6 text-right">Estimated Cost</th>
                <th className="py-4 px-6 text-center">Execution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filtered.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-4 px-6 font-mono text-xs text-slate-400 text-left">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-4 px-6 text-left">
                      <DsIntentBadge intent={log.task_type} />
                    </td>
                    <td className="py-4 px-6 text-left">
                      <div className="flex items-center gap-2">
                        <DsProviderBadge provider={log.provider} />
                        <span className="font-mono text-xs text-slate-300 font-medium">
                          {log.model}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-semibold text-white text-right">
                      {log.latency_ms}ms
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-slate-400 text-right">
                      {log.input_tokens} → {log.output_tokens}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-emerald-400 font-semibold text-right">
                      ${log.estimated_cost_usd.toFixed(6)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <DsStatusBadge status={log.status} />
                    </td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr>
                      <td colSpan={7} className="!bg-[#090a12] p-6 border-t border-white/5">
                        <div className="space-y-2">
                          <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider block">
                            Policy Resolution Reason
                          </span>
                          <p className="text-xs font-mono text-slate-300 leading-relaxed">
                            {log.routing_reason}
                          </p>
                          <div className="flex items-center gap-6 mt-3 text-xs font-mono text-slate-400">
                            <span>Priority Mode: <span className="text-white font-semibold">{log.priority}</span></span>
                            <span>Prompt Length: <span className="text-white font-semibold">{log.prompt_length} chars</span></span>
                            <span>Correlation ID: <span className="text-slate-300">{log.correlation_id}</span></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm font-mono text-slate-500">
              No request audit logs match the selected filter criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
