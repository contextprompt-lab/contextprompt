import { PipelineContext } from '../types.js';
import { getOpenAI, blogConfig } from '../config.js';

export async function stepReviewContent(ctx: PipelineContext): Promise<void> {
  const openai = getOpenAI();
  const { targetQuery, postStyle } = ctx.selectedTopic;
  const wordCount = ctx.contentText.split(/\s+/).length;

  const response = await openai.chat.completions.create({
    model: blogConfig.generationModel,
    messages: [
      {
        role: 'system',
        content: `You are an editor with one job: make this blog post sound like a real dev wrote it, not an AI.

## Kill on sight
- Any sentence that sounds like ChatGPT wrote it — "In today's fast-paced world", "It's worth noting", "Let's dive in", "In conclusion", "leverage", "streamline", "game-changer", "comprehensive guide"
- Corporate jargon, buzzword soup, empty filler
- Wordy sentences — if you can say it in fewer words, do it
- Vague claims with no specifics — replace with concrete examples or cut entirely
- Boring intros that don't get to the point
- Overly formal language — loosen it up

## Punch up
- Make it sound casual and direct — like a dev talking to another dev
- The first paragraph must directly answer the target search query "${targetQuery}" (featured snippet bait)
- Each <h2> section's first paragraph should be a standalone answer (AI search citation)
- Ensure <strong> tags on key terms (a few per section, not overdone)
- Target query "${targetQuery}" should appear 2-4 times naturally — not stuffed
- If any section feels thin, add a real example or tighten it up
- Make sure the voice is consistent — casual, opinionated, slightly irreverent throughout

## Don't touch
- Overall structure and section order
- CTA section
- Existing links
- No CSS/JS/inline styles
- No <html>/<body> wrappers

Return ONLY the improved HTML. No commentary, no markdown fences.`,
      },
      {
        role: 'user',
        content: ctx.contentHtml,
      },
    ],
  });

  const reviewed = response.choices[0]?.message?.content;
  if (!reviewed) throw new Error('No response from content review');

  // Strip markdown fences if the model wrapped them
  const cleaned = reviewed
    .replace(/^```html?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  ctx.contentHtml = cleaned;
  ctx.contentText = cleaned
    .replace(/<[^>]*>/g, ' ')
    .replace(/<!--[^>]*-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const newWordCount = ctx.contentText.split(/\s+/).length;
  const delta = newWordCount - wordCount;
  const sign = delta >= 0 ? '+' : '';
  console.log(`[pipeline] Review pass: ${wordCount} → ${newWordCount} words (${sign}${delta})`);
}
