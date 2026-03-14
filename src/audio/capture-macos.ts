import { AudioTee } from 'audiotee';
import { logger } from '../utils/logger.js';
import { TypedEmitter } from '../utils/typed-emitter.js';
import type { AudioSource, AudioSourceEvents } from './types.js';

export class MacOSAudioCapture extends TypedEmitter<AudioSourceEvents> implements AudioSource {
  private tee: AudioTee;

  constructor() {
    super();
    this.tee = new AudioTee({
      sampleRate: 16000,
      chunkDurationMs: 100,
      mute: false,
    });

    this.tee.on('data', (chunk) => {
      this.emit('data', chunk.data);
    });

    this.tee.on('error', (err) => {
      logger.error(`Audio capture error: ${err.message}`);
      this.emit('error', err);
    });

    this.tee.on('start', () => {
      logger.debug('Audio capture started');
    });

    this.tee.on('stop', () => {
      logger.debug('Audio capture stopped');
    });

    this.tee.on('log', (level: string, msg: any) => {
      logger.debug(`[audiotee ${level}] ${msg?.message || JSON.stringify(msg)}`);
    });
  }

  async start(): Promise<void> {
    try {
      await this.tee.start();
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('permission') || error.message.includes('Permission')) {
        throw new Error(
          'System audio capture permission required.\n' +
          'Go to System Settings > Privacy & Security > Audio Recording\n' +
          'and enable access for your terminal app.'
        );
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.tee.stop();
  }

  isActive(): boolean {
    return this.tee.isActive();
  }

}
