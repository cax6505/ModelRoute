'use client';

import React, { useEffect, useState, useRef } from 'react';

/* ─── Simplified Trace Divider (all pages except Playground) ── */
export function TraceLineSimple() {
  return (
    <div className="trace-divider my-2" aria-hidden="true">
      <div className="trace-divider-node" style={{ marginLeft: '0' }} />
      <div style={{ flex: 1 }} />
      <div className="trace-divider-node" />
      <div style={{ flex: 1 }} />
      <div className="trace-divider-node" />
      <div style={{ flex: 2 }} />
      <div className="trace-divider-node" style={{ marginRight: '0' }} />
    </div>
  );
}

/* ─── Full Routing Trace (Playground Studio) ──────────────── */

interface TraceStage {
  label: string;
}

const STAGES: TraceStage[] = [
  { label: 'Input' },
  { label: 'Classify' },
  { label: 'Policy' },
  { label: 'Provider' },
  { label: 'Output' },
];

interface TraceLineRoutingProps {
  /** Number of stages to light up (0 = none, 5 = all complete) */
  activeStages: number;
  /** Labels shown under key stages, e.g. { 1: 'code_generation', 3: 'groq' } */
  stageDetails?: Record<number, string>;
  /** If embedded, removes outer border/panel styling */
  embedded?: boolean;
}

export function TraceLineRouting({ activeStages, stageDetails = {}, embedded = false }: TraceLineRoutingProps) {
  const [visibleStages, setVisibleStages] = useState(0);
  const prevActiveRef = useRef(0);

  useEffect(() => {
    // Only animate forward
    if (activeStages > prevActiveRef.current) {
      let current = prevActiveRef.current;
      const interval = setInterval(() => {
        current++;
        setVisibleStages(current);
        if (current >= activeStages) {
          clearInterval(interval);
        }
      }, 200);
      prevActiveRef.current = activeStages;
      return () => clearInterval(interval);
    } else {
      setVisibleStages(activeStages);
      prevActiveRef.current = activeStages;
    }
  }, [activeStages]);

  const containerClass = embedded
    ? 'w-full'
    : 'w-full py-3.5 px-5 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-panel)] shadow-sm';

  return (
    <div className={containerClass} role="img" aria-label={`Route trace: ${visibleStages} of ${STAGES.length} stages complete`}>
      <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)] mb-2.5">
        <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[10px] font-display">
          <span className="jack-indicator text-[var(--accent-brass)]" /> Live Switchboard Routing Trace
        </span>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {visibleStages === 0 ? 'Idle' : `Stage ${visibleStages}/5: ${STAGES[Math.min(visibleStages - 1, STAGES.length - 1)]?.label}`}
        </span>
      </div>

      <div className="relative w-full py-1">
        {/* Background connector line - centered exactly at top-[8px] */}
        <div
          className="absolute left-[8px] right-[8px] top-[8px] h-[2px] -translate-y-1/2 z-0"
          style={{ background: 'rgba(201,138,62,0.20)' }}
        />
        {/* Active connector line */}
        <div
          className="absolute left-[8px] top-[8px] h-[2px] -translate-y-1/2 z-0 transition-all duration-500"
          style={{
            background: 'var(--accent-brass)',
            width: visibleStages > 1 ? `calc(${((visibleStages - 1) / (STAGES.length - 1)) * 100}% - 16px)` : '0%',
          }}
        />

        {/* Nodes Grid */}
        <div className="flex items-start justify-between w-full relative z-10">
          {STAGES.map((stage, idx) => {
            const isActive = idx < visibleStages;
            const isLatest = idx === visibleStages - 1 && visibleStages > 0;
            const detail = stageDetails[idx];

            return (
              <div
                key={stage.label}
                className="flex flex-col items-center text-center"
                style={{ width: '64px' }}
              >
                {/* Node Socket */}
                <div
                  className={`
                    w-[16px] h-[16px] rounded-full border-[2px] transition-all duration-300
                    flex items-center justify-center flex-shrink-0
                    ${isLatest ? 'trace-node-active' : ''}
                  `}
                  style={{
                    borderColor: isActive ? 'var(--accent-brass)' : 'rgba(201,138,62,0.3)',
                    background: isActive ? 'var(--accent-brass)' : 'var(--bg-primary)',
                    boxShadow: isActive ? '0 0 8px rgba(201,138,62,0.35)' : 'none',
                  }}
                >
                  {isActive && (
                    <div
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ background: 'var(--bg-primary)' }}
                    />
                  )}
                </div>

                {/* Stage Name */}
                <span
                  className="text-[10px] font-mono mt-1.5 transition-colors"
                  style={{
                    color: isActive ? 'var(--accent-brass)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {stage.label}
                </span>

                {/* Detail Tag if available */}
                {detail ? (
                  <span className="text-[9px] font-mono mt-0.5 px-1 py-0.2 rounded-[3px] bg-[rgba(201,138,62,0.12)] text-[var(--accent-brass)] border border-[rgba(201,138,62,0.25)] truncate max-w-[60px]">
                    {detail}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
