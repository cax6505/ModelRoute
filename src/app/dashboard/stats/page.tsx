'use client';

import { useState } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Zap, Clock, DollarSign, CheckCircle2, TrendingUp, BarChart3 } from 'lucide-react';
import { DsMetricCard, DsCard } from '@/components/design-system';

const USAGE_PIE_DATA = [
  { name: 'Groq LPU', value: 45, color: '#fb923c' },
  { name: 'Gemini Flash', value: 35, color: '#60a5fa' },
  { name: 'Ollama Local', value: 20, color: '#34d399' },
];

const LATENCY_BAR_DATA = [
  { model: 'Groq (Llama 8B)', latency: 210 },
  { model: 'Gemini Flash Lite', latency: 450 },
  { model: 'Groq (Llama 70B)', latency: 780 },
  { model: 'Gemini Flash', latency: 1100 },
  { model: 'Ollama (Local)', latency: 3200 },
];

export default function StatsPage() {
  const [period, setPeriod] = useState<string>('7d');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#07080e]">
      {/* Console Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 bg-[#0c0d15] flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Analytics & Savings Architecture
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Monitor model volume distribution, latency benchmarks, and commercial API cost avoidance.
          </p>
        </div>

        <Select value={period} onValueChange={(val) => val && setPeriod(val)}>
          <SelectTrigger className="w-[145px] h-9 text-xs bg-white/5 border-white/10 text-slate-200">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent className="bg-[#171929] border-white/10 text-slate-200">
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {/* Main Stats View */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-7xl mx-auto w-full">
        
        {/* HERO COST AVOIDANCE CARD - DOMINATES THE PAGE */}
        <DsCard isHero>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
                ★ Hero Financial Metric
              </span>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Commercial API Cost Avoidance:
              </h2>
              <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
                Calculated based on standard commercial pricing ($2.50/1M input tokens, $10.00/1M output tokens) across 455 routed requests in this period.
              </p>
            </div>

            <div className="text-right flex-shrink-0 bg-[#07080e] p-6 rounded-2xl border border-indigo-500/30 shadow-xl shadow-indigo-500/10">
              <div className="text-5xl font-mono font-extrabold text-emerald-400 tracking-tight">
                $18.42
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-400/90 mt-1 block">
                Saved via ModelRoute Free Tier Policy
              </span>
            </div>
          </div>
        </DsCard>

        {/* 4 Standard Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DsMetricCard
            label="Total Routed Requests"
            value="455"
            trend="+14%"
            subtext="vs previous period"
            icon={<Zap className="w-5 h-5 text-indigo-400" />}
          />

          <DsMetricCard
            label="Latency Percentiles (P50/P90)"
            value="210ms / 584ms"
            subtext="P99: 1.1s (Ollama fallback)"
            icon={<Clock className="w-5 h-5 text-amber-400" />}
          />

          <DsMetricCard
            label="Routing Success Rate"
            value="99.3%"
            subtext="3 rate-limits handled"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          />

          <DsMetricCard
            label="Actual Incurred Cost"
            value="$0.00"
            subtext="100% Free-tier quota"
            icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          />
        </div>

        {/* Charts using DsCard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <DsCard
            title={<span className="text-xs font-mono uppercase tracking-wider text-slate-400">Provider Volume Share (%)</span>}
          >
            <div className="h-[280px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={USAGE_PIE_DATA} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={6} dataKey="value">
                    {USAGE_PIE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#171929', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 pl-6 border-l border-white/10 text-sm">
                {USAGE_PIE_DATA.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-white">{item.name}</span>
                    <span className="font-mono text-slate-400">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </DsCard>

          <DsCard
            title={<span className="text-xs font-mono uppercase tracking-wider text-slate-400">Model Latency Distribution (ms)</span>}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={LATENCY_BAR_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="model" stroke="#64748b" fontSize={11} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#171929', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' }} />
                  <Bar dataKey="latency" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DsCard>
        </div>
      </div>
    </div>
  );
}
