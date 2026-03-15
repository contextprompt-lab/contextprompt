import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { getConfigDir } from '../config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  let dbPath: string;
  if (process.env.CONTEXTPROMPT_DB_PATH) {
    dbPath = process.env.CONTEXTPROMPT_DB_PATH;
    mkdirSync(join(dbPath, '..'), { recursive: true });
  } else {
    const configDir = getConfigDir();
    mkdirSync(configDir, { recursive: true });
    dbPath = join(configDir, 'contextprompt.db');
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      speaker_count INTEGER NOT NULL DEFAULT 0,
      task_count INTEGER NOT NULL DEFAULT 0,
      transcript TEXT,
      plan_json TEXT,
      output_path TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence TEXT NOT NULL,
      confidence_reason TEXT,
      proposed_change TEXT,
      evidence TEXT,
      files_json TEXT,
      steps_json TEXT,
      dependencies_json TEXT,
      ambiguities_json TEXT,
      github_issue_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      last_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issue_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      issue_number INTEGER NOT NULL,
      issue_url TEXT NOT NULL,
      issue_title TEXT NOT NULL,
      issue_body TEXT,
      issue_author TEXT,
      issue_labels_json TEXT,
      plan_json TEXT,
      task_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE
    );
  `);

  // Add github columns to repos table (idempotent)
  try { db.exec('ALTER TABLE repos ADD COLUMN github_owner TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE repos ADD COLUMN github_repo TEXT'); } catch { /* already exists */ }

  // --- Auth tables ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      picture TEXT,
      plan TEXT NOT NULL DEFAULT 'none',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      recording_seconds_used INTEGER NOT NULL DEFAULT 0,
      usage_reset_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Add user_id to existing tables (idempotent)
  try { db.exec('ALTER TABLE meetings ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE repos ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE settings ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE issue_analyses ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch { /* already exists */ }

  // Add admin flag
  try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0'); } catch { /* already exists */ }

  // Recreate repos table without UNIQUE on path (multi-user needs same path for different users)
  const hasUniquePathConstraint = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='repos'").get() as { sql: string } | undefined;
  if (hasUniquePathConstraint?.sql.includes('UNIQUE')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS repos_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        last_used TEXT,
        github_owner TEXT,
        github_repo TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO repos_new SELECT id, path, name, last_used, github_owner, github_repo, user_id, created_at FROM repos;
      DROP TABLE repos;
      ALTER TABLE repos_new RENAME TO repos;
    `);
  }
}

// --- Users ---

export interface UserRow {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture: string | null;
  plan: string;
  is_admin: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  recording_seconds_used: number;
  usage_reset_at: string;
  created_at: string;
  updated_at: string;
}

export function runAdminQuery(sql: string): { columns: string[]; rows: unknown[][] } | { changes: number } {
  const db = getDb();
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.startsWith('select') || trimmed.startsWith('pragma') || trimmed.startsWith('explain')) {
    const stmt = db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    if (rows.length === 0) return { columns: [], rows: [] };
    const columns = Object.keys(rows[0]);
    return { columns, rows: rows.map(r => columns.map(c => r[c])) };
  }
  const result = db.prepare(sql).run();
  return { changes: result.changes };
}

export function findUserByGoogleId(googleId: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function findUserByStripeCustomerId(customerId: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId) as UserRow | undefined;
}

export function createUser(googleId: string, email: string, name: string, picture: string | null): number {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)'
  ).run(googleId, email, name, picture);
  return result.lastInsertRowid as number;
}

export function updateUserPlan(id: number, plan: string): void {
  const db = getDb();
  db.prepare("UPDATE users SET plan = ?, updated_at = datetime('now') WHERE id = ?").run(plan, id);
}

export function updateUserStripe(id: number, customerId: string, subscriptionId: string): void {
  const db = getDb();
  db.prepare("UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(customerId, subscriptionId, id);
}

export function incrementRecordingUsage(userId: number, seconds: number): void {
  const db = getDb();
  db.prepare("UPDATE users SET recording_seconds_used = recording_seconds_used + ?, updated_at = datetime('now') WHERE id = ?")
    .run(seconds, userId);
}

export function resetUsageIfNeeded(userId: number): void {
  const db = getDb();
  const user = getUserById(userId);
  if (!user) return;

  const resetAt = new Date(user.usage_reset_at);
  const now = new Date();

  if (user.plan === 'pro') {
    // Monthly reset
    const monthsSinceReset = (now.getFullYear() - resetAt.getFullYear()) * 12 + (now.getMonth() - resetAt.getMonth());
    if (monthsSinceReset >= 1) {
      db.prepare("UPDATE users SET recording_seconds_used = 0, usage_reset_at = datetime('now') WHERE id = ?").run(userId);
    }
  } else {
    // Weekly reset for free plan
    const msSinceReset = now.getTime() - resetAt.getTime();
    if (msSinceReset >= 7 * 24 * 60 * 60 * 1000) {
      db.prepare("UPDATE users SET recording_seconds_used = 0, usage_reset_at = datetime('now') WHERE id = ?").run(userId);
    }
  }
}

// --- Sessions ---

const SESSION_DURATION_DAYS = 30;

export function createSession(userId: number): string {
  const db = getDb();
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
  return id;
}

export function getSession(sessionId: string): { user: UserRow } | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).get(sessionId) as UserRow | undefined;
  if (!row) return undefined;
  return { user: row };
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteExpiredSessions(): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

