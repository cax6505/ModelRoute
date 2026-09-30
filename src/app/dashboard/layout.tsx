"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FlaskConical,
  History,
  Key,
  Menu,
  PanelLeftClose,
  Sliders,
  Terminal,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Chip, Kbd, PageHeader, ProviderDot } from "@/components/design-system";
import { motionDuration, motionEasing, motionSpring } from "@/lib/motion";

const navItems = [
  {
    href: "/dashboard",
    label: "Playground Studio",
    icon: Terminal,
    shortcut: "⌘1",
    description: "Route a prompt through the live policy.",
  },
  {
    href: "/dashboard/history",
    label: "Request Audit Logs",
    icon: History,
    shortcut: "⌘2",
    description: "Inspect routing decisions and outcomes.",
  },
  {
    href: "/dashboard/stats",
    label: "Analytics & Costs",
    icon: BarChart3,
    shortcut: "⌘3",
    description: "Understand traffic, latency, and spend.",
  },
  {
    href: "/dashboard/rules",
    label: "Routing Policy",
    icon: Sliders,
    shortcut: "⌘4",
    description: "Tune candidate order and fallbacks.",
  },
  {
    href: "/dashboard/eval",
    label: "Eval Harness",
    icon: FlaskConical,
    shortcut: "⌘5",
    description: "Benchmark classification and quality.",
  },
  {
    href: "/dashboard/keys",
    label: "API Credentials",
    icon: Key,
    shortcut: "⌘6",
    description: "Manage gateway access keys.",
  },
];
const providers = [
  { name: "groq", latency: "210 ms" },
  { name: "gemini", latency: "450 ms" },
  { name: "ollama", latency: "Ready" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const active =
    navItems.find(
      (item) =>
        item.href === pathname ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href)),
    ) ?? navItems[0];
  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <button
        type="button"
        aria-label="Open navigation"
        className="fixed left-4 top-4 z-30 inline-flex size-10 items-center justify-center rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface)] shadow-[var(--shadow-rest)] lg:hidden"
        onClick={() => setDrawerOpen(true)}
      >
        <Menu className="size-4" />
      </button>
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-[rgba(22,19,15,.24)] lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside
        className={`${drawerOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[var(--border-hairline)] bg-[var(--surface)] transition-transform duration-[var(--duration-base)] lg:static lg:translate-x-0`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-[var(--border-hairline)] px-6">
          <Link
            href="/dashboard"
            className="font-display text-lg font-semibold tracking-tight"
            onClick={() => setDrawerOpen(false)}
          >
            Model<span className="text-[var(--accent)]">Route</span>
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            className="inline-flex size-8 items-center justify-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = item === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className="group relative flex items-center justify-between rounded-[var(--radius-2)] px-3 py-2.5 text-sm transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <span className="relative z-10 flex items-center gap-3">
                  <item.icon
                    className={
                      isActive
                        ? "size-4 text-[var(--accent)]"
                        : "size-4 text-[var(--ink-faint)]"
                    }
                  />
                  <span
                    className={
                      isActive
                        ? "font-medium text-[var(--ink)]"
                        : "text-[var(--ink-muted)]"
                    }
                  >
                    {item.label}
                  </span>
                </span>
                <span className="relative z-10">
                  <Kbd>{item.shortcut}</Kbd>
                </span>
                {isActive && (
                  <motion.span
                    layoutId="active-nav"
                    className="absolute inset-0 rounded-[var(--radius-2)] bg-[var(--accent-soft)]"
                    transition={{ type: "spring", ...motionSpring.ui }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border-hairline)] p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-2">
              <Activity className="size-3.5 text-[var(--success)]" />
              Infrastructure
            </span>
            <span className="text-[var(--success)]">Healthy</span>
          </div>
          <div className="space-y-1.5">
            {providers.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center justify-between rounded-[var(--radius-1)] bg-[var(--surface-sunken)] px-3 py-2 text-xs"
              >
                <span className="flex items-center gap-2 capitalize">
                  <ProviderDot provider={provider.name} pulse />
                  {provider.name}
                </span>
                <span className="font-mono tabular-nums text-[var(--ink-muted)]">
                  {provider.latency}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="flex h-14 items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--surface)] px-4 sm:px-8">
          <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
            <PanelLeftClose className="hidden size-4 sm:block" />
            <span>Workspace</span>
            <span className="text-[var(--ink-faint)]">/</span>
            <span className="text-[var(--ink)]">{active.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Chip>POST /api/route</Chip>
            <span className="hidden items-center gap-1.5 rounded-md bg-[var(--success-soft)] px-2 py-1 text-xs font-medium text-[var(--success)] sm:inline-flex">
              <span className="size-1.5 rounded-full bg-[var(--success)]" />
              CLOSED
            </span>
          </div>
        </div>
        <PageHeader title={active.label} description={active.description} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: motionDuration.page,
            ease: motionEasing.emphasized,
          }}
          className="min-h-[calc(100vh-138px)]"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
