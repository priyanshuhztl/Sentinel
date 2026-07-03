import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import https from 'https';

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

// ─── Platform-specific paths ──────────────────────────────────────────────────

function getConfigPath(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming'),
        'Claude', 'config.json'
      );
    case 'linux':
      return path.join(os.homedir(), '.config', 'Claude', 'config.json');
    default: // darwin
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'config.json');
  }
}

function getLocalStatePath(): string {
  return path.join(
    process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming'),
    'Claude', 'Local State'
  );
}

// ─── Key retrieval ────────────────────────────────────────────────────────────

function getSafeStorageKeyMac(): string | null {
  try {
    return execSync(
      'security find-generic-password -s "Claude Safe Storage" -w',
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();
  } catch { return null; }
}

function getSafeStorageKeyLinux(): string {
  try {
    const result = execSync(
      'secret-tool lookup application "Claude Safe Storage"',
      { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }
    ).toString().trim();
    if (result) return result;
  } catch { /* fall through to default */ }
  // Chrome/Electron Linux fallback when no secret service is available
  return 'peanuts';
}

// ─── Decryption ───────────────────────────────────────────────────────────────

// macOS (1003 iterations) + Linux (1 iteration): PBKDF2-SHA1 + AES-128-CBC
function decryptV10CBC(encrypted: string, passphrase: string, iterations: number): string | null {
  try {
    const raw = Buffer.from(encrypted, 'base64');
    if (raw.slice(0, 3).toString() !== 'v10') return null;

    const aesKey = crypto.pbkdf2Sync(passphrase, 'saltysalt', iterations, 16, 'sha1');
    const iv     = Buffer.alloc(16, 0x20); // 16 space characters

    const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(raw.slice(3)), decipher.final()]);

    const pad = decrypted[decrypted.length - 1];
    const text = (pad >= 1 && pad <= 16)
      ? decrypted.slice(0, -pad).toString('utf8')
      : decrypted.toString('utf8');

    const jsonStart = text.indexOf('{');
    return jsonStart >= 0 ? text.slice(jsonStart) : text;
  } catch { return null; }
}

// Windows newer Electron: DPAPI-wrapped AES-256-GCM key stored in Local State
function decryptWindowsV10GCM(raw: Buffer): string | null {
  try {
    const localStatePath = getLocalStatePath();
    if (!fs.existsSync(localStatePath)) return null;

    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8')) as Record<string, unknown>;
    const encryptedKeyB64 = (localState?.['os_crypt'] as Record<string, string> | undefined)?.['encrypted_key'];
    if (!encryptedKeyB64) return null;

    // Key is base64-encoded with a 5-byte 'DPAPI' ASCII prefix — strip it, then DPAPI-decrypt
    const encryptedKey = Buffer.from(encryptedKeyB64, 'base64').slice(5).toString('base64');
    const aesKeyB64 = execSync(
      `powershell -NoProfile -Command "$b=[System.Convert]::FromBase64String('${encryptedKey}');$k=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[System.Convert]::ToBase64String($k)"`,
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();

    const aesKey     = Buffer.from(aesKeyB64, 'base64');
    const nonce      = raw.slice(3, 15);   // 12-byte nonce after 'v10'
    const ciphertext = raw.slice(15, -16);
    const authTag    = raw.slice(-16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce);
    decipher.setAuthTag(authTag);
    const text = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

    const jsonStart = text.indexOf('{');
    return jsonStart >= 0 ? text.slice(jsonStart) : text;
  } catch { return null; }
}

// Windows older Electron: direct DPAPI, no v10 prefix
function decryptWindowsDPAPI(raw: Buffer): string | null {
  try {
    const b64 = raw.toString('base64');
    const result = execSync(
      `powershell -NoProfile -Command "$b=[System.Convert]::FromBase64String('${b64}');$d=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[System.Text.Encoding]::UTF8.GetString($d)"`,
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();

    const jsonStart = result.indexOf('{');
    return jsonStart >= 0 ? result.slice(jsonStart) : result;
  } catch { return null; }
}

function decryptElectronValue(encrypted: string): string | null {
  switch (process.platform) {
    case 'darwin': {
      const key = getSafeStorageKeyMac();
      if (!key) return null;
      return decryptV10CBC(encrypted, key, 1003);
    }
    case 'linux': {
      const key = getSafeStorageKeyLinux();
      // Try decrypting as v10 CBC (libsecret or peanuts key, 1 iteration on Linux)
      const result = decryptV10CBC(encrypted, key, 1);
      if (result) return result;
      // Fallback: some Linux Electron builds store the value as plaintext JSON
      try {
        const raw = Buffer.from(encrypted, 'base64').toString('utf8');
        const jsonStart = raw.indexOf('{');
        return jsonStart >= 0 ? raw.slice(jsonStart) : null;
      } catch { return null; }
    }
    case 'win32': {
      const raw = Buffer.from(encrypted, 'base64');
      if (raw.slice(0, 3).toString() === 'v10') {
        return decryptWindowsV10GCM(raw);
      }
      return decryptWindowsDPAPI(raw);
    }
    default:
      return null;
  }
}

// ─── Token extraction ─────────────────────────────────────────────────────────

// Throws a specific, user-visible reason at each step instead of collapsing
// every failure into one generic message — the reason ends up directly in
// the Usage Limits card, since that's the only diagnostic surface available
// once this is running inside a packaged app with no visible console.
function getAccessToken(): string {
  const configPath = getConfigPath();
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Can't read/parse Claude config at ${configPath}: ${err}`);
  }

  const tokenB64 = cfg['oauth:tokenCache'] as string | undefined;
  if (!tokenB64) throw new Error(`oauth:tokenCache missing from ${configPath}`);

  const json = decryptElectronValue(tokenB64);
  if (!json) throw new Error(`Failed to decrypt oauth:tokenCache (platform: ${process.platform})`);

  let cache: Record<string, { token: string; subscriptionType?: string }>;
  try {
    cache = JSON.parse(json);
  } catch {
    throw new Error('Decrypted oauth:tokenCache is not valid JSON');
  }

  const entry = Object.values(cache)[0];
  if (!entry?.token) throw new Error('Decrypted oauth:tokenCache has no token entries');
  return entry.token;
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
  let token: string;
  try {
    token = getAccessToken();
  } catch (err) {
    return { ...g._twCached!, fetchedAt: Date.now(), error: err instanceof Error ? err.message : String(err) };
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
  if (!g._twPollerStarted) startUsagePoller();
  return g._twCached!;
}

export function startUsagePoller(): void {
  if (g._twPollerStarted) return;
  g._twPollerStarted = true;
  if (!fs.existsSync(getConfigPath())) return;

  const poll = async () => {
    try {
      const result = await fetchFromAPI();
      if (result.error !== 'rate-limited' || g._twCached!.fetchedAt === 0) {
        g._twCached = result;
        const { emitter } = await import('./events');
        emitter.emit('update');
      }
    } catch { /* swallow — next interval will retry */ }
  };

  poll();
  setInterval(poll, POLL_INTERVAL_MS);
}
