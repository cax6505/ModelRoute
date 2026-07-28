'use client';

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

/* ─── 1. BUTTON COMPONENT ────────────────────────────────── */
export interface DsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export function DsButton({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}: DsButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const sizeStyles = {
    sm: 'h-8 px-3.5 text-xs gap-1.5',
    md: 'h-10 px-4.5 text-xs gap-2',
    lg: 'h-12 px-6 text-sm gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30',
    secondary: 'bg-[#141727] hover:bg-[#1a1e33] text-slate-200 border border-white/10 hover:border-indigo-500/40 shadow-sm',
    destructive: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50',
    ghost: 'bg-transparent hover:bg-white/5 text-slate-400 hover:text-white',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}

/* ─── 2. PROVIDER BADGE COMPONENT ────────────────────────── */
export type ProviderName = 'groq' | 'gemini' | 'ollama' | string;

export function DsProviderBadge({ provider }: { provider: ProviderName }) {
  const normalized = provider.toLowerCase();

  const styles: Record<string, string> = {
    groq: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    gemini: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    ollama: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  const styleClass = styles[normalized] || 'bg-slate-500/10 text-slate-300 border-slate-500/30';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${styleClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${normalized === 'groq' ? 'bg-amber-400' : normalized === 'gemini' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
      {provider}
    </span>
  );
}

/* ─── 3. STATUS BADGE COMPONENT ──────────────────────────── */
export type ExecutionStatus = 'success' | 'fallback' | 'error' | string;

export function DsStatusBadge({ status }: { status: ExecutionStatus }) {
  const normalized = status.toLowerCase();

  const styles: Record<string, string> = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    fallback: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    error: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  const styleClass = styles[normalized] || 'bg-slate-500/10 text-slate-300 border-slate-500/30';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${styleClass}`}>
      {status}
    </span>
  );
}

/* ─── 4. INTENT BADGE COMPONENT ──────────────────────────── */
export function DsIntentBadge({ intent }: { intent: string }) {
  const styles: Record<string, string> = {
    code_generation: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    summarization: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    extraction: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
    creative_writing: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    reasoning: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    simple_qa: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    translation: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    general: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  };

  const styleClass = styles[intent] || 'bg-slate-500/10 text-slate-300 border-slate-500/30';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${styleClass}`}>
      {intent}
    </span>
  );
}

/* ─── 5. CARD COMPONENT ──────────────────────────────────── */
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
  className = '',
  isHero = false,
}: DsCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-[#11131f] backdrop-blur-xl shadow-xl shadow-black/40 transition-all duration-200 ${
        isHero
          ? 'border-indigo-500/40 bg-gradient-to-br from-indigo-950/30 via-[#11131f] to-purple-950/20 shadow-indigo-500/10'
          : 'border-white/10 hover:border-white/20'
      } ${className}`}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-100 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 font-mono mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ─── 6. METRIC CARD COMPONENT ───────────────────────────── */
export interface DsMetricCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon?: React.ReactNode;
  isHero?: boolean;
  trend?: string;
}

export function DsMetricCard({
  label,
  value,
  subtext,
  icon,
  isHero = false,
  trend,
}: DsMetricCardProps) {
  return (
    <div
      className={`p-6 rounded-2xl border backdrop-blur-xl transition-all duration-200 ${
        isHero
          ? 'bg-gradient-to-br from-indigo-950/50 via-[#11131f] to-purple-950/30 border-indigo-500/50 shadow-2xl shadow-indigo-500/15'
          : 'bg-[#11131f] border-white/10 hover:border-white/20 shadow-xl shadow-black/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon && <span className={`${isHero ? 'text-indigo-400' : 'text-slate-400'}`}>{icon}</span>}
      </div>

      <div className={`font-mono font-extrabold tracking-tight mt-3 ${isHero ? 'text-4xl text-emerald-400' : 'text-3xl text-white'}`}>
        {value}
      </div>

      {(subtext || trend) && (
        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-slate-400">
          {trend && <span className="text-emerald-400 font-semibold">{trend}</span>}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}

/* ─── 7. EMPTY STATE COMPONENT ────────────────────────────── */
export function DsEmptyState({
  title = 'No Execution Active',
  description = 'Select a sample workload preset or enter a prompt to evaluate routing diagnostics.',
  icon,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
        {icon || <Sparkles className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-bold text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  );
}
