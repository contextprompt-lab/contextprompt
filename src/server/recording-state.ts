export interface RecordingState {
  status: 'idle' | 'recording' | 'processing';
  startedAt: string | null;
  pid: number | null;
  repos: string[];
  logs: string[];
}

const initialState: RecordingState = {
  status: 'idle',
  startedAt: null,
  pid: null,
  repos: [],
  logs: [],
};

let state: RecordingState = { ...initialState };

export function getRecordingState(): RecordingState {
  return { ...state };
}

export function setRecordingState(partial: Partial<RecordingState>): void {
  Object.assign(state, partial);
}

export function addRecordingLog(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  state.logs.push(trimmed);
  if (state.logs.length > 50) {
    state.logs = state.logs.slice(-50);
  }
}

export function resetRecordingState(): void {
  const logs = state.logs; // preserve logs
  state = { ...initialState, logs };
}
