import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getConfigDir } from '../config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const configDir = getConfigDir();
  mkdirSync(configDir, { recursive: true });
  const dbPath = join(configDir, 'meetcode.db');

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
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO meetings (date, duration_minutes, speaker_count, task_count, transcript, plan_json, output_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.date,
    data.duration_minutes,
    data.speaker_count,
    data.task_count,
    data.transcript,
    data.plan_json,
    data.output_path,
    data.status ?? 'completed'
  );
  return result.lastInsertRowid as number;
}

export function getMeetings(): MeetingRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM meetings ORDER BY created_at DESC').all() as MeetingRow[];
}

export function getMeeting(id: number): MeetingRow | undefined {
  const db = getDb();
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

export function getRepos(): RepoRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM repos ORDER BY last_used DESC NULLS LAST, created_at DESC').all() as RepoRow[];
}

export function addRepo(path: string, name: string): number {
  const db = getDb();
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

export function getRepo(id: number): RepoRow | undefined {
  const db = getDb();
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
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO issue_analyses (repo_id, issue_number, issue_url, issue_title, issue_body, issue_author, issue_labels_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
  );
  return result.lastInsertRowid as number;
}

export function getIssueAnalyses(repoId?: number): IssueAnalysisRow[] {
  const db = getDb();
  if (repoId) {
    return db.prepare(
      'SELECT id, repo_id, issue_number, issue_url, issue_title, issue_author, issue_labels_json, task_count, status, error, created_at FROM issue_analyses WHERE repo_id = ? ORDER BY created_at DESC'
    ).all(repoId) as IssueAnalysisRow[];
  }
  return db.prepare(
    'SELECT id, repo_id, issue_number, issue_url, issue_title, issue_author, issue_labels_json, task_count, status, error, created_at FROM issue_analyses ORDER BY created_at DESC'
  ).all() as IssueAnalysisRow[];
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

export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
