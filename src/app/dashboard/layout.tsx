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
  ChevronRight,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Playground Studio', description: 'Real-time execution studio', icon: Terminal, shortcut: '⌘1' },
  { href: '/dashboard/history', label: 'Request Audit Logs', description: 'Detailed execution history', icon: History, shortcut: '⌘2' },
  { href: '/dashboard/stats', label: 'Analytics & Savings', description: 'Performance & cost metrics', icon: BarChart3, shortcut: '⌘3' },
  { href: '/dashboard/rules', label: 'Routing Engine Rules', description: 'Config-driven policy manager', icon: Sliders, shortcut: '⌘4' },
  { href: '/dashboard/eval', label: 'Eval Harness', description: 'LLM-as-judge benchmark suite', icon: FlaskConical, shortcut: '⌘5' },
  { href: '/dashboard/keys', label: 'API Credentials', description: 'Hashed API key vault', icon: Key, shortcut: '⌘6' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#05060a] bg-mesh-pattern">
      {/* ── Sidebar Navigation ───────────────────────── */}
      <aside className="w-[285px] flex-shrink-0 border-r border-white/10 bg-[#070810]/95 backdrop-blur-2xl flex flex-col justify-between">
        <div>
          {/* Header Brand */}
          <div className="h-20 flex items-center px-6 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center gap-3.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1.5px] shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-200">
                <div className="w-full h-full bg-[#090a12] rounded-[10.5px] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20 glow-animation" />
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
                <p className="text-xs text-zinc-400 font-mono tracking-wide mt-0.5">Enterprise LLM Router</p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2">
            <div className="px-3 py-2 text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">
              Core Platform
            </div>

            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-white border border-indigo-500/40 shadow-lg shadow-indigo-500/10 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white/5 text-zinc-400 group-hover:text-white group-hover:bg-white/10'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold block leading-tight">{item.label}</span>
                      <span className="text-xs text-zinc-400 font-normal block mt-0.5 line-clamp-1">
                        {item.description}
                      </span>
                    </div>
                  </div>

                  {item.shortcut && (
                    <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-200">
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

        {/* Live System Health Monitor */}
        <div className="p-5 border-t border-white/10 bg-[#06070d]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" /> Infrastructure
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Healthy
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-orange-400 shadow-sm shadow-orange-500/50" /> Groq LPU
              </span>
              <span className="text-zinc-400 font-semibold">210ms ⚡</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-500/50" /> Gemini Flash
              </span>
              <span className="text-zinc-400 font-semibold">450ms 🌟</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="flex items-center gap-2 text-zinc-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" /> Ollama Local
              </span>
              <span className="text-emerald-400 font-semibold">Ready 🟢</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Application Workspace ───────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#05060a]">
        {children}
      </main>
    </div>
  );
}
