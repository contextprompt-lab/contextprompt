# Product Health Report — 2026-04-09

**Day:** Thursday — health monitoring only

## Application Status
- Landing page: UNKNOWN — outbound HTTP blocked in sandbox
- Health endpoint: UNKNOWN — same sandbox restriction

## CI / GitHub Status
- GitHub MCP tools unavailable in this sandbox (no `gh` CLI, MCP tools not responding)
- Remote has **1 open PR: #4** (`[seo-agent] Engineering managers landing page + 5 new blog topics`, branch `agent/seo/for-engineering-managers`, created 2026-04-03) — not stale
- Two conversion branches pushed but no PRs created (tooling blocked):
  - `agent/convert/login-value-props` (2026-04-01)
  - `agent/convert/first-meeting-empty-state` (2026-04-08)

## TypeScript
- Status: **PASS — 0 errors**

## Test Suite
- Status: **PASS** — 107/107 tests across 8 test files (1.91s)

## Build
- Status: **PASS** — Vite build succeeded (617 kB app chunk — existing warning)
- Note: `website/` has a separate `package.json`; `npm install` must be run in `website/` before `npm run build` succeeds in a fresh sandbox

## Dependency Audit
- Skipped today (Thursday). Outstanding vulnerabilities:

| Package | Severity | Issue | Days Outstanding |
|---------|----------|-------|-----------------|
| path-to-regexp | High | ReDoS via backtracking | ~10 days |
| picomatch | High | ReDoS + method injection | ~10 days |

Both are transitive dependencies. Fix available via `npm audit fix` in root and `cd website && npm audit fix`. **Still pending — recommend addressing on next Monday.**

## Search Console Summary (data through 2026-03-30)
- Total impressions: 78 | Clicks: 2 (/ and /privacy/) | 0% average CTR
- Top underperforming pages (impressions, 0% CTR):
  - `/blog/best-meeting-tools-for-engineering-teams-2026-3/` — 71 impressions, pos 9.5 ← highest volume
  - `/blog/ai-meeting-bot-for-engineering-teams-2/` — 34 impressions, pos 54.7
  - `/blog/best-meeting-tools-for-engineering-teams-2026-2/` — 28 impressions, pos 8.8
  - `/blog/how-to-automate-standup-meeting-follow-ups/` — 16 impressions, pos 6.4
- Homepage `/`: 1 click, 33.3% CTR, position 2.0 — performing well

## Bugs Found
- None

## Recommendations
1. **Create PRs manually** for pushed conversion branches — `gh` CLI and MCP GitHub tools unavailable in sandbox
2. **`npm audit fix`** — 3 high-severity vulns outstanding for ~10 days; run in both root and `website/` on Monday
3. **Next Wednesday conversion target:** Blog page `/blog/best-meeting-tools-for-engineering-teams-2026-3/` (71 impressions, pos 9.5) is the highest-traffic page with 0% CTR — add in-article CTA or improve title/meta to increase clicks
