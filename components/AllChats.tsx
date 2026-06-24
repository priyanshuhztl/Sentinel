'use client';

import { useState } from 'react';
import type { ChatSummary } from '@/lib/types';
import { fmtCost, fmtTime } from '@/lib/format';
import InfoTooltip from '@/components/InfoTooltip';

interface AllChatsProps {
  chats: ChatSummary[];
}

export default function AllChats({ chats }: AllChatsProps) {
  const [showAll, setShowAll] = useState(false);

  const maxCost = Math.max(...chats.map(c => c.cost), 0.0001);
  const visible = showAll ? chats : chats.slice(0, 8);
  const hidden = chats.length - 8;

  return (
    <section style={{
      background: 'var(--color-canvas)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
      alignSelf: 'start',
    }}>
      {/* Header strip */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recent Sessions
          </span>
          <InfoTooltip dir="down" text="All Claude Code sessions found in ~/.claude/projects/, sorted by most recent activity. The first row is your currently active session." />
        </div>
        <span style={{
          marginLeft: 'auto',
          background: 'var(--color-gray-100)', color: 'var(--color-body)',
          borderRadius: 9999, padding: '2px 8px',
          fontFamily: 'var(--f-mono)', fontSize: 12,
        }}>
          {chats.length}
        </span>
      </div>

      {chats.length === 0 ? (
        <div style={{ padding: '32px 20px', fontSize: 13, color: 'var(--color-mute)', textAlign: 'center' }}>No chats yet</div>
      ) : (
        <>
          {visible.map((chat, i) => (
            <div
              key={chat.sessionId}
              style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-gray-100)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  background: i === 0 ? 'var(--color-teal-100)' : 'var(--color-gray-100)',
                  color: i === 0 ? 'var(--color-teal-700)' : 'var(--color-body)',
                  borderRadius: 9999, padding: '2px 8px',
                  fontFamily: 'var(--f-mono)', fontSize: 11,
                }}>
                  {i === 0 ? 'live' : fmtTime(chat.firstTs)}
                </span>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--color-mute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chat.meta?.projectName ?? '—'}
                </div>
                <div style={{ fontSize: 14, color: 'var(--color-ink)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chat.meta?.chatTitle ?? chat.sessionId.slice(0, 8)}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-mute)', marginBottom: 4 }}>{chat.reqCount} reqs</div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 14, fontWeight: 500, color: 'var(--color-amber-700)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(chat.cost)}
                </div>
                <div style={{ width: 48, height: 4, background: 'var(--color-gray-100)', borderRadius: 9999, marginTop: 4, marginLeft: 'auto', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--color-amber-700)', width: `${Math.min(100, (chat.cost / maxCost) * 100).toFixed(1)}%` }} />
                </div>
              </div>
            </div>
          ))}

          {chats.length > 8 && (
            <button
              onClick={() => setShowAll(v => !v)}
              style={{ padding: '10px 20px', width: '100%', textAlign: 'center', background: 'transparent', border: 'none', borderTop: '1px solid var(--color-hairline)', fontFamily: 'var(--f-sans)', fontSize: 14, color: 'var(--color-link)', cursor: 'pointer' }}
            >
              {showAll ? 'Show less' : `Show ${hidden} more`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
