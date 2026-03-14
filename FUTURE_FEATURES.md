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

### 1. Decision Memory & Historical Context Injection

**What:** After each meeting/issue analysis, extract and store structured entities: decisions made, architectural choices, ownership assignments. On subsequent analyses, inject relevant historical context into the Claude prompt.

**Why it's hard to compete with:** After 3 months of use, contextprompt has institutional memory that cannot be replicated without re-processing months of meetings. New competitors start at zero.

**Implementation:**
- New DB table `knowledge_entries`: `id`, `source_type` (meeting/issue), `source_id`, `entry_type` (decision/architecture/ownership/open_question), `content`, `context`, `related_files_json`, `created_at`, `superseded_by`
- After `extractTasks()` completes, run a second lightweight Claude call with a new `templates/knowledge-prompt.txt` to extract durable knowledge
- Modify `buildUserPrompt()` in `src/tasks/extractor.ts` to query recent knowledge entries and inject a `## Historical Context` section (capped at ~2k tokens)
- New dashboard page showing accumulated decisions timeline
- **Files:** `src/server/db.ts`, `src/tasks/extractor.ts`, new `templates/knowledge-prompt.txt`, new `Knowledge.tsx` page

### 2. Meeting-Issue Cross-Linking

**What:** When analyzing an issue, search past meeting transcripts for relevant discussion. When viewing a meeting, show which issues were discussed. Bidirectional links with evidence.

**Why valuable:** Teams discuss issues in meetings before/after filing them. Currently that context is lost. "Issue #42 was discussed in the March 5 meeting — Sarah said the priority should be low" is context no other tool surfaces.

**Implementation:**
- New DB table `cross_references`: `source_type`, `source_id`, `target_type`, `target_id`, `relevance_score`, `evidence_text`
- On meeting completion: regex-extract issue references (`#\d+`, "issue number X") from transcript
- On issue analysis: search `meetings.transcript` for issue number + title keywords + file path overlap. Include top 3 relevant meeting excerpts in Claude prompt
- UI sections in MeetingDetail and IssueDetail showing cross-links
- **Files:** `src/server/db.ts`, `src/tasks/extractor.ts`, `src/server/routes/issues.ts`, `MeetingDetail.tsx`, `IssueDetail.tsx`

### 3. Effort & Risk Estimation

**What:** For each task, estimate implementation effort (0.5h to 16h) and risk level (low/medium/high) with risk factors. Based on: file count, cross-repo span, module complexity (export count), test coverage existence.

**Why valuable:** Transforms contextprompt from "meeting notes" into "engineering planning tool." Enables sprint planning directly from output.

**Implementation:**
- Extend `Task` interface in `src/tasks/types.ts` with `estimated_effort`, `risk_level`, `risk_factors`
- Extend Zod schema in `src/tasks/extractor.ts`
- Add estimation rules to `templates/task-prompt.txt` (new section `### 10) Effort and risk estimation`)
- Render in `src/output/markdown.ts` and dashboard TaskCard
- Summary in meeting/issue detail: "Total: ~12h estimated, 2 high-risk tasks"

### 4. Auto-Create GitHub Issues from Tasks

**What:** "Create Issue" button on each task in the dashboard. Pre-formats title, proposed change, agent steps, file references, and ambiguities into a GitHub issue body. Also "Create Branch" to set up a feature branch with a `.contextprompt-task.md` file.

**Why valuable:** Closes the loop from meeting to tracked work. Teams build workflow around this and switching becomes painful.

**Implementation:**
- Extend `src/github/client.ts` with `createIssue()` and `createBranch()` using `gh` CLI
- New endpoint `POST /api/tasks/:id/create-issue`
- New `renderGithubIssueBody(task)` in `src/output/markdown.ts`
- Buttons in TaskCard component
- **Files:** `src/github/client.ts`, `src/server/routes/meetings.ts`, `src/output/markdown.ts`, `TaskCard.tsx`, `website/app/src/api.ts`

### 5. Task Status Tracking & Feedback Loop

**What:** After extraction, users mark tasks as done/in-progress/won't-do/was-wrong. Track accuracy over time. Eventually feed accuracy stats back into prompts.

**Why valuable:** Creates retention (task management layer) and data flywheel (accuracy improves with feedback).

**Implementation:**
- Add columns to `tasks` table: `user_status`, `user_status_updated_at`, `wrong_reason`
- New endpoint `PATCH /api/tasks/:id/status`
- Status dropdown in TaskCard
- Analytics on home page: "This week: 12 tasks, 8 done, 1 wrong"
- **Files:** `src/server/db.ts`, `src/server/routes/meetings.ts`, `TaskCard.tsx`, `Home.tsx`

### 6. Batch Issue Synthesis

**What:** "Analyze All Open Issues" for a repo. Individual analysis (parallel), then a synthesis pass identifying: duplicate work, conflicting requirements, natural grouping, shared file hotspots, suggested implementation sequence.

**Why valuable:** Single-issue analysis misses interdependencies. This is sprint planning intelligence that no tool offers.

**Implementation:**
- New endpoint `POST /api/issues/analyze-batch`
- New `templates/synthesis-prompt.txt` producing: `duplicate_groups`, `conflict_pairs`, `suggested_sequence`, `shared_hotspots`
- New DB table `batch_analyses`
- New dashboard view with issue dependency visualization
- **Files:** `src/server/routes/issues.ts`, `src/server/db.ts`, `src/tasks/extractor.ts`, new `IssueSynthesis.tsx`

### 7. Git Activity Awareness

**What:** Before issue analysis, check recent git activity (last 14 days) and open PRs for referenced files. Inject into Claude context to prevent stale suggestions.

**Implementation:**
- New `src/repo/activity.ts` using `git log` and `gh pr list`
- Inject `## Recent Code Activity` section in issue analysis prompt
- "Recently modified" badges on file references in dashboard

---

## Recommended Phasing

**Phase 1 — Immediate impact, low complexity:**
- Enhancement 3 (Effort/Risk) — prompt-only change + schema extension
- Enhancement 4 (Auto-Create GitHub Issues) — uses existing `gh` CLI

**Phase 2 — Compound value foundation:**
- Enhancement 5 (Task Tracking) — simple DB changes, creates retention
- Enhancement 1 (Decision Memory) — the core data flywheel

**Phase 3 — Analysis depth:**
- Enhancement 2 (Cross-Linking) — requires meeting history
- Enhancement 7 (Git Activity) — tactical quality improvement
- Enhancement 6 (Batch Synthesis) — highest complexity, highest ceiling
