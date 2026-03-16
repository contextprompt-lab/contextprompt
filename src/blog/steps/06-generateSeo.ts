import { PipelineContext, SeoMetadata } from '../types.js';
import { getOpenAI, blogConfig } from '../config.js';

export async function stepGenerateSeo(ctx: PipelineContext): Promise<void> {
  const openai = getOpenAI();
  const { targetQuery, contentType, cluster } = ctx.selectedTopic;
  const contentPreview = ctx.contentText.slice(0, 800);

  const response = await openai.chat.completions.create({
    model: blogConfig.generationModel,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an SEO specialist for contextprompt, a developer productivity tool.

Generate precise, search-intent-aligned metadata for a developer-audience blog article.

Return JSON:
{
  "metaTitle": "SEO title with primary query near the beginning (50-60 chars)",
  "metaDescription": "Concise meta description within 150-160 characters. Clear and useful.",
  "targetKeywords": ["primary query", "variant 1", "variant 2", "related term", "another term"],
  "slug": "clean-url-slug-based-on-target-query",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Rules:
- metaTitle: include primary query near start; descriptive, not clickbait
- metaDescription: stay within 160 chars; practical; no hype
- targetKeywords: start with exact query; add developer-specific variants
- slug: lowercase, hyphens only, based on target query
- tags: specific to the dev-tools topic`,
      },
      {
        role: 'user',
        content: `Target query: ${targetQuery}
Content type: ${contentType}
Cluster: ${cluster}
Title: ${ctx.outline.title}

Content preview:
${contentPreview}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from SEO generation');

  const parsed = JSON.parse(content);
  const slug: string = (parsed.slug ?? targetQuery)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const seo: SeoMetadata = { ...parsed, slug };
  ctx.seo = seo;
  console.log(`[pipeline] SEO: slug="${seo.slug}", ${seo.tags.length} tags`);
}
