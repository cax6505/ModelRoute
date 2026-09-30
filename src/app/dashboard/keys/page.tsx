"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Key, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { DsButton, DsCard, DsStatusBadge } from "@/components/design-system";
interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
  revoked: boolean;
}
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/keys")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { keys?: Array<{ id: string; name: string; key_prefix: string; created_at: string; last_used_at?: string; is_revoked: boolean }> } | null) => {
        if (payload?.keys) setKeys(payload.keys.map((item) => ({ id: item.id, name: item.name, prefix: item.key_prefix, created: new Date(item.created_at).toLocaleDateString(), lastUsed: item.last_used_at ? new Date(item.last_used_at).toLocaleString() : "Never", revoked: item.is_revoked })));
      })
      .catch(() => setMessage("Keys could not be loaded."))
      .finally(() => setLoading(false));
  }, []);
  const create = () => {
    if (!name.trim()) return;
    void fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) })
      .then(async (response) => { if (!response.ok) throw new Error("Create failed"); return response.json(); })
      .then((payload: { rawKey: string; key: { id: string; name: string; key_prefix: string; created_at: string } }) => { setKeys((current) => [{ id: payload.key.id, name: payload.key.name, prefix: payload.key.key_prefix, created: "Just now", lastUsed: "Never", revoked: false }, ...current]); setRevealed(payload.rawKey); setName(""); })
      .catch(() => setMessage("Key could not be created."));
  };
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--ink-muted)]">
            Keys are SHA-256 hashed at rest.
          </p>
          <p className="mt-1 text-xs text-[var(--ink-faint)]">
            Raw credentials are shown once, immediately after creation.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New key name"
            className="h-10 rounded-[var(--radius-2)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
          />
          <DsButton
            onClick={create}
            disabled={!name.trim()}
            icon={<Plus className="size-4" />}
          >
            Create key
          </DsButton>
        </div>
      </div>
      <DsCard
        title={
          <span className="flex items-center gap-2">
            <Key className="size-4 text-[var(--accent)]" />
            Application keys
          </span>
        }
      >
        <div className="space-y-3">
          {loading && <p className="text-sm text-[var(--ink-muted)]">Loading keys...</p>}
          {keys.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-2)] border border-[var(--border-hairline)] p-4"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{item.name}</span>
                  <DsStatusBadge status={item.revoked ? "revoked" : "active"} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs text-[var(--ink-muted)]">
                  <span>{item.prefix}••••</span>
                  <span>Created {item.created}</span>
                  <span>Last used {item.lastUsed}</span>
                </div>
              </div>
              {!item.revoked && (
                <DsButton
                  variant="destructive"
                  size="sm"
                  onClick={() => { if (!window.confirm("Revoke this API key?")) return; void fetch(`/api/keys?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).then((response) => { if (!response.ok) throw new Error("Revoke failed"); setKeys((current) => current.map((key) => key.id === item.id ? { ...key, revoked: true } : key)); }).catch(() => setMessage("Key could not be revoked.")); }}
                  icon={<Trash2 className="size-4" />}
                >
                  Revoke
                </DsButton>
              )}
            </div>
          ))}
        </div>
      </DsCard>
      {revealed && (
        <div className="rounded-[var(--radius-3)] border border-[var(--warning)] bg-[var(--warning-soft)] p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 text-[var(--warning)]" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Copy this key now</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                This SHA-256-backed secret will never be shown again.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-2)] bg-[var(--surface)] p-3">
                <code className="min-w-0 flex-1 truncate text-xs">
                  {revealed}
                </code>
                <button
                  type="button"
                  aria-label="Copy API key"
                  onClick={() => {
                    void navigator.clipboard.writeText(revealed);
                    setCopied(true);
                  }}
                  className="text-[var(--ink-muted)]"
                >
                  {copied ? (
                    <Check className="size-4 text-[var(--success)]" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {message && <p role="status" className="text-sm text-[var(--danger)]">{message}</p>}
    </div>
  );
}
