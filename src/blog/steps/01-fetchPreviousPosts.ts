import { PipelineContext } from '../types.js';
import { getRecentBlogPosts } from '../../server/db.js';

export async function stepFetchPreviousPosts(ctx: PipelineContext): Promise<void> {
  const posts = getRecentBlogPosts(10);
  ctx.previousPosts = posts.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    meta_description: p.meta_description,
    meta_keywords: null,
  }));
  console.log(`[pipeline] Fetched ${ctx.previousPosts.length} previous posts`);
}
