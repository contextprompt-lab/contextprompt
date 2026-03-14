import { TypedEmitter } from '../utils/typed-emitter.js';
import { logger } from '../utils/logger.js';

/**
 * Mixes two 16-bit signed LE PCM audio streams into one.
 * Buffers incoming chunks and mixes on a fixed interval.
 */
export type AudioMixerEvents = {
  data: (chunk: Buffer) => void;
};

export class AudioMixer extends TypedEmitter<AudioMixerEvents> {
  private systemBuffer: Buffer[] = [];
  private micBuffer: Buffer[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private mixIntervalMs: number;
  private mixCount = 0;
  private systemOnlyTicks = 0;
  private micOnlyTicks = 0;
  private bothTicks = 0;
  private emptyTicks = 0;
  private systemFormatChecked = false;
  private micFormatChecked = false;

  constructor(mixIntervalMs = 100) {
    super();
    this.mixIntervalMs = mixIntervalMs;
  }

  start(): void {
    this.interval = setInterval(() => this.mix(), this.mixIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Flush remaining
    this.mix();
  }

  pushSystem(chunk: Buffer): void {
    if (!this.systemFormatChecked && chunk.length >= 4) {
      this.checkFormat('system', chunk);
      this.systemFormatChecked = true;
    }
    this.systemBuffer.push(chunk);
  }

  pushMic(chunk: Buffer): void {
    if (!this.micFormatChecked && chunk.length >= 4) {
      this.checkFormat('mic', chunk);
      this.micFormatChecked = true;
    }
    this.micBuffer.push(chunk);
  }

  private checkFormat(source: string, chunk: Buffer): void {
    // Check if data looks like float32 instead of int16LE
    // Float32 audio samples are typically between -1.0 and 1.0
    // When read as int16LE, float32 data produces very large or very small values
    const sample0 = chunk.readInt16LE(0);
    const sample1 = chunk.readInt16LE(2);
    // Float32 silence (0.0) is 0x00000000, which reads as 0 in int16LE too — can't detect
    // But float32 1.0 is 0x3F800000, which reads as -32768 (0x8000) then 16256 (0x3F80) in int16LE
    // Heuristic: if the first sample looks like a float32 exponent byte pattern, warn
    if (chunk.length >= 8) {
      const asFloat = chunk.readFloatLE(0);
      if (Math.abs(asFloat) > 0 && Math.abs(asFloat) <= 2.0) {
        const maxInt16 = Math.max(Math.abs(sample0), Math.abs(sample1));
        if (maxInt16 > 16000) {
          logger.warn(`[mixer] ${source} audio may be float32 instead of int16LE (first samples: int16=${sample0},${sample1} float32=${asFloat.toFixed(4)})`);
        }
      }
    }
    logger.debug(`[mixer] First ${source} chunk: ${chunk.length} bytes, samples[0..1]=${sample0},${sample1}`);
  }

  private mix(): void {
    const systemData = this.drain(this.systemBuffer);
    const micData = this.drain(this.micBuffer);

    this.mixCount++;

    if (systemData.length === 0 && micData.length === 0) {
      this.emptyTicks++;
      return;
    }

    // Log mix stats every ~1s (10 ticks at 100ms interval)
    if (this.mixCount % 10 === 0) {
      logger.debug(
        `[mixer] tick=${this.mixCount}: sys=${systemData.length}B mic=${micData.length}B | ` +
        `ticks: both=${this.bothTicks} sysOnly=${this.systemOnlyTicks} micOnly=${this.micOnlyTicks} empty=${this.emptyTicks}`
      );
    }

    // If only one source has data, pass it through directly
    // (don't pad the missing source with silence — it just hasn't arrived yet)
    if (systemData.length === 0) {
      this.micOnlyTicks++;
      this.emit('data', micData);
      return;
    }
    if (micData.length === 0) {
      this.systemOnlyTicks++;
      this.emit('data', systemData);
      return;
    }

    this.bothTicks++;
    // Both sources have data: mix the overlapping portion, pass through the remainder
    const minLen = Math.min(systemData.length, micData.length);
    const maxLen = Math.max(systemData.length, micData.length);
    const output = Buffer.alloc(maxLen);

    // Mix overlapping samples with clamping
    for (let i = 0; i < minLen; i += 2) {
      const s = systemData.readInt16LE(i);
      const m = micData.readInt16LE(i);
      const mixed = Math.max(-32768, Math.min(32767, s + m));
      output.writeInt16LE(mixed, i);
    }

    // Copy remainder from whichever source was longer
    if (systemData.length > minLen) {
      systemData.copy(output, minLen, minLen);
    } else if (micData.length > minLen) {
      micData.copy(output, minLen, minLen);
    }

    this.emit('data', output);
  }

  private drain(buffers: Buffer[]): Buffer {
    if (buffers.length === 0) return Buffer.alloc(0);
    const combined = Buffer.concat(buffers);
    buffers.length = 0;
    // Ensure even length for 16-bit samples
    if (combined.length % 2 !== 0) {
      return combined.subarray(0, combined.length - 1);
    }
    return combined;
  }
}
