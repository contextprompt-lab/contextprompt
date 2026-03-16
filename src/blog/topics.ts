export interface SeoTopic {
  query: string;
  slug: string;
  cluster: string;
  contentType: 'pillar' | 'high-intent' | 'supporting';
}

export const seoTopics: SeoTopic[] = [
  // --- Product keywords ---
  { query: 'AI meeting assistant for developers', slug: 'ai-meeting-assistant-for-developers', cluster: 'product', contentType: 'pillar' },
  { query: 'meeting transcription to coding tasks', slug: 'meeting-transcription-to-coding-tasks', cluster: 'product', contentType: 'pillar' },
  { query: 'repo-aware task extraction', slug: 'repo-aware-task-extraction', cluster: 'product', contentType: 'high-intent' },
  { query: 'turn meetings into Jira tickets automatically', slug: 'turn-meetings-into-jira-tickets', cluster: 'product', contentType: 'high-intent' },
  { query: 'AI meeting bot for engineering teams', slug: 'ai-meeting-bot-engineering-teams', cluster: 'product', contentType: 'high-intent' },
  { query: 'automated meeting notes for developers', slug: 'automated-meeting-notes-developers', cluster: 'product', contentType: 'high-intent' },
  { query: 'meeting to task converter AI', slug: 'meeting-to-task-converter-ai', cluster: 'product', contentType: 'supporting' },
  { query: 'extract action items from meetings automatically', slug: 'extract-action-items-meetings', cluster: 'product', contentType: 'high-intent' },

  // --- Comparison posts ---
  { query: 'contextprompt vs Otter ai for developers', slug: 'contextprompt-vs-otter-ai', cluster: 'comparison', contentType: 'high-intent' },
  { query: 'contextprompt vs Fireflies ai', slug: 'contextprompt-vs-fireflies', cluster: 'comparison', contentType: 'high-intent' },
  { query: 'best meeting tools for engineering teams 2026', slug: 'best-meeting-tools-engineering-teams-2026', cluster: 'comparison', contentType: 'pillar' },
  { query: 'Otter ai alternative for developers', slug: 'otter-ai-alternative-developers', cluster: 'comparison', contentType: 'high-intent' },
  { query: 'Fireflies alternative for coding teams', slug: 'fireflies-alternative-coding-teams', cluster: 'comparison', contentType: 'high-intent' },
  { query: 'meeting transcription tools compared 2026', slug: 'meeting-transcription-tools-compared', cluster: 'comparison', contentType: 'supporting' },
  { query: 'best AI note taker for software engineers', slug: 'best-ai-note-taker-software-engineers', cluster: 'comparison', contentType: 'high-intent' },

  // --- Workflow guides ---
  { query: 'using Claude Code with meeting context', slug: 'using-claude-code-meeting-context', cluster: 'workflow', contentType: 'pillar' },
  { query: 'meeting notes to GitHub issues automated', slug: 'meeting-notes-github-issues-automated', cluster: 'workflow', contentType: 'high-intent' },
  { query: 'sprint planning with AI tools', slug: 'sprint-planning-ai-tools', cluster: 'workflow', contentType: 'high-intent' },
  { query: 'how to automate standup meeting follow-ups', slug: 'automate-standup-meeting-follow-ups', cluster: 'workflow', contentType: 'high-intent' },
  { query: 'developer workflow automation with AI', slug: 'developer-workflow-automation-ai', cluster: 'workflow', contentType: 'supporting' },
  { query: 'from meeting to pull request with AI', slug: 'meeting-to-pull-request-ai', cluster: 'workflow', contentType: 'supporting' },
  { query: 'AI powered engineering team workflows', slug: 'ai-powered-engineering-team-workflows', cluster: 'workflow', contentType: 'pillar' },
  { query: 'how to turn product meetings into dev tasks', slug: 'product-meetings-to-dev-tasks', cluster: 'workflow', contentType: 'high-intent' },

  // --- Technical deep-dives ---
  { query: 'how repo-aware extraction works', slug: 'how-repo-aware-extraction-works', cluster: 'technical', contentType: 'pillar' },
  { query: 'AST parsing for code intelligence', slug: 'ast-parsing-code-intelligence', cluster: 'technical', contentType: 'supporting' },
  { query: 'AI transcript chunking and deduplication', slug: 'ai-transcript-chunking-deduplication', cluster: 'technical', contentType: 'supporting' },
  { query: 'building AI tools that understand codebases', slug: 'building-ai-tools-understand-codebases', cluster: 'technical', contentType: 'pillar' },
  { query: 'how AI maps meeting discussions to code files', slug: 'ai-maps-meeting-discussions-code-files', cluster: 'technical', contentType: 'high-intent' },
  { query: 'token budgeting for LLM code analysis', slug: 'token-budgeting-llm-code-analysis', cluster: 'technical', contentType: 'supporting' },

  // --- Thought leadership ---
  { query: 'the meeting-to-code gap', slug: 'meeting-to-code-gap', cluster: 'thought-leadership', contentType: 'pillar' },
  { query: 'why developers hate meeting notes', slug: 'why-developers-hate-meeting-notes', cluster: 'thought-leadership', contentType: 'high-intent' },
  { query: 'AI pair programming from meeting context', slug: 'ai-pair-programming-meeting-context', cluster: 'thought-leadership', contentType: 'supporting' },
  { query: 'the future of engineering meetings', slug: 'future-of-engineering-meetings', cluster: 'thought-leadership', contentType: 'supporting' },
  { query: 'why meeting summaries are not enough for developers', slug: 'meeting-summaries-not-enough-developers', cluster: 'thought-leadership', contentType: 'high-intent' },
  { query: 'developer productivity and meetings', slug: 'developer-productivity-meetings', cluster: 'thought-leadership', contentType: 'high-intent' },

  // --- Integration guides ---
  { query: 'Zoom meeting to coding tasks workflow', slug: 'zoom-meeting-coding-tasks', cluster: 'integration', contentType: 'high-intent' },
  { query: 'Google Meet for engineering teams productivity', slug: 'google-meet-engineering-teams', cluster: 'integration', contentType: 'high-intent' },
  { query: 'Slack huddles to coding tasks', slug: 'slack-huddles-coding-tasks', cluster: 'integration', contentType: 'high-intent' },
  { query: 'Microsoft Teams AI assistant for devs', slug: 'microsoft-teams-ai-assistant-devs', cluster: 'integration', contentType: 'high-intent' },
  { query: 'AI meeting tools that work with VS Code', slug: 'ai-meeting-tools-vscode', cluster: 'integration', contentType: 'supporting' },
  { query: 'connecting meeting transcripts to your IDE', slug: 'connecting-meeting-transcripts-ide', cluster: 'integration', contentType: 'supporting' },

  // --- AI/dev trends ---
  { query: 'generative AI for software planning', slug: 'generative-ai-software-planning', cluster: 'trends', contentType: 'pillar' },
  { query: 'how AI is changing sprint planning', slug: 'ai-changing-sprint-planning', cluster: 'trends', contentType: 'high-intent' },
  { query: 'LLM-powered developer workflows', slug: 'llm-powered-developer-workflows', cluster: 'trends', contentType: 'supporting' },
  { query: 'AI tools every developer should use in 2026', slug: 'ai-tools-developers-2026', cluster: 'trends', contentType: 'high-intent' },
  { query: 'the rise of AI coding assistants', slug: 'rise-of-ai-coding-assistants', cluster: 'trends', contentType: 'supporting' },
  { query: 'developer experience and AI automation', slug: 'developer-experience-ai-automation', cluster: 'trends', contentType: 'supporting' },

  // --- Problem-focused ---
  { query: 'developers waste time in meetings', slug: 'developers-waste-time-meetings', cluster: 'problem', contentType: 'high-intent' },
  { query: 'how to stop losing context after meetings', slug: 'stop-losing-context-after-meetings', cluster: 'problem', contentType: 'high-intent' },
  { query: 'meeting notes never turn into code', slug: 'meeting-notes-never-turn-into-code', cluster: 'problem', contentType: 'high-intent' },
  { query: 'why engineering meetings feel unproductive', slug: 'engineering-meetings-unproductive', cluster: 'problem', contentType: 'supporting' },
  { query: 'context switching after meetings costs engineering hours', slug: 'context-switching-meetings-engineering', cluster: 'problem', contentType: 'supporting' },
  { query: 'the hidden cost of manual task creation from meetings', slug: 'hidden-cost-manual-task-creation', cluster: 'problem', contentType: 'supporting' },

  // --- Use case specific ---
  { query: 'AI for remote engineering team meetings', slug: 'ai-remote-engineering-team-meetings', cluster: 'use-case', contentType: 'high-intent' },
  { query: 'automated sprint retrospective action items', slug: 'automated-sprint-retrospective-actions', cluster: 'use-case', contentType: 'supporting' },
  { query: 'technical debt discussions to tasks', slug: 'technical-debt-discussions-tasks', cluster: 'use-case', contentType: 'supporting' },
  { query: 'architecture decision records from meetings', slug: 'architecture-decision-records-meetings', cluster: 'use-case', contentType: 'supporting' },
  { query: 'product owner developer communication AI', slug: 'product-owner-developer-communication-ai', cluster: 'use-case', contentType: 'high-intent' },
  { query: 'onboarding new developers with meeting context', slug: 'onboarding-developers-meeting-context', cluster: 'use-case', contentType: 'supporting' },
];
