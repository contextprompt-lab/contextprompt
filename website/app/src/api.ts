const BASE = '/api';

export function getWsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    // Session expired — reload to show login
    window.location.reload();
    throw new Error('Session expired');
  }
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
export const rerunMeeting = (id: number) => request<{ ok: true; status: string }>(`/meetings/${id}/rerun`, { method: 'POST' });

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
export const registerBrowserRepo = (name: string) =>
  request<{ id: number; path: string; name: string }>('/repos/register', {
    method: 'POST',
    body: JSON.stringify({ name }),
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

// --- File System Access API (client-side scanning, no files sent to server) ---

export function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}

// RepoMap types (matches server-side src/repo/types.ts)
export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum';
  signature?: string;
}

export interface FileEntry {
  path: string;
  exports: ExportInfo[];
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface ClientRepoMap {
  name: string;
  rootPath: string;
  fileTree: string;
  files: FileEntry[];
  readme: string | null;
  sourceFiles: SourceFile[];
}

// --- IndexedDB for storing DirectoryHandles across sessions ---

const DB_NAME = 'contextprompt';
const STORE_NAME = 'directory_handles';

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'repoId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(repoId: number, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ repoId, handle, name: handle.name });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDirectoryHandle(repoId: number): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(repoId);
    req.onsuccess = () => resolve(req.result?.handle ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function removeDirectoryHandle(repoId: number): Promise<void> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(repoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Client-side repo scanner ---

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt',
  'coverage', '.cache', '.turbo', 'vendor', '__pycache__',
  '.venv', 'venv', 'target',
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

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.py', '.go', '.rs', '.java', '.rb', '.swift']);

const MAX_FILE_SIZE = 200_000; // Skip individual files larger than 200KB
const MAX_TOTAL_FILES = 5000;
const README_MAX_LINES = 100;

// Regex-based export extraction (lightweight, runs in browser)
function extractExportsFromSource(content: string, ext: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  if (!['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'].includes(ext)) return exports;

  const lines = content.split('\n');
  for (const line of lines) {
    // export function name(...)
    const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) { exports.push({ name: funcMatch[1], kind: 'function' }); continue; }

    // export class Name
    const classMatch = line.match(/export\s+class\s+(\w+)/);
    if (classMatch) { exports.push({ name: classMatch[1], kind: 'class' }); continue; }

    // export interface Name
    const ifaceMatch = line.match(/export\s+interface\s+(\w+)/);
    if (ifaceMatch) { exports.push({ name: ifaceMatch[1], kind: 'interface' }); continue; }

    // export type Name
    const typeMatch = line.match(/export\s+type\s+(\w+)/);
    if (typeMatch) { exports.push({ name: typeMatch[1], kind: 'type' }); continue; }

    // export const name
    const constMatch = line.match(/export\s+const\s+(\w+)/);
    if (constMatch) { exports.push({ name: constMatch[1], kind: 'const' }); continue; }

    // export enum Name
    const enumMatch = line.match(/export\s+enum\s+(\w+)/);
    if (enumMatch) { exports.push({ name: enumMatch[1], kind: 'enum' }); continue; }

    // export default function/class
    const defaultMatch = line.match(/export\s+default\s+(?:(?:async\s+)?function|class)\s+(\w+)/);
    if (defaultMatch) { exports.push({ name: defaultMatch[1], kind: 'function' }); continue; }
  }

  return exports;
}

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.|__tests__|__mocks__/.test(path);
}

/**
 * Scan a local directory via File System Access API and build a RepoMap.
 * No files are sent to the server — only the resulting RepoMap metadata.
 */
export async function scanDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (msg: string) => void,
): Promise<ClientRepoMap> {
  const allPaths: string[] = [];
  const fileContents = new Map<string, string>();
  let readme: string | null = null;
  let fileCount = 0;

  async function walk(handle: FileSystemDirectoryHandle, prefix: string) {
    if (fileCount >= MAX_TOTAL_FILES) return;

    for await (const entry of handle.values()) {
      if (fileCount >= MAX_TOTAL_FILES) break;

      if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        const dirPath = `${prefix}${entry.name}/`;
        allPaths.push(dirPath);
        await walk(entry as FileSystemDirectoryHandle, dirPath);
      } else {
        const filePath = `${prefix}${entry.name}`;
        const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()!.toLowerCase() : '';
        if (SKIP_EXT.has(ext)) continue;

        allPaths.push(filePath);
        fileCount++;
        onProgress?.(`Scanning... (${fileCount} files)`);

        // Read README
        if (!readme && /^readme\.md$/i.test(entry.name) && !prefix) {
          try {
            const file = await (entry as FileSystemFileHandle).getFile();
            const text = await file.text();
            readme = text.split('\n').slice(0, README_MAX_LINES).join('\n');
          } catch { /* skip */ }
        }

        // Read all text files for source content
        if (!isTestFile(filePath)) {
          try {
            const file = await (entry as FileSystemFileHandle).getFile();
            if (file.size <= MAX_FILE_SIZE) {
              const content = await file.text();
              // Skip binary-looking files
              if (!content.includes('\0')) {
                fileContents.set(filePath, content);
              }
            }
          } catch { /* skip */ }
        }
      }
    }
  }

  onProgress?.('Scanning...');
  await walk(dirHandle, '');

  // Build file tree
  const fileTree = buildFileTree(allPaths);

  // Extract exports from source files
  const files: FileEntry[] = [];
  for (const [path, content] of fileContents) {
    const ext = '.' + path.split('.').pop()!.toLowerCase();
    const exports = extractExportsFromSource(content, ext);
    if (exports.length > 0) {
      files.push({ path, exports });
    }
  }

  // Include all source file contents
  const sourceFiles: SourceFile[] = [...fileContents.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([path, content]) => ({ path, content }));

  onProgress?.(`Scanned ${fileCount} files, ${sourceFiles.length} source files`);

  return {
    name: dirHandle.name,
    rootPath: `browser://${dirHandle.name}`,
    fileTree,
    files,
    readme,
    sourceFiles,
  };
}

