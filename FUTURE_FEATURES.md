# contextprompt — Future Features

## Current Strengths (Moat)

1. **Repo-aware extraction** — AST parsing + token-budgeted repo maps mean tasks map to real files, not generic summaries
2. **Calibrated confidence** — ready/review/clarify with reasoning; honest about uncertainty
3. **Agent-ready output** — copy-paste execution blocks for Claude Code
4. **Cross-repo awareness** — frontend/backend contract detection across multiple repos
5. **Three ingestion modes** — local audio, browser mic, Recall.ai bot
6. **The 230-line system prompt** — heavily iterated, hard to replicate without extensive testing

## Primary Weakness: Everything is Stateless

Meeting 50 gets the exact same context as meeting 1. No accumulated decisions, no team patterns, no cross-meeting intelligence.

---

## Proposed Enhancements

### 1. Per-User Task Filtering in Shared Meetings ⚡ HIGH IMPORTANCE

**What:** In a standup with multiple devs each running their own contextprompt bot, each bot should only extract tasks relevant to *its* user. Add a user identity concept so the bot knows "I am Alice" and uses that — combined with existing repo context and speaker diarization — to filter tasks to what's actually yours.

**Why it matters:** This is the unlock for team adoption. Without it, every bot in a shared meeting produces identical output, making multi-user standups pointless. With it, contextprompt becomes a personal engineering assistant that understands your role in the team.

**Three signals for filtering:**
1. **Identity** — `user_name` config tells the bot who it belongs to. The prompt focuses on tasks assigned to, volunteered by, or discussed in relation to that person
2. **Repo context** (already exists) — each user's bot scans *their* repos, naturally biasing file-matching toward their domain
3. **Speaker diarization** (already exists) — Recall.ai returns speaker labels, so Claude can distinguish "Alice said she'll do it" from "Bob said he'll do it"

