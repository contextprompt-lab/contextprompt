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
  const { title, targetQuery, contentType, cluster, angle, postStyle } = ctx.selectedTopic;
  const { intro, sections, cta, faq, conclusion } = ctx.outline;
  const isEditorial = postStyle === 'editorial';

  const sectionsFormatted = sections
    .map((s: any, i: number) => {
      const keyPoints = s.keyPoints?.length
        ? `\n   Key points: ${s.keyPoints.join('; ')}`
        : '';
      return `${i + 1}. ${s.heading}: ${s.description}${keyPoints}`;
    })
    .join('\n');

  const faqFormatted = faq.length > 0
    ? `\n## FAQ\n${faq.map(q => `- ${q}`).join('\n')}`
    : '';

  const researchContext = ctx.researchResults.length > 0
    ? `\n## Research context (use for inspiration, do not copy):\n${ctx.researchResults.slice(0, 5).map(r => `- ${r.title}: ${r.snippet}`).join('\n')}`
    : '';

  const sharedWritingRules = `## HTML Output Rules
- Output ONLY the article body HTML. No <html>, <head>, <body> tags.
- Do NOT include an <h1> tag — the title is set separately. Start with <h2>.
- Use semantic HTML: <h2>, <h3>, <p>, <ul>/<li>, <blockquote>, <strong>, <em>, <code>, <pre>
- Do NOT include any CSS, JavaScript, or inline styles
- Keep HTML clean and ready for insertion into a CMS

## Tone & Voice — THIS IS CRITICAL
- Write like a dev bro who actually knows his shit — casual, direct, opinionated
- Think senior engineer posting on Twitter or writing a quick blog post, not a corporate content team
- Use "you" and "your" freely. Short sentences. Sentence fragments are fine.
- Be funny when it's natural — dry humor, not trying too hard
- Hot takes are welcome. Have opinions. "honestly this kinda sucks" is valid
- Swearing is OK sparingly (damn, hell, shit) — don't overdo it
- NEVER sound like AI-generated content. No "In today's fast-paced world", "Let's dive in", "It's worth noting", "In conclusion", "leverage", "streamline", "empower"
- NEVER use corporate jargon or buzzword soup
- If you catch yourself writing something boring, delete it

## Writing Quality Standards
- Every paragraph must earn its place — if it doesn't teach something or make the reader smirk, cut it
- Short, scannable paragraphs (2-3 sentences max)
- Use <h3> subheadings within sections to break up content
- Include code snippets or real examples where relevant — devs love concrete stuff
- GEO optimization: the first paragraph under each <h2> should be a clear, direct answer that search engines can cite
- Use <strong> for key terms and takeaways
- Keep the whole article tight — no padding, no filler, respect the reader's time`;

  const systemPrompt = isEditorial
    ? `You are a technical content writer for a developer-focused blog. Write informative, educational content for software engineers.

${sharedWritingRules}

## Editorial Rules
- This is an informative article — do not pitch any specific product
- If mentioning tools, mention several options fairly with honest pros/cons
- You may mention contextprompt (https://contextprompt.app) once if genuinely relevant to the topic, but it should not be the focus
- Include quantitative claims where possible — cite specific numbers, benchmarks, or survey data`
    : `You are a technical content writer for contextprompt, a developer productivity tool that joins meetings, transcribes, scans repos, and extracts structured coding tasks with real file paths.

${sharedWritingRules}

## Product Rules
- Natural, not salesy — contextprompt should appear as a solution, not a pitch
- Include quantitative claims where possible (e.g., "saves 15 minutes per meeting")
- Show don't tell: describe what contextprompt does in a workflow, don't just claim it's great

## Internal Linking
- Include 1-2 natural links to contextprompt pages using the provided link list
- The CTA section must include a link to the app
- Do not invent URLs`;

  const userContentParts = [
    `## Target query\n${targetQuery}`,
    `## Article title\n${title}`,
    `## Content type: ${contentType} — Cluster: ${cluster}`,
    `## Angle: ${angle}`,
    `## Introduction\n${intro}`,
    `## Sections\n${sectionsFormatted}`,
    faqFormatted,
    `## CTA\nHeading: ${cta.heading}\nDescription: ${cta.description}`,
  ];

  if (!isEditorial) {
    const internalLinksFormatted = INTERNAL_LINKS.map(l => `- ${l.title}: ${l.url}`).join('\n');
    userContentParts.push(`## Available internal links (use ONLY these)\n${internalLinksFormatted}`);
  }

  userContentParts.push(
    `## Conclusion\n${conclusion}`,
    researchContext,
    `\nWrite the full article. Aim for ${blogConfig.targetWordCount} words.`,
  );

  const response = await openai.chat.completions.create({
    model: blogConfig.generationModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContentParts.filter(Boolean).join('\n\n') },
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
