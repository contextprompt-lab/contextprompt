import { config as loadEnv } from 'dotenv';
loadEnv(); // Load .env from project root

import { PipelineContext } from './types.js';
import { blogConfig } from './config.js';
import { stepFetchPreviousPosts } from './steps/01-fetchPreviousPosts.js';
import { stepResearchTopics } from './steps/02-researchTopics.js';
import { stepSelectTopic } from './steps/03-selectTopic.js';
import { stepGenerateOutline } from './steps/04-generateOutline.js';
import { stepGenerateContent } from './steps/05-generateContent.js';
import { stepReviewContent } from './steps/05b-reviewContent.js';
import { stepGenerateSeo } from './steps/06-generateSeo.js';
import { stepInsertInternalLinks } from './steps/07-insertInternalLinks.js';
import { stepSaveToDatabase } from './steps/08-saveToDatabase.js';

const steps = [
  { name: 'fetchPreviousPosts', fn: stepFetchPreviousPosts },
  { name: 'researchTopics', fn: stepResearchTopics },
  { name: 'selectTopic', fn: stepSelectTopic },
  { name: 'generateOutline', fn: stepGenerateOutline },
  { name: 'generateContent', fn: stepGenerateContent },
  { name: 'reviewContent', fn: stepReviewContent },
  { name: 'generateSeo', fn: stepGenerateSeo },
  { name: 'insertInternalLinks', fn: stepInsertInternalLinks },
  { name: 'saveToDatabase', fn: stepSaveToDatabase },
];

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, backoffMs = 3000): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(2, attempt);
        console.warn(`[pipeline] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError!;
}

async function runSinglePost(): Promise<void> {
  const ctx: PipelineContext = {
    previousPosts: [],
    researchResults: [],
    selectedTopic: { title: '', targetQuery: '', contentType: 'supporting', cluster: '', angle: '', rationale: '', postStyle: 'editorial' },
    outline: { title: '', intro: '', sections: [], cta: { heading: '', description: '' }, faq: [], conclusion: '' },
    contentHtml: '',
    contentText: '',
    seo: { metaTitle: '', metaDescription: '', targetKeywords: [], slug: '', tags: [] },
    finalHtml: '',
    savedPostId: 0,
    pipelineLog: [],
    startTime: Date.now(),
  };

  console.log(`\n[pipeline] Starting blog generation (${steps.length} steps)`);

  for (const step of steps) {
    const stepStart = Date.now();
    try {
      await withRetry(() => step.fn(ctx));
      const durationMs = Date.now() - stepStart;
      ctx.pipelineLog.push({ step: step.name, status: 'success', durationMs });
      console.log(`[pipeline] ✓ ${step.name} (${(durationMs / 1000).toFixed(1)}s)`);
    } catch (error) {
      const durationMs = Date.now() - stepStart;
      const errorMsg = error instanceof Error ? error.message : String(error);
      ctx.pipelineLog.push({ step: step.name, status: 'failed', durationMs, error: errorMsg });
      console.error(`[pipeline] ✗ ${step.name}: ${errorMsg}`);
      throw error;
    }
  }

  const totalDuration = (Date.now() - ctx.startTime) / 1000;
  console.log(`[pipeline] Post #${ctx.savedPostId} complete in ${totalDuration.toFixed(1)}s`);
}

export async function runPipeline(): Promise<void> {
  const count = blogConfig.postsPerRun;
  console.log(`\n========================================`);
  console.log(`Blog Pipeline — generating ${count} post(s)`);
  console.log(`Model: ${blogConfig.generationModel}`);
  console.log(`========================================\n`);

  for (let i = 0; i < count; i++) {
    console.log(`\n--- Post ${i + 1} of ${count} ---`);
    await runSinglePost();
  }

  console.log(`\n========================================`);
  console.log(`Done! Generated ${count} post(s).`);
  console.log(`========================================`);
}

// CLI entry point
if (process.argv[1]?.endsWith('pipeline.ts') || process.argv[1]?.endsWith('pipeline.js')) {
  runPipeline()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Pipeline failed:', err);
      process.exit(1);
    });
}
