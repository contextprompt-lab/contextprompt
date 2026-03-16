import { PipelineContext } from '../types.js';
import { aggregateResearch } from '../research/aggregator.js';

export async function stepResearchTopics(ctx: PipelineContext): Promise<void> {
  ctx.researchResults = await aggregateResearch();
  console.log(`[pipeline] Aggregated ${ctx.researchResults.length} research results`);
}
