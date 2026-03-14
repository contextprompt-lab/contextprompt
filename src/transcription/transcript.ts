import type { TranscriptSegment, Utterance } from './types.js';

export class Transcript {
  private segments: TranscriptSegment[] = [];
  private speakerOrder: string[] = [];
  private speakerLabels: Map<string, string> = new Map();

  constructor(labels?: string[]) {
    if (labels) {
      // Labels will be mapped to speakers in order of first appearance
      this.speakerLabels = new Map();
      labels.forEach((label, i) => {
        this.speakerLabels.set(`speaker_${i}`, label);
      });
    }
  }

  addUtterance(utterance: Utterance): void {
    // Track speaker order of first appearance
    if (!this.speakerOrder.includes(utterance.speaker)) {
      this.speakerOrder.push(utterance.speaker);
    }

    const last = this.segments[this.segments.length - 1];

    // Merge consecutive segments from the same speaker if close in time
    const GAP_THRESHOLD = 2; // seconds
    if (
      last &&
      last.speaker === utterance.speaker &&
      utterance.startTime - last.endTime < GAP_THRESHOLD
    ) {
      // Ensure sentence boundary with proper punctuation
      const lastChar = last.text.trim().slice(-1);
      const needsPunctuation = !['.', '!', '?', ',', ';', ':'].includes(lastChar);
      last.text = last.text.trim() + (needsPunctuation ? '.' : '') + ' ' + utterance.text;
      last.endTime = utterance.endTime;
    } else {
      this.segments.push({
        speaker: utterance.speaker,
        text: utterance.text,
        startTime: utterance.startTime,
        endTime: utterance.endTime,
      });
    }
  }

  getSpeakerLabel(speakerId: string): string {
    if (this.speakerLabels.has(speakerId)) {
      return this.speakerLabels.get(speakerId)!;
    }
    const index = this.speakerOrder.indexOf(speakerId);
    return `Speaker ${index + 1}`;
  }

  getSpeakerMap(): Array<{ id: string; label: string }> {
    return this.speakerOrder.map((id) => ({
      id,
      label: this.getSpeakerLabel(id),
    }));
  }

  getSegments(): TranscriptSegment[] {
    return [...this.segments];
  }

  getWordCount(): number {
    return this.segments.reduce((count, seg) => count + seg.text.split(/\s+/).length, 0);
  }

  formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  toFormattedText(): string {
    return this.segments
      .map((seg) => {
        const ts = this.formatTimestamp(seg.startTime);
        const label = this.getSpeakerLabel(seg.speaker);
        return `[${ts}] ${label}: ${seg.text}`;
      })
      .join('\n');
  }

  isEmpty(): boolean {
    return this.segments.length === 0;
  }
}
