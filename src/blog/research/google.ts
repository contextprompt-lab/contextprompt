import { ResearchResult } from '../types.js';

interface SerpApiResponse {
  organic_results?: { title: string; link: string; snippet: string }[];
}

async function searchGoogle(query: string, apiKey: string): Promise<{ title: string; link: string; snippet: string }[]> {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'us');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`SerpApi error: ${response.status}`);
  const data = (await response.json()) as SerpApiResponse;
  return data.organic_results || [];
}

export async function researchGoogle(): Promise<ResearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.log('[research] SERPAPI_API_KEY not set, skipping Google research');
    return [];
  }

  const results: ResearchResult[] = [];
  // Keep to 2 queries per blog post to stay within SerpApi free tier (100/month)
  const allQueries = [
    'AI developer tools trending 2026',
    'meeting productivity engineering teams',
    'AI coding assistant workflows',
    'developer meeting transcription tools',
  ];
  // Rotate queries: pick 2 based on current day
  const dayIndex = new Date().getDate() % allQueries.length;
  const queries = [
    allQueries[dayIndex],
    allQueries[(dayIndex + 1) % allQueries.length],
  ];

  for (const q of queries) {
    try {
      const items = await searchGoogle(q, apiKey);
      for (const item of items) {
        const isReddit = item.link.includes('reddit.com');
        results.push({
          title: item.title,
          url: item.link,
          source: isReddit ? 'google_reddit' : 'google',
          snippet: item.snippet,
          score: 0,
        });
      }
    } catch (error) {
      console.warn(`[research] SerpApi search failed for "${q}":`, error);
    }
  }

  return results;
}
