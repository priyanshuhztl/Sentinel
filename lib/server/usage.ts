import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import https from 'https';

const ELECTRON_CONFIG = path.join(
  os.homedir(),
  'Library/Application Support/Claude/config.json'
);
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface UsageLimits {
  sessionPct:       number | null;   // 0–100, current ~5-hour window
  weeklyPct:        number | null;   // 0–100, 7-day window
  sessionResetsAt:  string | null;   // ISO or human-readable
  weeklyResetsAt:   string | null;
  plan:             string | null;
  fetchedAt:        number;
  error:            string | null;
}

// Persist across HMR module reloads
const g = global as typeof globalThis & {
  _twCached?: UsageLimits;
  _twPollerStarted?: boolean;
};

if (!g._twCached) {
  g._twCached = {
    sessionPct: null, weeklyPct: null,
    sessionResetsAt: null, weeklyResetsAt: null,
    plan: null, fetchedAt: 0, error: null,
  };
}

// ─── Electron cookie/config decryption ───────────────────────────────────────

function getSafeStorageKey(): string | null {
  try {
    return execSync(
      'security find-generic-password -s "Claude Safe Storage" -w',
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();
  } catch { return null; }
}

function decryptElectronValue(encrypted: string): string | null {
  const key = getSafeStorageKey();
  if (!key) return null;

  try {
    const raw = Buffer.from(encrypted, 'base64');
    if (raw.slice(0, 3).toString() !== 'v10') return null;
    const body = raw.slice(3);

    // PBKDF2-SHA1 key derivation (Chrome macOS algorithm)
    const aesKey = crypto.pbkdf2Sync(key, 'saltysalt', 1003, 16, 'sha1');
    const iv     = Buffer.alloc(16, 0x20); // 16 space characters

    const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(body), decipher.final()]);

    // Remove PKCS7 padding
    const pad = decrypted[decrypted.length - 1];
    const text = (pad >= 1 && pad <= 16)
      ? decrypted.slice(0, -pad).toString('utf8')
      : decrypted.toString('utf8');

    // Strip binary prefix (find JSON start)
    const jsonStart = text.indexOf('{');
    return jsonStart >= 0 ? text.slice(jsonStart) : text;
  } catch { return null; }
}

function getAccessToken(): string | null {
  try {
    const cfg = JSON.parse(fs.readFileSync(ELECTRON_CONFIG, 'utf8'));
    const tokenB64 = cfg['oauth:tokenCache'];
    if (!tokenB64) return null;

    const json = decryptElectronValue(tokenB64);
    if (!json) return null;

    const cache = JSON.parse(json) as Record<string, { token: string; subscriptionType?: string }>;
    const entry = Object.values(cache)[0];
    return entry?.token ?? null;
  } catch { return null; }
}

// ─── API call ─────────────────────────────────────────────────────────────────

function httpsGet(url: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        if (res.statusCode && res.statusCode >= 400) {
          reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { status: res.statusCode, body }));
        } else {
          try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON parse failed')); }
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(new Error('timeout')); });
  });
}

async function fetchFromAPI(): Promise<UsageLimits> {
  const token = getAccessToken();
  if (!token) {
    return { ...g._twCached!, fetchedAt: Date.now(), error: 'OAuth token not found' };
  }

  try {
    const data = await httpsGet('https://api.anthropic.com/api/oauth/usage', {
      'Authorization': `Bearer ${token}`,
      'Accept':        'application/json',
    }) as Record<string, { utilization: number; resets_at: string } | null>;

    const fiveHour = data['five_hour'];
    const sevenDay = data['seven_day'];

    return {
      sessionPct:      fiveHour?.utilization ?? null,
      weeklyPct:       sevenDay?.utilization ?? null,
      sessionResetsAt: fiveHour?.resets_at ?? null,
      weeklyResetsAt:  sevenDay?.resets_at ?? null,
      plan:            null,
      fetchedAt:       Date.now(),
      error:           null,
    };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      return { ...g._twCached!, fetchedAt: Date.now(), error: 'rate-limited' };
    }
    return { ...g._twCached!, fetchedAt: Date.now(), error: String(err) };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getUsageLimits(): UsageLimits {
  // Lazy-start in case instrumentation.ts didn't fire (e.g. dev HMR re-register skip)
  if (!g._twPollerStarted) startUsagePoller();
  return g._twCached!;
}

export function startUsagePoller(): void {
  if (g._twPollerStarted) return;
  g._twPollerStarted = true;
  if (!fs.existsSync(ELECTRON_CONFIG)) return;

  const poll = async () => {
    try {
      const result = await fetchFromAPI();
      // Only replace cache if we got real data (not a rate-limit-preserved value)
      if (result.error !== 'rate-limited' || g._twCached!.fetchedAt === 0) {
        g._twCached = result;
        // Notify SSE clients of updated limits
        const { emitter } = await import('./events');
        emitter.emit('update');
      }
    } catch { /* swallow — next interval will retry */ }
  };

  poll(); // fetch immediately at startup
  setInterval(poll, POLL_INTERVAL_MS);
}
