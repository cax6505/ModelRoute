"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  FlaskConical,
  History,
  Key,
  Menu,
  Moon,
  Sliders,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { startTransition } from "react";
import { useEffect, useState } from "react";
import { Kbd, PageHeader, ProviderDot } from "@/components/design-system";
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
const defaultProviders = [
  { name: "groq", latency: "210 ms", state: "Healthy" },
  { name: "gemini", latency: "450 ms", state: "Healthy" },
  { name: "openrouter", latency: "Ready", state: "Healthy" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [providers, setProviders] = useState(defaultProviders);
  const [breakerState, setBreakerState] = useState("CLOSED");
  const [dashboardAuthenticated, setDashboardAuthenticated] = useState<
    boolean | null
  >(null);
  const [dashboardKey, setDashboardKey] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/dashboard/session")
      .then((response) => {
        setDashboardAuthenticated(response.ok);
      })
      .catch(() => {
        setDashboardAuthenticated(false);
      });
  }, []);
  useEffect(() => {
    if (!dashboardAuthenticated) return;
    void fetch("/api/health")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          payload: {
            providers?: Array<{
              name: string;
              available: boolean;
              latencyMs: number | null;
              circuitState: string;
            }>;
          } | null,
        ) => {
          if (!payload?.providers?.length) return;
          setProviders(
            payload.providers.map((provider) => ({
              name: provider.name,
              latency: provider.available
                ? provider.latencyMs === null
                  ? "Ready"
                  : `${provider.latencyMs} ms`
                : "Down",
              state: provider.available ? "Healthy" : "Degraded",
            })),
          );
          setBreakerState(
            payload.providers.some(
              (provider) => provider.circuitState === "OPEN",
            )
              ? "OPEN"
              : payload.providers.some(
                    (provider) => provider.circuitState === "HALF_OPEN",
                  )
                ? "HALF_OPEN"
                : "CLOSED",
          );
        },
      )
      .catch(() => undefined);
  }, [dashboardAuthenticated]);
  useEffect(() => {
    const saved = window.localStorage.getItem("modelroute-theme");
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const nextTheme = saved === "dark" || saved === "light" ? saved : preferred;
    startTransition(() => setTheme(nextTheme));
    document.documentElement.dataset.theme = nextTheme;
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const item = navItems[Number(event.key) - 1];
      if (!item) return;
      event.preventDefault();
      router.push(item.href);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("modelroute-theme", nextTheme);
  };
  const authenticateDashboard = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    const response = await fetch("/api/dashboard/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: dashboardKey }),
    });
    if (!response.ok) {
      setAuthError("Invalid dashboard credential.");
      return;
    }
    setDashboardKey("");
    setDashboardAuthenticated(true);
  };
  const active =
    navItems.find(
      (item) =>
        item.href === pathname ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href)),
    ) ?? navItems[0];
  if (dashboardAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-6 text-[var(--ink)]">
        <p className="text-sm text-[var(--ink-muted)]">Opening workspace...</p>
      </div>
    );
  }
  if (!dashboardAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-6 text-[var(--ink)]">
        <form
          onSubmit={authenticateDashboard}
          className="w-full max-w-sm space-y-5 rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface)] p-6 shadow-[var(--shadow-rest)]"
        >
          <div>
            <h1 className="font-display text-xl font-semibold">Private workspace</h1>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              Enter the dashboard credential configured for this deployment.
            </p>
          </div>
          <input
            type="password"
            value={dashboardKey}
            onChange={(event) => setDashboardKey(event.target.value)}
            placeholder="Dashboard credential"
            autoComplete="current-password"
            className="h-11 w-full rounded-[var(--radius-2)] border border-[var(--border-strong)] bg-transparent px-3 text-sm outline-none"
            required
          />
          {authError && <p className="text-sm text-[var(--danger)]">{authError}</p>}
          <button
            type="submit"
            className="h-11 w-full rounded-[var(--radius-2)] bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            Open workspace
          </button>
        </form>
      </div>
    );
  }
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
                className="group relative isolate flex min-h-11 items-center justify-between overflow-hidden rounded-[var(--radius-2)] px-3 py-2.5 text-sm transition-colors hover:bg-[var(--surface-sunken)]"
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
                    className="pointer-events-none absolute inset-0 -z-0 rounded-[var(--radius-2)] bg-[var(--accent-soft)]"
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
            <span
              className={
                providers.some((provider) => provider.state === "Degraded")
                  ? "text-[var(--danger)]"
                  : "text-[var(--success)]"
              }
            >
              {providers.some((provider) => provider.state === "Degraded")
                ? "Degraded"
                : "Healthy"}
            </span>
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
                <span
                  className={
                    provider.state === "Degraded"
                      ? "font-mono tabular-nums text-[var(--danger)]"
                      : "font-mono tabular-nums text-[var(--ink-muted)]"
                  }
                >
                  {provider.latency}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border-hairline)] bg-[var(--surface)] px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5 pl-11 text-sm sm:pl-0">
            <span className="hidden shrink-0 text-[var(--ink-faint)] sm:inline">
              Workspace
            </span>
            <span
              aria-hidden="true"
              className="hidden text-[var(--border-strong)] sm:inline"
            >
              /
            </span>
            <span className="truncate font-medium text-[var(--ink)]">
              {active.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className="inline-flex size-9 items-center justify-center rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
            >
              {theme === "light" ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
            </button>
            <span className="hidden h-9 items-center gap-2 rounded-[var(--radius-2)] border border-[var(--success)]/15 bg-[var(--success-soft)] px-3 text-xs font-medium text-[var(--success)] sm:inline-flex">
              <span className="size-2 rounded-full bg-[var(--success)]" />
              <span className="text-[var(--ink-muted)]">Circuit</span>
              <span>{breakerState.replace("_", " ")}</span>
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
