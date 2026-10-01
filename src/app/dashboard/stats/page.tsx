"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, DollarSign, Gauge, RefreshCw, Zap } from "lucide-react";
import {
  DsCard,
  DsEmptyState,
  DsMetricCard,
  SegmentedControl,
} from "@/components/design-system";

interface Stats {
  requests: number;
  totalCost: number;
  p50: number | null;
  p95: number | null;
  failoverRate: number;
  byProvider: Array<{
    name: string;
    requests: number;
    p50: number | null;
    p95: number | null;
  }>;
}

const emptyStats: Stats = {
  requests: 0,
  totalCost: 0,
  p50: null,
  p95: null,
  failoverRate: 0,
  byProvider: [],
};

export default function StatsPage() {
  const [range, setRange] = useState("7d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/stats?period=${range}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Analytics are unavailable.");
        return response.json() as Promise<Stats>;
      })
      .then((payload) => {
        setError(null);
        setStats(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setStats(emptyStats);
        setError(
          reason instanceof Error
            ? reason.message
            : "Analytics are unavailable.",
        );
      });

    return () => controller.abort();
  }, [range, refreshToken]);

  const hasData = Boolean(stats?.requests);

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--ink-muted)]">
          Operational metrics from persisted routing decisions.
        </p>
        <div className="flex items-center gap-2">
          <SegmentedControl
            options={[
              { value: "24h", label: "24h" },
              { value: "7d", label: "7 days" },
              { value: "30d", label: "30 days" },
            ]}
            value={range}
            onChange={setRange}
          />
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            aria-label="Refresh analytics"
            className="inline-flex size-10 items-center justify-center rounded-[var(--radius-2)] border border-[var(--border-strong)] text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-2)] border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {!stats ? (
        <DsEmptyState
          title="Loading analytics"
          description="Reading persisted request logs..."
        />
      ) : !hasData ? (
        <DsEmptyState
          title="No analytics yet"
          description="Run a prompt in Playground Studio. Completed routes will appear here with latency, cost, and failover metrics."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DsMetricCard
              label="Requests"
              value={stats.requests}
              subtext={`Last ${range}`}
              icon={<Zap className="size-4 text-[var(--accent)]" />}
            />
            <DsMetricCard
              label="P50 latency"
              value={`${stats.p50 ?? "-"} ms`}
              subtext={`P95 ${stats.p95 ?? "-"} ms`}
              icon={<Clock className="size-4 text-[var(--groq)]" />}
            />
            <DsMetricCard
              label="Total cost"
              value={`$${stats.totalCost.toFixed(6)}`}
              subtext="Persisted estimate"
              icon={<DollarSign className="size-4 text-[var(--success)]" />}
            />
            <DsMetricCard
              label="Failover rate"
              value={`${(stats.failoverRate * 100).toFixed(1)}%`}
              subtext="Fallback executions"
              icon={<Gauge className="size-4 text-[var(--warning)]" />}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DsCard
              title="Requests by provider"
              subtitle="Persisted request volume"
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byProvider}>
                    <CartesianGrid
                      stroke="var(--border-hairline)"
                      vertical={false}
                    />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar
                      dataKey="requests"
                      fill="var(--accent)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DsCard>
            <DsCard
              title="Provider latency"
              subtitle="P50 and P95 milliseconds"
            >
              <div className="space-y-4">
                {stats.byProvider.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="font-medium capitalize">
                      {provider.name}
                    </span>
                    <span className="font-mono text-xs text-[var(--ink-muted)]">
                      P50 {provider.p50 ?? "-"} ms / P95 {provider.p95 ?? "-"}{" "}
                      ms
                    </span>
                  </div>
                ))}
              </div>
            </DsCard>
          </div>
        </>
      )}
    </div>
  );
}
