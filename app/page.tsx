'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { usePlan } from '@/hooks/usePlan';
import type { DashboardData } from '@/lib/types';
import Header from '@/components/Header';
import CurrentChat from '@/components/CurrentChat';
import UsageLimitsCard from '@/components/UsageLimits';
import AllChats from '@/components/AllChats';
import HourlyBreakdown from '@/components/HourlyBreakdown';
import RecentRequests from '@/components/RecentRequests';
import PromptHealth from '@/components/PromptHealth';

type Tab = 'dashboard' | 'activity' | 'health';
type Theme = 'light' | 'dark';

export default function Home() {
  const { data, connected } = useSSE<DashboardData>(`/api/stream`);
  const { monthlyUsd, setPlan, subValue } = usePlan();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') setTheme(stored);
  }, []);

  const toggleTheme = () => setTheme(t => {
    const next = t === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    return next;
  });

  return (
    <div
      data-theme={theme}
      style={{ minHeight: '100vh', background: 'var(--color-canvas-soft)' }}
    >
      <Header
        data={data}
        connected={connected}
        monthlyUsd={monthlyUsd}
        onSetPlan={setPlan}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Tab bar */}
      <div style={{
        position: 'sticky',
        top: 59,
        zIndex: 40,
        background: 'var(--color-canvas)',
        borderBottom: '1px solid var(--color-hairline)',
        padding: '0 24px',
        display: 'flex',
      }}>
        {([
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'activity',  label: 'Activity' },
          { id: 'health',    label: 'Prompt Health' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              height: 40,
              padding: '0 12px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === id ? 'var(--color-ink)' : 'transparent'}`,
              fontFamily: 'var(--f-sans)',
              fontSize: 14,
              fontWeight: 500,
              color: tab === id ? 'var(--color-ink)' : 'var(--color-body)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {data === null ? (
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <p style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--color-mute)' }}>
            connecting to backend…
          </p>
        </main>
      ) : tab === 'dashboard' ? (
        <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CurrentChat
            chat={data.currentChat}
            subValue={subValue(
              data.usageLimits?.sessionPct ?? null,
              data.currentChat?.reqCount ?? 0,
              data.currentChat?.cost ?? 0,
              data.totalCost,
            )}
            monthlyUsd={monthlyUsd}
          />
          <RecentRequests requests={data.recent} />
        </main>
      ) : tab === 'activity' ? (
        <main style={{ padding: 24, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
          <UsageLimitsCard limits={data.usageLimits} />
          <AllChats chats={data.allChats} />
          <div style={{ gridColumn: '1 / span 2' }}>
            <HourlyBreakdown hourly={data.hourly} />
          </div>
        </main>
      ) : (
        <main style={{ padding: 24 }}>
          <PromptHealth data={data.promptHealth} />
        </main>
      )}
    </div>
  );
}
