import { spawn, ChildProcess } from 'node:child_process';
import { logger } from '../utils/logger.js';
import { TypedEmitter } from '../utils/typed-emitter.js';
import { findFfmpeg, verifyFfmpeg, listDshowAudioDevices, findLoopbackDevice } from './ffmpeg.js';
import type { AudioSource, AudioSourceEvents } from './types.js';

export class WindowsAudioCapture extends TypedEmitter<AudioSourceEvents> implements AudioSource {
  private process: ChildProcess | null = null;
  private active = false;
  private deviceName: string | null = null;

  constructor(deviceName?: string) {
    super();
    this.deviceName = deviceName ?? null;
  }

  async start(): Promise<void> {
    const ffmpegPath = findFfmpeg();
    verifyFfmpeg(ffmpegPath);

    // Auto-detect loopback device if not specified
    if (!this.deviceName) {
      const devices = listDshowAudioDevices(ffmpegPath);
      logger.debug(`Available audio devices: ${devices.join(', ')}`);

      const loopback = findLoopbackDevice(devices);
      if (!loopback) {
        throw new Error(
          'No loopback audio device found.\n' +
          'Enable "Stereo Mix" in Windows Sound settings:\n' +
          '  1. Right-click the speaker icon in the taskbar → Sound settings\n' +
          '  2. More sound settings → Recording tab\n' +
          '  3. Right-click → Show Disabled Devices\n' +
          '  4. Right-click "Stereo Mix" → Enable\n\n' +
          `Available devices: ${devices.join(', ') || '(none found)'}\n` +
          'You can also specify a device with --audio-device "Device Name"'
        );
      }
      this.deviceName = loopback;
    }

    logger.debug(`Using audio device: ${this.deviceName}`);

    this.process = spawn(ffmpegPath, [
      '-f', 'dshow',
      '-audio_buffer_size', '50',
      '-i', `audio=${this.deviceName}`,
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      'pipe:1',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout!.on('data', (chunk: Buffer) => {
      this.emit('data', chunk);
    });

    this.process.stderr!.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) logger.debug(`[ffmpeg] ${msg}`);
    });

    this.process.on('error', (err) => {
      this.active = false;
      this.emit('error', new Error(`Audio capture failed: ${err.message}`));
    });

    this.process.on('close', (code) => {
      this.active = false;
      if (code && code !== 0) {
        logger.debug(`FFmpeg exited with code ${code}`);
      }
    });

    this.active = true;
    logger.debug('Windows audio capture started');
  }

  async stop(): Promise<void> {
    if (this.process) {
      // Send 'q' to ffmpeg's stdin for clean shutdown (SIGTERM doesn't exist on Windows)
      try {
        this.process.stdin!.write('q');
      } catch {
        // stdin may already be closed
      }

      // Give ffmpeg a moment to shut down cleanly, then force kill
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try {
            this.process?.kill();
          } catch {
            // already dead
          }
          resolve();
        }, 2000);

        this.process!.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }
    this.active = false;
    logger.debug('Windows audio capture stopped');
  }

  isActive(): boolean {
    return this.active;
  }

}
