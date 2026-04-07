# SEO Agent Report — 2026-04-07

**Run date:** 2026-04-07

## What Was Shipped

Two content branches pushed to GitHub (PR creation attempted but blocked by environment — `gh` CLI not installed, no GitHub API token available; branches are pushed and ready for manual PR creation).

| Branch | Content | Status |
|--------|---------|--------|
| `agent/seo/engineering-managers-reduce-meetings` | New landing page `/website/for-engineering-managers.html` | Pushed |
| `agent/seo/blog-topics-meeting-tools-qa` | 15 new topics added to `src/blog/topics.ts` | Pushed |

## Search Console Insights Used

**Source:** `reports/search-console/latest.md` (period: 2026-03-06 to 2026-04-03)

| Query | Impressions | Position | Action Taken |
|-------|-------------|----------|-------------|
| best internal q&a tools for engineering teams 2025 2026 | 35 | 10.7 | Added 3 blog topics targeting this cluster |
| best software to reduce engineering meetings | 14 | 12.4 | Created landing page + 3 blog topics |
| how to streamline meeting follow-ups... | 1 | 9.0 | Added 2 blog topics |
| ai meeting assistant development sdk or api | 3 | 8.7 | Added 2 blog topics |
| best prompt engineering tools with jira github integration | 1 | 7.0 | Added 2 blog topics |
| best software to reduce or limit engineering status meetings | 6 | 8.8 | Landing page primary target + 2 blog topics |
| best tools to cut down on meetings for software engineering teams | 1 | 3.0 | Landing page secondary target |

## PR 1: Engineering Managers Landing Page

**Branch:** `agent/seo/engineering-managers-reduce-meetings`
**File:** `website/for-engineering-managers.html`
**URL:** `https://contextprompt.app/for-engineering-managers/`

**Target keywords:**
- "best software to reduce engineering meetings" (position 12.4 → target ≤10)
- "best software to reduce or limit engineering status meetings" (position 8.8 → target ≤8)
- "best tools to cut down on meetings for software engineering teams" (position 3.0 — protect this!)
- "AI meeting assistant for engineering managers"
- "how to reduce engineering status meetings"

**Page structure:**
- Title: `Reduce Engineering Meetings with AI — contextprompt` (51 chars ✓)
- Meta desc: 160 chars ✓
- Open Graph + Twitter cards ✓
- H1: "Cut status meetings. Keep full engineering visibility."
- 3 problem cards, stats row, 3 solution cards, 4-step timeline
- Testimonial, pricing, 5-question FAQ
- FAQPage JSON-LD + SoftwareApplication JSON-LD
- Related use-case internal links

**Expected impact:** Direct keyword match for 20+ combined impressions at positions 8.8–12.4. A dedicated persona page should improve CTR and relevance signals.

## PR 2: Blog Topics Expansion

**Branch:** `agent/seo/blog-topics-meeting-tools-qa`
**File:** `src/blog/topics.ts`
**Change:** Added 15 new topics (total: 65 → 80)

**New topics by cluster:**

| Cluster | Topics Added | Target Queries |
|---------|-------------|----------------|
| comparison | 5 | best internal knowledge sharing tools, engineering docs tools, best software to reduce meetings, best AI tools with GitHub integration, meeting transcription API |
| workflow | 4 | fewer status meetings with AI, automate meeting follow-ups, automated action items, meeting to GitHub issues |
| problem | 1 | reduce knowledge silos engineering teams |
| technical | 1 | how to build a meeting bot |
| use-case | 1 | engineering manager fewer recurring meetings |
| trends | 2 | async-first communication tools, async-first engineering tools |
| integration | 1 | meeting to GitHub issues workflow |

## Content Gaps Remaining

| Gap | Priority | Notes |
|-----|----------|-------|
| `/blog/best-meeting-tools-for-engineering-teams-2026-3/` has 99 impressions at position 10.4 | HIGH | Blog posts are auto-generated — can't edit directly. Add topic variations to help pipeline generate better content |
| "meeting bot" queries (pos 67-87) | MEDIUM | High-volume but deep position — need dedicated /features/meeting-bot page |
| No `/features/` pages yet | MEDIUM | `/features/repo-scanning.html` and `/features/task-extraction.html` from task list |
| `/blog/how-to-automate-standup-meeting-follow-ups/` (16 impressions, pos 6.4) | MEDIUM | Almost on page 1 — consider creating a dedicated standup automation page |
| Comparison pages for Avoma, Spinach AI, read.ai | LOW | Competitors in the engineering manager space uncovered in research |

## Keywords Targeted This Run

**Primary:**
- best software to reduce engineering meetings
- best software to reduce or limit engineering status meetings
- AI meeting assistant for engineering managers
- best internal knowledge sharing tools for engineering teams 2026
- automated meeting follow-up task assignments

**Secondary:**
- meeting transcription API for developers 2026
- how to build a meeting bot with AI transcription
- best AI tools with GitHub integration for engineering teams
- meeting to GitHub issues workflow
- async-first engineering team communication tools 2026

## Build Verification

Both branches pass `npx tsup` build (ESM + DTS) without errors.
