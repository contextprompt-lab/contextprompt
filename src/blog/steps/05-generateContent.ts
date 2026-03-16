import { PipelineContext } from '../types.js';
import { getOpenAI, blogConfig } from '../config.js';

const INTERNAL_LINKS = [
  { title: 'contextprompt homepage', url: 'https://contextprompt.app/' },
  { title: 'contextprompt FAQ', url: 'https://contextprompt.app/faq/' },
  { title: 'Get started free', url: 'https://contextprompt.app/app/' },
  { title: 'How it works', url: 'https://contextprompt.app/#how-it-works' },
  { title: 'Pricing', url: 'https://contextprompt.app/#pricing' },
];

export async function stepGenerateContent(ctx: PipelineContext): Promise<void> {
  const openai = getOpenAI();
  const { title, targetQuery, contentType, cluster, angle } = ctx.selectedTopic;
  const { intro, sections, cta, faq, conclusion } = ctx.outline;

  const sectionsFormatted = sections
    .map((s, i) => `${i + 1}. ${s.heading}: ${s.description}`)
    .join('\n');

  const faqFormatted = faq.length > 0
    ? `\n## FAQ\n${faq.map(q => `- ${q}`).join('\n')}`
    : '';

  const researchContext = ctx.researchResults.length > 0
    ? `\n## Research context (use for inspiration, do not copy):\n${ctx.researchResults.slice(0, 5).map(r => `- ${r.title}: ${r.snippet}`).join('\n')}`
    : '';

  const internalLinksFormatted = INTERNAL_LINKS.map(l => `- ${l.title}: ${l.url}`).join('\n');

  const response = await openai.chat.completions.create({
    model: blogConfig.generationModel,
    messages: [
      {
        role: 'system',
        content: `You are a technical content writer for contextprompt, a developer productivity tool that joins meetings, transcribes, scans repos, and extracts structured coding tasks with real file paths.

## HTML Output Rules
- Output ONLY the article body HTML. No <html>, <head>, <body> tags.
- Do NOT include an <h1> tag — the title is set separately. Start with <h2>.
- Use semantic HTML: <h2>, <h3>, <p>, <ul>/<li>, <blockquote>, <strong>, <em>, <code>, <pre>
- Do NOT include any CSS, JavaScript, or inline styles
- Keep HTML clean and ready for insertion into a CMS

## Writing Style
- Developer-audience: technical but accessible
- Practical and specific — include concrete examples, code snippets where relevant
- Short, readable paragraphs (2-4 sentences)
- Lead with the answer to the search query in the first 1-2 paragraphs
- GEO optimization: include a clear definitional opening paragraph that AI search engines can cite
- Include quantitative claims where possible (e.g., "saves 15 minutes per meeting")
- Natural, not salesy — contextprompt should appear as a solution, not a pitch

## Internal Linking
- Include 1-2 natural links to contextprompt pages using the provided link list
- The CTA section must include a link to the app
- Do not invent URLs`,
      },
      {
        role: 'user',
        content: `## Target query
${targetQuery}

## Article title
${title}

## Content type: ${contentType} — Cluster: ${cluster}
## Angle: ${angle}

## Introduction
${intro}

## Sections
${sectionsFormatted}
${faqFormatted}

## CTA
Heading: ${cta.heading}
Description: ${cta.description}

## Available internal links (use ONLY these)
${internalLinksFormatted}

## Conclusion
${conclusion}
${researchContext}

Write the full article. Aim for ${blogConfig.targetWordCount} words.`,
      },
    ],
  });

  const html = response.choices[0]?.message?.content;
  if (!html) throw new Error('No response from content generation');

  ctx.contentHtml = html;
  ctx.contentText = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/<!--[^>]*-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = ctx.contentText.split(/\s+/).length;
  console.log(`[pipeline] Generated ${wordCount} words of content`);
}