// --- Meetings ---

export interface MeetingRow {
  id: number;
  date: string;
  duration_minutes: number;
  speaker_count: number;
  task_count: number;
  transcript: string | null;
  plan_json: string | null;
  output_path: string | null;
  status: string;
  created_at: string;
  user_id: number | null;
}

export function insertMeeting(data: {
  date: string;
  duration_minutes: number;
  speaker_count: number;
  task_count: number;
  transcript: string;
  plan_json: string;
  output_path: string;
  status?: string;
  user_id?: number;
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO meetings (date, duration_minutes, speaker_count, task_count, transcript, plan_json, output_path, status, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.date,
    data.duration_minutes,
    data.speaker_count,
    data.task_count,
    data.transcript,
    data.plan_json,
    data.output_path,
    data.status ?? 'completed',
    data.user_id ?? null,
  );
  return result.lastInsertRowid as number;
}

export function getMeetings(userId?: number): MeetingRow[] {
  const db = getDb();
  if (userId !== undefined) {
    return db.prepare('SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC').all(userId) as MeetingRow[];
  }
  return db.prepare('SELECT * FROM meetings ORDER BY created_at DESC').all() as MeetingRow[];
}

export function getMeeting(id: number, userId?: number): MeetingRow | undefined {
  const db = getDb();
  if (userId !== undefined) {
    return db.prepare('SELECT * FROM meetings WHERE id = ? AND user_id = ?').get(id, userId) as MeetingRow | undefined;
  }
  return db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
}

export function deleteMeeting(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
}

// --- Tasks ---

export interface TaskRow {
  id: number;
  meeting_id: number;
  task_id: string;
  title: string;
  status: string;
  confidence: string;
  confidence_reason: string | null;
  proposed_change: string | null;
  evidence: string | null;
  files_json: string | null;
  steps_json: string | null;
  dependencies_json: string | null;
  ambiguities_json: string | null;
  github_issue_url: string | null;
  created_at: string;
}

export function insertTasksForMeeting(meetingId: number, tasks: Array<{
  task_id: string;
  title: string;
  status: string;
  confidence: string;
  confidence_reason?: string;
  proposed_change?: string;
  evidence?: string;
  files_json?: string;
  steps_json?: string;
  dependencies_json?: string;
  ambiguities_json?: string;
}>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tasks (meeting_id, task_id, title, status, confidence, confidence_reason, proposed_change, evidence, files_json, steps_json, dependencies_json, ambiguities_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((tasks: typeof arguments[1]) => {
    for (const task of tasks) {
      stmt.run(
        meetingId,
        task.task_id,
        task.title,
        task.status,
        task.confidence,
        task.confidence_reason ?? null,
        task.proposed_change ?? null,
        task.evidence ?? null,
        task.files_json ?? null,
        task.steps_json ?? null,
        task.dependencies_json ?? null,
        task.ambiguities_json ?? null,
      );
    }
  });

  insertMany(tasks);
}

export function deleteTasksForMeeting(meetingId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE meeting_id = ?').run(meetingId);
}

export function getTasksForMeeting(meetingId: number): TaskRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM tasks WHERE meeting_id = ? ORDER BY task_id').all(meetingId) as TaskRow[];
}

export function updateTaskGithubIssue(taskId: number, issueUrl: string): void {
  const db = getDb();
  db.prepare('UPDATE tasks SET github_issue_url = ? WHERE id = ?').run(issueUrl, taskId);
}

// --- Repos ---

export interface RepoRow {
  id: number;
  path: string;
  name: string;
  last_used: string | null;
  github_owner: string | null;
  github_repo: string | null;
  created_at: string;
}

export function getRepos(userId?: number): RepoRow[] {
  const db = getDb();
  if (userId !== undefined) {
    return db.prepare('SELECT * FROM repos WHERE user_id = ? ORDER BY last_used DESC NULLS LAST, created_at DESC').all(userId) as RepoRow[];
  }
  return db.prepare('SELECT * FROM repos ORDER BY last_used DESC NULLS LAST, created_at DESC').all() as RepoRow[];
}

export function addRepo(path: string, name: string, userId?: number): number {
  const db = getDb();
  if (userId !== undefined) {
    // Check if this user already has this repo
    const existing = db.prepare('SELECT id FROM repos WHERE path = ? AND user_id = ?').get(path, userId) as { id: number } | undefined;
    if (existing) {
      db.prepare('UPDATE repos SET name = ? WHERE id = ?').run(name, existing.id);
      return existing.id;
    }
    const result = db.prepare('INSERT INTO repos (path, name, user_id) VALUES (?, ?, ?)').run(path, name, userId);
    return result.lastInsertRowid as number;
  }
  const stmt = db.prepare(`
    INSERT INTO repos (path, name) VALUES (?, ?)
    ON CONFLICT(path) DO UPDATE SET name = excluded.name
  `);
  const result = stmt.run(path, name);
  return result.lastInsertRowid as number;
}

export function removeRepo(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM repos WHERE id = ?').run(id);
}

export function touchRepo(path: string): void {
  const db = getDb();
  db.prepare("UPDATE repos SET last_used = datetime('now') WHERE path = ?").run(path);
}

export function getRepo(id: number, userId?: number): RepoRow | undefined {
  const db = getDb();
  if (userId !== undefined) {
    return db.prepare('SELECT * FROM repos WHERE id = ? AND user_id = ?').get(id, userId) as RepoRow | undefined;
  }
  return db.prepare('SELECT * FROM repos WHERE id = ?').get(id) as RepoRow | undefined;
}

export function updateRepoGithub(id: number, owner: string | null, repo: string | null): void {
  const db = getDb();
  db.prepare('UPDATE repos SET github_owner = ?, github_repo = ? WHERE id = ?').run(owner, repo, id);
}

// --- Issue Analyses ---

export interface IssueAnalysisRow {
  id: number;
  repo_id: number;
  issue_number: number;
  issue_url: string;
  issue_title: string;
  issue_body: string | null;
  issue_author: string | null;
  issue_labels_json: string | null;
  plan_json: string | null;
  task_count: number;
  status: string;
  error: string | null;
  created_at: string;
}

export function insertIssueAnalysis(data: {
  repo_id: number;
  issue_number: number;
  issue_url: string;
  issue_title: string;
  issue_body?: string;
  issue_author?: string;
  issue_labels_json?: string;
  status?: string;
  user_id?: number;
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO issue_analyses (repo_id, issue_number, issue_url, issue_title, issue_body, issue_author, issue_labels_json, status, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.repo_id,
    data.issue_number,
    data.issue_url,
    data.issue_title,
    data.issue_body ?? null,
    data.issue_author ?? null,
    data.issue_labels_json ?? null,
    data.status ?? 'pending',
    data.user_id ?? null,
  );
  return result.lastInsertRowid as number;
}

export function getIssueAnalyses(repoId?: number, userId?: number): IssueAnalysisRow[] {
  const db = getDb();
  const cols = 'id, repo_id, issue_number, issue_url, issue_title, issue_author, issue_labels_json, task_count, status, error, created_at';
  if (repoId && userId !== undefined) {
    return db.prepare(`SELECT ${cols} FROM issue_analyses WHERE repo_id = ? AND user_id = ? ORDER BY created_at DESC`).all(repoId, userId) as IssueAnalysisRow[];
  }
  if (repoId) {
    return db.prepare(`SELECT ${cols} FROM issue_analyses WHERE repo_id = ? ORDER BY created_at DESC`).all(repoId) as IssueAnalysisRow[];
  }
  if (userId !== undefined) {
    return db.prepare(`SELECT ${cols} FROM issue_analyses WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as IssueAnalysisRow[];
  }
  return db.prepare(`SELECT ${cols} FROM issue_analyses ORDER BY created_at DESC`).all() as IssueAnalysisRow[];
}

export function getIssueAnalysis(id: number): IssueAnalysisRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM issue_analyses WHERE id = ?').get(id) as IssueAnalysisRow | undefined;
}

export function updateIssueAnalysisStatus(
  id: number,
  status: string,
  planJson?: string,
  taskCount?: number,
  error?: string,
): void {
  const db = getDb();
  db.prepare(
    'UPDATE issue_analyses SET status = ?, plan_json = COALESCE(?, plan_json), task_count = COALESCE(?, task_count), error = ? WHERE id = ?'
  ).run(status, planJson ?? null, taskCount ?? null, error ?? null, id);
}

export function deleteIssueAnalysis(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM issue_analyses WHERE id = ?').run(id);
}

// --- Settings ---

export function getSetting(key: string, userId?: number): string | undefined {
  const db = getDb();
  if (userId !== undefined) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ? AND user_id = ?').get(key, userId) as { value: string } | undefined;
    return row?.value;
  }
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string, userId?: number): void {
  const db = getDb();
  if (userId !== undefined) {
    // Use key + user_id as composite uniqueness
    const existing = db.prepare('SELECT 1 FROM settings WHERE key = ? AND user_id = ?').get(key, userId);
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ? AND user_id = ?').run(value, key, userId);
    } else {
      db.prepare('INSERT INTO settings (key, value, user_id) VALUES (?, ?, ?)').run(key, value, userId);
    }
    return;
  }
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function deleteSetting(key: string, userId?: number): void {
  const db = getDb();
  if (userId !== undefined) {
    db.prepare('DELETE FROM settings WHERE key = ? AND user_id = ?').run(key, userId);
    return;
  }
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
