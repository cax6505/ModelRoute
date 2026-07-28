'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

const USAGE_PIE_DATA = [
  { name: 'Groq LPU', value: 45, color: '#f97316' },
  { name: 'Gemini Flash', value: 35, color: '#3b82f6' },
  { name: 'Ollama Local', value: 20, color: '#10b981' },
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
    <div className="h-full flex flex-col overflow-hidden bg-[#05060a]">
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 bg-[#080912]/80 backdrop-blur-xl flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Analytics & Cost Avoidance Metrics
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            Monitor model volume distribution, latency benchmarks, and savings versus commercial LLM APIs.
          </p>
        </div>

        <Select value={period} onValueChange={(val) => val && setPeriod(val)}>
          <SelectTrigger className="w-[140px] h-9 text-xs bg-white/5 border-white/10 text-zinc-200">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent className="bg-[#11121d] border-white/10 text-zinc-200">
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-glass p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Total Requests</span>
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-3 font-mono">455</div>
            <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 inline" /> +14% vs previous period
            </p>
          </div>

          <div className="card-glass p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Avg Latency</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-3 font-mono">584ms</div>
            <p className="text-xs text-zinc-400 mt-2">
              Groq avg: 210ms | Gemini: 450ms
            </p>
          </div>

          <div className="card-glass p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Success Rate</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3 font-mono">99.3%</div>
            <p className="text-xs text-zinc-400 mt-2">
              3 rate-limit events gracefully handled
            </p>
          </div>

          <div className="card-glass p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Actual Cost</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3 font-mono">$0.00</div>
            <p className="text-xs text-zinc-400 mt-2">
              100% Free-tier quota routed
            </p>
          </div>
        </div>

        {/* Cost Avoidance Card */}
        <Card className="card-glass border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-[#0e101c] to-purple-950/20">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs px-3 py-1 font-mono mb-2">
                Cost Savings Metric
              </Badge>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Equivalent Commercial API Cost Avoidance:
              </h2>
              <p className="text-sm text-zinc-400">
                Calculated based on standard commercial pricing ($2.50/1M input, $10.00/1M output tokens) across 455 routed requests.
              </p>
            </div>
            <div className="text-right flex-shrink-0 bg-white/[0.02] p-5 rounded-2xl border border-white/5">
              <div className="text-4xl font-extrabold font-mono text-emerald-400">$18.42</div>
              <span className="text-xs font-semibold text-emerald-400/80 font-mono mt-1 block">Saved via ModelRoute Policy</span>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="card-glass">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                Provider Volume Distribution (%)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[280px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={USAGE_PIE_DATA} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={6} dataKey="value">
                    {USAGE_PIE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0e101c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 pl-6 border-l border-white/10 text-sm">
                {USAGE_PIE_DATA.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-white">{item.name}</span>
                    <span className="font-mono text-zinc-400">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                Model Latency Benchmarks (ms)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={LATENCY_BAR_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="model" stroke="#64748b" fontSize={11} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0e101c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '13px' }} />
                  <Bar dataKey="latency" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
