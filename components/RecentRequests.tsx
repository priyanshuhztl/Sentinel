'use client';

import type { RequestRecord } from '@/lib/types';
import { fmtNum, fmtTimeS, shortModel } from '@/lib/format';
import { calcCost } from '@/lib/pricing';
import InfoTooltip from '@/components/InfoTooltip';

interface RecentRequestsProps {
  requests: RequestRecord[];
}

const TH: React.CSSProperties = {
  padding: '8px 16px',
  fontFamily: 'var(--f-mono)',
  fontSize: 12,
  color: 'var(--color-mute)',
  textTransform: 'uppercase',
  textAlign: 'left',
  fontWeight: 400,
};

export default function RecentRequests({ requests }: RecentRequestsProps) {
  const rows = requests.slice(0, 20);

  return (
    <section style={{ background: 'var(--color-canvas)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recent Requests
          </span>
          <InfoTooltip dir="down" text="The 20 most recent individual API calls made by Claude Code, including token counts and per-request cost." />
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--color-canvas-soft)', borderBottom: '1px solid var(--color-hairline)' }}>
            <th style={{ ...TH, width: 80 }}>Time</th>
            <th style={TH}>Model</th>
            <th style={{ ...TH, textAlign: 'right' }}>Fresh Input</th>
            <th style={{ ...TH, textAlign: 'right' }}>Output</th>
            <th style={{ ...TH, textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                Cache Hits
                <InfoTooltip dir="down" text="Tokens served from Claude's context cache. Shown in green when active — these tokens cost ~10× less than fresh input tokens." />
              </div>
            </th>
            <th style={{ ...TH, textAlign: 'right' }}>Cost</th>
            <th style={{ ...TH }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', fontSize: 13, color: 'var(--color-mute)' }}>
                Waiting for Claude Code…
              </td>
            </tr>
          ) : (
            rows.map(r => {
              const cost = calcCost(r);
              return (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid var(--color-hairline)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-gray-100)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)' }}>
                    {fmtTimeS(r.timestamp)}
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <span style={{ background: 'var(--color-gray-100)', color: 'var(--color-body)', borderRadius: 9999, padding: '2px 8px', fontFamily: 'var(--f-mono)', fontSize: 12 }}>
                      {shortModel(r.model)}
                    </span>
                  </td>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--f-mono)', fontSize: 14, color: 'var(--color-body)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(r.inputTokens)}
                  </td>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--f-mono)', fontSize: 14, color: 'var(--color-body)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(r.outputTokens)}
                  </td>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--f-mono)', fontSize: 14, color: r.cacheReadTokens > 0 ? 'var(--color-success-text)' : 'var(--color-mute)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.cacheReadTokens > 0 ? fmtNum(r.cacheReadTokens) : '—'}
                  </td>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--f-mono)', fontSize: 14, fontWeight: 500, color: 'var(--color-amber-700)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ${cost.toFixed(4)}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                    {r.cacheReadTokens > 0 && (
                      <span style={{ background: 'var(--color-green-100)', color: 'var(--color-success-text)', borderRadius: 9999, padding: '2px 8px', fontFamily: 'var(--f-mono)', fontSize: 11 }}>
                        ↩ cached
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
