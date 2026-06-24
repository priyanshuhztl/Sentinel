import { NextRequest } from 'next/server';
import { emitter } from '@/lib/server/events';
import { buildPayload } from '@/lib/server/tracker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      // Send current state immediately
      send(buildPayload());

      // Push updates via emitter
      const onUpdate = () => send(buildPayload());
      emitter.on('update', onUpdate);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        emitter.off('update', onUpdate);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
