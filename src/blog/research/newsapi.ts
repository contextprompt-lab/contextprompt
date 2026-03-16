import { ResearchResult } from '../types.js';

interface NewsApiResponse {
  status: string;
  articles: { title: string; url: string; description: string | null; publishedAt: string }[];
}

export async function researchNews(): Promise<ResearchResult[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.log('[research] NEWSAPI_KEY not set, skipping news research');
    return [];
  }

  const results: ResearchResult[] = [];

  try {
    const url = new URL('https://newsapi.org/v2/everything');
    // Single query per post to stay within NewsAPI free tier (100 requests/day)
    const queries = [
      'developer tools OR AI coding assistant',
      'meeting transcription OR AI developer productivity',
      'Claude Code OR AI pair programming',
    ];
    const query = queries[new Date().getDate() % queries.length];
    url.searchParams.set('q', query);
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('language', 'en');
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('apiKey', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`NewsAPI error: ${response.status}`);
    const data = (await response.json()) as NewsApiResponse;

    for (const article of data.articles) {
      if (!article.title || article.title === '[Removed]') continue;
      results.push({
        title: article.title,
        url: article.url,
        source: 'newsapi',
        snippet: article.description || '',
        publishedAt: article.publishedAt,
        score: 0,
      });
    }
  } catch (error) {
    console.warn('[research] NewsAPI search failed:', error);
  }

  return results;
}
