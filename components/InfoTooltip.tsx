'use client';

import { useState } from 'react';

interface InfoTooltipProps {
  text: string;
  dir?: 'up' | 'down';
}

export default function InfoTooltip({ text, dir = 'up' }: InfoTooltipProps) {
  const [show, setShow] = useState(false);
  const isUp = dir === 'up';

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        width: 15, height: 15, borderRadius: 9999,
        border: '1px solid currentColor',
        fontSize: 9, fontFamily: 'var(--f-sans)', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', userSelect: 'none', opacity: 0.6, flexShrink: 0,
      }}>
        ?
      </span>

      {show && (
        <div style={{
          position: 'absolute',
          ...(isUp
            ? { bottom: 'calc(100% + 8px)' }
            : { top: 'calc(100% + 8px)' }),
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-ink)',
          color: 'var(--color-canvas)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          fontSize: 12, lineHeight: 1.55,
          width: 240,
          zIndex: 300,
          boxShadow: 'var(--shadow-dropdown)',
          pointerEvents: 'none',
        }}>
          {text}
          <div style={{
            position: 'absolute',
            ...(isUp
              ? { top: '100%', borderTop: '6px solid var(--color-ink)' }
              : { bottom: '100%', borderBottom: '6px solid var(--color-ink)' }),
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
          }} />
        </div>
      )}
    </div>
  );
}
