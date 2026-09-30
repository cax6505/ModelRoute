"use client";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Clock, DollarSign, Gauge, Zap } from "lucide-react";
import {
  DsCard,
  DsMetricCard,
  SegmentedControl,
} from "@/components/design-system";
const traffic = [
  { day: "Mon", requests: 48 },
  { day: "Tue", requests: 62 },
  { day: "Wed", requests: 55 },
  { day: "Thu", requests: 71 },
  { day: "Fri", requests: 83 },
  { day: "Sat", requests: 67 },
  { day: "Sun", requests: 69 },
];
export default function StatsPage() {
  const [range, setRange] = useState("7d");
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex justify-end">
        <SegmentedControl
          options={[
            { value: "24h", label: "24h" },
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
          ]}
          value={range}
          onChange={setRange}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DsMetricCard
          label="Requests"
          value="455"
          trend="+14%"
          subtext="vs previous period"
          icon={<Zap className="size-4 text-[var(--accent)]" />}
        />
        <DsMetricCard
          label="P50 latency"
          value="210 ms"
          subtext="P95 780 ms"
          icon={<Clock className="size-4 text-[var(--groq)]" />}
        />
        <DsMetricCard
          label="Total cost"
          value="$0.00"
          subtext="$18.42 avoided"
          icon={<DollarSign className="size-4 text-[var(--success)]" />}
        />
        <DsMetricCard
          label="Failover rate"
          value="0.7%"
          subtext="3 recovered requests"
          icon={<Gauge className="size-4 text-[var(--warning)]" />}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <DsCard
          title="Requests over time"
          subtitle={`Rolling ${range} traffic`}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={traffic}>
                <CartesianGrid
                  stroke="var(--border-hairline)"
                  vertical={false}
                />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-2)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="var(--accent)"
                  fill="var(--accent-soft)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DsCard>
        <DsCard title="Cost by provider" subtitle="Share of routed volume">
          <div className="space-y-5 pt-4">
            {[
              ["Groq", 45, "var(--groq)"],
              ["Gemini", 35, "var(--gemini)"],
              ["Ollama", 20, "var(--ollama)"],
            ].map(([name, value, color]) => (
              <div key={String(name)}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-mono text-[var(--ink-muted)]">
                    {value}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-sunken)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${value}%`, background: String(color) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </DsCard>
      </div>
      <DsCard
        title="Latency percentile by provider"
        subtitle="Measured response latency in milliseconds"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: "Groq", p50: 210, p95: 490 },
                { name: "Gemini", p50: 450, p95: 820 },
                { name: "Ollama", p50: 1200, p95: 3200 },
              ]}
            >
              <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-2)",
                }}
              />
              <Bar dataKey="p50" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="p95"
                fill="var(--ink-faint)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DsCard>
    </div>
  );
}
