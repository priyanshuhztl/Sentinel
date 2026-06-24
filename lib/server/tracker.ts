import { getUsageLimits } from './usage';
import type { CacheEfficiency, PromptHealthData, PromptRecord, SessionCacheMetric } from '../types';

export interface RequestRecord {
  id: string;
  sessionId: string;
  model: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  durationMs: number;
}

export interface SessionState {
  startTime: number;
  requests: RequestRecord[];
  inFlight: Map<string, Partial<RequestRecord>>;
}

export interface SessionMeta {
  projectName: string;
  chatTitle: string;
}

export interface ChatSummary {
  sessionId: string;
  firstTs: number;
  lastTs: number;
  reqCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  model: string;
  meta: SessionMeta;
}

// Pricing per million tokens (as of mid-2025)
const MODEL_PRICING = [
  { pattern: /haiku/i,  input: 0.80,  output: 4.00,  cacheCreation: 1.00,   cacheRead: 0.08 },
  { pattern: /opus/i,   input: 15.00, output: 75.00, cacheCreation: 18.75,  cacheRead: 1.50 },
  { pattern: /sonnet/i, input: 3.00,  output: 15.00, cacheCreation: 3.75,   cacheRead: 0.30 },
];
const DEFAULT_PRICING = { input: 3.00, output: 15.00, cacheCreation: 3.75, cacheRead: 0.30 };

export function getPricing(model: string) {
  return MODEL_PRICING.find(p => p.pattern.test(model)) ?? DEFAULT_PRICING;
}

export function calcCost(r: Pick<RequestRecord, 'model' | 'inputTokens' | 'outputTokens' | 'cacheCreationTokens' | 'cacheReadTokens'>): number {
  const p = getPricing(r.model);
  return (
    r.inputTokens         * p.input         +
    r.outputTokens        * p.output        +
    r.cacheCreationTokens * p.cacheCreation +
    r.cacheReadTokens     * p.cacheRead
  ) / 1_000_000;
}

export function groupByChat(requests: RequestRecord[]): ChatSummary[] {
  const map = new Map<string, ChatSummary>();

  for (const r of requests) {
    let s = map.get(r.sessionId);
    if (!s) {
      s = {
        sessionId:           r.sessionId,
        firstTs:             r.timestamp,
        lastTs:              r.timestamp,
        reqCount:            0,
        inputTokens:         0,
        outputTokens:        0,
        cacheCreationTokens: 0,
        cacheReadTokens:     0,
        cost:                0,
        model:               r.model,
        meta:                tracker.getMeta(r.sessionId),
      };
      map.set(r.sessionId, s);
    }
    s.reqCount++;
    s.inputTokens         += r.inputTokens;
    s.outputTokens        += r.outputTokens;
    s.cacheCreationTokens += r.cacheCreationTokens;
    s.cacheReadTokens     += r.cacheReadTokens;
    s.cost                += calcCost(r);
    if (r.timestamp < s.firstTs) s.firstTs = r.timestamp;
    if (r.timestamp > s.lastTs)  s.lastTs  = r.timestamp;
    s.model = r.model;
  }

  return [...map.values()].sort((a, b) => b.lastTs - a.lastTs);
}

const DEFAULT_META: SessionMeta = { projectName: 'unknown', chatTitle: '(no title)' };

class Tracker {
  private state: SessionState = {
    startTime: Date.now(),
    requests: [],
    inFlight: new Map(),
  };
  private meta = new Map<string, SessionMeta>();

  addRequest(r: RequestRecord): void {
    this.state.requests.push(r);
  }

  setMeta(sessionId: string, m: SessionMeta): void {
    if (!this.meta.has(sessionId)) this.meta.set(sessionId, m);
  }

  updateTitle(sessionId: string, title: string): void {
    const existing = this.meta.get(sessionId);
    if (existing) existing.chatTitle = title;
    else this.meta.set(sessionId, { projectName: 'unknown', chatTitle: title });
  }

  getMeta(sessionId: string): SessionMeta {
    return this.meta.get(sessionId) ?? DEFAULT_META;
  }

  getState(): SessionState {
    return this.state;
  }
}

// Global singleton that survives HMR
const g = global as typeof globalThis & { _twTracker?: Tracker };
if (!g._twTracker) {
  g._twTracker = new Tracker();
}
export const tracker = g._twTracker;

// ─── Prompt storage (separate HMR-safe global) ────────────────────────────────
// Stored separately from the Tracker class so it survives module re-evaluations
// without any version-bump or singleton reset. All functions access gP._twPrompts
// dynamically, so old and new function instances always share the same array.

const gP = global as typeof globalThis & { _twPrompts?: PromptRecord[] };
if (!gP._twPrompts) gP._twPrompts = [];

export function addPromptRecord(r: PromptRecord): void {
  gP._twPrompts!.push(r);
}

export function getSessionPrompts(sessionId: string): PromptRecord[] {
  return (gP._twPrompts ?? []).filter(p => p.sessionId === sessionId);
}

