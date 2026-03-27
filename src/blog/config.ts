import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required for blog generation');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export const blogConfig = {
  generationModel: process.env.BLOG_GENERATION_MODEL || 'gpt-5.4-mini',
  targetWordCount: parseInt(process.env.BLOG_TARGET_WORD_COUNT || '1500', 10),
  postsPerRun: parseInt(process.env.BLOG_POSTS_PER_RUN || '1', 10),
};
