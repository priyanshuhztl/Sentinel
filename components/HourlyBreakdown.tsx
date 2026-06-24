'use client';

import type { HourlyEntry } from '@/lib/types';
import { fmtCost, fmtK } from '@/lib/format';
import InfoTooltip from '@/components/InfoTooltip';

interface HourlyBreakdownProps {
  hourly: [string, HourlyEntry][];
}

export default function HourlyBreakdown({ hourly }: HourlyBreakdownProps) {
  const rows = hourly.slice(0, 6);
  const maxCost = Math.max(...rows.map(([, v]) => v.cost), 0.0001);

  return (
    <section style={{ background: 'var(--color-canvas)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Hourly Breakdown
          </span>
          <InfoTooltip dir="down" text="Token output and API cost grouped by hour. Bar length is proportional to cost relative to your busiest hour. Shows your 6 most recent hours." />
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '32px 20px', fontSize: 13, color: 'var(--color-mute)', textAlign: 'center' }}>No data yet</div>
      ) : (
        rows.map(([label, v], i) => (
          <div key={label} style={{ padding: '10px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--color-hairline)' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', width: 112, flexShrink: 0 }}>{label}</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 14, fontWeight: 500, color: 'var(--color-amber-700)', width: 80, fontVariantNumeric: 'tabular-nums' }}>{fmtCost(v.cost)}</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', width: 90, fontVariantNumeric: 'tabular-nums' }}>{fmtK(v.output)} tokens</span>
            <span style={{ fontSize: 12, color: 'var(--color-mute)', width: 64, fontVariantNumeric: 'tabular-nums' }}>{v.count} reqs</span>
            <div style={{ flex: 1, height: 6, background: 'var(--color-gray-100)', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#7928ca,#007cf0)', width: `${Math.min(100, (v.cost / maxCost) * 100).toFixed(1)}%` }} />
            </div>
          </div>
        ))
      )}
    </section>
  );
}
