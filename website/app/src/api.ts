const BASE = '/api';

export function getWsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Meetings
export interface Meeting {
  id: number;
  date: string;
  duration_minutes: number;
  speaker_count: number;
  task_count: number;
  status: string;
  output_path: string | null;
  created_at: string;
}

export interface MeetingDetail extends Meeting {
  transcript: string | null;
  plan: {
    decisions: string[];
    tasks: TaskDetail[];
  } | null;
  tasks: TaskDetail[];
}

export interface TaskDetail {
  id: number;
  task_id: string;
  title: string;
  status: string;
  confidence: string;
  confidence_reason: string | null;
  proposed_change: string | null;
  evidence: string | null;
  files: Array<{ path: string; reason: string }>;
  steps: string[];
  dependencies: string[];
  ambiguities: string[];
  github_issue_url: string | null;
}

export const getMeetings = () => request<Meeting[]>('/meetings');
export const getMeeting = (id: number) => request<MeetingDetail>(`/meetings/${id}`);
export const deleteMeeting = (id: number) => request<{ ok: true }>(`/meetings/${id}`, { method: 'DELETE' });

// Repos
export interface Repo {
  id: number;
  path: string;
  name: string;
  last_used: string | null;
  github_owner: string | null;
  github_repo: string | null;
  exists: boolean;
  created_at: string;
}

export const getRepos = () => request<Repo[]>('/repos');
export const addRepo = (path: string) => request<{ id: number; path: string; name: string }>('/repos', {
  method: 'POST',
  body: JSON.stringify({ path }),
});
export const removeRepo = (id: number) => request<{ ok: true }>(`/repos/${id}`, { method: 'DELETE' });
export const connectRepoGithub = (id: number, owner?: string, repo?: string) =>
  request<{ ok: true; github_owner: string; github_repo: string }>(`/repos/${id}/github`, {
    method: 'PATCH',
    body: JSON.stringify({ owner, repo }),
  });
export const disconnectRepoGithub = (id: number) =>
  request<{ ok: true }>(`/repos/${id}/github`, { method: 'DELETE' });

// Folder browser (server-side, for local dev)
export interface BrowseResult {
  current: string;
  parent: string;
  dirs: Array<{ name: string; path: string; isGitRepo: boolean }>;
}

export const browseFolders = (path?: string) =>
  request<BrowseResult>(`/repos/browse${path ? `?path=${encodeURIComponent(path)}` : ''}`);

// Upload repo (for deployed use — files read client-side via File System Access API)
export interface UploadFile {
  path: string;
  content: string;
}

export async function uploadRepo(name: string, files: UploadFile[]) {
  return request<{ id: number; path: string; name: string }>('/repos/upload', {
    method: 'POST',
    body: JSON.stringify({ name, files }),
  });
}

// Check if File System Access API is available
export function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}

// Read a directory recursively using File System Access API
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt',
  'coverage', '.cache', '.turbo', 'vendor', '__pycache__',
  '.venv', 'venv', 'target', '.DS_Store',
]);

const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot',
  '.lock', '.map',
  '.mp3', '.mp4', '.wav', '.avi',
  '.zip', '.tar', '.gz',
  '.pdf', '.doc', '.docx',
  '.exe', '.dll', '.so', '.dylib',
]);

const MAX_FILE_SIZE = 100_000; // 100KB per file
const MAX_TOTAL_FILES = 2000;

export async function readDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (count: number) => void,
): Promise<{ name: string; files: UploadFile[] }> {
  const files: UploadFile[] = [];

  async function walk(handle: FileSystemDirectoryHandle, prefix: string) {
    if (files.length >= MAX_TOTAL_FILES) return;

    for await (const entry of handle.values()) {
      if (files.length >= MAX_TOTAL_FILES) break;

      if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
        await walk(entry as FileSystemDirectoryHandle, `${prefix}${entry.name}/`);
      } else {
        const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()!.toLowerCase() : '';
        if (SKIP_EXT.has(ext)) continue;

        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (file.size > MAX_FILE_SIZE) continue;

          const content = await file.text();
          // Skip binary-looking files
          if (content.includes('\0')) continue;

          files.push({ path: `${prefix}${entry.name}`, content });
          onProgress?.(files.length);
        } catch {
          // Skip files we can't read
        }
      }
    }
  }

  await walk(dirHandle, '');
  return { name: dirHandle.name, files };
}

