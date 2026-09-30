"use client";
import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import {
  DsEmptyState,
  DsIntentBadge,
  DsProviderBadge,
  DsStatusBadge,
} from "@/components/design-system";
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
  correlation_id: string;
}
export default function HistoryPage() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [selected, setSelected] = useState<RequestLog | null>(null);
  useEffect(() => {
    void fetch("/api/history")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { logs?: RequestLog[] } | null) => setLogs(payload?.logs ?? []))
      .catch(() => setLogs([]));
  }, []);
  const filtered = logs.filter(
    (log) =>
      (provider === "all" || log.provider === provider) &&
      (!query ||
        `${log.model} ${log.correlation_id} ${log.routing_reason}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const exportLogs = () => {
    const anchor = document.createElement("a");
    anchor.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(filtered, null, 2))}`;
    anchor.download = "modelroute-audit-logs.json";
    anchor.click();
  };
  return (
    <div className="space-y-5 p-4 sm:p-8">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <label className="flex h-9 items-center gap-2 rounded-[var(--radius-2)] border border-[var(--border-strong)] bg-[var(--surface)] px-3">
            <Search className="size-4 text-[var(--ink-faint)]" />
            <input
              aria-label="Search audit logs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search model or ID"
              className="w-52 bg-transparent text-xs outline-none"
            />
          </label>
          {["all", "groq", "gemini", "ollama"].map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setProvider(item)}
              className={`rounded-[var(--radius-2)] px-3 py-2 text-xs capitalize ${provider === item ? "bg-[var(--ink)] text-[var(--surface)]" : "border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink-muted)]"}`}
            >
              {item === "all" ? "All providers" : item}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportLogs}
          className="inline-flex items-center gap-2 rounded-[var(--radius-2)] border border-[var(--border-strong)] px-3 py-2 text-xs"
        >
          <Download className="size-4" />
          Export JSON
        </button>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[var(--border-hairline)] bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
              <tr>
                {[
                  "Timestamp",
                  "Intent",
                  "Provider and model",
                  "Latency",
                  "Tokens",
                  "Cost",
                  "Status",
                ].map((head) => (
                  <th key={head} className="px-4 py-3 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="cursor-pointer border-b border-[var(--border-hairline)] hover:bg-[var(--accent-soft)]"
                >
                  <td className="px-4 py-4 font-mono text-[var(--ink-muted)]">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-4">
                    <DsIntentBadge intent={log.task_type} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <DsProviderBadge provider={log.provider} />
                      <span className="font-mono text-[var(--ink-muted)]">
                        {log.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono">{log.latency_ms} ms</td>
                  <td className="px-4 py-4 font-mono text-[var(--ink-muted)]">
                    {log.input_tokens} → {log.output_tokens}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    ${log.estimated_cost_usd.toFixed(6)}
                  </td>
                  <td className="px-4 py-4">
                    <DsStatusBadge status={log.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <DsEmptyState
            title="No matching requests"
            description="Adjust the search or provider filter."
          />
        )}
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[rgba(22,19,15,.18)]"
          onClick={() => setSelected(null)}
        >
          <aside
            className="h-full w-full max-w-md border-l border-[var(--border-hairline)] bg-[var(--surface)] p-6 shadow-[var(--shadow-floating)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-[var(--ink-muted)]">Routing decision</p>
            <h2 className="mt-1 text-xl font-semibold">
              {selected.correlation_id}
            </h2>
            <div className="mt-8 space-y-5 text-sm">
              <p className="border-l-2 border-[var(--accent)] pl-4">
                Classified as <strong>{selected.task_type}</strong>
              </p>
              <p className="border-l-2 border-[var(--gemini)] pl-4">
                Selected <strong>{selected.provider}</strong>
                <br />
                <span className="font-mono text-xs text-[var(--ink-muted)]">
                  {selected.model}
                </span>
              </p>
              <p className="rounded-[var(--radius-2)] bg-[var(--surface-sunken)] p-4 text-xs leading-6 text-[var(--ink-muted)]">
                {selected.routing_reason}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
