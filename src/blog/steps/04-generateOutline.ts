import { PipelineContext, BlogOutline } from '../types.js';
import { getOpenAI, blogConfig } from '../config.js';

export async function stepGenerateOutline(ctx: PipelineContext): Promise<void> {
  const openai = getOpenAI();
  const { title, targetQuery, contentType, cluster, angle, postStyle } = ctx.selectedTopic;
  const isEditorial = postStyle === 'editorial';

  const sharedRequirements = `Requirements:
- 3-5 H2 sections — keep it tight, no fluff, no padding
- Each section MUST include 2-3 key points that the writer should cover
- At least one section should include a concrete example or code snippet
- Sections should be practical, opinionated, and technically grounded
- FAQ: 2-3 real questions people search for about this topic
- Tone: casual, direct, like a senior dev explaining something to a friend. Think "bro who actually knows his stuff" — not corporate, not AI-sounding, not boring
- No generic productivity fluff, no buzzword soup, no "in today's rapidly evolving landscape" energy
- Front-load the most valuable section (the one that directly answers the search query) as section 1 or 2`;

  const systemPrompt = isEditorial
    ? `You are an SEO content strategist for a developer-focused blog.

Create a structured article outline for a developer-audience blog post. This is an editorial/informative post — it should provide genuine value to developers without pitching any specific product.

Return JSON:
{
  "title": "SEO-friendly H1 title aligned with the target query",
  "intro": "2-3 sentence intro — directly address the search query, state what the reader will learn, and why it matters now",
  "sections": [
    { "heading": "H2 heading", "description": "What this section covers", "keyPoints": ["point 1", "point 2", "point 3"] }
  ],
  "cta": {
    "heading": "Further Reading",
    "description": "Related resources or next steps for the reader"
  },
  "faq": ["Question 1", "Question 2", "Question 3"],
  "conclusion": "Brief conclusion description"
}

${sharedRequirements}
- CTA should suggest further reading or related resources, not pitch a product
- If mentioning tools, mention several options fairly`
    : `You are an SEO content strategist for contextprompt, a developer productivity tool that turns meeting transcriptions into repo-aware coding tasks.

Create a structured article outline for a developer-audience blog post.

Return JSON:
{
  "title": "SEO-friendly H1 title aligned with the target query",
  "intro": "2-3 sentence intro — directly address the search query, state what the reader will learn, and why it matters now",
  "sections": [
    { "heading": "H2 heading", "description": "What this section covers", "keyPoints": ["point 1", "point 2", "point 3"] }
  ],
  "cta": {
    "heading": "Try contextprompt Free",
    "description": "CTA description explaining the value"
  },
  "faq": ["Question 1", "Question 2", "Question 3"],
  "conclusion": "Brief conclusion description"
}

${sharedRequirements}
- CTA always links to contextprompt — position it as a natural solution`;

  const response = await openai.chat.completions.create({
    model: blogConfig.generationModel,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Target query: ${targetQuery}
Article title: ${title}
Content type: ${contentType}
Cluster: ${cluster}
Angle: ${angle}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from outline generation');

  const outline: BlogOutline = JSON.parse(content);
  ctx.outline = outline;
  console.log(`[pipeline] Outline: ${outline.sections.length} sections, ${outline.faq.length} FAQs`);
}
