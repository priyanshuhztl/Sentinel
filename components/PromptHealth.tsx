'use client';

import { useState } from 'react';
import type { PromptHealthData, SessionCacheMetric, CacheEfficiency, PromptRecord, PromptFlag } from '@/lib/types';
import InfoTooltip from '@/components/InfoTooltip';

interface Props {
  data: PromptHealthData;
}

function scoreColor(n: number): string {
  if (n >= 75) return 'var(--color-success)';
  if (n >= 50) return 'var(--color-warning)';
  return 'var(--color-error)';
}

function scoreStyle(n: number): { bg: string; fg: string } {
  if (n >= 75) return { bg: 'var(--color-green-100)', fg: 'var(--color-success-text)' };
  if (n >= 50) return { bg: 'var(--color-amber-100)', fg: 'var(--color-warning-text)' };
  return { bg: 'var(--color-red-100)', fg: 'var(--color-error-text)' };
}

function cacheHitColor(rate: number): string {
  if (rate >= 0.5) return 'var(--color-success)';
  if (rate >= 0.2) return 'var(--color-warning)';
  return 'var(--color-error)';
}

const EFF: Record<CacheEfficiency, { bg: string; fg: string; label: string }> = {
  excellent: { bg: 'var(--color-green-100)', fg: 'var(--color-success-text)', label: 'excellent' },
  good:      { bg: 'var(--color-blue-100)',  fg: 'var(--color-blue-1000)',    label: 'good'      },
  poor:      { bg: 'var(--color-amber-100)', fg: 'var(--color-warning-text)', label: 'poor'      },
  none:      { bg: 'var(--color-gray-100)',  fg: 'var(--color-mute)',         label: 'none'      },
};

const FLAG_COLORS: Record<string, { bg: string; fg: string }> = {
  error: { bg: 'var(--color-red-100)',   fg: 'var(--color-error-text)'   },
  warn:  { bg: 'var(--color-amber-100)', fg: 'var(--color-warning-text)' },
  good:  { bg: 'var(--color-green-100)', fg: 'var(--color-success-text)' },
};

