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

  // Detect recent postStyle pattern for balance
  const recentStyles = ctx.previousPosts.slice(0, 2).map(p => {
    const titleLower = p.title.toLowerCase();
    const matchedTopic = seoTopics.find(t => titleLower.includes(t.query.toLowerCase()));
    return matchedTopic?.postStyle ?? 'product';
  });
  const allSameStyle = recentStyles.length >= 2 && recentStyles[0] === recentStyles[1];
  const balanceHint = allSameStyle
    ? `The last 2 posts were "${recentStyles[0]}" style. Prefer a "${recentStyles[0] === 'product' ? 'editorial' : 'product'}" topic next for variety.`
    : '';

  const response = await openai.chat.completions.create({
    model: blogConfig.generationModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an SEO content strategist for a developer-focused blog.

Your job is to select the single best topic from the provided candidate list to publish next.

Each topic has a "postStyle" field:
- "product": focused on contextprompt (a developer tool that turns meeting transcripts into repo-aware coding tasks)
- "editorial": generally informative developer content, not product-focused

Selection priorities:
1. Prefer "high-intent" topics first — they have the highest search demand
2. Maintain topical balance — avoid clusters already covered in recent posts
3. Alternate between "product" and "editorial" postStyle for variety
4. Strengthen developer-tools topical authority
5. Pillar articles should be chosen when multiple high-intent articles in a cluster already exist
${balanceHint ? `\n${balanceHint}` : ''}

Return a JSON object:
{
  "title": "SEO-friendly article title (55-65 characters)",
  "targetQuery": "the exact query string from the candidate list",
  "contentType": "pillar | high-intent | supporting",
  "cluster": "the exact cluster value from the candidate list",
  "angle": "unique perspective or angle for the article",
  "rationale": "why this topic was selected",
  "postStyle": "product | editorial (must match the candidate's postStyle)"
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

  const parsed = JSON.parse(content);

  // Ensure postStyle matches the candidate
  const matchedCandidate = candidates.find(c => c.query === parsed.targetQuery);
  const topic: SelectedTopic = {
    ...parsed,
    postStyle: matchedCandidate?.postStyle ?? parsed.postStyle ?? 'product',
  };

  ctx.selectedTopic = topic;
  console.log(`[pipeline] Selected: "${topic.title}" [${topic.cluster} / ${topic.contentType} / ${topic.postStyle}]`);
}
