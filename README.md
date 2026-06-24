# Sentinel

A real-time dashboard for monitoring your Claude Code sessions — token usage, costs, cache efficiency, and prompt quality, all in one place.

Built for developers who want visibility into what Claude is actually doing (and spending) while they work.

---

## What it does

Sentinel tails the JSONL session logs that Claude Code writes to `~/.claude/projects/` and streams live metrics to a local web dashboard. No API keys required, no data leaves your machine.

---

## Features

### Dashboard tab

**Current Chat**

The top card tracks your active Claude Code session in real time:

- **Project & session title** — pulled from the first user message of the session
- **Live badge** — shows session duration and total output tokens, updated every second
- **Token strip** — five-cell grid showing Fresh Input, Output, Cache Read, Cache Write, and Total tokens for the session
- **API Equivalent cost** — what you would pay if billed per-token via the Anthropic API directly (no subscription discount)
- **Subscription Cost** — your estimated actual cost, prorated against your monthly Claude plan. Set your plan (Pro / Max / Max Ultra) via the top-right dropdown; Sentinel uses the 5-hour window utilization from Anthropic's usage API to calculate your true share of the monthly fee
- **Savings line** — shows how much you saved vs. the API rate on your current plan, as a dollar amount and percentage
- **2×2 metric cards** — Output tokens · Cache hits · Cache hit rate % · Cache savings $
- **Token mix bar** — proportional breakdown of fresh / output / cache-write / cache-read tokens across the session, color-coded

**Recent Requests**

A live table of the last 30 API calls in the session:

| Column | Description |
|---|---|
| Time | Timestamp of the request |
| Model | Claude model used (e.g. sonnet-4-6) |
| Fresh Input | Uncached input tokens sent |
| Output | Tokens generated |
| Cache Hits | Tokens served from the context cache |
| Cost | API-equivalent cost of that single request |
| Status | `↩ cached` badge when the request was cache-served |

---

### Activity tab

**Usage Limits**

Reads your live Claude rate-limit utilization directly from Anthropic's internal usage API. On macOS, Sentinel decrypts the OAuth token stored in the Claude desktop app's Keychain safe storage — no manual login needed.

Shows two limit bars:

- **Requests (5h)** — percentage of the rolling 5-hour request window consumed, with a countdown to reset
- **Weekly (all models)** — percentage of the 7-day cumulative token budget consumed across all model tiers

Polls every 5 minutes. Color transitions from green → amber → red as limits approach 100%.

**Recent Sessions**

A scrollable list of all Claude Code sessions found in `~/.claude/projects/`, sorted by most recent activity:

- The current session is tagged with a green `live` badge
- Each row shows project name, session title, request count, and API-equivalent cost
- A mini proportional cost bar makes it easy to spot expensive sessions at a glance
- Sessions beyond 8 are hidden behind a **Show N more** toggle

**Hourly Breakdown**

A time-bucketed view of your last 6 active hours:

- Cost, output token count, and request count per hour
- Gradient bar chart normalized against your busiest hour

---

### Prompt Health tab

Four summary stat cards at the top (all filterable by project):

| Card | What it measures |
|---|---|
| Cache Hit Rate | % of all input tokens served from cache across every tracked session |
| Total Saved | Cumulative USD saved from cache hits vs. full input pricing |
| Avg Quality Score | Average prompt score (0–100) for sessions active since the server started |
| Wasted Cache Sessions | Sessions where cache was written but never read back (you paid write cost with no benefit) |

**Project filter**

When sessions span multiple projects, pill buttons appear in the section header — one per unique project plus an "All" default. Selecting a project filters both the session table and all four stat cards to that project only.

**Session table**

Per-session breakdown of cache efficiency and prompt quality, sorted by request count descending:

| Column | Description |
|---|---|
| Session | Session title and project name |
| Reqs | Total API requests in the session |
| Cache Hit | Hit rate bar and percentage |
| Prompts | Number of user prompts captured |
| Avg Score | Average prompt quality score (color-coded) |
| $ Saved | Cache savings for the session |
| Cache | Efficiency badge: excellent / good / poor / none |

Click any row to expand it and inspect individual prompts.

**Per-prompt view**

Each expanded prompt shows:

