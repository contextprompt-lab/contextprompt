import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { RepoMap } from "../repo/types.js";
import type { ExtractedPlan, Task } from "./types.js";
import type { GitHubIssue } from "../github/types.js";
import { shouldChunk, chunkTranscript, deduplicateTasks } from "./chunker.js";
import { logger } from "../utils/logger.js";

const FileReferenceSchema = z.object({
  path: z.string(),
  reason: z.string().default(""),
});

const TaskSchema = z.object({
  id: z.string().default("T?"),
  title: z.string().default("Untitled task"),
  status: z.enum(["ready", "review", "clarify"]).default("review"),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  confidence_reason: z.string().default(""),
  why_this_task_exists: z.string().default(""),
  proposed_change: z.string().default(""),
  high_confidence_files: z.array(FileReferenceSchema).default([]),
  possible_related_files: z.array(FileReferenceSchema).default([]),
  evidence: z.string().default(""),
  ambiguities: z.array(z.string()).default([]),
  task_assumptions: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  agent_steps: z.array(z.string()).default([]),
});

const IncompleteItemSchema = z.object({
  text: z.string().default(""),
  evidence: z.string().default(""),
  why_incomplete: z.string().default(""),
});

const ExecutionBucketsSchema = z.object({
  ready_now: z.array(z.string()).default([]),
  review_before_execution: z.array(z.string()).default([]),
  needs_clarification: z.array(z.string()).default([]),
});

