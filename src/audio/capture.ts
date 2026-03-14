import { platform } from 'node:os';
import type { AudioSource } from './types.js';

export type { AudioSource, AudioSourceEvents } from './types.js';

/**
 * Create a platform-appropriate audio capture source.
 * Uses dynamic imports so audiotee (macOS-only) is never loaded on Windows.
 */
export async function createAudioCapture(audioDevice?: string): Promise<AudioSource> {
  const os = platform();

  if (os === 'darwin') {
    const { MacOSAudioCapture } = await import('./capture-macos.js');
    return new MacOSAudioCapture();
  }

  if (os === 'win32') {
    const { WindowsAudioCapture } = await import('./capture-windows.js');
    return new WindowsAudioCapture(audioDevice);
  }

  throw new Error(
    `Unsupported platform: ${os}. meetcode supports macOS and Windows.`
  );
}
