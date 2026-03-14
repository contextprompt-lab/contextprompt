import { DeepgramClient } from '@deepgram/sdk';
import type { Utterance } from './types.js';
import { logger } from '../utils/logger.js';
import { TypedEmitter } from '../utils/typed-emitter.js';

type V1Socket = Awaited<ReturnType<InstanceType<typeof DeepgramClient>['listen']['v1']['connect']>>;

type DeepgramTranscriberEvents = {
  utterance: (utterance: Utterance) => void;
  error: (error: Error) => void;
};

export interface DeepgramAudioConfig {
  encoding: string;
  sampleRate: number;
  channels: number;
}

export class DeepgramTranscriber extends TypedEmitter<DeepgramTranscriberEvents> {
  private client: DeepgramClient;
  private socket: V1Socket | null = null;
  private buffer: Buffer[] = [];
  private connected = false;
  private closing = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private bytesSent = 0;
  private bytesBuffered = 0;
  private lastStatsTime = 0;

  constructor(apiKey: string) {
    super();
    this.client = new DeepgramClient({ apiKey });
  }

  async connect(audioConfig?: DeepgramAudioConfig): Promise<void> {
    const enc = audioConfig?.encoding ?? 'linear16';
    const rate = audioConfig?.sampleRate ?? 16000;
    const ch = audioConfig?.channels ?? 1;

    // The v5 SDK uses client.listen.v1.connect() for live streaming
    // Deepgram v5 SDK types are incomplete for live streaming config — cast required
    this.socket = await this.client.listen.v1.connect({
      model: 'nova-3',
      language: 'en',
      smart_format: true,
      diarize: true,
      interim_results: true,
      encoding: enc,
      sample_rate: rate,
      channels: ch,
      endpointing: 800,
      utterance_end_ms: 1500,
      vad_events: true,
    } as any);

    this.socket.on('open', () => {
      logger.debug('Deepgram connection opened');
      this.connected = true;
      this.flushBuffer();
    });

    let messageCount = 0;
    // SDK emits generic Response but we only care about ListenV1Results
    this.socket.on('message', (data: any) => {
      messageCount++;
      if (messageCount <= 3) {
        logger.debug(`Deepgram message #${messageCount}: type=${data.type}, is_final=${data.is_final}, transcript="${data.channel?.alternatives?.[0]?.transcript || ''}"`);
      }
      if (data.type !== 'Results') return;
      if (!data.is_final) return;

      const alternative = data.channel?.alternatives?.[0];
      if (!alternative?.transcript?.trim()) return;

      const words = alternative.words || [];
      if (words.length === 0) {
        this.emit('utterance', {
          speaker: 'speaker_0',
          text: alternative.transcript.trim(),
          startTime: data.start || 0,
          endTime: (data.start || 0) + (data.duration || 0),
        });
        return;
      }

      // Group words by speaker
      let currentSpeaker: number | undefined = words[0]?.speaker;
      let currentWords: string[] = [];
      let segmentStart = words[0]?.start || 0;

      for (const word of words) {
        if (word.speaker !== currentSpeaker) {
          if (currentWords.length > 0) {
            this.emit('utterance', {
              speaker: `speaker_${currentSpeaker ?? 0}`,
              text: currentWords.join(' '),
              startTime: segmentStart,
              endTime: word.start || 0,
            });
          }
          currentSpeaker = word.speaker;
          currentWords = [word.punctuated_word || word.word];
          segmentStart = word.start || 0;
        } else {
          currentWords.push(word.punctuated_word || word.word);
        }
      }

      if (currentWords.length > 0) {
        const lastWord = words[words.length - 1];
        this.emit('utterance', {
          speaker: `speaker_${currentSpeaker ?? 0}`,
          text: currentWords.join(' '),
          startTime: segmentStart,
          endTime: lastWord?.end || 0,
        });
      }
    });

    this.socket.on('error', (err: Error) => {
      logger.error(`Deepgram error: ${err.message}`);
      this.emit('error', err);
    });

    this.socket.on('close', () => {
      this.connected = false;
      if (!this.closing && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.warn(`Deepgram connection dropped, reconnecting (attempt ${this.reconnectAttempts})...`);
        setTimeout(() => this.connect(audioConfig).catch((err) => {
          logger.error(`Deepgram reconnect failed: ${(err as Error).message}`);
        }), 1000 * this.reconnectAttempts);
      } else {
        logger.debug('Deepgram connection closed');
      }
    });

    this.socket.connect();
    await this.socket.waitForOpen();
  }

  send(audioChunk: Buffer): void {
    if (this.connected && this.socket) {
      this.socket.sendMedia(audioChunk);
      this.bytesSent += audioChunk.length;
    } else {
      this.buffer.push(audioChunk);
      this.bytesBuffered += audioChunk.length;
      logger.debug(`[deepgram] Buffering ${audioChunk.length}B (not connected), total buffered: ${this.bytesBuffered}B`);
    }

    const now = Date.now();
    if (now - this.lastStatsTime >= 5000) {
      this.lastStatsTime = now;
      logger.debug(`[deepgram] bytesSent=${this.bytesSent} buffered=${this.bytesBuffered} connected=${this.connected}`);
    }
  }

  private flushBuffer(): void {
    if (!this.socket) return;
    for (const chunk of this.buffer) {
      this.socket.sendMedia(chunk);
    }
    this.buffer = [];
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.socket && this.connected) {
      // Tell Deepgram to flush remaining buffered audio and emit final results
      try {
        (this.socket as any).sendFinalize({ type: 'Finalize' });
      } catch {
        logger.debug('Failed to send finalize to Deepgram');
      }
      // Wait up to 2s for Deepgram to send final results before closing
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 2000);
        this.socket?.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.socket.close();
    } else if (this.socket) {
      this.socket.close();
    }
    this.socket = null;
    this.connected = false;
    this.removeAllListeners();
    this.buffer = [];
  }
}
