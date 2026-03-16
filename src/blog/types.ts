export interface ResearchResult {
  title: string;
  url: string;
  source: 'google' | 'google_reddit' | 'newsapi';
  snippet: string;
  publishedAt?: string;
  score: number;
}

export interface PreviousPost {
  id: number;
  title: string;
  slug: string;
  meta_description: string | null;
  meta_keywords: string | null;
}

export interface SelectedTopic {
  title: string;
  targetQuery: string;
  contentType: 'pillar' | 'high-intent' | 'supporting';
  cluster: string;
  angle: string;
  rationale: string;
}

export interface BlogOutline {
  title: string;
  intro: string;
  sections: { heading: string; description: string }[];
  cta: { heading: string; description: string };
  faq: string[];
  conclusion: string;
}

export interface SeoMetadata {
  metaTitle: string;
  metaDescription: string;
  targetKeywords: string[];
  slug: string;
  tags: string[];
}

export interface PipelineLogEntry {
  step: string;
  status: 'success' | 'failed';
  durationMs: number;
  error?: string;
}

export interface PipelineContext {
  previousPosts: PreviousPost[];
  researchResults: ResearchResult[];
  selectedTopic: SelectedTopic;
  outline: BlogOutline;
  contentHtml: string;
  contentText: string;
  seo: SeoMetadata;
  finalHtml: string;
  savedPostId: number;
  pipelineLog: PipelineLogEntry[];
  startTime: number;
}
