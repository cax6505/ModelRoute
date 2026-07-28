'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Terminal,
  History,
  BarChart3,
  Sliders,
  FlaskConical,
  Key,
  Zap,
  Activity,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { DsProviderBadge } from '@/components/design-system';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Playground Studio', icon: Terminal, shortcut: '⌘1' },
  { href: '/dashboard/history', label: 'Request Audit Logs', icon: History, shortcut: '⌘2' },
  { href: '/dashboard/stats', label: 'Analytics & Costs', icon: BarChart3, shortcut: '⌘3' },
  { href: '/dashboard/rules', label: 'Routing Policy', icon: Sliders, shortcut: '⌘4' },
  { href: '/dashboard/eval', label: 'Eval Harness', icon: FlaskConical, shortcut: '⌘5' },
  { href: '/dashboard/keys', label: 'API Credentials', icon: Key, shortcut: '⌘6' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#07080e] bg-canvas-pattern">
      {/* ── Sidebar Navigation ─────────────────────────── */}
      <aside className="w-[260px] flex-shrink-0 border-r border-white/10 bg-[#0c0d15] flex flex-col justify-between">
        <div>
          {/* Header Brand */}
          <div className="h-16 flex items-center px-6 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 p-[1.5px] shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
                <div className="w-full h-full bg-[#0c0d15] rounded-[10.5px] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-white tracking-tight">
                    Model<span className="text-indigo-400">Route</span>
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono tracking-wide">LLM Router Platform</p>
              </div>
            </Link>
          </div>

          {/* Navigation Links - Single line, spacious */}
          <nav className="p-4 space-y-1.5">
            <div className="px-3 py-2 text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
              Navigation Console
            </div>

            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-600/15 text-white border border-indigo-500/40 shadow-lg shadow-indigo-500/10 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.shortcut && (
                    <span className="text-xs font-mono text-slate-500 group-hover:text-slate-300">
                      {item.shortcut}
                    </span>
                  )}

                  {isActive && (
                    <div className="absolute right-0 top-3 bottom-3 w-1 rounded-l-full bg-gradient-to-b from-indigo-400 to-purple-500" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* System Health Footer */}
        <div className="p-5 border-t border-white/10 bg-[#080910] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" /> Infrastructure
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Healthy
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <DsProviderBadge provider="groq" />
              <span className="text-slate-400 font-semibold">210ms ⚡</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <DsProviderBadge provider="gemini" />
              <span className="text-slate-400 font-semibold">450ms 🌟</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <DsProviderBadge provider="ollama" />
              <span className="text-emerald-400 font-semibold">Ready 🟢</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace Area (Fills 100% remaining width) ──── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#07080e]">
        {children}
      </main>
    </div>
  );
}