**Implementation:**
- Add `user_name` field to session/bot config (dashboard meeting settings + CLI `--me` flag)
- New section in `templates/task-prompt.txt`: "You are extracting tasks for {user_name}. Focus on tasks explicitly assigned to them, volunteered by them, or relevant to their connected repos. Ignore tasks clearly owned by others unless they create dependencies."
- Optional: team roster context (`--team "Alice:frontend,auth Bob:backend,infra"`) so Claude can reason about implicit assignment ("the frontend person should..." → that's Alice)
- Handle edge cases: shared repos (use speaker identity to disambiguate), implicit/unassigned tasks (extract with `clarify` status), cross-cutting tasks (extract for both users with scoped descriptions)
- **Files:** `templates/task-prompt.txt`, `src/tasks/extractor.ts`, `bin/commands/start.ts`, `src/server/routes/meetings.ts`, bot config schema

### 2. Decision Memory & Historical Context Injection

**What:** After each meeting/issue analysis, extract and store structured entities: decisions made, architectural choices, ownership assignments. On subsequent analyses, inject relevant historical context into the Claude prompt.

**Why it's hard to compete with:** After 3 months of use, contextprompt has institutional memory that cannot be replicated without re-processing months of meetings. New competitors start at zero.

**Implementation:**
- New DB table `knowledge_entries`: `id`, `source_type` (meeting/issue), `source_id`, `entry_type` (decision/architecture/ownership/open_question), `content`, `context`, `related_files_json`, `created_at`, `superseded_by`
- After `extractTasks()` completes, run a second lightweight Claude call with a new `templates/knowledge-prompt.txt` to extract durable knowledge
- Modify `buildUserPrompt()` in `src/tasks/extractor.ts` to query recent knowledge entries and inject a `## Historical Context` section (capped at ~2k tokens)
- New dashboard page showing accumulated decisions timeline
- **Files:** `src/server/db.ts`, `src/tasks/extractor.ts`, new `templates/knowledge-prompt.txt`, new `Knowledge.tsx` page

### 3. Meeting-Issue Cross-Linking

**What:** When analyzing an issue, search past meeting transcripts for relevant discussion. When viewing a meeting, show which issues were discussed. Bidirectional links with evidence.

**Why valuable:** Teams discuss issues in meetings before/after filing them. Currently that context is lost. "Issue #42 was discussed in the March 5 meeting — Sarah said the priority should be low" is context no other tool surfaces.

**Implementation:**
- New DB table `cross_references`: `source_type`, `source_id`, `target_type`, `target_id`, `relevance_score`, `evidence_text`
- On meeting completion: regex-extract issue references (`#\d+`, "issue number X") from transcript
- On issue analysis: search `meetings.transcript` for issue number + title keywords + file path overlap. Include top 3 relevant meeting excerpts in Claude prompt
- UI sections in MeetingDetail and IssueDetail showing cross-links
- **Files:** `src/server/db.ts`, `src/tasks/extractor.ts`, `src/server/routes/issues.ts`, `MeetingDetail.tsx`, `IssueDetail.tsx`

### 4. Effort & Risk Estimation

**What:** For each task, estimate implementation effort (0.5h to 16h) and risk level (low/medium/high) with risk factors. Based on: file count, cross-repo span, module complexity (export count), test coverage existence.

**Why valuable:** Transforms contextprompt from "meeting notes" into "engineering planning tool." Enables sprint planning directly from output.

**Implementation:**
- Extend `Task` interface in `src/tasks/types.ts` with `estimated_effort`, `risk_level`, `risk_factors`
- Extend Zod schema in `src/tasks/extractor.ts`
- Add estimation rules to `templates/task-prompt.txt` (new section `### 10) Effort and risk estimation`)
- Render in `src/output/markdown.ts` and dashboard TaskCard
- Summary in meeting/issue detail: "Total: ~12h estimated, 2 high-risk tasks"

### 5. Auto-Create GitHub Issues from Tasks

**What:** "Create Issue" button on each task in the dashboard. Pre-formats title, proposed change, agent steps, file references, and ambiguities into a GitHub issue body. Also "Create Branch" to set up a feature branch with a `.contextprompt-task.md` file.

**Why valuable:** Closes the loop from meeting to tracked work. Teams build workflow around this and switching becomes painful.

**Implementation:**
- Extend `src/github/client.ts` with `createIssue()` and `createBranch()` using `gh` CLI
- New endpoint `POST /api/tasks/:id/create-issue`
- New `renderGithubIssueBody(task)` in `src/output/markdown.ts`
- Buttons in TaskCard component
- **Files:** `src/github/client.ts`, `src/server/routes/meetings.ts`, `src/output/markdown.ts`, `TaskCard.tsx`, `website/app/src/api.ts`

### 6. Task Status Tracking & Feedback Loop

**What:** After extraction, users mark tasks as done/in-progress/won't-do/was-wrong. Track accuracy over time. Eventually feed accuracy stats back into prompts.

**Why valuable:** Creates retention (task management layer) and data flywheel (accuracy improves with feedback).

**Implementation:**
- Add columns to `tasks` table: `user_status`, `user_status_updated_at`, `wrong_reason`
- New endpoint `PATCH /api/tasks/:id/status`
- Status dropdown in TaskCard
- Analytics on home page: "This week: 12 tasks, 8 done, 1 wrong"
- **Files:** `src/server/db.ts`, `src/server/routes/meetings.ts`, `TaskCard.tsx`, `Home.tsx`

### 7. Batch Issue Synthesis

**What:** "Analyze All Open Issues" for a repo. Individual analysis (parallel), then a synthesis pass identifying: duplicate work, conflicting requirements, natural grouping, shared file hotspots, suggested implementation sequence.

**Why valuable:** Single-issue analysis misses interdependencies. This is sprint planning intelligence that no tool offers.

**Implementation:**
- New endpoint `POST /api/issues/analyze-batch`
- New `templates/synthesis-prompt.txt` producing: `duplicate_groups`, `conflict_pairs`, `suggested_sequence`, `shared_hotspots`
- New DB table `batch_analyses`
- New dashboard view with issue dependency visualization
- **Files:** `src/server/routes/issues.ts`, `src/server/db.ts`, `src/tasks/extractor.ts`, new `IssueSynthesis.tsx`

### 8. New Feature / Greenfield Project Support ⚡ HIGH IMPORTANCE

**What:** Currently, the entire pipeline is built around mapping tasks to *existing* files. When a meeting discusses building something new ("let's add a notifications system", "we need a new onboarding flow"), the system degrades — file search finds nothing, confidence drops to low, and the task lands in `needs_clarification` with sparse file references. There's no concept of "create new file at X path" in the task schema.

**The gap:**
- `high_confidence_files` and `possible_related_files` only reference existing files — no way to express "create `src/notifications/NotificationService.ts`"
- The system prompt rule "NEVER guess file paths" prevents Claude from suggesting where new code should live, even when the repo structure makes it obvious
- Multi-stage file search (bigrams, keywords, content search) returns empty for truly new features
- New features get the same low-confidence treatment as vague/incomplete tasks, even when the meeting discussion was perfectly clear

**What it should do:**
- Recognize when a task requires new files vs. editing existing ones
- Suggest file paths for new code based on repo conventions (e.g., if components live in `src/components/`, suggest `src/components/Notifications.tsx`)
- Include scaffolding steps in `agent_steps` (create directory, create file, wire into router/exports)
- Reference existing patterns as templates ("follow the same structure as `src/components/Settings.tsx`")
- Maintain high confidence when the *intent* is clear even if no files exist yet

**Implementation:**
- Add `new_files` field to `Task` interface: `{ suggested_path: string, reason: string, based_on: string }[]`
- Extend Zod schema in `src/tasks/extractor.ts` to validate `new_files`
- Update system prompt with new section: "When a task requires creating new code that doesn't exist yet, suggest file paths based on the repo's existing directory structure and naming conventions. Reference similar existing files as templates."
- Relax the "NEVER guess file paths" rule to allow *suggested* paths for new files (clearly marked as suggestions, not confirmed)
- Render new files section in `src/output/markdown.ts` and agent execution blocks
- Update confidence calibration: a clear new feature request with obvious repo placement should be `medium` or `high`, not `low`
- **Files:** `src/tasks/types.ts`, `src/tasks/extractor.ts`, `templates/task-prompt.txt`, `src/output/markdown.ts`, `website/app/src/components/TaskCard.tsx`

### 9. Git Activity Awareness

**What:** Before issue analysis, check recent git activity (last 14 days) and open PRs for referenced files. Inject into Claude context to prevent stale suggestions.

**Implementation:**
- New `src/repo/activity.ts` using `git log` and `gh pr list`
- Inject `## Recent Code Activity` section in issue analysis prompt
- "Recently modified" badges on file references in dashboard

---

## Recommended Phasing

**Phase 0 — Top priority, team adoption unlock:**
- Enhancement 1 (Per-User Filtering) — config + prompt change, leverages existing repo context + speaker diarization
- Enhancement 8 (New Feature / Greenfield Support) — schema + prompt change, fixes a fundamental gap in task extraction

**Phase 1 — Immediate impact, low complexity:**
- Enhancement 4 (Effort/Risk) — prompt-only change + schema extension
- Enhancement 5 (Auto-Create GitHub Issues) — uses existing `gh` CLI

**Phase 2 — Compound value foundation:**
- Enhancement 6 (Task Tracking) — simple DB changes, creates retention
- Enhancement 2 (Decision Memory) — the core data flywheel

**Phase 3 — Analysis depth:**
- Enhancement 3 (Cross-Linking) — requires meeting history
- Enhancement 9 (Git Activity) — tactical quality improvement
- Enhancement 7 (Batch Synthesis) — highest complexity, highest ceiling
