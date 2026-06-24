'use client';

import type { DashboardData } from '@/lib/types';
import { fmtCost, fmtNum, fmtUptime } from '@/lib/format';
import PlanSettings from '@/components/PlanSettings';

interface HeaderProps {
  data: DashboardData | null;
  connected: boolean;
  monthlyUsd: number | null;
  onSetPlan: (usd: number | null) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Header({ data, connected, monthlyUsd, onSetPlan, theme, onToggleTheme }: HeaderProps) {
  const stats = data
    ? [
        { label: 'CHATS',  value: fmtNum(data.totalChats),      color: 'var(--color-ink)' },
        { label: 'REQS',   value: fmtNum(data.totalReqs),       color: 'var(--color-ink)' },
        { label: 'COST',   value: fmtCost(data.totalCost),      color: 'var(--color-amber-700)' },
        { label: 'UPTIME', value: fmtUptime(data.watcherUptime), color: 'var(--color-ink)' },
      ]
    : [];

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--color-canvas)', borderBottom: '1px solid var(--color-hairline)' }}>
      {/* Vercel gradient stripe */}
      <div style={{ height: 3, width: '100%', background: 'linear-gradient(135deg,#007cf0,#00dfd8,#7928ca,#ff0080)' }} />

      <div style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* Status dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 9999,
            background: connected ? 'var(--color-success)' : 'var(--color-gray-600)',
            boxShadow: connected ? '0 0 0 3px var(--color-success-bg)' : 'none',
            animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            display: 'inline-block',
          }} />
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)' }}>
            {connected ? 'live' : 'connecting…'}
          </span>
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--color-hairline)', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sentinel-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00dfd8"/>
                <stop offset="50%" stopColor="#7928ca"/>
                <stop offset="100%" stopColor="#ff0080"/>
              </linearGradient>
            </defs>
            <path d="M16 5 L26 10 L26 19 Q26 25.5 16 28.5 Q6 25.5 6 19 L6 10 Z" fill="url(#sentinel-g)" fillOpacity={0.14}/>
            <path d="M16 5 L26 10 L26 19 Q26 25.5 16 28.5 Q6 25.5 6 19 L6 10 Z" fill="none" stroke="url(#sentinel-g)" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M10.5 17.5 Q13 14 16 14 Q19 14 21.5 17.5 Q19 21 16 21 Q13 21 10.5 17.5 Z" fill="none" stroke="url(#sentinel-g)" strokeWidth="1.1" strokeLinejoin="round"/>
            <circle cx="16" cy="17.5" r="2.2" fill="url(#sentinel-g)"/>
          </svg>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--color-ink)', letterSpacing: '-0.2px' }}>
            Sentinel
          </span>
        </div>

        {/* Center stats */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {s.label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: s.color }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title="Toggle theme"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32,
            background: 'var(--color-canvas)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-ink)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-gray-100)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-canvas)')}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Plan dropdown */}
        <PlanSettings monthlyUsd={monthlyUsd} onSet={onSetPlan} />
      </div>
    </header>
  );
}
