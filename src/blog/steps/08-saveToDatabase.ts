import { PipelineContext } from '../types.js';
import { insertBlogPost, upsertBlogTag, linkBlogPostTag } from '../../server/db.js';
import { blogConfig } from '../config.js';

export async function stepSaveToDatabase(ctx: PipelineContext): Promise<void> {
  const wordCount = ctx.contentText.split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 250));

  // Deduplicate slug if needed — append -2, -3, etc.
  let slug = ctx.seo.slug;
  const { getDb } = await import('../../server/db.js');
  const db = getDb();
  let suffix = 1;
  while (db.prepare('SELECT 1 FROM blog_posts WHERE slug = ?').get(slug)) {
    suffix++;
    slug = `${ctx.seo.slug}-${suffix}`;
  }

  const postId = insertBlogPost({
    slug,
    title: ctx.outline.title,
    meta_description: ctx.seo.metaDescription,
    meta_keywords: ctx.seo.targetKeywords.join(', '),
    content_html: ctx.finalHtml,
    content_text: ctx.contentText,
    status: 'published',
    research_sources_json: JSON.stringify(ctx.researchResults.slice(0, 10)),
    generation_model: blogConfig.generationModel,
    pipeline_log_json: JSON.stringify(ctx.pipelineLog),
    word_count: wordCount,
    reading_time_minutes: readingTime,
  });

  // Save tags
  for (const tagName of ctx.seo.tags) {
    const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const tagId = upsertBlogTag(tagName, tagSlug);
    linkBlogPostTag(postId, tagId);
  }

  ctx.savedPostId = postId;
  console.log(`[pipeline] Saved post #${postId}: "${ctx.outline.title}" at /blog/${slug}/`);
}
