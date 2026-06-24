'use client';

import type { UsageLimits } from '@/lib/types';
import InfoTooltip from '@/components/InfoTooltip';

interface UsageLimitsProps {
  limits: UsageLimits | null | undefined;
}

function barColor(pct: number): string {
  if (pct > 80) return 'var(--color-error)';
  if (pct > 50) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function fmtResetsAt(iso: string | null): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Resetting…';
  const totalMin = Math.round(diff / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `Resets in ${h}h ${m}m` : `Resets in ${m}m`;
}

export default function UsageLimitsCard({ limits }: UsageLimitsProps) {
  const hasData = limits && (limits.sessionPct !== null || limits.weeklyPct !== null);
  const hasError = limits && limits.error;

  const ago =
    limits?.fetchedAt
      ? Math.round((Date.now() - limits.fetchedAt) / 60_000)
      : null;

  const rows = [
    limits?.sessionPct != null && {
      label: 'Requests (5h)',
      pct: limits.sessionPct,
      reset: fmtResetsAt(limits.sessionResetsAt) || '~5hr window',
    },
    limits?.weeklyPct != null && {
      label: 'Weekly (all models)',
      pct: limits.weeklyPct,
      reset: fmtResetsAt(limits.weeklyResetsAt) || '7-day window',
    },
  ].filter(Boolean) as { label: string; pct: number; reset: string }[];

  return (
    <section style={{
      background: 'var(--color-canvas)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      padding: 20,
      alignSelf: 'start',
    }}>
      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        Usage Limits
        <InfoTooltip dir="down" text="Your Claude API rate limits fetched from the Claude website every 5 minutes. Hitting a limit will temporarily pause Claude Code." />
      </div>

      {hasData ? (
        <>
          {rows.map((row, i) => (
            <div key={row.label} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-hairline)' : 'none', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{row.label}</span>
                  <InfoTooltip text={
                    row.label.includes('5h')
                      ? 'API requests made in the rolling 5-hour window. Resets automatically; hitting 100% pauses Claude Code until the window slides.'
                      : 'Token usage across all Claude models in the past 7 days. Resets weekly; counts all plans and model tiers.'
                  } />
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-mute)', fontVariantNumeric: 'tabular-nums' }}>{row.pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--color-gray-100)', borderRadius: 9999, margin: '6px 0 4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 9999, background: barColor(row.pct), width: `${Math.min(100, row.pct)}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-mute)' }}>{row.reset}</div>
            </div>
          ))}
        </>
      ) : hasError ? (
        <div style={{ background: 'var(--color-error-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 12, color: 'var(--color-error-text)' }}>
          {limits.error === 'rate-limited' ? 'Retrying in 5min' : limits.error}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-mute)', padding: '4px 0' }}>Fetching…</div>
      )}

      {ago !== null && (
        <div style={{ fontSize: 12, color: 'var(--color-mute)', borderTop: '1px solid var(--color-hairline)', paddingTop: 10, marginTop: 0 }}>
          Updated {ago}m ago · polls every 5 min
        </div>
      )}
    </section>
  );
}
