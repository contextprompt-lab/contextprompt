import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { logger } from '../utils/logger.js';

/**
 * Locate the ffmpeg binary. Checks:
 * 1. Same directory as the running executable (for bundled distribution)
 * 2. System PATH
 */
export function findFfmpeg(): string {
  // Check next to the executable (for packaged distributions)
  const exeDir = dirname(process.execPath);
  const localFfmpeg = join(exeDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (existsSync(localFfmpeg)) {
    return localFfmpeg;
  }

  // Fall back to PATH
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}

/**
 * Verify ffmpeg is available and return its version string.
 * Throws a helpful error if not found.
 */
export function verifyFfmpeg(ffmpegPath: string): string {
  try {
    const output = execFileSync(ffmpegPath, ['-version'], {
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const firstLine = output.split('\n')[0] ?? '';
    logger.debug(`Found ffmpeg: ${firstLine}`);
    return firstLine;
  } catch {
    throw new Error(
      'FFmpeg is required for audio capture on Windows but was not found.\n' +
      'Download it from https://www.gyan.dev/ffmpeg/builds/ (get the "essentials" build)\n' +
      'and place ffmpeg.exe in the same folder as contextprompt, or add it to your PATH.'
    );
  }
}

/**
 * List available DirectShow audio devices on Windows.
 * Returns an array of device names.
 */
export function listDshowAudioDevices(ffmpegPath: string): string[] {
  try {
    // ffmpeg prints device list to stderr and exits with error code
    const result = execFileSync(ffmpegPath, [
      '-list_devices', 'true',
      '-f', 'dshow',
      '-i', 'dummy',
    ], {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseDshowDevices(result);
  } catch (err: any) {
    // ffmpeg always exits with error for -list_devices, output is in stderr
    const stderr = err.stderr || '';
    return parseDshowDevices(stderr);
  }
}

function parseDshowDevices(output: string): string[] {
  const devices: string[] = [];
  let inAudioSection = false;

  for (const line of output.split('\n')) {
    if (line.includes('DirectShow audio devices')) {
      inAudioSection = true;
      continue;
    }
    if (line.includes('DirectShow video devices')) {
      inAudioSection = false;
      continue;
    }
    if (inAudioSection) {
      // Lines look like: [dshow @ ...] "Device Name"
      const match = line.match(/"([^"]+)"/);
      if (match && !line.includes('Alternative name')) {
        devices.push(match[1]);
      }
    }
  }

  return devices;
}

/**
 * Find the best loopback audio device for system audio capture.
 * Prefers devices with "Stereo Mix", "What U Hear", or "Loopback" in the name.
 */
export function findLoopbackDevice(devices: string[]): string | null {
  const loopbackKeywords = ['stereo mix', 'what u hear', 'loopback', 'wave out'];

  // First try: look for known loopback device names
  for (const device of devices) {
    const lower = device.toLowerCase();
    if (loopbackKeywords.some((kw) => lower.includes(kw))) {
      return device;
    }
  }

  // If no obvious loopback device, return null — user may need to enable Stereo Mix
  return null;
}
