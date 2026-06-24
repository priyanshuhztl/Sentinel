import type { PromptFlag, PromptScore } from '../types';

const ACTION_VERBS = [
  'fix', 'add', 'implement', 'explain', 'refactor', 'write', 'remove', 'check',
  'update', 'create', 'debug', 'find', 'show', 'list', 'change', 'help', 'make',
  'run', 'test', 'review', 'delete', 'move', 'rename', 'read', 'build', 'convert',
  'extract', 'parse', 'format', 'generate', 'deploy', 'install', 'migrate',
];

const FILE_PATTERN  = /\.(ts|tsx|js|jsx|py|json|md|css|html|go|rs|java|c|cpp|sh|yaml|yml)\b|\/[\w.\-]+|\\[\w.\-]+/;
const CODE_PATTERN  = /`[^`]+`|```[\s\S]+?```/;
const ERROR_PATTERN = /error:|Error:|TypeError|ReferenceError|SyntaxError|undefined is not|cannot read|is not a function|stack trace|\bat line\b|ENOENT|EACCES/i;
const LIST_PATTERN  = /^[ \t]*[-*•]\s+/m;
const NUM_LIST      = /^[ \t]*\d+\.\s+/m;

export function scorePrompt(
  text: string,
  opts?: { prevTimestamp?: number; currentTimestamp?: number },
): PromptScore {
  const flags: PromptFlag[] = [];
  let score = 60;

  const trimmed = text.trim();
  const lower   = trimmed.toLowerCase();
  const chars   = trimmed.length;

  // ── Bad signals ──────────────────────────────────────────────────────────────

  if (chars < 15) {
    flags.push({ type: 'vague', severity: 'error', label: 'VAGUE' });
    score -= 40;
  } else if (chars < 50) {
    flags.push({ type: 'too-short', severity: 'warn', label: 'TOO SHORT' });
    score -= 20;
  }

  if (chars > 4000) {
    flags.push({ type: 'too-long', severity: 'warn', label: 'TOO LONG' });
    score -= 10;
  }

  if (chars >= 50 && !ACTION_VERBS.some(v => lower.includes(v))) {
    flags.push({ type: 'no-verb', severity: 'warn', label: 'NO VERB' });
    score -= 20;
  }

  const questionCount = (trimmed.match(/\?/g) ?? []).length;
  if (questionCount >= 3) {
    flags.push({ type: 'multi-task', severity: 'warn', label: 'MULTI-TASK' });
    score -= 15;
  }

  if (
    opts?.prevTimestamp !== undefined &&
    opts?.currentTimestamp !== undefined &&
    opts.currentTimestamp - opts.prevTimestamp < 15_000
  ) {
    flags.push({ type: 'retry', severity: 'warn', label: 'RETRY' });
    score -= 10;
  }

  // ── Good signals ─────────────────────────────────────────────────────────────

  if (FILE_PATTERN.test(trimmed)) {
    flags.push({ type: 'has-file', severity: 'good', label: 'HAS FILE' });
    score += 15;
  }

  if (CODE_PATTERN.test(trimmed)) {
    flags.push({ type: 'has-code', severity: 'good', label: 'HAS CODE' });
    score += 15;
  }

  if (ERROR_PATTERN.test(trimmed)) {
    flags.push({ type: 'has-error', severity: 'good', label: 'HAS ERROR' });
    score += 20;
  }

  if (LIST_PATTERN.test(trimmed) || NUM_LIST.test(trimmed)) {
    flags.push({ type: 'structured', severity: 'good', label: 'STRUCTURED' });
    score += 10;
  }

  return { overall: Math.min(100, Math.max(0, score)), flags };
}
