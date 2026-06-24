export interface SessionMeta {
  projectName: string;
  chatTitle: string;
}

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

export interface UsageLimits {
  sessionPct: number | null;
  weeklyPct: number | null;
  sessionResetsAt: string | null;
  weeklyResetsAt: string | null;
  plan: string | null;
  fetchedAt: number;
  error: string | null;
}

export interface HourlyEntry {
  output: number;
  cacheRead: number;
  cost: number;
  count: number;
}

export type CacheEfficiency = 'excellent' | 'good' | 'poor' | 'none';

export type PromptFlagType =
  | 'vague' | 'too-short' | 'too-long' | 'no-verb' | 'multi-task' | 'retry'
  | 'has-file' | 'has-code' | 'has-error' | 'structured';

export interface PromptFlag {
  type: PromptFlagType;
  severity: 'error' | 'warn' | 'good';
  label: string;
}

export interface PromptScore {
  overall: number;
  flags: PromptFlag[];
}

export interface PromptRecord {
  sessionId: string;
  turnIndex: number;
  timestamp: number;
  text: string;
  wordCount: number;
  charCount: number;
  score: PromptScore;
  pairedOutputTokens: number;
}

export interface SessionCacheMetric {
  sessionId: string;
  chatTitle: string;
  projectName: string;
  reqCount: number;
  hitRate: number;
  savedUsd: number;
  wasteRatio: number;
  totalCacheRead: number;
  totalCacheCreation: number;
  totalFreshInput: number;
  efficiency: CacheEfficiency;
  prompts: PromptRecord[];
  avgPromptScore: number;
}

export interface PromptHealthData {
  overallHitRate: number;
  totalSavedUsd: number;
  wastedSessionCount: number;
  sessionMetrics: SessionCacheMetric[];
}

export interface DashboardData {
  watcherUptime: number;
  totalReqs: number;
  totalChats: number;
  totalCost: number;
  currentChat: ChatSummary | null;
  allChats: ChatSummary[];
  hourly: [string, HourlyEntry][];
  recent: RequestRecord[];
  usageLimits: UsageLimits;
  promptHealth: PromptHealthData;
}
