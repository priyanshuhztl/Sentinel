'use client';

import { useState, useRef, useEffect } from 'react';
import { PLAN_PRESETS } from '@/hooks/usePlan';

interface PlanSettingsProps {
  monthlyUsd: number | null;
  onSet: (usd: number | null) => void;
}

export default function PlanSettings({ monthlyUsd, onSet }: PlanSettingsProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeLabel =
    PLAN_PRESETS.find(p => p.monthlyUsd === monthlyUsd)?.label ??
    (monthlyUsd != null ? `$${monthlyUsd}/mo` : 'Plan');

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 32, padding: '0 10px',
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--f-sans)', fontSize: 14, fontWeight: 500,
          color: 'var(--color-ink)', cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-gray-100)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-canvas)')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth={2}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {activeLabel}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 240,
          background: 'var(--color-canvas)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-dropdown)',
          padding: 16,
          zIndex: 100,
        }}>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 12 }}>
            Subscription Plan
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PLAN_PRESETS.map(p => {
              const selected = monthlyUsd === p.monthlyUsd;
              return (
                <button
                  key={p.label}
                  onClick={() => { onSet(p.monthlyUsd); setOpen(false); }}
                  style={{
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--f-sans)', fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', textAlign: 'left', padding: '0 12px',
                    background: selected ? 'var(--color-link)' : 'transparent',
                    color: selected ? '#fff' : 'var(--color-ink)',
                    border: selected ? 'none' : '1px solid var(--color-hairline)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-gray-100)'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {p.label} · ${p.monthlyUsd}/mo
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginTop: 10 }}>
            <input
              type="number"
              placeholder="custom $/mo"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              style={{
                width: '100%', height: 36,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-hairline-strong)',
                fontFamily: 'var(--f-mono)', fontSize: 13,
                padding: '0 10px',
                color: 'var(--color-ink)',
                background: 'var(--color-canvas-soft)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                const v = parseFloat(custom);
                if (v > 0) { onSet(v); setCustom(''); setOpen(false); }
              }}
              style={{
                height: 36, padding: '0 12px',
                background: 'var(--color-ink)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--f-sans)', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', color: 'var(--color-canvas)',
                whiteSpace: 'nowrap',
              }}
            >
              set
            </button>
          </div>

          {monthlyUsd != null && (
            <button
              onClick={() => { onSet(null); setOpen(false); }}
              style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', fontSize: 12, color: 'var(--color-mute)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              clear plan
            </button>
          )}

          <div style={{ fontSize: 12, color: 'var(--color-mute)', marginTop: 8, lineHeight: 1.5, borderTop: '1px solid var(--color-hairline)', paddingTop: 8 }}>
            Plan sets the subscription baseline used to compute API-equivalent savings.
          </div>
        </div>
      )}
    </div>
  );
}
