import { buildPayload } from '@/lib/server/tracker';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(buildPayload());
}
