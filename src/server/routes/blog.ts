import { Router } from 'express';
import { getPublishedBlogPosts, getBlogPostBySlug, getBlogPostCount, getAllBlogSlugs, getRecentBlogPosts } from '../db.js';

export const blogRouter = Router();

const DOMAIN = 'https://contextprompt.app';
const POSTS_PER_PAGE = 12;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sharedHead(title: string, description: string, canonicalPath: string): string {
  const canonical = `${DOMAIN}${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">

  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="contextprompt">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="${DOMAIN}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${DOMAIN}/og-image.png">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icon-192.png">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0a0a0a">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    a { text-decoration: none; color: inherit; }

    body { font-family: 'Inter', -apple-system, system-ui, sans-serif; font-size: 1rem; color: #e6e6e6; background: #0a0a0a; }

    .container { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

    .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(10,10,10,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid #21262d; height: 56px; }
    .nav-inner { display: flex; align-items: center; height: 56px; gap: 24px; }
    .nav-logo { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 1.125rem; color: #e6e6e6; flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
    .nav-logo-icon { width: 28px; height: 28px; border-radius: 6px; }
    .nav-links { display: flex; gap: 24px; margin-left: auto; align-items: center; }
    .nav-links a { font-size: 0.875rem; color: #999; transition: color 0.15s; }
    .nav-links a:hover { color: #e6e6e6; }
    .nav-link--cta { color: #0a0a0a !important; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem !important; padding: 8px 16px; background: #3fb950; border-radius: 8px; transition: opacity 0.15s; }
    .nav-link--cta:hover { opacity: 0.9; color: #0a0a0a !important; }

    .footer { border-top: 1px solid #21262d; padding: 48px 0 32px; }
    .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .footer-col { display: flex; flex-direction: column; gap: 8px; }
    .footer-logo { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #999; font-size: 1rem; display: flex; align-items: center; gap: 8px; }
    .footer-logo-icon { width: 24px; height: 24px; border-radius: 5px; }
    .footer-tagline { font-size: 0.875rem; color: #555; line-height: 1.5; }
    .footer-heading { font-size: 0.75rem; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .footer-col a { font-size: 0.875rem; color: #555; transition: color 0.15s; }
    .footer-col a:hover { color: #e6e6e6; }
    .footer-bottom { border-top: 1px solid #21262d; padding-top: 24px; text-align: center; }
    .footer-copy { font-size: 0.75rem; color: #555; }

    @media (max-width: 768px) {
      .footer-grid { grid-template-columns: 1fr 1fr; }
      .nav-links { gap: 12px; }
    }
    @media (max-width: 480px) {
      .footer-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>`;
}

function nav(): string {
  return `
  <nav class="nav">
    <div class="nav-inner container">
      <a href="/" class="nav-logo"><img src="/logo-icon.svg" alt="contextprompt" class="nav-logo-icon">contextprompt</a>
      <div class="nav-links">
        <a href="/#how-it-works">How it works</a>
        <a href="/#features">Features</a>
        <a href="/#pricing">Pricing</a>
        <a href="/faq/">FAQ</a>
        <a href="/app/" class="nav-link--cta">Get Started Free</a>
      </div>
    </div>
  </nav>`;
}