// Recording
export interface RecordingStatus {
  status: 'idle' | 'recording' | 'processing';
  startedAt: string | null;
  pid: number | null;
  repos: string[];
  logs: string[];
}

export const getRecordingStatus = () => request<RecordingStatus>('/recording/status');
export const startRecording = (opts: {
  repos?: number[];
  mic?: boolean;
  micOnly?: boolean;
  model?: string;
  speakers?: string[];
}) => request<{ ok: true; pid: number }>('/recording/start', {
  method: 'POST',
  body: JSON.stringify(opts),
});
export const stopRecording = () => request<{ ok: true }>('/recording/stop', { method: 'POST' });

// Settings
export const getSettings = () => request<Record<string, string>>('/settings');
export const setSetting = (key: string, value: string) => request<{ ok: true }>(`/settings/${key}`, {
  method: 'PUT',
  body: JSON.stringify({ value }),
});

// GitHub Issues
export interface GitHubIssueSummary {
  number: number;
  title: string;
  url: string;
  author: string;
  labels: string[];
  createdAt: string;
  repo_id: number;
  repo_name: string;
  github_owner: string;
  github_repo: string;
}

export interface IssueAnalysis {
  id: number;
  repo_id: number;
  repo_name: string;
  issue_number: number;
  issue_url: string;
  issue_title: string;
  issue_author: string | null;
  task_count: number;
  status: string;
  error: string | null;
  created_at: string;
}

export interface IssueAnalysisDetail extends IssueAnalysis {
  issue_body: string | null;
  labels: string[];
  plan: {
    decisions: string[];
    fix_summary: string;
    execution_buckets: {
      ready_now: string[];
      review_before_execution: string[];
      needs_clarification: string[];
    };
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      confidence: string;
      confidence_reason: string;
      why_this_task_exists: string;
      proposed_change: string;
      high_confidence_files: Array<{ path: string; reason: string }>;
      possible_related_files: Array<{ path: string; reason: string }>;
      evidence: string;
      ambiguities: string[];
      task_assumptions: string[];
      dependencies: string[];
      agent_steps: string[];
    }>;
    assumptions: string[];
    incomplete_items: Array<{ text: string; evidence: string; why_incomplete: string }>;
  } | null;
}

export const getGithubIssues = (repoId?: number) =>
  request<GitHubIssueSummary[]>(`/issues${repoId ? `?repo_id=${repoId}` : ''}`);
export const getIssueAnalyses = (repoId?: number) =>
  request<IssueAnalysis[]>(`/issues/analyses${repoId ? `?repo_id=${repoId}` : ''}`);
export const getIssueAnalysis = (id: number) =>
  request<IssueAnalysisDetail>(`/issues/analyses/${id}`);
export const getAnalysisStatus = (id: number) =>
  request<{ id: number; status: string; error: string | null }>(`/issues/analyses/${id}/status`);
export const analyzeIssue = (repoId: number, issueNumber: number) =>
  request<{ id: number; status: string }>('/issues/analyze', {
    method: 'POST',
    body: JSON.stringify({ repo_id: repoId, issue_number: issueNumber }),
  });
export const deleteIssueAnalysis = (id: number) =>
  request<{ ok: true }>(`/issues/analyses/${id}`, { method: 'DELETE' });

// Recall.ai Bots
export interface BotStatus {
  bot_id: string;
  meeting_id: number | null;
  status: string;
  status_changes: Array<{ code: string; sub_code: string | null; created_at: string }>;
  has_recording: boolean;
}

export const getRecallStatus = () => request<{ configured: boolean }>('/bots/status');
export const sendBot = (meetingUrl: string, repoIds?: number[], botName?: string) =>
  request<{ bot_id: string; meeting_id: number; status: string }>('/bots', {
    method: 'POST',
    body: JSON.stringify({ meeting_url: meetingUrl, repo_ids: repoIds, bot_name: botName }),
  });
export const getBotStatus = (botId: string) => request<BotStatus>(`/bots/${botId}`);
export const leaveBotCall = (botId: string) =>
  request<{ ok: true }>(`/bots/${botId}/leave`, { method: 'POST' });
