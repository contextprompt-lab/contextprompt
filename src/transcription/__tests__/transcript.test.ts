import { describe, it, expect } from 'vitest';
import { Transcript } from '../transcript.js';
import type { Utterance } from '../types.js';

function makeUtterance(overrides: Partial<Utterance> = {}): Utterance {
  return {
    speaker: 'speaker_0',
    text: 'Hello world',
    startTime: 0,
    endTime: 1,
    ...overrides,
  };
}

describe('Transcript', () => {
  describe('addUtterance', () => {
    it('creates a new segment for the first utterance', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance());
      expect(t.getSegments()).toHaveLength(1);
      expect(t.getSegments()[0].text).toBe('Hello world');
    });

    it('merges same-speaker utterances within gap threshold', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ startTime: 0, endTime: 1 }));
      t.addUtterance(makeUtterance({ text: 'How are you', startTime: 1.5, endTime: 3 }));

      const segs = t.getSegments();
      expect(segs).toHaveLength(1);
      expect(segs[0].text).toContain('Hello world');
      expect(segs[0].text).toContain('How are you');
      expect(segs[0].endTime).toBe(3);
    });

    it('does NOT merge same-speaker utterances beyond gap threshold', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ startTime: 0, endTime: 1 }));
      t.addUtterance(makeUtterance({ text: 'Later', startTime: 5, endTime: 6 }));

      expect(t.getSegments()).toHaveLength(2);
    });

    it('does NOT merge different speakers', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ speaker: 'speaker_0', startTime: 0, endTime: 1 }));
      t.addUtterance(makeUtterance({ speaker: 'speaker_1', text: 'Reply', startTime: 1, endTime: 2 }));

      expect(t.getSegments()).toHaveLength(2);
    });

    it('adds punctuation when merging if missing', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ text: 'Hello world', startTime: 0, endTime: 1 }));
      t.addUtterance(makeUtterance({ text: 'Next part', startTime: 1, endTime: 2 }));

      const segs = t.getSegments();
      expect(segs[0].text).toBe('Hello world. Next part');
    });

    it('does NOT add punctuation when already present', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ text: 'Hello world.', startTime: 0, endTime: 1 }));
      t.addUtterance(makeUtterance({ text: 'Next part', startTime: 1, endTime: 2 }));

      const segs = t.getSegments();
      expect(segs[0].text).toBe('Hello world. Next part');
    });
  });

  describe('speaker labels', () => {
    it('maps custom labels to speakers by order', () => {
      const t = new Transcript(['Alice', 'Bob']);
      expect(t.getSpeakerLabel('speaker_0')).toBe('Alice');
      expect(t.getSpeakerLabel('speaker_1')).toBe('Bob');
    });

    it('falls back to Speaker N for unlabeled speakers', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ speaker: 'speaker_0' }));
      t.addUtterance(makeUtterance({ speaker: 'speaker_1', startTime: 5, endTime: 6 }));

      expect(t.getSpeakerLabel('speaker_0')).toBe('Speaker 1');
      expect(t.getSpeakerLabel('speaker_1')).toBe('Speaker 2');
    });

    it('tracks speaker order of first appearance', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ speaker: 'speaker_1', startTime: 0, endTime: 1 }));
      t.addUtterance(makeUtterance({ speaker: 'speaker_0', startTime: 5, endTime: 6 }));

      const map = t.getSpeakerMap();
      expect(map[0].id).toBe('speaker_1');
      expect(map[1].id).toBe('speaker_0');
    });
  });

  describe('getWordCount', () => {
    it('counts words across all segments', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance({ text: 'one two three', startTime: 0, endTime: 1 }));
      t.addUtterance(makeUtterance({ speaker: 'speaker_1', text: 'four five', startTime: 5, endTime: 6 }));

      expect(t.getWordCount()).toBe(5);
    });
  });

  describe('isEmpty', () => {
    it('returns true for empty transcript', () => {
      expect(new Transcript().isEmpty()).toBe(true);
    });

    it('returns false after adding utterance', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance());
      expect(t.isEmpty()).toBe(false);
    });
  });

  describe('formatTimestamp', () => {
    it('formats sub-hour as MM:SS', () => {
      const t = new Transcript();
      expect(t.formatTimestamp(125)).toBe('02:05');
    });

    it('formats multi-hour as H:MM:SS', () => {
      const t = new Transcript();
      expect(t.formatTimestamp(3661)).toBe('1:01:01');
    });

    it('formats zero', () => {
      const t = new Transcript();
      expect(t.formatTimestamp(0)).toBe('00:00');
    });
  });

  describe('toFormattedText', () => {
    it('formats segments with timestamp and speaker', () => {
      const t = new Transcript(['Alice']);
      t.addUtterance(makeUtterance({ text: 'Hello', startTime: 65, endTime: 66 }));

      const text = t.toFormattedText();
      expect(text).toBe('[01:05] Alice: Hello');
    });
  });

  describe('getSegments', () => {
    it('returns a defensive copy', () => {
      const t = new Transcript();
      t.addUtterance(makeUtterance());
      const segs = t.getSegments();
      segs.pop();
      expect(t.getSegments()).toHaveLength(1);
    });
  });
});
