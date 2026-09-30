"use client";

import React from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProviderName = "groq" | "gemini" | "ollama" | string;
const providerColors: Record<string, string> = {
  groq: "var(--groq)",
  gemini: "var(--gemini)",
  ollama: "var(--ollama)",
};

export function ProviderDot({
  provider,
  pulse = false,
}: {
  provider: ProviderName;
  pulse?: boolean;
}) {
  return (
    <span
      aria-label={`${provider} provider`}
      className={cn("size-2 rounded-full", pulse && "animate-status-pulse")}
      style={{
        backgroundColor:
          providerColors[provider.toLowerCase()] ?? "var(--ink-faint)",
      }}
    />
  );
}
export function DsProviderBadge({ provider }: { provider: ProviderName }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-2 py-1 text-xs font-medium text-[var(--ink)]">
      <ProviderDot provider={provider} />
      {provider}
    </span>
  );
}
export type ExecutionStatus = "success" | "fallback" | "error" | string;
export function DsStatusBadge({ status }: { status: ExecutionStatus }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "success"
      ? "bg-[var(--success-soft)] text-[var(--success)]"
      : normalized === "fallback"
        ? "bg-[var(--warning-soft)] text-[var(--warning)]"
        : normalized === "error"
          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
          : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        tone,
      )}
    >
      {status}
    </span>
  );
}
export function DsIntentBadge({ intent }: { intent: string }) {
  return (
    <span className="inline-flex rounded-md bg-[var(--accent-soft)] px-2 py-1 font-mono text-xs text-[var(--accent-hover)]">
      {intent}
    </span>
  );
}

export interface DsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
}
export function DsButton({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  className,
  disabled,
  ...props
}: DsButtonProps) {
  const variants = {
    primary:
      "bg-[var(--accent)] text-white shadow-[var(--shadow-rest)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-raised)]",
    secondary:
      "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-sunken)]",
    destructive:
      "bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
    ghost:
      "text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-2)] font-medium transition-[background-color,box-shadow,color,transform] duration-[var(--duration-base)] active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
}

export interface DsCardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  className?: string;
  isHero?: boolean;
}
export function DsCard({
  children,
  title,
  subtitle,
  headerAction,
  className,
  isHero = false,
}: DsCardProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface)] shadow-[var(--shadow-rest)]",
        isHero &&
          "border-[var(--accent-soft-strong)] shadow-[var(--shadow-raised)]",
        className,
      )}
    >
      {(title || subtitle || headerAction) && (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-5 py-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-[var(--ink)]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{subtitle}</p>
            )}
          </div>
          {headerAction}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
export function DsMetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon?: React.ReactNode;
  isHero?: boolean;
  trend?: string;
}) {
  return (
    <div className="rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface)] p-5 shadow-[var(--shadow-rest)]">
      <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">
        {value}
      </div>
      {(trend || subtext) && (
        <div className="mt-2 flex gap-2 text-xs text-[var(--ink-muted)]">
          {trend && <span className="text-[var(--success)]">{trend}</span>}
          {subtext}
        </div>
      )}
    </div>
  );
}
export function DsEmptyState({
  title = "Nothing here yet",
  description = "Run a route to see the first result.",
  icon,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface)] px-6 py-12 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon ?? <Sparkles className="size-5" />}
      </div>
      <h4 className="mt-4 text-sm font-semibold">{title}</h4>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--ink-muted)]">
        {description}
      </p>
    </div>
  );
}
export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-2 py-1 text-xs text-[var(--ink-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[32px] justify-center rounded-[var(--radius-1)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[11px] leading-4 text-[var(--ink-faint)]">
      {children}
    </kbd>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "skeleton-shimmer block rounded-[var(--radius-1)]",
        className,
      )}
      aria-hidden="true"
    />
  );
}
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-hairline)] px-4 py-5 sm:px-8">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-medium text-[var(--accent)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="inline-flex rounded-[var(--radius-2)] bg-[var(--surface-sunken)] p-1"
      role="group"
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[var(--radius-1)] px-3 py-1.5 text-xs transition-colors",
            value === option.value
              ? "bg-[var(--surface)] font-medium text-[var(--ink)] shadow-[var(--shadow-rest)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
          )}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
