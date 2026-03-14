import { describe, it, expect } from 'vitest';
import { shouldChunk, chunkTranscript, deduplicateTasks } from '../chunker.js';

describe('shouldChunk', () => {
  it('returns false for short transcripts', () => {
    expect(shouldChunk('Hello world')).toBe(false);
  });

  it('returns true for transcripts exceeding 100k tokens', () => {
    // 100k tokens * 4 chars/token = 400k chars
    const long = 'a'.repeat(400_001);
    expect(shouldChunk(long)).toBe(true);
  });

  it('returns false at exactly the boundary', () => {
    const exact = 'a'.repeat(400_000);
    expect(shouldChunk(exact)).toBe(false);
  });
});

describe('chunkTranscript', () => {
  it('returns a single chunk for short text', () => {
    const text = 'Hello world';
    const chunks = chunkTranscript(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('splits long text into multiple chunks', () => {
    // Create text > 400k chars
    const lines = Array.from({ length: 50_000 }, (_, i) => `Line ${i}: ${'x'.repeat(10)}`);
    const text = lines.join('\n');
    const chunks = chunkTranscript(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('chunks have overlap', () => {
    const lines = Array.from({ length: 50_000 }, (_, i) => `Line ${i}: ${'x'.repeat(10)}`);
    const text = lines.join('\n');
    const chunks = chunkTranscript(text);

    if (chunks.length >= 2) {
      // The end of chunk 0 should overlap with the start of chunk 1
      const endOfFirst = chunks[0].slice(-100);
      expect(chunks[1]).toContain(endOfFirst);
    }
  });

  it('covers the entire input', () => {
    const lines = Array.from({ length: 50_000 }, (_, i) => `Line ${i}: ${'x'.repeat(10)}`);
    const text = lines.join('\n');
    const chunks = chunkTranscript(text);

    // First chunk starts at the beginning
    expect(chunks[0].startsWith('Line 0')).toBe(true);
    // Last chunk ends at the end
    expect(chunks[chunks.length - 1].endsWith('x'.repeat(10))).toBe(true);
  });
});

describe('deduplicateTasks', () => {
  it('removes tasks with similar titles', () => {
    const tasks = [
      { title: 'Add user authentication to login page' },
      { title: 'Add user authentication to the login page' },
    ];
    const result = deduplicateTasks(tasks);
    expect(result).toHaveLength(1);
  });

  it('keeps tasks with dissimilar titles', () => {
    const tasks = [
      { title: 'Add user authentication' },
      { title: 'Fix database connection pooling' },
    ];
    const result = deduplicateTasks(tasks);
    expect(result).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(deduplicateTasks([])).toEqual([]);
  });

  it('handles single task', () => {
    const tasks = [{ title: 'Only task' }];
    const result = deduplicateTasks(tasks);
    expect(result).toHaveLength(1);
  });

  it('keeps first occurrence when duplicates found', () => {
    const tasks = [
      { title: 'Add feature X', id: 'first' },
      { title: 'Add feature X', id: 'second' },
    ];
    const result = deduplicateTasks(tasks);
    expect(result).toHaveLength(1);
    expect((result[0] as any).id).toBe('first');
  });
});