- Turn index (T1, T2, …)
- Score ring — colored circle displaying the 0–100 score
- Full prompt text (click to expand from preview)
- Word count and paired output tokens
- Quality flag pills (see scoring below)

---

### Prompt scoring

Every user prompt is scored 0–100 from a base of 60. Flags adjust the score and are color-coded red (error), amber (warning), or green (good).

**Penalty flags**

| Flag | Condition | Score change |
|---|---|---|
| `VAGUE` | Prompt is under 15 characters | −40 |
| `TOO SHORT` | Prompt is under 50 characters | −20 |
| `TOO LONG` | Prompt exceeds 4,000 characters | −10 |
| `NO VERB` | No recognized action verb found | −20 |
| `MULTI-TASK` | Three or more question marks | −15 |
| `RETRY` | Sent within 15 seconds of previous prompt | −10 |

**Bonus flags**

| Flag | Condition | Score change |
|---|---|---|
| `HAS FILE` | Contains a file path or extension | +15 |
| `HAS CODE` | Contains inline or fenced code | +15 |
| `HAS ERROR` | Contains an error message or stack trace | +20 |
| `STRUCTURED` | Contains a bullet or numbered list | +10 |

Score is clamped to 0–100. **75–100** is good, **50–74** is ok, **0–49** is poor. Scores are only recorded for sessions active since the server started.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, plain inline styles, Tailwind CSS v4 |
| Font | Geist Sans + Geist Mono |
| Real-time | Server-Sent Events (`/api/stream`) |
| Backend | Next.js Route Handlers (Node.js) |
| Data source | `~/.claude/projects/**/*.jsonl` (Claude Code session logs) |
| Persistence | None — in-memory only, resets on server restart |

No database, no external services, no telemetry.

---

## Requirements

- macOS (Linux should work but the usage-limits feature uses the macOS Keychain)
- [Claude Code](https://claude.ai/code) installed and used at least once (to generate session logs)
- Node.js 18+

---

## Quick start

```bash
git clone https://github.com/your-username/sentinel.git
cd sentinel
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard connects automatically — no configuration needed.

---

## How it works

1. **Watcher** (`lib/server/watcher.ts`) — on startup, scans `~/.claude/projects/` for JSONL files written in the last 24 hours. It watches those files with `fs.watchFile` and tails new lines as Claude Code writes them.

2. **Tracker** (`lib/server/tracker.ts`) — maintains an in-memory store of all `RequestRecord` objects parsed from the JSONL stream, keyed by session ID. Computes per-session and aggregate metrics on demand.

3. **Scorer** (`lib/server/scorer.ts`) — each user message is scored synchronously as it arrives. Scores and flags are stored alongside the prompt text.

4. **SSE stream** (`app/api/stream/route.ts`) — a `GET /api/stream` endpoint builds the full `DashboardData` payload and sends it to the client. An `EventEmitter` (`lib/server/events.ts`) fires an `update` event whenever the watcher processes new lines; the SSE handler broadcasts the rebuilt payload to all connected clients.

5. **Client** (`app/page.tsx`) — a single `useSSE` hook maintains the EventSource connection and feeds data to the three tab components. The UI re-renders on every SSE message.

---

## Plan settings

Click the **Pro** button in the top-right corner to configure your Claude subscription tier:

| Plan | Monthly | Est. request budget |
|---|---|---|
| Pro | $20 | 5,000 requests/month |
| Max | $100 | 25,000 requests/month |
| Max Ultra | $200 | 100,000 requests/month |

Once set, Sentinel calculates your *actual* cost per session by prorating your monthly fee against real usage data from the Anthropic usage API (5-hour window utilization × your share of tracked cost). Without a plan set, only the raw API-equivalent cost is shown.

Settings are persisted in `localStorage`.

---

## Caveats

- **In-memory only.** Restarting the dev server clears all tracked data. Sessions are re-scanned from the last 24 hours of JSONL files on each boot.
- **Prompt scoring starts fresh.** Prompts are scored as they arrive after the server starts. Historical prompts in existing JSONL files are not scored.
- **Usage limits require the Claude desktop app.** The Keychain token decryption only works on macOS with the Claude Electron app installed and signed in.
- **Pricing is approximate.** Token prices are hardcoded to mid-2025 Anthropic list prices. Check `lib/server/tracker.ts` (`MODEL_PRICING`) if you need to update them.

---

## License

MIT
