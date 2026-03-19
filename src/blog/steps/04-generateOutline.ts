import { PipelineContext, BlogOutline } from '../types.js';
import { getOpenAI, blogConfig } from '../config.js';

export async function stepGenerateOutline(ctx: PipelineContext): Promise<void> {
  const openai = getOpenAI();
  const { title, targetQuery, contentType, cluster, angle, postStyle } = ctx.selectedTopic;
  const isEditorial = postStyle === 'editorial';

  const systemPrompt = isEditorial
    ? `You are an SEO content strategist for a developer-focused blog.

Create a structured article outline for a developer-audience blog post. This is an editorial/informative post — it should provide genuine value to developers without pitching any specific product.

Return JSON:
{
  "title": "SEO-friendly H1 title aligned with the target query",
  "intro": "1-2 sentence intro description — must directly address the search query",
  "sections": [
    { "heading": "H2 heading", "description": "What this section covers" }
  ],
  "cta": {
    "heading": "Further Reading",
    "description": "Related resources or next steps for the reader"
  },
  "faq": ["Question 1", "Question 2", "Question 3"],
  "conclusion": "Brief conclusion description"
}

Requirements:
- 4-6 H2 sections structured for developer search intent
- Sections should be practical, specific, and technically grounded
- FAQ: 2-4 real questions people search for about this topic
- CTA should suggest further reading or related resources, not pitch a product
- No generic wellness/productivity fluff — stay technical and practical`
    : `You are an SEO content strategist for contextprompt, a developer productivity tool that turns meeting transcriptions into repo-aware coding tasks.

Create a structured article outline for a developer-audience blog post.

Return JSON:
{
  "title": "SEO-friendly H1 title aligned with the target query",
  "intro": "1-2 sentence intro description — must directly address the search query",
  "sections": [
    { "heading": "H2 heading", "description": "What this section covers" }
  ],
  "cta": {
    "heading": "Try contextprompt Free",
    "description": "CTA description explaining the value"
  },
  "faq": ["Question 1", "Question 2", "Question 3"],
  "conclusion": "Brief conclusion description"
}

Requirements:
- 4-6 H2 sections structured for developer search intent
- Sections should be practical, specific, and technically grounded
- FAQ: 2-4 real questions people search for about this topic
- CTA always links to contextprompt — position it as a natural solution
- No generic wellness/productivity fluff — stay technical and practical`;

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
