'use client';

import { useState, useEffect } from 'react';
import type { ChatSummary } from '@/lib/types';
import { fmtCost, fmtNum, fmtK, fmtTime, fmtUptime, shortModel } from '@/lib/format';
import { getPricing } from '@/lib/pricing';
import { PLAN_PRESETS, type SubValueResult } from '@/hooks/usePlan';
import InfoTooltip from '@/components/InfoTooltip';

interface CurrentChatProps {
  chat: ChatSummary | null;
  subValue: SubValueResult | null;
  monthlyUsd: number | null;
}

export default function CurrentChat({ chat, subValue, monthlyUsd }: CurrentChatProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section style={{
      background: 'var(--color-canvas)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card-lg)',
      padding: 24,
    }}>
      <div style={{
        fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        borderBottom: '1px solid var(--color-hairline)',
        paddingBottom: 12, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        Current Chat
        <InfoTooltip dir="down" text="Live metrics for your active Claude Code session. Costs, token counts, and cache stats update automatically as you work." />
      </div>

      {chat ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* LEFT COLUMN — identity + cost comparison */}
          <div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)' }}>
              {chat.meta?.projectName ?? ''}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginTop: 2, lineHeight: 1.35 }}>
              {chat.meta?.chatTitle ?? ''}
            </div>

            {/* Live badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--color-green-100)', color: 'var(--color-success-text)',
              borderRadius: 9999, padding: '2px 10px', fontSize: 12, marginTop: 12,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 9999,
                background: 'var(--color-success)',
                animation: 'pulse-dot 2s ease-in-out infinite',
                display: 'inline-block',
              }} />
              active · {fmtUptime(Math.max(0, now - chat.firstTs))} · {fmtK(chat.outputTokens)} out
            </div>

            {/* Cost comparison — full-width two-box side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
              {/* API Equivalent */}
              <div style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-canvas-soft)',
                boxShadow: 'var(--shadow-card)',
              }}>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  API Equivalent
                  <InfoTooltip text="What you'd pay if billed per-token directly via the Anthropic API — the 'full price' without any subscription discount." />
                </div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 28, fontWeight: 700, letterSpacing: '-1px', color: 'var(--color-amber-700)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(chat.cost)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-mute)', marginTop: 4 }}>
                  pay-per-token rate
                </div>
              </div>

              {/* Subscription Cost */}
              {monthlyUsd != null && subValue != null ? (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-purple-100)',
                  boxShadow: 'inset 0 0 0 1px var(--color-purple-700)',
                }}>
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--color-purple-700)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    Subscription Cost
                    <InfoTooltip text="Your estimated actual cost based on your Claude subscription plan, prorated by how much you've used Claude this session vs. the billing period." />
                  </div>
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 28, fontWeight: 700, letterSpacing: '-1px', color: 'var(--color-purple-700)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCost(subValue.value)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-purple-700)', marginTop: 4, opacity: 0.75 }}>
                    what you actually pay
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-canvas-soft)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textAlign: 'center', lineHeight: 1.6 }}>
                    Set a plan to<br/>see your cost
                  </div>
                </div>
              )}
            </div>

            {/* Savings line */}
            {monthlyUsd != null && subValue != null && chat.cost > 0 && (() => {
              const savings = Math.max(0, chat.cost - subValue.value);
              const pct = Math.round((savings / chat.cost) * 100);
              const planName = PLAN_PRESETS.find(p => p.monthlyUsd === monthlyUsd)?.label ?? `$${monthlyUsd}/mo`;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-success)', fontFamily: 'var(--f-mono)' }}>&#10003;</span>
                  <span style={{ fontSize: 12, color: 'var(--color-mute)', lineHeight: 1.4 }}>
                    Saved <span style={{ color: 'var(--color-success-text)', fontWeight: 500 }}>{fmtCost(savings)} ({pct}%)</span> vs API on your {planName} plan
                  </span>
                </div>
              );
            })()}

            {/* Model row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <span style={{
                background: 'var(--color-gray-100)', color: 'var(--color-body)',
                borderRadius: 9999, padding: '2px 10px',
                fontFamily: 'var(--f-mono)', fontSize: 12,
              }}>
                {shortModel(chat.model)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>{chat.reqCount} requests</span>
              <span style={{ fontSize: 12, color: 'var(--color-mute)' }}>· started {fmtTime(chat.firstTs)}</span>
            </div>
          </div>

          {/* RIGHT COLUMN — token metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Token strip — 5-cell grid */}
            {(() => {
              const totalTokens = chat.inputTokens + chat.outputTokens + chat.cacheCreationTokens + chat.cacheReadTokens;
              const cells = [
                { label: 'Input',    value: fmtNum(chat.inputTokens) },
                { label: 'Output',   value: fmtNum(chat.outputTokens) },
                { label: 'Cache rd', value: fmtNum(chat.cacheReadTokens) },
                { label: 'Cache wr', value: fmtNum(chat.cacheCreationTokens) },
                { label: 'Total',    value: fmtK(totalTokens) },
              ];
              return (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1,
                  borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                  border: '1px solid var(--color-hairline)', background: 'var(--color-hairline)',
                }}>
                  {cells.map(c => (
                    <div key={c.label} style={{ background: 'var(--color-canvas-soft)', padding: '10px 12px' }}>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--color-mute)', textTransform: 'uppercase' }}>{c.label}</div>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>{c.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 2×2 metrics */}
            {(() => {
              const ctx = chat.inputTokens + chat.cacheReadTokens;
              const hitRate = ctx > 0 ? ((chat.cacheReadTokens / ctx) * 100).toFixed(1) : '0.0';
              const p = getPricing(chat.model);
              const savings = (chat.cacheReadTokens * (p.input - p.cacheRead)) / 1_000_000;
              const metrics = [
                { icon: '↗', iconBg: 'var(--color-blue-100)', value: fmtNum(chat.outputTokens), color: 'var(--color-blue-700)', label: 'output tokens', tip: 'Total tokens generated by Claude in this session.' },
                { icon: '✓', iconBg: 'var(--color-green-100)', value: fmtK(chat.cacheReadTokens), color: 'var(--color-success)', label: 'cache hits', tip: 'Tokens served from the context cache instead of being reprocessed — faster responses and lower cost.' },
                { icon: '%', iconBg: 'var(--color-green-100)', value: `${hitRate}%`, color: 'var(--color-success)', label: 'cache hit rate', tip: '% of input tokens served from cache. Above 50% is excellent; 100% means every request reused the cached context.' },
                { icon: '$', iconBg: 'var(--color-purple-100)', value: fmtCost(savings), color: 'var(--color-purple-700)', label: 'cache savings', tip: 'Money saved vs. processing all tokens at full input price (cache read tokens × price difference).' },
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {metrics.map(m => (
                    <div key={m.label} style={{ background: 'var(--color-canvas)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', padding: '14px 18px' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 9999, background: m.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: m.color }}>
                        {m.icon}
                      </div>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 22, fontWeight: 700, color: m.color, fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>
                        {m.value}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-mute)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {m.label}
                        <InfoTooltip text={m.tip} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Token mix bar */}
            {(() => {
              const total = chat.inputTokens + chat.outputTokens + chat.cacheCreationTokens + chat.cacheReadTokens || 1;
              const legend = [
                { color: '#007cf0', label: 'fresh',    value: fmtK(chat.inputTokens),          pct: chat.inputTokens / total },
                { color: '#ff0080', label: 'output',   value: fmtK(chat.outputTokens),         pct: chat.outputTokens / total },
                { color: '#7928ca', label: 'cache wr', value: fmtK(chat.cacheCreationTokens),  pct: chat.cacheCreationTokens / total },
                { color: '#00dfd8', label: 'cache rd', value: fmtK(chat.cacheReadTokens),      pct: chat.cacheReadTokens / total },
              ];
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--color-mute)', textTransform: 'uppercase', marginBottom: 6 }}>
                    <span>Token mix</span>
                    <span>{fmtK(total)} total</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 9999, background: 'var(--color-gray-100)', overflow: 'hidden', display: 'flex' }}>
                    {legend.map(l => (
                      <div key={l.label} style={{ background: l.color, width: `${(l.pct * 100).toFixed(1)}%` }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
                    {legend.map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 9999, background: l.color, display: 'inline-block' }} />
                        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--color-mute)' }}>{l.label}</span>
                        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>{l.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--color-mute)', padding: '32px 0', textAlign: 'center' }}>
          Waiting for Claude Code…
        </div>
      )}
    </section>
  );
}