function buildFileTree(paths: string[]): string {
  // Simple indented tree
  const sorted = [...paths].sort();
  const lines: string[] = [];
  for (const p of sorted) {
    const depth = p.split('/').filter(Boolean).length - 1;
    const name = p.endsWith('/') ? p.split('/').filter(Boolean).pop()! + '/' : p.split('/').pop()!;
    lines.push('  '.repeat(depth) + name);
  }
  return lines.join('\n');
}

// Build repo maps for all browser-connected repos (called before analysis)
export async function buildRepoMaps(
  repoIds: number[],
  onProgress?: (msg: string) => void,
): Promise<ClientRepoMap[]> {
  const maps: ClientRepoMap[] = [];

  for (const repoId of repoIds) {
    const handle = await getDirectoryHandle(repoId);
    if (!handle) continue;

    // Verify we still have permission
    const permission = await (handle as any).queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      const requested = await (handle as any).requestPermission({ mode: 'read' });
      if (requested !== 'granted') continue;
    }

    onProgress?.(`Scanning ${handle.name}...`);
    const map = await scanDirectoryHandle(handle, onProgress);
    maps.push(map);
  }

  return maps;
}

// Send repo maps with bot request
export const sendBot = (meetingUrl: string, repoIds?: number[], botName?: string, repoMaps?: ClientRepoMap[]) =>
  request<{ bot_id: string; meeting_id: number; status: string }>('/bots', {
    method: 'POST',
    body: JSON.stringify({ meeting_url: meetingUrl, repo_ids: repoIds, bot_name: botName, repo_maps: repoMaps }),
  });

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
export const getBotStatus = (botId: string) => request<BotStatus>(`/bots/${botId}`);
export const leaveBotCall = (botId: string) =>
  request<{ ok: true }>(`/bots/${botId}/leave`, { method: 'POST' });

// Auth
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  plan: 'none' | 'free' | 'pro';
  is_admin: boolean;
  usage: {
    recording_seconds_used: number;
    recording_seconds_limit: number;
    period: 'month';
    reset_at: string;
  };
}

export const getMe = () => request<AuthUser>('/auth/me');
export const logout = () => request<{ ok: true }>('/auth/logout', { method: 'POST' });
export const selectPlan = (plan: string) => request<{ ok: true; plan: string }>('/auth/plan', {
  method: 'POST',
  body: JSON.stringify({ plan }),
});

// Stripe
export const createCheckoutSession = () => request<{ url: string }>('/stripe/checkout', { method: 'POST' });
export const createPortalSession = () => request<{ url: string }>('/stripe/portal', { method: 'POST' });

// Admin
export const adminQuery = (sql: string) => request<{ columns: string[]; rows: unknown[][] } | { changes: number }>('/admin/query', {
  method: 'POST',
  body: JSON.stringify({ sql }),
});
