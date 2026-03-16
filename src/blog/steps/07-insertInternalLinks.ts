import { PipelineContext } from '../types.js';
import { getOpenAI, blogConfig } from '../config.js';
import { getRecentBlogPosts } from '../../server/db.js';

export async function stepInsertInternalLinks(ctx: PipelineContext): Promise<void> {
  let html = ctx.contentHtml;

  // Get existing posts for cross-linking
  const existingPosts = getRecentBlogPosts(20);

  if (existingPosts.length > 0) {
    try {
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: blogConfig.generationModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an internal linking specialist. Given a blog post's content and existing posts, identify 2-3 places where internal links can be naturally inserted.

Return JSON:
{
  "links": [
    { "anchorText": "exact text from the content to wrap with a link", "postSlug": "slug of the post to link to" }
  ]
}

Rules:
- anchorText must be an EXACT substring in the content
- Only link to genuinely relevant posts
- Maximum 3 internal links
- Spread links throughout the article
- If no good opportunities exist, return empty links array`,
          },
          {
            role: 'user',
            content: `## Current post title: ${ctx.outline.title}

## Content (first 2000 chars):
${ctx.contentText.slice(0, 2000)}

## Existing posts:
${JSON.stringify(existingPosts.map(p => ({ slug: p.slug, title: p.title })), null, 2)}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const { links } = JSON.parse(content);
        let inserted = 0;
        for (const link of links || []) {
          if (html.includes(link.anchorText)) {
            html = html.replace(
              link.anchorText,
              `<a href="/blog/${link.postSlug}/">${link.anchorText}</a>`
            );
            inserted++;
          }
        }
        console.log(`[pipeline] Inserted ${inserted} internal links`);
      }
    } catch (error) {
      console.warn('[pipeline] Internal linking failed, continuing without:', error);
    }
  } else {
    console.log('[pipeline] No existing posts to link to');
  }

  ctx.finalHtml = html;
}
