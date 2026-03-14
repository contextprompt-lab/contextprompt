export type AudioSourceEvents = {
  data: (chunk: Buffer) => void;
  error: (error: Error) => void;
};

export interface AudioSource {
  start(): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  on<K extends keyof AudioSourceEvents>(event: K, listener: AudioSourceEvents[K]): void;
}
