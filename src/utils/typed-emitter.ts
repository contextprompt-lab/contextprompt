/**
 * A minimal typed event emitter. Replaces the identical `on`/`emit`/`listeners`
 * boilerplate duplicated across AudioCapture, MicCapture, AudioMixer, and
 * DeepgramTranscriber.
 */
export class TypedEmitter<Events extends Record<string, (...args: any[]) => void>> {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof Events & string>(event: K, listener: Events[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof Events & string>(event: K, listener: Events[K]): void {
    this.listeners.get(event)?.delete(listener);
  }

  protected emit<K extends keyof Events & string>(event: K, ...args: Parameters<Events[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        fn(...args);
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