function fmtSaved(n: number) {
  if (n < 0.001) return '—';
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function PromptRow({ p }: { p: PromptRecord }) {
  const [expanded, setExpanded] = useState(false);
  const preview = p.text.length > 120 ? p.text.slice(0, 119) + '…' : p.text;
  const ring = scoreColor(p.score.overall);

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--color-hairline)' }}>
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', width: 32, flexShrink: 0 }}>
        T{p.turnIndex + 1}
      </span>
      {/* Score ring */}
      <div
        style={{
          width: 32, height: 32, borderRadius: 9999,
          border: `2px solid ${ring}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--f-mono)', fontSize: 12, color: ring,
          flexShrink: 0,
        }}
        onClick={() => setExpanded(x => !x)}
      >
        {p.score.overall}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--color-ink)', lineHeight: 1.5, cursor: 'pointer' }}
          onClick={() => setExpanded(x => !x)}
        >
          {expanded ? p.text : preview}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-mute)', marginTop: 2 }}>
          {p.wordCount}w · {p.pairedOutputTokens > 0 ? `${p.pairedOutputTokens} out` : ''}
        </div>
        {p.score.flags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {p.score.flags.map((f: PromptFlag, i) => {
              const s = FLAG_COLORS[f.severity] ?? FLAG_COLORS.warn;
              return (
                <span
                  key={i}
                  style={{ background: s.bg, color: s.fg, borderRadius: 9999, padding: '0 8px', height: 20, display: 'inline-flex', alignItems: 'center', fontSize: 11 }}
                >
                  {f.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRow({ m }: { m: SessionCacheMetric }) {
  const [open, setOpen] = useState(false);
  const eff = EFF[m.efficiency];
  const pct = Math.round(m.hitRate * 100);
  const hitColor = cacheHitColor(m.hitRate);
  const score = Math.round(m.avgPromptScore);
  const ss = scoreStyle(score);

  return (
    <>
      <tr
        onClick={() => setOpen(x => !x)}
        style={{ borderBottom: '1px solid var(--color-hairline)', cursor: 'pointer', transition: 'background 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-gray-100)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <td style={{ padding: '10px 16px', maxWidth: 220 }}>
          <div style={{ fontSize: 14, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ marginRight: 6, fontSize: 12, color: 'var(--color-mute)' }}>{open ? '▾' : '▸'}</span>
            {m.chatTitle}
          </div>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.projectName}
          </div>
        </td>
        <td style={{ padding: '10px 16px', fontFamily: 'var(--f-mono)', fontSize: 14, color: 'var(--color-ink)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {m.reqCount}
        </td>
        <td style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 80, height: 6, background: 'var(--color-gray-100)', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: hitColor, width: `${pct}%` }} />
            </div>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: hitColor, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
              {pct}%
            </span>
          </div>
        </td>
        <td style={{ padding: '10px 16px', fontFamily: 'var(--f-mono)', fontSize: 14, color: 'var(--color-ink)', textAlign: 'right' }}>
          {m.prompts.length}
        </td>
        <td style={{ padding: '10px 16px' }}>
          {score > 0 ? (
            <span style={{ background: ss.bg, color: ss.fg, borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontFamily: 'var(--f-mono)', fontSize: 11 }}>
              {score}
            </span>
          ) : (
            <span style={{ color: 'var(--color-mute)', fontSize: 12 }}>—</span>
          )}
        </td>
        <td style={{ padding: '10px 16px', fontFamily: 'var(--f-mono)', fontSize: 14, color: m.savedUsd > 0 ? 'var(--color-success-text)' : 'var(--color-mute)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {fmtSaved(m.savedUsd)}
        </td>
        <td style={{ padding: '10px 16px' }}>
          <span style={{ background: eff.bg, color: eff.fg, borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontFamily: 'var(--f-mono)', fontSize: 11 }}>
            {eff.label}
          </span>
        </td>
      </tr>

      {open && (
        <tr style={{ borderBottom: '2px solid var(--color-hairline)', background: 'var(--color-canvas-soft)' }}>
          <td colSpan={7} style={{ padding: '16px 24px 24px' }}>
            {m.prompts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-mute)' }}>
                No prompts captured — prompts are stored from new activity only (restart the watcher to re-scan recent sessions).
              </div>
            ) : (
              m.prompts.map((p, i) => <PromptRow key={i} p={p} />)
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function PromptHealth({ data }: Props) {
  const { sessionMetrics } = data;
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const projects = [...new Set(sessionMetrics.map(m => m.projectName))].sort();

  const filteredMetrics = selectedProject
    ? sessionMetrics.filter(m => m.projectName === selectedProject)
    : sessionMetrics;

  const totalCacheRead = filteredMetrics.reduce((s, m) => s + m.totalCacheRead, 0);
  const totalInput = filteredMetrics.reduce((s, m) => s + m.totalCacheRead + m.totalFreshInput, 0);
  const overallHitRate = totalInput > 0 ? totalCacheRead / totalInput : 0;
  const totalSavedUsd = filteredMetrics.reduce((s, m) => s + m.savedUsd, 0);
  const wastedSessionCount = filteredMetrics.filter(m => m.wasteRatio > 0.8 && m.totalCacheCreation > 0).length;

  const scoredSessions = filteredMetrics.filter(m => m.avgPromptScore > 0);
  const overallAvgScore = scoredSessions.length > 0
    ? scoredSessions.reduce((s, m) => s + m.avgPromptScore, 0) / scoredSessions.length
    : 0;

  const displaySessions = [...filteredMetrics].sort((a, b) => b.reqCount - a.reqCount);

  const hitPct = Math.round(overallHitRate * 100);
  const hitColor = cacheHitColor(overallHitRate);

  const statsCards = [
    {
      icon: '⚡', iconBg: 'var(--color-teal-100)',
      value: `${hitPct}%`, color: hitColor,
      label: 'Cache Hit Rate',
      tip: 'Percentage of all input tokens served from the context cache across every tracked session. Above 50% is excellent.',
    },
    {
      icon: '$', iconBg: 'var(--color-green-100)',
      value: totalSavedUsd >= 0.001 ? `$${totalSavedUsd.toFixed(2)}` : '$0.00',
      color: 'var(--color-success)',
      label: 'Total Saved',
      tip: 'Cumulative cost savings from cache hits vs. if all tokens were processed at full input price.',
    },
    {
      icon: '★', iconBg: 'var(--color-amber-100)',
      value: overallAvgScore > 0 ? `${Math.round(overallAvgScore)}` : '—',
      color: overallAvgScore > 0 ? scoreColor(Math.round(overallAvgScore)) : 'var(--color-mute)',
      label: 'Avg Quality Score',
      tip: 'Average prompt quality score (0–100) based on length, clarity, and structure. Only scored for sessions active since the server started.',
    },
    {
      icon: '!', iconBg: 'var(--color-red-100)',
      value: String(wastedSessionCount),
      color: wastedSessionCount > 0 ? 'var(--color-error-text)' : 'var(--color-success-text)',
      label: 'Wasted Cache Sessions',
      tip: 'Sessions where context cache was written but never read back — you paid the cache write cost with no benefit.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {statsCards.map(s => (
          <div key={s.label} style={{ background: 'var(--color-canvas)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', padding: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9999, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 12, color: s.color }}>
              {s.icon}
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 20, fontWeight: 600, color: s.color, fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              {s.label}
              <InfoTooltip text={s.tip} />
            </div>
          </div>
        ))}
      </div>

      {/* Sessions table */}
      <section style={{ background: 'var(--color-canvas)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-hairline)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Prompt Health By Session
              </span>
              <InfoTooltip dir="down" text="Per-session breakdown of cache efficiency and prompt quality, sorted by request count. Click a row to expand individual prompt scores." />
            </div>
            {projects.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project:</span>
                {[null, ...projects].map(p => {
                  const active = selectedProject === p;
                  return (
                    <button
                      key={p ?? '__all__'}
                      onClick={() => setSelectedProject(p)}
                      style={{
                        fontFamily: 'var(--f-mono)', fontSize: 11,
                        padding: '3px 10px', borderRadius: 9999,
                        border: active ? '1px solid var(--color-ink)' : '1px solid var(--color-hairline)',
                        background: active ? 'var(--color-ink)' : 'transparent',
                        color: active ? 'var(--color-canvas)' : 'var(--color-mute)',
                        cursor: 'pointer', transition: 'all 0.1s',
                      }}
                    >
                      {p ?? 'All'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {displaySessions.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: 13, color: 'var(--color-mute)' }}>
            No sessions recorded yet
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-canvas-soft)', borderBottom: '1px solid var(--color-hairline)' }}>
                {['Session', 'Reqs', 'Cache Hit', 'Prompts', 'Avg Score', '$ Saved', 'Cache'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      fontFamily: 'var(--f-mono)', fontSize: 12,
                      color: 'var(--color-mute)', textTransform: 'uppercase',
                      textAlign: i === 1 || i === 3 || i === 5 ? 'right' : 'left',
                      fontWeight: 400,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displaySessions.map(m => <SessionRow key={m.sessionId} m={m} />)}
            </tbody>
          </table>
        )}
      </section>

      {/* Score legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-mute)', paddingLeft: 4 }}>
        <span>Score: <span style={{ color: 'var(--color-success)' }}>75–100 good</span></span>
        <span style={{ color: 'var(--color-warning)' }}>50–74 ok</span>
        <span style={{ color: 'var(--color-error)' }}>0–49 poor</span>
        <span>· Scores only for sessions active since last server start</span>
      </div>
    </div>
  );
}
