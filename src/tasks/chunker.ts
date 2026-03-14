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

export function deduplicateTasks<T extends { title: string }>(tasks: T[]): T[] {
  const seen = new Map<string, T>();

  for (const task of tasks) {
    const normalized = task.title.toLowerCase().trim();

    let isDuplicate = false;
    for (const [key] of seen) {
      if (similarity(normalized, key) > 0.7) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seen.set(normalized, task);
    }
  }

  return Array.from(seen.values());
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Simple Jaccard similarity on words
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}
