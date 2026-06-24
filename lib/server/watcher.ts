import fs from 'fs';
import path from 'path';
import os from 'os';
import { tracker, addPromptRecord, getSessionPromptCount, getLastSessionPromptTs } from './tracker';
import { emitter } from './events';
import { scorePrompt } from './scorer';
import type { RequestRecord } from './tracker';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SCAN_WINDOW_MS  = 24 * 60 * 60 * 1000;


// ─── HMR-safe globals ─────────────────────────────────────────────────────────

const g = global as typeof globalThis & {
  _twFilePositions?: Map<string, number>;
  _twSeenIds?: Set<string>;
  _twRenderTimer?: ReturnType<typeof setTimeout> | null;
};

if (!g._twFilePositions) g._twFilePositions = new Map<string, number>();
if (!g._twSeenIds)       g._twSeenIds       = new Set<string>();
if (!('_twRenderTimer' in g)) g._twRenderTimer = null;

const filePositions = g._twFilePositions;
const seenIds       = g._twSeenIds;

// ─── Debounced render ─────────────────────────────────────────────────────────
// Prevents the scan loop from calling emitter.emit 100+ times in one burst.
// Any number of scheduleRender() calls within 80ms collapse into one emit.

function scheduleRender(): void {
  if (g._twRenderTimer) clearTimeout(g._twRenderTimer);
  g._twRenderTimer = setTimeout(() => {
    emitter.emit('update');
    g._twRenderTimer = null;
  }, 80);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function boot(): void {
  if (!fs.existsSync(PROJECTS_DIR)) {
    process.stdout.write(`\x1b[31mDirectory not found:\x1b[0m ${PROJECTS_DIR}\n`);
    return;
  }

  // Process recent files (last hour) synchronously so history is ready before
  // the first emit — this is why we emit once here, not inside processFile.
  scanAll();
  emitter.emit('update');

  // Watch for live updates.
  // On macOS, fs.watch recursive returns only the basename (not the relative path),
  // so we resolve it back to a full path by searching project subdirectories.
  fs.watch(PROJECTS_DIR, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const basename = path.basename(filename); // safe for both macOS and Linux
    if (!basename.endsWith('.jsonl')) return;
    const full = resolveJsonl(basename);
    if (full) { processFile(full, false); scheduleRender(); }
  });

  // Poll every 3s as a fallback — guards against missed watch events on macOS,
  // and discovers JSONL files created after scanAll() ran (new sessions).
  setInterval(() => {
    let changed = false;
    const before = tracker.getState().requests.length;
    scanForNewFiles();
    for (const filePath of filePositions.keys()) {
      processFile(filePath, false);
    }
    if (tracker.getState().requests.length > before) changed = true;
    if (changed) scheduleRender();
  }, 3000);
}

// Resolve a .jsonl basename to its full path by searching all project subdirs.
function resolveJsonl(basename: string): string | null {
  try {
    for (const dir of fs.readdirSync(PROJECTS_DIR)) {
      const full = path.join(PROJECTS_DIR, dir, basename);
      if (fs.existsSync(full)) return full;
    }
  } catch {}
  return null;
}

// ─── File scanning ────────────────────────────────────────────────────────────

function scanAll(): void {
  const cutoff = Date.now() - SCAN_WINDOW_MS;
  for (const projectDir of fs.readdirSync(PROJECTS_DIR)) {
    const dir = path.join(PROJECTS_DIR, projectDir);
    try { if (!fs.statSync(dir).isDirectory()) continue; } catch { continue; }

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.jsonl')) continue;
      const fullPath = path.join(dir, file);
      try {
        const mtime = fs.statSync(fullPath).mtimeMs;
        if (mtime < cutoff) {
          // Too old — record its size so live-watch never replays it.
          filePositions.set(fullPath, fs.statSync(fullPath).size);
        } else {
          processFile(fullPath, true);
        }
      } catch { continue; }
    }
  }
}

// Lightweight variant: only registers files not yet tracked (new sessions).
function scanForNewFiles(): void {
  const cutoff = Date.now() - SCAN_WINDOW_MS;
  for (const projectDir of fs.readdirSync(PROJECTS_DIR)) {
    const dir = path.join(PROJECTS_DIR, projectDir);
    try { if (!fs.statSync(dir).isDirectory()) continue; } catch { continue; }
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.jsonl')) continue;
      const fullPath = path.join(dir, file);
      if (filePositions.has(fullPath)) continue; // already tracked — skip
      try {
        const mtime = fs.statSync(fullPath).mtimeMs;
        if (mtime < cutoff) {
          filePositions.set(fullPath, fs.statSync(fullPath).size);
        } else {
          processFile(fullPath, true); // new file within window — read from start
        }
      } catch { continue; }
    }
  }
}

