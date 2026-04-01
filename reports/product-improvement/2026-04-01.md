# Product Improvement Report — 2026-04-01

**Type:** Conversion (Wednesday)
**Branch:** `agent/convert/login-value-props`
**Status:** Branch pushed, PR needs manual creation

## Problem

The login page (`website/app/src/pages/Login.tsx`) was a conversion dead-end:
- Title: "contextprompt"
- Subtitle: "Turn meetings into repo-aware coding tasks" (generic, no specifics)
- One button: "Sign in with Google"
- Nothing else

Every visitor — whether arriving from the homepage (position 2, 33% CTR), a blog post, or a use-case page — hit this page with zero context about what they're signing up for, what will happen after they authenticate, or whether it's free. High abandonment risk.

## Change

Rewrote `Login.tsx` to add:

1. **Stronger headline** — "Stop writing meeting notes. Start shipping code." (developer-focused pain point)

2. **Trust signal** — "Free to start · No credit card required" immediately below the CTA button

3. **3 value prop bullets** with check icons:
   - "Bot joins your meeting and records automatically"
   - "Scans your repos to understand your codebase"
   - "Extracts actionable coding tasks from the conversation"

4. **"How it works" mini-flow** — 3 numbered steps:
   - Paste a meeting link → Bot joins and records → Get structured coding tasks

## Rationale

Search Console shows the homepage converts at 33% CTR from position 2 — meaning the homepage headline/meta is working. The bottleneck is between homepage → login → signup. Adding clarity at the login gate directly impacts the signup rate.

The value prop bullets translate the technical product ("Recall.ai bot + Claude extraction") into user benefits ("meeting notes → coding tasks automatically").

## Diff Size
- 64 lines added, 3 removed in `Login.tsx` — well within 150-line limit

## Test Results
- 107/107 tests pass
- Vite build succeeds

## Expected Impact
- Reduce signup abandonment on the login page
- Set clearer expectations → better activation (users know what to do after signing in)
- "Free to start" trust signal removes purchase hesitation at signup gate