const ExtractedPlanSchema = z.object({
  decisions: z.array(z.string()).default([]),
  fix_summary: z.string().default(""),
  execution_buckets: ExecutionBucketsSchema.default({
    ready_now: [],
    review_before_execution: [],
    needs_clarification: [],
  }),
  tasks: z.array(TaskSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  incomplete_items: z.array(IncompleteItemSchema).default([]),
});

// --- Pass 1: File Selection ---

const FileSelectionSchema = z.object({
  requested_files: z
    .array(
      z.object({
        repo: z.string(),
        path: z.string(),
      }),
    )
    .default([]),
});

type FileSelection = z.infer<typeof FileSelectionSchema>;

interface FetchedFile {
  repo: string;
  path: string;
  content: string;
}

const CHARS_PER_TOKEN = 4;
const MAX_SOURCE_FILE_TOKENS = 120_000;
const MAX_SINGLE_FILE_TOKENS = 15_000;
const MAX_REQUESTED_FILES = 60;
const DEFAULT_TOKENS_PER_MINUTE = 30_000;
const WINDOW_MS = 60_000;

// --- Rate Limiter ---

export class TokenRateLimiter {
  private tokensPerMinute: number;
  private usageLog: Array<{ tokens: number; timestamp: number }> = [];

  constructor(tokensPerMinute: number = DEFAULT_TOKENS_PER_MINUTE) {
    this.tokensPerMinute = tokensPerMinute;
  }

  private prune(): void {
    const cutoff = Date.now() - WINDOW_MS;
    this.usageLog = this.usageLog.filter((e) => e.timestamp > cutoff);
  }

  private usedInWindow(): number {
    this.prune();
    return this.usageLog.reduce((sum, e) => sum + e.tokens, 0);
  }

  async waitIfNeeded(estimatedTokens: number): Promise<void> {
    const used = this.usedInWindow();
    if (used + estimatedTokens <= this.tokensPerMinute) return;

    // Find when enough budget frees up
    const sorted = [...this.usageLog].sort((a, b) => a.timestamp - b.timestamp);
    let freed = 0;
    let waitUntil = Date.now();

    for (const entry of sorted) {
      freed += entry.tokens;
      waitUntil = entry.timestamp + WINDOW_MS;
      if (used - freed + estimatedTokens <= this.tokensPerMinute) break;
    }

    const waitMs = waitUntil - Date.now();
    if (waitMs > 0) {
      logger.info(
        `Waiting ${Math.ceil(waitMs / 1000)}s for rate limit budget...`,
      );
      await new Promise((r) => setTimeout(r, waitMs + 500)); // +500ms buffer
    }
  }

  recordUsage(tokens: number): void {
    this.usageLog.push({ tokens, timestamp: Date.now() });
  }

  updateLimitFromHeaders(headers: Headers): void {
    try {
      const limit = headers.get("x-ratelimit-limit-input-tokens");
      if (limit) {
        const parsed = parseInt(limit, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.tokensPerMinute = parsed;
        }
      }
    } catch {
      // ignore header parse failures
    }
  }
}

function extractRetryWait(err: unknown): number {
  const DEFAULT_WAIT = 60_000;
  try {
    const headers = (err as any)?.headers;
    if (!headers) return DEFAULT_WAIT;

    const retryAfter =
      typeof headers.get === "function"
        ? headers.get("retry-after")
        : headers["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds * 1000 + 1000;
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_WAIT;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFileSelectPrompt(): string {
  const paths = [
    join(__dirname, "..", "..", "templates", "file-select-prompt.txt"),
    join(__dirname, "..", "templates", "file-select-prompt.txt"),
  ];

  for (const p of paths) {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error("Could not find file-select-prompt.txt template");
}

export function parseFileSelectionResponse(text: string): FileSelection {
  let cleaned = text.trim();

  // Strip markdown code fences (```json ... ```)
  cleaned = cleaned
    .replace(/^```json?\s*/gm, "")
    .replace(/\s*```\s*/gm, "")
    .trim();

  // Extract the JSON object from any surrounding text
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  } else {
    // No JSON object found — check for a JSON array (bare requested_files)
    const arrStart = cleaned.indexOf("[");
    const arrEnd = cleaned.lastIndexOf("]");
    if (arrStart >= 0 && arrEnd > arrStart) {
      cleaned = `{"requested_files":${cleaned.slice(arrStart, arrEnd + 1)}}`;
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    const result = FileSelectionSchema.parse(parsed);
    // Cap at max
    result.requested_files = result.requested_files.slice(
      0,
      MAX_REQUESTED_FILES,
    );
    return result;
  } catch (err) {
    logger.warn(
      `Failed to parse file selection response: ${(err as Error).message}`,
    );
    logger.warn(`Raw response (first 300 chars): ${text.slice(0, 300)}`);
    return { requested_files: [] };
  }
}

async function callClaudeFileSelection(
  client: Anthropic,
  userPrompt: string,
  model: string,
  rateLimiter: TokenRateLimiter,
  systemPromptOverride?: string,
): Promise<FileSelection> {
  const systemPrompt = systemPromptOverride || loadFileSelectPrompt();
  const estimatedTokens = Math.ceil(
    (systemPrompt.length + userPrompt.length) / CHARS_PER_TOKEN,
  );

  const makeCall = async () => {
    await rateLimiter.waitIfNeeded(estimatedTokens);
    const { data: response, response: httpResponse } = await client.messages
      .create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      })
      .withResponse();

    rateLimiter.recordUsage(response.usage.input_tokens);
    rateLimiter.updateLimitFromHeaders(httpResponse.headers);

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return parseFileSelectionResponse(text);
  };

  try {
    return await makeCall();
  } catch (err) {
    const msg = (err as Error).message || "";
    // Retry once on rate limit
    if (
      msg.includes("rate_limit") ||
      msg.includes("429") ||
      (err as any).status === 429
    ) {
      const waitMs = extractRetryWait(err);
      logger.warn(
        `File selection rate limited, waiting ${Math.ceil(waitMs / 1000)}s before retry...`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
      try {
        return await makeCall();
      } catch (retryErr) {
        logger.warn(
          `File selection failed after retry: ${(retryErr as Error).message}`,
        );
        return { requested_files: [] };
      }
    }
    logger.warn(
      `Pass 1 file selection failed, falling back to single-pass: ${msg}`,
    );
    return { requested_files: [] };
  }
}

// Patterns for project manifest / config files that reveal the tech stack
const ANCHOR_PATTERNS = [
  // JS/TS
  /^package\.json$/,
  /^app\.json$/,
  /^tsconfig\.json$/,
  // Python
  /^pyproject\.toml$/,
  /^requirements\.txt$/,
  /^setup\.py$/,
  // Go
  /^go\.mod$/,
  // Rust
  /^Cargo\.toml$/,
  // Ruby
  /^Gemfile$/,
  // PHP
  /^composer\.json$/,
  // C/C++
  /^CMakeLists\.txt$/,
  /^Makefile$/,
  /^meson\.build$/,
  /^conanfile\.(txt|py)$/,
  /^vcpkg\.json$/,
  // C#/.NET
  /\.csproj$/,
  /^Directory\.Build\.props$/,
  // Java/Kotlin
  /^build\.gradle(\.kts)?$/,
  /^pom\.xml$/,
  // Swift
  /^Package\.swift$/,
  // Dart/Flutter
  /^pubspec\.yaml$/,
  // Elixir
  /^mix\.exs$/,
];

// Entry point patterns across languages
const ENTRY_PATTERNS = [
  // JS/TS
  /^(src\/)?(index|main|app)\.(ts|tsx|js|jsx|mts|mjs)$/,
  /^src\/server\/(index|app)\.(ts|js)$/,
  // Python
  /^(src\/)?main\.py$/,
  /^(src\/)?app\.py$/,
  /^(src\/)?__main__\.py$/,
  // Go
  /^(cmd\/\w+\/)?main\.go$/,
  // Rust
  /^src\/(main|lib)\.rs$/,
  // C/C++
  /^(src\/)?main\.(c|cpp|cc|cxx)$/,
  // C#
  /^(src\/)?Program\.cs$/,
  // Java/Kotlin
  /^src\/main\/java\/.*\/(Main|App|Application)\.(java|kt)$/,
  // Swift
  /^(Sources\/\w+\/)?main\.swift$/,
  /^(Sources\/\w+\/)?App\.swift$/,
  // Dart
  /^lib\/main\.dart$/,
];

function getAnchorFiles(repos: RepoMap[]): FileSelection["requested_files"] {
  const anchors: FileSelection["requested_files"] = [];

  for (const repo of repos) {
    // Collect all known full paths from the repo
    const knownPaths = new Set<string>();

    // From source files (browser repos have these)
    if (repo.sourceFiles) {
      for (const sf of repo.sourceFiles) {
        knownPaths.add(sf.path);
      }
    }

    // From export entries (both browser and disk repos)
    for (const f of repo.files) {
      knownPaths.add(f.path);
    }

    // For disk repos without sourceFiles, check filesystem for root-level anchors
    if (!repo.sourceFiles && !repo.rootPath.startsWith("browser://")) {
      for (const pattern of ANCHOR_PATTERNS) {
        // Root-level manifests — check common names directly
        const rootCandidates = [
          "package.json",
          "app.json",
          "tsconfig.json",
          "pyproject.toml",
          "requirements.txt",
          "setup.py",
          "go.mod",
          "Cargo.toml",
          "Gemfile",
          "composer.json",
          "CMakeLists.txt",
          "Makefile",
          "meson.build",
          "vcpkg.json",
          "Package.swift",
          "pubspec.yaml",
          "mix.exs",
          "build.gradle",
          "build.gradle.kts",
          "pom.xml",
        ];
        for (const candidate of rootCandidates) {
          if (
            pattern.test(candidate) &&
            existsSync(join(repo.rootPath, candidate))
          ) {
            knownPaths.add(candidate);
          }
        }
      }
    }

    // Match full paths against patterns
    for (const filePath of knownPaths) {
      const matched =
        ANCHOR_PATTERNS.some((p) => p.test(filePath)) ||
        ENTRY_PATTERNS.some((p) => p.test(filePath));

      if (matched) {
        anchors.push({ repo: repo.name, path: filePath });
      }
    }
  }

  return anchors;
}

export function fetchRequestedFiles(
  requested: FileSelection["requested_files"],
  repos: RepoMap[],
): FetchedFile[] {
  const fetched: FetchedFile[] = [];
  const fetchedPaths = new Set<string>();
  let totalTokens = 0;

  for (const req of requested) {
    if (totalTokens >= MAX_SOURCE_FILE_TOKENS) break;

    // Find the matching repo
    const repo = repos.find((r) => r.name === req.repo);
    if (!repo) continue;

    // Validate path doesn't escape repo (no .. segments)
    const normalized = normalize(req.path);
    if (normalized.startsWith("..") || normalized.startsWith("/")) continue;

    let content: string | null = null;

    if (repo.rootPath.startsWith("browser://")) {
      // Browser repo — look up in sourceFiles
      if (repo.sourceFiles) {
        const sf = repo.sourceFiles.find((f) => f.path === req.path);
        if (sf) content = sf.content;
      }
    } else {
      // Disk repo — read file directly
      const fullPath = resolve(repo.rootPath, normalized);
      // Security: ensure resolved path is still within repo root
      if (!fullPath.startsWith(resolve(repo.rootPath))) continue;
      try {
        if (existsSync(fullPath)) {
          content = readFileSync(fullPath, "utf-8");
        }
      } catch {
        continue;
      }
    }

    if (!content) continue;

    const key = `${req.repo}:${req.path}`;
    if (fetchedPaths.has(key)) continue;

    const fileTokens = Math.ceil(content.length / CHARS_PER_TOKEN);
    if (fileTokens > MAX_SINGLE_FILE_TOKENS) {
      const totalLines = content.split("\n").length;
      content = content.slice(0, MAX_SINGLE_FILE_TOKENS * CHARS_PER_TOKEN);
      const keptLines = content.split("\n").length;
      content += `\n\n/* ... TRUNCATED: showing ${keptLines}/${totalLines} lines (~${Math.round((fileTokens * CHARS_PER_TOKEN) / 1024)}KB total). Remaining content not shown. */`;
    }

    const actualTokens = Math.ceil(content.length / CHARS_PER_TOKEN);
    if (totalTokens + actualTokens > MAX_SOURCE_FILE_TOKENS) break;

    fetched.push({ repo: req.repo, path: req.path, content });
    fetchedPaths.add(key);
    totalTokens += actualTokens;
  }

  return fetched;
}

function formatSourceFiles(files: FetchedFile[]): string {
  if (files.length === 0) return "";

  let ctx = `## Source Files\n\nThe following source files were identified as most relevant to the discussion:\n\n`;
  for (const f of files) {
    const ext = f.path.split(".").pop() || "";
    const truncated = f.content.includes("/* ... TRUNCATED:")
      ? " (truncated)"
      : "";
    ctx += `### ${f.repo}/${f.path}${truncated}\n\`\`\`${ext}\n${f.content}\n\`\`\`\n\n`;
  }
  return ctx;
}

function loadFileRefinePrompt(): string {
  const paths = [
    join(__dirname, "..", "..", "templates", "file-refine-prompt.txt"),
    join(__dirname, "..", "templates", "file-refine-prompt.txt"),
  ];

  for (const p of paths) {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error("Could not find file-refine-prompt.txt template");
}

function loadSystemPrompt(): string {
  // Try multiple paths to find the template
  const paths = [
    join(__dirname, "..", "..", "templates", "task-prompt.txt"),
    join(__dirname, "..", "templates", "task-prompt.txt"),
  ];

  for (const p of paths) {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error("Could not find task-prompt.txt template");
}

export function describeRepo(repo: RepoMap): string {
  // Try package.json first for JS/TS repos
  const pkgPath = join(repo.rootPath, "package.json");
  let deps: Record<string, string> = {};

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      deps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {
      // Fall through to file tree heuristics
    }
  }

  if (Object.keys(deps).length > 0) {
    return describeFromDeps(deps);
  }

  // Fallback: infer from file tree patterns
  return describeFromFileTree(repo.fileTree);
}

function describeFromDeps(deps: Record<string, string>): string {
  const has = (pkg: string) => pkg in deps;

  // Determine primary framework
  let framework = "";
  if (has("react-native") || has("expo")) {
    framework = "React Native mobile app";
  } else if (has("react") && has("next")) {
    framework = "Next.js web app";
  } else if (has("react")) {
    framework = "React web app";
  } else if (has("vue") && has("nuxt")) {
    framework = "Nuxt.js web app";
  } else if (has("vue")) {
    framework = "Vue.js web app";
  } else if (has("svelte") || has("@sveltejs/kit")) {
    framework = "Svelte web app";
  } else if (has("@angular/core")) {
    framework = "Angular web app";
  } else if (has("@nestjs/core")) {
    framework = "NestJS API server";
  } else if (has("express")) {
    framework = "Express.js API server";
  } else if (has("fastify")) {
    framework = "Fastify API server";
  } else if (has("hono")) {
    framework = "Hono API server";
  } else if (has("koa")) {
    framework = "Koa API server";
  } else if (has("typescript") || has("ts-node")) {
    framework = "TypeScript project";
  }

  if (!framework) return "";

  // Collect notable tools/services
  const extras: string[] = [];
  if (has("expo")) extras.push("expo");
  if (has("@react-navigation/native")) extras.push("react-navigation");
  if (has("prisma") || has("@prisma/client")) extras.push("prisma");
  if (has("typeorm")) extras.push("typeorm");
  if (has("sequelize")) extras.push("sequelize");
  if (has("mongoose")) extras.push("mongoose");
  if (has("@supabase/supabase-js")) extras.push("supabase");
  if (has("firebase") || has("firebase-admin")) extras.push("firebase");
  if (has("@anthropic-ai/sdk")) extras.push("claude-api");
  if (has("openai")) extras.push("openai");
  if (has("stripe")) extras.push("stripe");
  if (has("@aws-sdk/client-s3") || has("aws-sdk")) extras.push("aws");
  if (has("redis") || has("ioredis")) extras.push("redis");
  if (has("pg") || has("postgres")) extras.push("postgres");
  if (has("graphql") || has("@apollo/server")) extras.push("graphql");

  if (extras.length > 0) {
    return `${framework} (${extras.join(", ")})`;
  }
  return framework;
}

function describeFromFileTree(fileTree: string): string {
  const lines = fileTree.toLowerCase();

  const frontendSignals = [
    "components/",
    "screens/",
    "pages/",
    "app.tsx",
    "app.vue",
    "app.jsx",
  ];
  const backendSignals = [
    "routes/",
    "controllers/",
    "handlers/",
    "migrations/",
    "models/",
    "server.ts",
    "server.js",
  ];

  const hasFrontend = frontendSignals.some((s) => lines.includes(s));
  const hasBackend = backendSignals.some((s) => lines.includes(s));

  // Python
  if (
    lines.includes("manage.py") ||
    lines.includes("requirements.txt") ||
    lines.includes("pyproject.toml")
  ) {
    if (lines.includes("django") || lines.includes("manage.py"))
      return "Python Django app";
    if (lines.includes("fastapi") || lines.includes("main.py"))
      return "Python API server";
    return "Python project";
  }

  // Go
  if (lines.includes("go.mod")) return "Go service";

  // Rust
  if (lines.includes("cargo.toml")) return "Rust project";

  if (hasFrontend && hasBackend) return "Fullstack application";
  if (hasFrontend) return "Frontend application";
  if (hasBackend) return "Backend API server";

  return "";
}

function buildReverseImportGraph(
  files: RepoMap["files"],
): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  for (const file of files) {
    if (!file.imports) continue;
    for (const imp of file.imports) {
      const existing = reverse.get(imp) || [];
      existing.push(file.path);
      reverse.set(imp, existing);
    }
  }
  return reverse;
}

function formatRepoContext(repos: RepoMap[]): string {
  return repos
    .map((repo) => {
      const desc = describeRepo(repo);
      let ctx = `### Repo: ${repo.name} (${repo.rootPath})\n`;
      if (desc) ctx += `> ${desc}\n`;
      ctx += "\n";
      ctx += `#### File Tree\n\`\`\`\n${repo.fileTree}\n\`\`\`\n\n`;

      if (repo.files.length > 0) {
        const reverseGraph = buildReverseImportGraph(repo.files);

        // Group files by directory for tree-style output
        const byDir = new Map<string, typeof repo.files>();
        for (const file of repo.files) {
          const parts = file.path.split("/");
          const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
          const existing = byDir.get(dir) || [];
          existing.push(file);
          byDir.set(dir, existing);
        }

        ctx += `#### Key Exports & Dependencies\n`;
        for (const [dir, files] of byDir) {
          if (dir !== ".") ctx += `${dir}/\n`;
          for (const file of files) {
            const fileName = file.path.split("/").pop();
            const indent = dir !== "." ? "  " : "";
            const exports = file.exports
              .map((e) => {
                const sig = e.signature ? `${e.name}${e.signature}` : e.name;
                return `${e.kind} ${sig}`;
              })
              .join(", ");
            if (exports) {
              ctx += `${indent}${fileName} — ${exports}\n`;
            } else {
              ctx += `${indent}${fileName}\n`;
            }
            // Show imports (what this file depends on)
            if (file.imports && file.imports.length > 0) {
              ctx += `${indent}  ← imports: ${file.imports.join(", ")}\n`;
            }
            // Show reverse imports for high-connectivity files (imported by 3+)
            const importedBy = reverseGraph.get(file.path);
            if (importedBy && importedBy.length >= 3) {
              ctx += `${indent}  ← imported by: ${importedBy.join(", ")}\n`;
            }
          }
        }
        ctx += "\n";
      }

      if (repo.readme) {
        ctx += `#### README\n${repo.readme}\n\n`;
      }

      return ctx;
    })
    .join("\n---\n\n");
}

function buildUserPrompt(transcript: string, repos: RepoMap[]): string {
  let prompt = `## Meeting Transcript\n\n${transcript}\n\n`;
  prompt += `## Codebase Map\n\n${formatRepoContext(repos)}`;
  return prompt;
}

export async function extractTasks(
  transcript: string,
  repos: RepoMap[],
  apiKey: string,
  model: string = "claude-sonnet-4-6",
  language?: string,
): Promise<ExtractedPlan> {
  const client = new Anthropic({ apiKey });
  const rateLimiter = new TokenRateLimiter();
  let systemPrompt = loadSystemPrompt();
  if (language && language !== "English") {
    systemPrompt += `\n\nIMPORTANT: Write your entire response in ${language}. All task titles, descriptions, steps, assumptions, decisions, and other text fields must be in ${language}. Keep file paths, code identifiers, and JSON keys in English.`;
  }
  const repoContext = formatRepoContext(repos);

  // --- Always include anchor files (package.json, entry points, etc.) ---
  const anchorFiles = getAnchorFiles(repos);

  // --- Pass 1: Ask Claude which files to read ---
  logger.info("Pass 1: Identifying relevant source files...");
  const selectionPrompt = buildUserPrompt(transcript, repos);
  const fileSelection = await callClaudeFileSelection(
    client,
    selectionPrompt,
    model,
    rateLimiter,
  );

  // Combine: anchor files first, then Claude's selections (deduped in fetchRequestedFiles)
  const allRequested = [...anchorFiles, ...fileSelection.requested_files];

  let fetchedFiles: FetchedFile[] = [];
  if (allRequested.length > 0) {
    logger.info(
      `Pass 1 selected ${fileSelection.requested_files.length} files + ${anchorFiles.length} anchor files, fetching contents...`,
    );
    fetchedFiles = fetchRequestedFiles(allRequested, repos);
    logger.info(
      `Fetched ${fetchedFiles.length} files (~${Math.ceil(fetchedFiles.reduce((sum, f) => sum + f.content.length, 0) / CHARS_PER_TOKEN)} tokens)`,
    );
  } else {
    logger.info("No files to fetch, proceeding with structure-only analysis");
  }

  // --- Pass 1.5: Refinement — let Claude request additional files after seeing contents ---
  if (fetchedFiles.length > 0) {
    const currentTokens = Math.ceil(
      fetchedFiles.reduce((sum, f) => sum + f.content.length, 0) /
        CHARS_PER_TOKEN,
    );
    const remainingBudget = MAX_SOURCE_FILE_TOKENS - currentTokens;

    if (remainingBudget > 5000) {
      try {
        logger.info("Pass 1.5: Refining file selection based on contents...");
        const refineSystemPrompt = loadFileRefinePrompt();
        const refineUserPrompt = `## Already Fetched Files\n\n${formatSourceFiles(fetchedFiles)}\n\n## Codebase Map\n\n${repoContext}`;

        const refinement = await callClaudeFileSelection(
          client,
          refineUserPrompt,
          model,
          rateLimiter,
          refineSystemPrompt,
        );

        if (refinement.requested_files.length > 0) {
          // Cap refinement at 20 files
          const refineRequested = refinement.requested_files.slice(0, 20);
          const fetchedPaths = new Set(
            fetchedFiles.map((f) => `${f.repo}:${f.path}`),
          );
          const newRequested = refineRequested.filter(
            (r) => !fetchedPaths.has(`${r.repo}:${r.path}`),
          );

          if (newRequested.length > 0) {
            const additionalFiles = fetchRequestedFiles(newRequested, repos);
            fetchedFiles.push(...additionalFiles);
            logger.info(
              `Pass 1.5 added ${additionalFiles.length} files (~${Math.ceil(additionalFiles.reduce((sum, f) => sum + f.content.length, 0) / CHARS_PER_TOKEN)} tokens)`,
            );
          }
        }
      } catch (err) {
        logger.warn(
          `Pass 1.5 refinement failed, continuing with initial selection: ${(err as Error).message}`,
        );
      }
    }
  }

  // --- Pass 2: Deep analysis with file contents ---
  const buildPrompt = (transcriptPart: string, chunkLabel?: string) => {
    const transcriptSection = chunkLabel
      ? `## Meeting Transcript (${chunkLabel})\n\n${transcriptPart}`
      : `## Meeting Transcript\n\n${transcriptPart}`;

    if (fetchedFiles.length > 0) {
      return `${transcriptSection}\n\n## Codebase Map\n\n${repoContext}\n\n${formatSourceFiles(fetchedFiles)}`;
    }
    return `${transcriptSection}\n\n## Codebase Map\n\n${repoContext}`;
  };

  if (!shouldChunk(transcript)) {
    logger.info(
      `Pass 2: Extracting tasks${fetchedFiles.length > 0 ? " with source files" : ""}...`,
    );
    try {
      return await callClaude(
        client,
        systemPrompt,
        buildPrompt(transcript),
        model,
        rateLimiter,
      );
    } catch (err) {
      // If Pass 2 fails with source files (too large), retry without them
      if (
        fetchedFiles.length > 0 &&
        ((err as Error).message.includes("too large") ||
          (err as Error).message.includes("maximum") ||
          (err as Error).message.includes("413"))
      ) {
        logger.warn("Pass 2 too large with source files, retrying without...");
        return await callClaude(
          client,
          systemPrompt,
          buildUserPrompt(transcript, repos),
          model,
          rateLimiter,
        );
      }
      throw err;
    }
  }

  // Chunked extraction for long transcripts
  logger.info("Transcript is long, splitting into chunks...");
  const chunks = chunkTranscript(transcript);
  const allTasks: Task[] = [];
  let decisions: string[] = [];
  let assumptions: string[] = [];
  let incompleteItems: {
    text: string;
    evidence: string;
    why_incomplete: string;
  }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    logger.info(`Processing chunk ${i + 1}/${chunks.length}...`);
    const userPrompt = buildPrompt(chunks[i], `Part ${i + 1}/${chunks.length}`);
    const result = await callClaude(
      client,
      systemPrompt,
      userPrompt,
      model,
      rateLimiter,
    );
    allTasks.push(...result.tasks);
    if (i === chunks.length - 1) {
      decisions = result.decisions;
    }
    assumptions.push(...result.assumptions);
    incompleteItems.push(...result.incomplete_items);
  }

  // Deduplicate and re-number
  const deduplicated = deduplicateTasks(allTasks);
  const renumbered = deduplicated.map((task, i) => ({
    ...task,
    id: `T${i + 1}`,
    dependencies: [],
  }));

  const uniqueAssumptions = [...new Set(assumptions)];
  const uniqueIncomplete = incompleteItems.filter(
    (item, i, arr) => arr.findIndex((other) => other.text === item.text) === i,
  );

  const execution_buckets = {
    ready_now: renumbered.filter((t) => t.status === "ready").map((t) => t.id),
    review_before_execution: renumbered
      .filter((t) => t.status === "review")
      .map((t) => t.id),
    needs_clarification: renumbered
      .filter((t) => t.status === "clarify")
      .map((t) => t.id),
  };

  return {
    decisions,
    fix_summary: "",
    execution_buckets,
    tasks: renumbered,
    assumptions: uniqueAssumptions,
    incomplete_items: uniqueIncomplete,
  };
}

async function callClaude(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  rateLimiter: TokenRateLimiter,
): Promise<ExtractedPlan> {
  const MAX_RETRIES = 3;
  const estimatedTokens = Math.ceil(
    (systemPrompt.length + userPrompt.length) / CHARS_PER_TOKEN,
  );
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retrying Claude API (attempt ${attempt + 1})...`);
      }

      await rateLimiter.waitIfNeeded(estimatedTokens);

      const { data: response, response: httpResponse } = await client.messages
        .create({
          model,
          max_tokens: 16384,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        })
        .withResponse();

      rateLimiter.recordUsage(response.usage.input_tokens);
      rateLimiter.updateLimitFromHeaders(httpResponse.headers);

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return parseClaudeResponse(text);
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message || "";
      // Don't retry on auth/billing errors
      if (
        msg.includes("credit") ||
        msg.includes("api_key") ||
        msg.includes("authentication")
      ) {
        throw lastError;
      }
      // Context window exceeded — give a clear error
      if (
        msg.includes("prompt is too long") ||
        msg.includes("context length exceeded") ||
        msg.includes("exceeds the maximum number of tokens")
      ) {
        throw new Error(
          `Codebase too large for analysis — try connecting fewer repos or a larger model. (${msg})`,
        );
      }
      // Rate limit — wait with header-informed delay
      if (
        msg.includes("rate_limit") ||
        msg.includes("429") ||
        (err as any).status === 429
      ) {
        const waitMs = extractRetryWait(err);
        logger.warn(
          `Rate limited, waiting ${Math.ceil(waitMs / 1000)}s before retry...`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      // Other errors — short backoff
      const delay = attempt * 2000;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      logger.error(`Claude API error (attempt ${attempt + 1}): ${msg}`);
    }
  }

  throw lastError || new Error("Claude API failed after retries");
}

function loadIssuePrompt(): string {
  const paths = [
    join(__dirname, "..", "..", "templates", "issue-prompt.txt"),
    join(__dirname, "..", "templates", "issue-prompt.txt"),
  ];

  for (const p of paths) {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error("Could not find issue-prompt.txt template");
}

export function buildIssueUserPrompt(
  issue: GitHubIssue,
  repos: RepoMap[],
): string {
  let prompt = `## GitHub Issue #${issue.number}: ${issue.title}\n\n`;
  prompt += `**Author:** ${issue.author}\n`;
  if (issue.labels.length > 0) {
    prompt += `**Labels:** ${issue.labels.join(", ")}\n`;
  }
  prompt += `\n### Issue Body\n\n${issue.body || "(empty)"}\n\n`;

  if (issue.comments.length > 0) {
    prompt += `### Comments\n\n`;
    for (const comment of issue.comments) {
      prompt += `**${comment.author}** (${comment.createdAt}):\n${comment.body}\n\n`;
    }
  }

  prompt += `## Codebase Map\n\n${formatRepoContext(repos)}`;
  return prompt;
}

export async function extractTasksFromIssue(
  issue: GitHubIssue,
  repos: RepoMap[],
  apiKey: string,
  model: string = "claude-sonnet-4-6",
  language?: string,
): Promise<ExtractedPlan> {
  const client = new Anthropic({ apiKey });
  const rateLimiter = new TokenRateLimiter();
  let systemPrompt = loadIssuePrompt();
  if (language && language !== "English") {
    systemPrompt += `\n\nIMPORTANT: Write your entire response in ${language}. All task titles, descriptions, steps, assumptions, decisions, and other text fields must be in ${language}. Keep file paths, code identifiers, and JSON keys in English.`;
  }
  const userPrompt = buildIssueUserPrompt(issue, repos);
  return await callClaude(client, systemPrompt, userPrompt, model, rateLimiter);
}

export function parseClaudeResponse(text: string): ExtractedPlan {
  // Strip markdown fences if present
  let cleaned = text.trim();
  cleaned = cleaned
    .replace(/^```json?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Handle case where Claude wraps in extra text before/after JSON
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return ExtractedPlanSchema.parse(parsed);
  } catch (err) {
    logger.error("Failed to parse Claude response as JSON");
    logger.debug(`Raw response: ${text.slice(0, 500)}`);
    throw new Error(
      `Failed to parse Claude response as JSON: ${(err as Error).message}. Response started with: "${text.slice(0, 200)}"`,
    );
  }
}