// ─── Incremental JSONL reader ─────────────────────────────────────────────────

function processFile(filePath: string, fromStart: boolean): void {
  let stat: fs.Stats;
  try { stat = fs.statSync(filePath); } catch { return; }

  const lastPos = fromStart ? 0 : (filePositions.get(filePath) ?? 0);
  if (stat.size <= lastPos) return;

  let fd: number;
  const buf = Buffer.allocUnsafe(stat.size - lastPos);
  try {
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, buf.length, lastPos);
    fs.closeSync(fd);
  } catch { return; }

  filePositions.set(filePath, stat.size);

  const sessionId = path.basename(filePath, '.jsonl');
  for (const line of buf.toString('utf8').split('\n')) {
    if (line.trim()) processLine(line, sessionId);
  }
}

// ─── JSONL line parser ────────────────────────────────────────────────────────

function processLine(line: string, sessionId: string): void {
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(line) as Record<string, unknown>; } catch { return; }

  // Extract project name from first user message cwd
  if (obj['type'] === 'user') {
    const cwd = obj['cwd'] as string | undefined;
    const msgContent = (obj['message'] as Record<string,unknown> | undefined)?.['content'];
    const text = typeof msgContent === 'string' ? msgContent
               : Array.isArray(msgContent)
                 ? (msgContent.find((b: unknown) => (b as Record<string,unknown>)['type'] === 'text') as Record<string,unknown> | undefined)?.['text'] as string ?? ''
                 : '';

    // setMeta only sets once (first call wins), so user message sets the fallback title
    tracker.setMeta(sessionId, {
      projectName: cwd ? path.basename(cwd) : 'unknown',
      chatTitle:   text.slice(0, 70).replace(/\n/g, ' ') || '(empty)',
    });

    // Score and store the prompt if it has meaningful text
    if (text.trim().length > 0) {
      const tsRaw = obj['timestamp'] as string | undefined;
      const ts = tsRaw ? new Date(tsRaw).getTime() : Date.now();
      const prevTs = getLastSessionPromptTs(sessionId);
      const score = scorePrompt(text, { prevTimestamp: prevTs, currentTimestamp: ts });
      addPromptRecord({
        sessionId,
        turnIndex:          getSessionPromptCount(sessionId),
        timestamp:          isFinite(ts) ? ts : Date.now(),
        text,
        wordCount:          text.trim().split(/\s+/).filter(Boolean).length,
        charCount:          text.length,
        score,
        pairedOutputTokens: 0, // filled in by computePromptHealth
      });
    }

    return;
  }

  // ai-title overwrites the fallback title from the first user message
  if (obj['type'] === 'ai-title') {
    const aiTitle = obj['aiTitle'] as string | undefined;
    if (aiTitle) tracker.updateTitle(sessionId, aiTitle);
    return;
  }

  if (obj['type'] !== 'assistant') return;

  const msg   = obj['message'] as Record<string, unknown> | undefined;
  if (!msg) return;

  const usage = msg['usage'] as Record<string, number> | undefined;
  if (!usage) return;

  const msgId = msg['id'] as string | undefined;
  if (msgId && seenIds.has(msgId)) return;
  if (msgId) seenIds.add(msgId);

  const tsRaw = obj['timestamp'] as string | undefined;
  const timestamp = tsRaw ? new Date(tsRaw).getTime() : Date.now();

  tracker.addRequest({
    id:                  msgId ?? crypto.randomUUID(),
    sessionId,
    model:               (msg['model'] as string | undefined) ?? 'unknown',
    timestamp:           isFinite(timestamp) ? timestamp : Date.now(),
    inputTokens:         usage['input_tokens']                ?? 0,
    outputTokens:        usage['output_tokens']               ?? 0,
    cacheCreationTokens: usage['cache_creation_input_tokens'] ?? 0,
    cacheReadTokens:     usage['cache_read_input_tokens']     ?? 0,
    durationMs:          0,
  } as RequestRecord);
}
