"use client";
import { useState } from "react";
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
  const [keys, setKeys] = useState<ApiKey[]>([
    {
      id: "1",
      name: "Production application",
      prefix: "mr_live_a1b2c3d4",
      created: "Sep 23, 2026",
      lastUsed: "1 hour ago",
      revoked: false,
    },
    {
      id: "2",
      name: "Staging worker",
      prefix: "mr_live_e5f6g7h8",
      created: "Sep 16, 2026",
      lastUsed: "2 days ago",
      revoked: false,
    },
  ]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = () => {
    if (!name.trim()) return;
    const raw = `mr_live_${crypto.randomUUID().replaceAll("-", "")}`;
    setKeys([
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        prefix: raw.slice(0, 16),
        created: "Just now",
        lastUsed: "Never",
        revoked: false,
      },
      ...keys,
    ]);
    setRevealed(raw);
    setName("");
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
                  onClick={() =>
                    setKeys(
                      keys.map((key) =>
                        key.id === item.id ? { ...key, revoked: true } : key,
                      ),
                    )
                  }
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
    </div>
  );
}
