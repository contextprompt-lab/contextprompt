import { PipelineContext, SelectedTopic } from '../types.js';
import { getOpenAI, blogConfig } from '../config.js';
import { seoTopics, SeoTopic } from '../topics.js';

export async function stepSelectTopic(ctx: PipelineContext): Promise<void> {
  const openai = getOpenAI();

  // Filter out already-used topics
  const usedQueries = new Set<string>();
  for (const post of ctx.previousPosts) {
    const titleLower = post.title.toLowerCase();
    for (const topic of seoTopics) {
      if (titleLower.includes(topic.query.toLowerCase())) {
        usedQueries.add(topic.query);
      }
    }
  }

  const candidates: SeoTopic[] = seoTopics.filter(t => !usedQueries.has(t.query));
  if (candidates.length === 0) throw new Error('All SEO topics have been used');

  const recentTitles = ctx.previousPosts.slice(0, 5).map(p => p.title.toLowerCase());

  const response = await openai.chat.completions.create({
    model: blogConfig.generationModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an SEO content strategist for contextprompt, a developer tool that turns meeting transcriptions into repo-aware coding tasks.

Your job is to select the single best topic from the provided candidate list to publish next.

Selection priorities:
1. Prefer "high-intent" topics first — they have the highest search demand
2. Maintain topical balance — avoid clusters already covered in recent posts
3. Strengthen developer-tools topical authority
4. Pillar articles should be chosen when multiple high-intent articles in a cluster already exist

Return a JSON object:
{
  "title": "SEO-friendly article title (55-65 characters)",
  "targetQuery": "the exact query string from the candidate list",
  "contentType": "pillar | high-intent | supporting",
  "cluster": "the exact cluster value from the candidate list",
  "angle": "unique perspective or angle for the article",
  "rationale": "why this topic was selected"
}`,
      },
      {
        role: 'user',
        content: `## Recent post titles (avoid repeating these clusters):
${JSON.stringify(recentTitles)}

## Research context (trending topics):
${ctx.researchResults.slice(0, 10).map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

## Available candidates:
${JSON.stringify(candidates, null, 2)}

Select the single best topic.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from topic selection');

  const topic: SelectedTopic = JSON.parse(content);
  ctx.selectedTopic = topic;
  console.log(`[pipeline] Selected: "${topic.title}" [${topic.cluster} / ${topic.contentType}]`);
}
