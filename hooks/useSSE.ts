'use client';

import { useState, useEffect, useRef } from 'react';

export function useSSE<T>(url: string): { data: T | null; connected: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (e: MessageEvent) => {
        try {
          setData(JSON.parse(e.data) as T);
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        timerRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [url]);

  return { data, connected };
}
