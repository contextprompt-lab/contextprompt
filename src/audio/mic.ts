import { spawn, ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import { logger } from '../utils/logger.js';
import { TypedEmitter } from '../utils/typed-emitter.js';
import { findFfmpeg } from './ffmpeg.js';

export type MicCaptureEvents = {
  data: (chunk: Buffer) => void;
  error: (error: Error) => void;
};

export class MicCapture extends TypedEmitter<MicCaptureEvents> {
  private process: ChildProcess | null = null;
  private sampleRate: number;
  private lastChunkTime = 0;
  private totalBytes = 0;
  private chunkCount = 0;

  constructor(sampleRate = 16000) {
    super();
    this.sampleRate = sampleRate;
  }

  async start(): Promise<void> {
    if (platform() === 'win32') {
      this.startWindows();
    } else {
      this.startUnix();
    }
  }

  private startUnix(): void {
    // Use sox's `rec` to capture from default mic as raw 16-bit signed LE PCM
    this.process = spawn('rec', [
      '-q',                    // quiet
      '-t', 'raw',             // raw PCM output
      '-b', '16',              // 16-bit
      '-e', 'signed-integer',  // signed int
      '-r', String(this.sampleRate),
      '-c', '1',               // mono
      '-L',                    // little-endian
      '-',                     // stdout
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.wireProcess('Install sox: brew install sox');
  }

  private startWindows(): void {
    const ffmpegPath = findFfmpeg();

    // Use ffmpeg to capture from default microphone via DirectShow
    this.process = spawn(ffmpegPath, [
      '-f', 'dshow',
      '-i', 'audio=default',
      '-ar', String(this.sampleRate),
      '-ac', '1',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      'pipe:1',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.wireProcess('Install FFmpeg and ensure a microphone is available');
  }

  private wireProcess(installHint: string): void {
    this.process!.stdout!.on('data', (chunk: Buffer) => {
      const now = Date.now();
      this.chunkCount++;
      this.totalBytes += chunk.length;

      if (this.lastChunkTime > 0) {
        const gap = now - this.lastChunkTime;
        if (gap > 500) {
          logger.debug(`[mic] Gap detected: ${gap}ms between chunks`);
        }
      }
      this.lastChunkTime = now;

      if (this.chunkCount % 50 === 0) {
        logger.debug(`[mic] chunks=${this.chunkCount} totalBytes=${this.totalBytes} lastChunkSize=${chunk.length}`);
      }

      this.emit('data', chunk);
    });

    this.process!.stderr!.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) logger.debug(`[mic] ${msg}`);
    });

    this.process!.on('error', (err) => {
      this.emit('error', new Error(`Mic capture failed: ${err.message}. ${installHint}`));
    });

    this.process!.on('close', (code) => {
      if (code && code !== 0) {
        logger.debug(`Mic process exited with code ${code}`);
      }
    });

    logger.debug('Microphone capture started');
  }

  async stop(): Promise<void> {
    if (this.process) {
      if (platform() === 'win32') {
        // Send 'q' to ffmpeg stdin for clean shutdown
        try {
          this.process.stdin!.write('q');
        } catch {
          // stdin may already be closed
        }
      } else {
        this.process.kill('SIGTERM');
      }
      this.process = null;
    }
    logger.debug('Microphone capture stopped');
  }

}
