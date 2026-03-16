import { ResearchResult } from '../types.js';
import { researchGoogle } from './google.js';
import { researchNews } from './newsapi.js';

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function deduplicateResults(results: ResearchResult[]): ResearchResult[] {
  const unique: ResearchResult[] = [];
  for (const result of results) {
    const isDuplicate = unique.some(existing => jaccardSimilarity(existing.title, result.title) > 0.6);
    if (!isDuplicate) unique.push(result);
  }
  return unique;
}

function scoreResults(results: ResearchResult[]): ResearchResult[] {
  const now = Date.now();
  return results.map(result => {
    let score = 1.0;
    if (result.publishedAt) {
      const ageDays = (now - new Date(result.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
      score *= Math.exp(-ageDays / 14);
    }
    if (result.source === 'google_reddit') score *= 1.2;
    if (result.source === 'newsapi') score *= 1.1;
    return { ...result, score };
  });
}

export async function aggregateResearch(): Promise<ResearchResult[]> {
  console.log('[research] Starting research aggregation...');

  const [googleResults, newsResults] = await Promise.allSettled([
    researchGoogle(),
    researchNews(),
  ]);

  const allResults: ResearchResult[] = [];

  if (googleResults.status === 'fulfilled') {
    allResults.push(...googleResults.value);
    console.log(`[research] Google: ${googleResults.value.length} results`);
  } else {
    console.warn('[research] Google search failed:', googleResults.reason);
  }

  if (newsResults.status === 'fulfilled') {
    allResults.push(...newsResults.value);
    console.log(`[research] NewsAPI: ${newsResults.value.length} results`);
  } else {
    console.warn('[research] NewsAPI failed:', newsResults.reason);
  }

  // Research is optional — pipeline can proceed without it
  if (allResults.length === 0) {
    console.log('[research] No research results available, proceeding without research context');
    return [];
  }

  const deduplicated = deduplicateResults(allResults);
  const scored = scoreResults(deduplicated);
  const sorted = scored.sort((a, b) => b.score - a.score);

  console.log(`[research] ${allResults.length} total -> ${deduplicated.length} unique -> top ${Math.min(sorted.length, 20)}`);
  return sorted.slice(0, 20);
}
