const CHARS_PER_TOKEN = 4;
const MAX_TRANSCRIPT_TOKENS = 100000;
const OVERLAP_TOKENS = 2000;

export function shouldChunk(transcript: string): boolean {
  return transcript.length / CHARS_PER_TOKEN > MAX_TRANSCRIPT_TOKENS;
}

export function chunkTranscript(transcript: string): string[] {
  const maxChars = MAX_TRANSCRIPT_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

  const chunks: string[] = [];
  let start = 0;

  while (start < transcript.length) {
    let end = start + maxChars;

    if (end >= transcript.length) {
      chunks.push(transcript.slice(start));
      break;
    }

    // Find a newline near the boundary to avoid splitting mid-sentence
    const searchStart = Math.max(end - 500, start);
    const lastNewline = transcript.lastIndexOf('\n', end);
    if (lastNewline > searchStart) {
      end = lastNewline + 1;
    }

    chunks.push(transcript.slice(start, end));
    start = end - overlapChars;
  }

  return chunks;
}

interface DeduplicableTask {
  title: string;
  confidence?: 'high' | 'medium' | 'low';
  high_confidence_files?: Array<{ path: string }>;
  proposed_change?: string;
}

export function deduplicateTasks<T extends DeduplicableTask>(tasks: T[]): T[] {
  const kept: T[] = [];

  for (const task of tasks) {
    let isDuplicate = false;
    for (let i = 0; i < kept.length; i++) {
      if (taskSimilarity(task, kept[i]) > 0.55) {
        // Keep the one with higher confidence
        if (confidenceRank(task.confidence) > confidenceRank(kept[i].confidence)) {
          kept[i] = task;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(task);
    }
  }

  return kept;
}

function confidenceRank(confidence?: string): number {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  if (confidence === 'low') return 1;
  return 0;
}

function taskSimilarity(a: DeduplicableTask, b: DeduplicableTask): number {
  const titleSim = similarity(
    a.title.toLowerCase().trim(),
    b.title.toLowerCase().trim(),
  );

  const filesA = (a.high_confidence_files || []).map(f => f.path);
  const filesB = (b.high_confidence_files || []).map(f => f.path);
  const hasFiles = filesA.length > 0 || filesB.length > 0;
  const fileSim = hasFiles ? setSimilarity(new Set(filesA), new Set(filesB)) : 0;

  const hasChange = (a.proposed_change || '').length > 0 || (b.proposed_change || '').length > 0;
  const changeSim = hasChange
    ? similarity((a.proposed_change || '').toLowerCase().trim(), (b.proposed_change || '').toLowerCase().trim())
    : 0;

  // Adaptive weighting: when signals are missing, redistribute weight to title
  if (!hasFiles && !hasChange) {
    return titleSim; // title-only comparison (backward compatible)
  }
  if (!hasFiles) {
    return titleSim * 0.7 + changeSim * 0.3;
  }
  if (!hasChange) {
    return titleSim * 0.5 + fileSim * 0.5;
  }
  return titleSim * 0.4 + fileSim * 0.4 + changeSim * 0.2;
}

function setSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Jaccard similarity on words
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  return setSimilarity(wordsA, wordsB);
}
