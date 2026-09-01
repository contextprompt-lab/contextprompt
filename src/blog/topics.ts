import { PostStyle } from './types.js';

export interface SeoTopic {
  query: string;
  slug: string;
  cluster: string;
  contentType: 'pillar' | 'high-intent' | 'supporting';
  postStyle: PostStyle;
}

export const seoTopics: SeoTopic[] = [
  // --- Product keywords ---
  { query: 'AI meeting assistant for developers', slug: 'ai-meeting-assistant-for-developers', cluster: 'product', contentType: 'pillar', postStyle: 'product' },
  { query: 'meeting transcription to coding tasks', slug: 'meeting-transcription-to-coding-tasks', cluster: 'product', contentType: 'pillar', postStyle: 'product' },
  { query: 'repo-aware task extraction', slug: 'repo-aware-task-extraction', cluster: 'product', contentType: 'high-intent', postStyle: 'product' },
  { query: 'AI meeting bot for engineering teams', slug: 'ai-meeting-bot-engineering-teams', cluster: 'product', contentType: 'high-intent', postStyle: 'product' },
  { query: 'automated meeting notes for developers', slug: 'automated-meeting-notes-developers', cluster: 'product', contentType: 'high-intent', postStyle: 'product' },
  { query: 'meeting to task converter AI', slug: 'meeting-to-task-converter-ai', cluster: 'product', contentType: 'supporting', postStyle: 'product' },
  { query: 'extract action items from meetings automatically', slug: 'extract-action-items-meetings', cluster: 'product', contentType: 'high-intent', postStyle: 'product' },

  // --- Comparison posts ---
  { query: 'contextprompt vs Otter ai for developers', slug: 'contextprompt-vs-otter-ai', cluster: 'comparison', contentType: 'high-intent', postStyle: 'product' },
  { query: 'contextprompt vs Fireflies ai', slug: 'contextprompt-vs-fireflies', cluster: 'comparison', contentType: 'high-intent', postStyle: 'product' },
  { query: 'best meeting tools for engineering teams 2026', slug: 'best-meeting-tools-engineering-teams-2026', cluster: 'comparison', contentType: 'pillar', postStyle: 'product' },
  { query: 'Otter ai alternative for developers', slug: 'otter-ai-alternative-developers', cluster: 'comparison', contentType: 'high-intent', postStyle: 'product' },
  { query: 'Fireflies alternative for coding teams', slug: 'fireflies-alternative-coding-teams', cluster: 'comparison', contentType: 'high-intent', postStyle: 'product' },
  { query: 'meeting transcription tools compared 2026', slug: 'meeting-transcription-tools-compared', cluster: 'comparison', contentType: 'supporting', postStyle: 'product' },
  { query: 'best AI note taker for software engineers', slug: 'best-ai-note-taker-software-engineers', cluster: 'comparison', contentType: 'high-intent', postStyle: 'product' },

  // --- Workflow guides ---
  { query: 'using Claude Code with meeting context', slug: 'using-claude-code-meeting-context', cluster: 'workflow', contentType: 'pillar', postStyle: 'product' },
  { query: 'meeting notes to GitHub issues automated', slug: 'meeting-notes-github-issues-automated', cluster: 'workflow', contentType: 'high-intent', postStyle: 'product' },
  { query: 'sprint planning with AI tools', slug: 'sprint-planning-ai-tools', cluster: 'workflow', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'how to automate standup meeting follow-ups', slug: 'automate-standup-meeting-follow-ups', cluster: 'workflow', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'developer workflow automation with AI', slug: 'developer-workflow-automation-ai', cluster: 'workflow', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'how AI meeting tools help developers ship faster', slug: 'ai-meeting-tools-ship-faster', cluster: 'workflow', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'AI powered engineering team workflows', slug: 'ai-powered-engineering-team-workflows', cluster: 'workflow', contentType: 'pillar', postStyle: 'editorial' },
  { query: 'how to turn product meetings into dev tasks', slug: 'product-meetings-to-dev-tasks', cluster: 'workflow', contentType: 'high-intent', postStyle: 'product' },

  // --- Technical deep-dives ---
  { query: 'how repo-aware extraction works', slug: 'how-repo-aware-extraction-works', cluster: 'technical', contentType: 'pillar', postStyle: 'product' },
  { query: 'AST parsing for code intelligence', slug: 'ast-parsing-code-intelligence', cluster: 'technical', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'AI transcript chunking and deduplication', slug: 'ai-transcript-chunking-deduplication', cluster: 'technical', contentType: 'supporting', postStyle: 'product' },
  { query: 'building AI tools that understand codebases', slug: 'building-ai-tools-understand-codebases', cluster: 'technical', contentType: 'pillar', postStyle: 'editorial' },
  { query: 'how AI maps meeting discussions to code files', slug: 'ai-maps-meeting-discussions-code-files', cluster: 'technical', contentType: 'high-intent', postStyle: 'product' },
  { query: 'token budgeting for LLM code analysis', slug: 'token-budgeting-llm-code-analysis', cluster: 'technical', contentType: 'supporting', postStyle: 'editorial' },

  // --- Thought leadership ---
  { query: 'the meeting-to-code gap', slug: 'meeting-to-code-gap', cluster: 'thought-leadership', contentType: 'pillar', postStyle: 'editorial' },
  { query: 'why developers hate meeting notes', slug: 'why-developers-hate-meeting-notes', cluster: 'thought-leadership', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'AI pair programming from meeting context', slug: 'ai-pair-programming-meeting-context', cluster: 'thought-leadership', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'the future of engineering meetings', slug: 'future-of-engineering-meetings', cluster: 'thought-leadership', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'why meeting summaries are not enough for developers', slug: 'meeting-summaries-not-enough-developers', cluster: 'thought-leadership', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'developer productivity and meetings', slug: 'developer-productivity-meetings', cluster: 'thought-leadership', contentType: 'high-intent', postStyle: 'editorial' },

  // --- Integration guides ---
  { query: 'Zoom meeting to coding tasks workflow', slug: 'zoom-meeting-coding-tasks', cluster: 'integration', contentType: 'high-intent', postStyle: 'product' },
  { query: 'Google Meet for engineering teams productivity', slug: 'google-meet-engineering-teams', cluster: 'integration', contentType: 'high-intent', postStyle: 'product' },
  { query: 'Slack huddles to coding tasks', slug: 'slack-huddles-coding-tasks', cluster: 'integration', contentType: 'high-intent', postStyle: 'product' },
  { query: 'Microsoft Teams AI assistant for devs', slug: 'microsoft-teams-ai-assistant-devs', cluster: 'integration', contentType: 'high-intent', postStyle: 'product' },

  // --- AI/dev trends ---
  { query: 'generative AI for software planning', slug: 'generative-ai-software-planning', cluster: 'trends', contentType: 'pillar', postStyle: 'editorial' },
  { query: 'how AI is changing sprint planning', slug: 'ai-changing-sprint-planning', cluster: 'trends', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'LLM-powered developer workflows', slug: 'llm-powered-developer-workflows', cluster: 'trends', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'AI tools every developer should use in 2026', slug: 'ai-tools-developers-2026', cluster: 'trends', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'the rise of AI coding assistants', slug: 'rise-of-ai-coding-assistants', cluster: 'trends', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'developer experience and AI automation', slug: 'developer-experience-ai-automation', cluster: 'trends', contentType: 'supporting', postStyle: 'editorial' },

  // --- Problem-focused ---
  { query: 'developers waste time in meetings', slug: 'developers-waste-time-meetings', cluster: 'problem', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'how to stop losing context after meetings', slug: 'stop-losing-context-after-meetings', cluster: 'problem', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'meeting notes never turn into code', slug: 'meeting-notes-never-turn-into-code', cluster: 'problem', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'why engineering meetings feel unproductive', slug: 'engineering-meetings-unproductive', cluster: 'problem', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'context switching after meetings costs engineering hours', slug: 'context-switching-meetings-engineering', cluster: 'problem', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'the hidden cost of manual task creation from meetings', slug: 'hidden-cost-manual-task-creation', cluster: 'problem', contentType: 'supporting', postStyle: 'editorial' },

  // --- Use case specific ---
  { query: 'AI for remote engineering team meetings', slug: 'ai-remote-engineering-team-meetings', cluster: 'use-case', contentType: 'high-intent', postStyle: 'product' },
  { query: 'automated sprint retrospective action items', slug: 'automated-sprint-retrospective-actions', cluster: 'use-case', contentType: 'supporting', postStyle: 'product' },
  { query: 'technical debt discussions to tasks', slug: 'technical-debt-discussions-tasks', cluster: 'use-case', contentType: 'supporting', postStyle: 'product' },
  { query: 'architecture decision records from meetings', slug: 'architecture-decision-records-meetings', cluster: 'use-case', contentType: 'supporting', postStyle: 'product' },
  { query: 'product owner developer communication AI', slug: 'product-owner-developer-communication-ai', cluster: 'use-case', contentType: 'high-intent', postStyle: 'product' },
  { query: 'onboarding new developers with meeting context', slug: 'onboarding-developers-meeting-context', cluster: 'use-case', contentType: 'supporting', postStyle: 'product' },

  // --- Search Console opportunity topics (2026-04-17) ---
  // "best internal q&a tools for engineering teams 2025 2026" — 35 impressions, pos 10.7
  { query: 'best internal tools for software engineering teams 2026', slug: 'best-internal-tools-engineering-teams-2026', cluster: 'comparison', contentType: 'pillar', postStyle: 'editorial' },
  // "best software to reduce engineering meetings" — 19 impressions, pos 13.7
  { query: 'best software to reduce engineering status meetings', slug: 'best-software-reduce-engineering-meetings', cluster: 'problem', contentType: 'high-intent', postStyle: 'editorial' },
  // "engineering ai notetaker" — 9 impressions, pos 32.9
  { query: 'best AI notetaker for engineering teams', slug: 'best-ai-notetaker-engineering-teams', cluster: 'comparison', contentType: 'high-intent', postStyle: 'editorial' },
  // "leading AI meeting assistants for developers" — pos 7.0 with impressions
  { query: 'leading AI meeting assistants for developers compared', slug: 'leading-ai-meeting-assistants-developers', cluster: 'comparison', contentType: 'high-intent', postStyle: 'editorial' },
  // "best prompt engineering tools with jira github integration" — pos 7.0
  { query: 'best AI tools for developers with Jira and GitHub integration 2026', slug: 'best-ai-tools-jira-github-integration-2026', cluster: 'integration', contentType: 'high-intent', postStyle: 'editorial' },

  // --- Editorial: general developer productivity ---
  { query: 'how to write better technical meeting agendas', slug: 'better-technical-meeting-agendas', cluster: 'workflow', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'async vs sync communication for engineering teams', slug: 'async-vs-sync-communication-engineering', cluster: 'thought-leadership', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'measuring developer productivity without surveillance', slug: 'measuring-developer-productivity', cluster: 'trends', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'how engineering teams run effective standups', slug: 'effective-standups-engineering-teams', cluster: 'workflow', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'technical debt prioritization strategies', slug: 'technical-debt-prioritization', cluster: 'problem', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'code review best practices for remote teams', slug: 'code-review-best-practices-remote', cluster: 'workflow', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'how to document architecture decisions', slug: 'document-architecture-decisions', cluster: 'use-case', contentType: 'supporting', postStyle: 'editorial' },
  { query: 'reducing meeting load for engineering teams', slug: 'reducing-meeting-load-engineering', cluster: 'problem', contentType: 'high-intent', postStyle: 'editorial' },
  { query: 'AI code generation tools compared 2026', slug: 'ai-code-generation-tools-compared-2026', cluster: 'trends', contentType: 'pillar', postStyle: 'editorial' },
  { query: 'building a developer experience team', slug: 'building-developer-experience-team', cluster: 'trends', contentType: 'supporting', postStyle: 'editorial' },
];
