# contextprompt — Pitches

---

## Investor Pitch

AI is making execution cheaper, but it is creating a new bottleneck: **translation**.
Teams still spend too much time turning messy stakeholder feedback, product demos, brainstorming sessions, and review calls into clear implementation work.

**We turn conversations into project-aware execution plans.**

The system listens to meetings, understands what changes were requested, maps them to the real codebase or project structure, and produces reviewable, agent-ready tasks with confidence levels, likely files, ambiguities, and execution steps.

In a world where more work is delegated to AI, the bottleneck is no longer just writing code.
It is correctly translating human intent into trustworthy AI execution.

### One-liner

> We turn product and engineering conversations into project-aware execution plans for AI-assisted teams.

---

## Landing Page

### Headline

**Turn feedback calls into execution-ready work**

### Subheadline

Your team already decides what to build in meetings, demos, and review calls. We turn that conversation into project-aware tasks and agent-ready instructions, grounded in your real repo or project structure.

### Supporting copy

No more messy notes.
No more replaying calls.
No more manually translating vague feedback into something AI or developers can actually execute.

The tool listens to the conversation, extracts real implementation tasks, maps them to likely files or project areas, flags ambiguities, and outputs a clean execution plan your team can review or send to Claude/Cursor.

### Alternative headline

**From messy meeting feedback to repo-aware execution**

### Alternative subheadline

We convert product, design, and engineering conversations into structured implementation plans for AI-assisted work.

---

## Casual Explanation

It listens to a meeting or feedback call and turns what people said into actual execution tasks.

Instead of a developer or PM going back through notes like:

- "Wait, what exactly did they want changed?"
- "Which files does this probably touch?"
- "How do I phrase this for Claude or Cursor?"

The tool does that translation step for you. It figures out:

- What the real tasks are
- What parts of the codebase or project are likely involved
- What is clear vs uncertain
- What can be sent straight to an AI coding agent

The value is not "meeting notes." It is turning human feedback into usable execution.

---

## Demo Pitch (Boss / Internal Stakeholder)

### The Problem (30 seconds)

Every engineering team has the same broken workflow: you sit in a meeting, someone says "we need to refactor the auth flow" or "that button should also update the cart" — and then what? Someone writes a Jira ticket from memory, half the context is lost, and a developer spends 30 minutes just figuring out which files to touch.

AI coding tools like Claude Code and Cursor are incredible at *executing* — but they need well-structured input. The bottleneck isn't writing code anymore. It's translating messy human conversations into precise, actionable work.

### The Solution (30 seconds)

contextprompt sits in your meetings, listens to the conversation, understands your actual codebase, and produces a structured execution plan — with specific files, confidence levels, and tasks ready to hand directly to an AI coding agent.

It's a bridge from human intent to AI execution.

### Live Demo Flow (3-5 minutes)

**Step 1: Start recording**
```bash
contextprompt start --repos ~/our-app --verbose
```
- Show it connecting to Deepgram, scanning the repo
- Point out: "It's already indexing our codebase — function signatures, exports, file structure"

**Step 2: Simulate a meeting conversation**
- Have a short conversation (or play a pre-recorded clip) discussing 2-3 feature requests/bugs
- Example topics:
  - "We need to add rate limiting to the API endpoints"
  - "The dashboard should show task completion percentages"
  - "There's a bug where the transcript drops speaker labels after 30 minutes"

**Step 3: Stop and show extraction**
- Press Ctrl+C
- Show the spinner: "Extracting tasks with Claude..."
- Open the generated markdown file

**Step 4: Walk through the output**
- Show the **decisions** section (what was agreed on)
- Show the **tasks table** with:
  - Confidence levels (high/medium/low)
  - Specific file paths from the actual repo
  - Execution status (ready / review / clarify)
- Show **ambiguities** flagged automatically
- Key selling point: "These aren't generic tasks — they reference our actual files"

**Step 5: Execute with Claude Code**
```bash
claude "Read contextprompt-2026-03-14-103000.md and implement task T1"
```
- Show Claude Code reading the plan and starting implementation
- "Zero translation step. Meeting to code in one pipeline."

**Step 6: Bonus features (quick mentions)**
- `contextprompt issue <url>` — same structured analysis for GitHub issues
- `contextprompt dashboard` — web UI to browse past meetings and tasks
- Cost: ~$0.50 per hour-long meeting

### Why This Matters (30 seconds)

Right now, the gap between "what the team decided" and "what gets built" is filled by manual work — writing tickets, re-reading Slack threads, guessing which files matter. contextprompt eliminates that gap entirely.

For a team of 10 engineers, if each person saves even 30 minutes a week on meeting-to-task translation, that's 250 hours a year — at less than a dollar per meeting.

### Handling Objections

| Objection | Response |
|-----------|----------|
| "How accurate is it?" | "It uses your actual codebase to ground tasks — not hallucinated file paths. Confidence levels tell you what to trust vs. review." |
| "What about privacy?" | "Audio is streamed to Deepgram for transcription and Claude for extraction. No data stored externally. Local SQLite for history." |
| "Does it work with our stack?" | "Repo scanning uses TypeScript AST for TS/JS projects. File tree + README analysis works for any language." |
| "Cost?" | "~$0.50/meeting. Deepgram nova-3 + Claude Sonnet. Orders of magnitude cheaper than the engineering time it saves." |
| "Why not just use meeting notes + ChatGPT?" | "Two things: codebase awareness (it knows your actual files/exports) and structured output (confidence-calibrated, ready for AI agents)." |

### Demo Prep Checklist

- [ ] Have API keys configured (`contextprompt config`)
- [ ] Have a demo repo ready with recognizable file structure
- [ ] Pre-test the full flow end-to-end at least once
- [ ] Have a backup pre-generated markdown output in case of network issues
- [ ] Have the dashboard running as a visual wow-factor (`contextprompt dashboard`)
- [ ] Prepare 2-3 realistic meeting topics relevant to your boss's domain
- [ ] Test audio capture works on demo machine (macOS 14.2+ required for system audio)

---

## One-liners

- AI made coding faster. We make feedback executable.
- Turn meetings into project-aware execution plans.
- Where stakeholder feedback becomes agent-ready work.
- From conversation to execution, grounded in your real project.
- The missing layer between human feedback and AI implementation.
- **We turn product and engineering conversations into project-aware execution plans for AI-assisted teams.**