function footer(): string {
  return `
  <footer class="footer">
    <div class="container footer-grid">
      <div class="footer-col">
        <span class="footer-logo"><img src="/logo-icon.svg" alt="contextprompt" class="footer-logo-icon">contextprompt</span>
        <p class="footer-tagline">Turn meetings into repo-aware coding tasks.</p>
      </div>
      <div class="footer-col">
        <h4 class="footer-heading">Product</h4>
        <a href="/#how-it-works">How it works</a>
        <a href="/#features">Features</a>
        <a href="/#pricing">Pricing</a>
        <a href="/playground/">Playground</a>
      </div>
      <div class="footer-col">
        <h4 class="footer-heading">Resources</h4>
        <a href="/faq/">FAQ</a>
        <a href="/blog/">Blog</a>
      </div>
      <div class="footer-col">
        <h4 class="footer-heading">Legal</h4>
        <a href="/privacy/">Privacy Policy</a>
        <a href="/terms/">Terms of Service</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span class="footer-copy">&copy; 2026 contextprompt. All rights reserved.</span>
    </div>
  </footer>`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// GET /blog — Blog index
blogRouter.get('/', (_req, res) => {
  const page = Math.max(1, parseInt(_req.query.page as string) || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;
  const posts = getPublishedBlogPosts(POSTS_PER_PAGE, offset);
  const totalPosts = getBlogPostCount();
  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

  const postCards = posts.map(p => `
    <article class="blog-card">
      <a href="/blog/${escapeHtml(p.slug)}/">
        <h2 class="blog-card-title">${escapeHtml(p.title)}</h2>
        ${p.meta_description ? `<p class="blog-card-desc">${escapeHtml(p.meta_description)}</p>` : ''}
        <div class="blog-card-meta">
          ${p.published_at ? `<time>${formatDate(p.published_at)}</time>` : ''}
          ${p.reading_time_minutes ? `<span>${p.reading_time_minutes} min read</span>` : ''}
        </div>
      </a>
    </article>
  `).join('');

  const pagination = totalPages > 1 ? `
    <div class="blog-pagination">
      ${page > 1 ? `<a href="/blog/?page=${page - 1}" class="blog-page-link">&larr; Previous</a>` : ''}
      <span class="blog-page-info">Page ${page} of ${totalPages}</span>
      ${page < totalPages ? `<a href="/blog/?page=${page + 1}" class="blog-page-link">Next &rarr;</a>` : ''}
    </div>
  ` : '';

  const html = `${sharedHead('Blog — contextprompt', 'Articles about AI-powered meeting tools, developer productivity, repo-aware task extraction, and engineering team workflows.', '/blog/')}
<body>
  ${nav()}

  <main class="blog-index">
    <div class="container">
      <h1 class="blog-index-title">Blog</h1>
      <p class="blog-index-sub">Insights on AI-powered developer workflows, meeting productivity, and shipping faster.</p>

      ${posts.length === 0 ? '<p class="blog-empty">No posts yet. Check back soon!</p>' : ''}
      <div class="blog-grid">
        ${postCards}
      </div>
      ${pagination}
    </div>
  </main>

  <section class="blog-cta">
    <div class="container" style="text-align:center; padding: 64px 24px;">
      <h2 style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; margin-bottom: 16px;">Ready to ship faster?</h2>
      <a href="/app/" style="display:inline-block; font-family:'JetBrains Mono',monospace; font-weight:600; padding:12px 40px; border-radius:8px; background:#3fb950; color:#0a0a0a; transition:opacity 0.15s;">Get started free</a>
      <p style="font-size:0.875rem; color:#555; margin-top:12px;">Free plan includes 1 hour/month. No credit card required.</p>
    </div>
  </section>

  ${footer()}

  <style>
    .blog-index { padding-top: calc(56px + 64px); padding-bottom: 48px; }
    .blog-index-title { font-family: 'JetBrains Mono', monospace; font-size: 2.75rem; font-weight: 700; text-align: center; margin-bottom: 12px; }
    .blog-index-sub { text-align: center; color: #999; font-size: 0.875rem; max-width: 560px; margin: 0 auto 48px; line-height: 1.6; }
    .blog-empty { text-align: center; color: #555; font-size: 1rem; padding: 48px 0; }

    .blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; }
    .blog-card { background: #111113; border: 1px solid #21262d; border-radius: 12px; padding: 24px; transition: border-color 0.15s; }
    .blog-card:hover { border-color: #3fb950; }
    .blog-card-title { font-size: 1.125rem; font-weight: 600; line-height: 1.4; margin-bottom: 8px; }
    .blog-card-desc { font-size: 0.875rem; color: #999; line-height: 1.5; margin-bottom: 12px; }
    .blog-card-meta { display: flex; gap: 16px; font-size: 0.75rem; color: #555; }

    .blog-pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 48px; }
    .blog-page-link { color: #3fb950; font-size: 0.875rem; font-weight: 500; }
    .blog-page-link:hover { text-decoration: underline; }
    .blog-page-info { color: #555; font-size: 0.875rem; }
  </style>
</body>
</html>`;

  res.type('html').send(html);
});

// GET /blog/sitemap-posts.xml — Dynamic sitemap for blog posts
blogRouter.get('/sitemap-posts.xml', (_req, res) => {
  const slugs = getAllBlogSlugs();
  const urls = slugs.map(slug =>
    `  <url><loc>${DOMAIN}/blog/${slug}/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.type('application/xml').send(xml);
});

// GET /blog/:slug — Individual blog post
blogRouter.get('/:slug/', (req, res) => {
  const post = getBlogPostBySlug(req.params.slug);
  if (!post) {
    res.status(404).type('html').send(`${sharedHead('Post Not Found — contextprompt', 'This blog post could not be found.', '/blog/')}
<body>${nav()}<main style="padding-top:calc(56px + 80px); text-align:center; min-height:60vh;">
<div class="container"><h1 style="font-family:'JetBrains Mono',monospace; font-size:2rem;">Post not found</h1>
<p style="color:#999; margin-top:16px;"><a href="/blog/" style="color:#3fb950;">&larr; Back to blog</a></p></div>
</main>${footer()}</body></html>`);
    return;
  }

  const relatedPosts = getRecentBlogPosts(4)
    .filter(p => p.slug !== post.slug)
    .slice(0, 3);

  const relatedHtml = relatedPosts.length > 0 ? `
    <section class="post-related">
      <h2 class="post-related-title">More from the blog</h2>
      <div class="post-related-grid">
        ${relatedPosts.map(p => `
          <a href="/blog/${escapeHtml(p.slug)}/" class="post-related-card">
            <h3>${escapeHtml(p.title)}</h3>
            ${p.meta_description ? `<p>${escapeHtml(p.meta_description)}</p>` : ''}
          </a>
        `).join('')}
      </div>
    </section>
  ` : '';

  const publishedDate = post.published_at ? formatDate(post.published_at) : '';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': post.title,
    'description': post.meta_description || '',
    'author': { '@type': 'Organization', 'name': post.author },
    'publisher': { '@type': 'Organization', 'name': 'contextprompt', 'url': DOMAIN },
    'datePublished': post.published_at || '',
    'dateModified': post.updated_at,
    'url': `${DOMAIN}/blog/${post.slug}/`,
    'mainEntityOfPage': `${DOMAIN}/blog/${post.slug}/`,
  });

  const html = `${sharedHead(`${post.title} — contextprompt`, post.meta_description || post.title, `/blog/${post.slug}/`)}
<body>
  ${nav()}

  <article class="post">
    <div class="container post-container">
      <header class="post-header">
        <a href="/blog/" class="post-back">&larr; Blog</a>
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <div class="post-meta">
          ${publishedDate ? `<time>${publishedDate}</time>` : ''}
          ${post.reading_time_minutes ? `<span>${post.reading_time_minutes} min read</span>` : ''}
        </div>
      </header>

      <div class="post-body">
        ${post.content_html}
      </div>

      <div class="post-cta">
        <h2>Ready to turn your meetings into tasks?</h2>
        <p>contextprompt joins your call, transcribes, scans your repos, and extracts structured coding tasks.</p>
        <a href="/app/" class="post-cta-btn">Get started free</a>
      </div>
    </div>
  </article>

  ${relatedHtml}

  ${footer()}

  <script type="application/ld+json">${jsonLd}</script>

  <style>
    .post { padding-top: calc(56px + 48px); padding-bottom: 48px; }
    .post-container { max-width: 780px; }
    .post-back { display: inline-block; font-size: 0.875rem; color: #3fb950; margin-bottom: 24px; }
    .post-back:hover { text-decoration: underline; }
    .post-title { font-family: 'JetBrains Mono', monospace; font-size: 2.25rem; font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
    .post-meta { display: flex; gap: 16px; font-size: 0.875rem; color: #555; margin-bottom: 48px; }

    .post-body { line-height: 1.8; color: #ccc; }
    .post-body h2 { font-size: 1.5rem; font-weight: 600; color: #e6e6e6; margin: 48px 0 16px; }
    .post-body h3 { font-size: 1.125rem; font-weight: 600; color: #e6e6e6; margin: 32px 0 12px; }
    .post-body p { margin-bottom: 16px; }
    .post-body ul, .post-body ol { margin: 0 0 16px 24px; }
    .post-body li { margin-bottom: 8px; }
    .post-body code { font-family: 'JetBrains Mono', monospace; font-size: 0.875em; background: #1a1a1e; padding: 2px 6px; border-radius: 4px; }
    .post-body pre { background: #0d1117; border: 1px solid #21262d; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 16px 0; }
    .post-body pre code { background: none; padding: 0; }
    .post-body blockquote { border-left: 3px solid #3fb950; padding-left: 16px; color: #999; margin: 24px 0; font-style: italic; }
    .post-body a { color: #3fb950; text-decoration: underline; }
    .post-body a:hover { color: #58d468; }
    .post-body strong { color: #e6e6e6; }

    .post-cta { text-align: center; padding: 48px; margin-top: 64px; background: #111113; border: 1px solid #21262d; border-radius: 12px; }
    .post-cta h2 { font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; margin-bottom: 8px; }
    .post-cta p { color: #999; font-size: 0.875rem; margin-bottom: 24px; line-height: 1.5; }
    .post-cta-btn { display: inline-block; font-family: 'JetBrains Mono', monospace; font-weight: 600; padding: 12px 40px; border-radius: 8px; background: #3fb950; color: #0a0a0a; transition: opacity 0.15s; }
    .post-cta-btn:hover { opacity: 0.9; }

    .post-related { padding: 48px 0; }
    .post-related-title { font-size: 1.25rem; font-weight: 600; text-align: center; margin-bottom: 24px; }
    .post-related-grid { max-width: 1120px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .post-related-card { background: #111113; border: 1px solid #21262d; border-radius: 12px; padding: 20px; transition: border-color 0.15s; }
    .post-related-card:hover { border-color: #3fb950; }
    .post-related-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 8px; }
    .post-related-card p { font-size: 0.875rem; color: #999; line-height: 1.4; }

    @media (max-width: 768px) {
      .post-title { font-size: 1.75rem; }
    }
  </style>
</body>
</html>`;

  res.type('html').send(html);
});
