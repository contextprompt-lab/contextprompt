export interface Utterance {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}
