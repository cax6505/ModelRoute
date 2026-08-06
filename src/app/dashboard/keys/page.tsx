'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Key, Plus, Copy, Check, ShieldAlert, Trash2 } from 'lucide-react';
import { DsButton, DsCard } from '@/components/design-system';

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  rate_limit_rpm: number;
  is_revoked: boolean;
  last_used_at?: string;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([
    {
      id: '1',
      name: 'Default Production Application',
      key_prefix: 'mr_live_a1b2c3d4',
      rate_limit_rpm: 60,
      is_revoked: false,
      last_used_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      id: '2',
      name: 'Staging Integration Worker',
      key_prefix: 'mr_live_e5f6g7h8',
      rate_limit_rpm: 120,
      is_revoked: false,
      last_used_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    },
  ]);

  const [isOpen, setIsOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;

    const rawHex = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const raw = `mr_live_${rawHex}`;
    const prefix = raw.substring(0, 16);

    const newKeyItem: ApiKeyItem = {
      id: crypto.randomUUID(),
      name: newKeyName.trim(),
      key_prefix: prefix,
      rate_limit_rpm: 60,
      is_revoked: false,
      created_at: new Date().toISOString(),
    };

    setKeys([newKeyItem, ...keys]);
    setGeneratedRawKey(raw);
  };

  const handleCopy = () => {
    if (generatedRawKey) {
      navigator.clipboard.writeText(generatedRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = (id: string) => {
    setKeys(keys.map((k) => (k.id === id ? { ...k, is_revoked: true } : k)));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#07080e]">
      {/* Console Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 bg-[#0c0d15] flex-shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Key className="w-5 h-5 text-indigo-400" />
            API Credentials & Keys Vault
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Manage SHA-256 hashed API keys for authenticating request calls to the ModelRoute gateway.
          </p>
        </div>

        <DsButton size="md" onClick={() => setIsOpen(true)} icon={<Plus className="w-4 h-4" />}>
          Generate New API Key
        </DsButton>
      </header>

      <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-6">
        <DsCard
          title={
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Active Application API Keys</span>
            </div>
          }
          subtitle="Pass `Authorization: Bearer mr_live_...` in request headers. Raw keys are revealed strictly once upon creation."
        >
          <div className="space-y-4">
            {keys.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-[#0c0d15]"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-white">{item.name}</span>
                    <Badge variant={item.is_revoked ? 'destructive' : 'outline'} className="text-xs font-mono border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                      {item.is_revoked ? 'Revoked' : 'Active (SHA-256)'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 mt-2.5 font-mono text-xs text-slate-400">
                    <span>Key Prefix: <span className="text-indigo-300 font-semibold">{item.key_prefix}...</span></span>
                    <span>Rate Limit: <span className="text-slate-200 font-semibold">{item.rate_limit_rpm} RPM</span></span>
                    <span>Created: <span className="text-slate-300">{new Date(item.created_at).toLocaleDateString()}</span></span>
                  </div>
                </div>

                <div>
                  {!item.is_revoked && (
                    <DsButton
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(item.id)}
                      icon={<Trash2 className="w-4 h-4" />}
                    >
                      Revoke Key
                    </DsButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DsCard>
      </div>

      {/* Creation Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setGeneratedRawKey(null); setNewKeyName(''); } }}>
        <DialogContent className="bg-[#171929] border-white/10 text-white rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {generatedRawKey ? 'API Key Generated Successfully' : 'Generate Application Key'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-1">
              {generatedRawKey
                ? 'Copy and save this secret key now. For security reasons, it will never be displayed again.'
                : 'Enter a descriptive name to label key usage.'}
            </DialogDescription>
          </DialogHeader>

          {!generatedRawKey ? (
            <div className="space-y-4 py-3">
              <Input
                placeholder="Key Name (e.g., Production Worker Service)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-white/5 border-white/10 text-sm h-10 text-white placeholder:text-slate-500"
              />
            </div>
          ) : (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl bg-[#07080e] border border-indigo-500/30 flex items-center justify-between font-mono text-xs text-indigo-300">
                <span className="truncate mr-3 font-semibold">{generatedRawKey}</span>
                <DsButton variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </DsButton>
              </div>
              <div className="flex items-center gap-3 text-xs text-amber-300 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>Store this key securely in your environment variables (`MODELROUTE_API_KEY`).</span>
              </div>
            </div>
          )}

          <DialogFooter>
            {!generatedRawKey ? (
              <DsButton onClick={handleCreateKey} disabled={!newKeyName.trim()}>
                Generate Key
              </DsButton>
            ) : (
              <DsButton onClick={() => setIsOpen(false)}>
                Done
              </DsButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