export function getSessionPromptCount(sessionId: string): number {
  return (gP._twPrompts ?? []).filter(p => p.sessionId === sessionId).length;
}

export function getLastSessionPromptTs(sessionId: string): number | undefined {
  const arr = (gP._twPrompts ?? []).filter(p => p.sessionId === sessionId);
  return arr.length > 0 ? arr[arr.length - 1].timestamp : undefined;
}

// ─── computePromptHealth ──────────────────────────────────────────────────────

function cacheEfficiency(hitRate: number, totalRead: number): CacheEfficiency {
  if (totalRead === 0) return 'none';
  if (hitRate >= 0.5) return 'excellent';
  if (hitRate >= 0.2) return 'good';
  return 'poor';
}

function cacheSavingsUsd(requests: RequestRecord[]): number {
  return requests.reduce((sum, r) => {
    const p = getPricing(r.model);
    return sum + (r.cacheReadTokens * (p.input - p.cacheRead)) / 1_000_000;
  }, 0);
}

export function computePromptHealth(chats: ChatSummary[], allRequests: RequestRecord[]): PromptHealthData {
  const reqsBySession = new Map<string, RequestRecord[]>();
  for (const r of allRequests) {
    const arr = reqsBySession.get(r.sessionId) ?? [];
    arr.push(r);
    reqsBySession.set(r.sessionId, arr);
  }

  const sessionMetrics: SessionCacheMetric[] = chats.map((chat) => {
    const reqs    = reqsBySession.get(chat.sessionId) ?? [];
    const prompts = getSessionPrompts(chat.sessionId);

    // Pair each prompt with the response at the same turn index to get output tokens
    const pairedPrompts: PromptRecord[] = prompts.map((p, i) => ({
      ...p,
      pairedOutputTokens: reqs[i]?.outputTokens ?? 0,
    }));

    const totalRead      = chat.cacheReadTokens;
    const totalCreated   = chat.cacheCreationTokens;
    const totalFresh     = chat.inputTokens;
    const totalEffective = totalFresh + totalRead + totalCreated;
    const hitRate        = totalEffective > 0 ? totalRead / totalEffective : 0;
    const wasteRatio     = totalCreated > 0 ? Math.max(0, 1 - totalRead / totalCreated) : 0;
    const savedUsd       = cacheSavingsUsd(reqs);
    const avgPromptScore = pairedPrompts.length > 0
      ? pairedPrompts.reduce((s, p) => s + p.score.overall, 0) / pairedPrompts.length
      : 0;

    return {
      sessionId:          chat.sessionId,
      chatTitle:          chat.meta.chatTitle,
      projectName:        chat.meta.projectName,
      reqCount:           chat.reqCount,
      hitRate,
      savedUsd,
      wasteRatio,
      totalCacheRead:     totalRead,
      totalCacheCreation: totalCreated,
      totalFreshInput:    totalFresh,
      efficiency:         cacheEfficiency(hitRate, totalRead),
      prompts:            pairedPrompts,
      avgPromptScore,
    };
  });

  const totalEffectiveAll = sessionMetrics.reduce(
    (s, m) => s + m.totalFreshInput + m.totalCacheRead + m.totalCacheCreation, 0
  );
  const totalReadAll = sessionMetrics.reduce((s, m) => s + m.totalCacheRead, 0);

  return {
    overallHitRate:      totalEffectiveAll > 0 ? totalReadAll / totalEffectiveAll : 0,
    totalSavedUsd:       sessionMetrics.reduce((s, m) => s + m.savedUsd, 0),
    wastedSessionCount:  sessionMetrics.filter(m => m.wasteRatio > 0.8 && m.totalCacheCreation > 0).length,
    sessionMetrics,
  };
}

// ─── buildPayload ──────────────────────────────────────────────────────────────

export function buildPayload() {
  const state = tracker.getState();
  const all   = state.requests;
  const chats = groupByChat(all);

  const hourly: Record<string, { output: number; cacheRead: number; cost: number; count: number }> = {};
  for (const r of all) {
    const d   = new Date(r.timestamp);
    const key = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`;
    if (!hourly[key]) hourly[key] = { output: 0, cacheRead: 0, cost: 0, count: 0 };
    hourly[key].output    += r.outputTokens;
    hourly[key].cacheRead += r.cacheReadTokens;
    hourly[key].cost      += calcCost(r);
    hourly[key].count++;
  }

  return {
    watcherUptime: Date.now() - state.startTime,
    totalReqs:     all.length,
    totalChats:    chats.length,
    totalCost:     all.reduce((s, r) => s + calcCost(r), 0),
    currentChat:   chats[0] ?? null,
    allChats:      chats,
    hourly:        Object.entries(hourly).sort((a, b) => a[0] > b[0] ? -1 : 1),
    recent:        all.slice(-30).reverse(),
    usageLimits:   getUsageLimits(),
    promptHealth:  computePromptHealth(chats, all),
  };
}
