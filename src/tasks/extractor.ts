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
const DEFAULT_TOKENS_PER_MINUTE = 50_000;
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

const MAX_PROGRAMMATIC_FILES = 20;
const MAX_HAIKU_ROUNDS = 3;
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_FILES_PER_ROUND = 15;

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "want", "like",
  "just", "also", "and", "or", "but", "for", "with", "from", "not",
  "so", "if", "then", "when", "how", "what", "where", "which", "who",
  "why", "this", "that", "these", "those", "it", "its", "we", "they",
  "our", "their", "your", "you", "he", "she", "him", "her", "his",
  "yeah", "yes", "no", "ok", "okay", "um", "uh", "gonna", "gotta",
  "kinda", "right", "thing", "things", "think", "know", "see", "look",
  "get", "got", "make", "take", "going", "said", "say", "let", "put",
  "way", "one", "two", "about", "into", "out", "some", "all", "more",
  "really", "very", "actually", "basically", "there", "here", "now",
  "well", "too", "than", "other", "only", "still", "even", "much",
]);

// --- Layer 1: Programmatic File Selection ---

export function extractKeywords(transcript: string): string[] {
  const words = transcript
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

function buildReverseImportCounts(repos: RepoMap[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    for (const file of repo.files) {
      if (!file.imports) continue;
      for (const imp of file.imports) {
        const key = `${repo.name}:${imp}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }
  return counts;
}

export function selectFilesProgrammatically(
  transcript: string,
  repos: RepoMap[],
): { files: Array<{ repo: string; path: string }>; keywords: string[] } {
  const keywords = extractKeywords(transcript);
  if (keywords.length === 0) {
    return { files: [], keywords };
  }

  const importCounts = buildReverseImportCounts(repos);

  const scored: Array<{ repo: string; path: string; score: number }> = [];

  for (const repo of repos) {
    // Build a map of export names by path for quick lookup
    const exportsByPath = new Map<string, string[]>();
    for (const file of repo.files) {
      exportsByPath.set(
        file.path,
        file.exports.map((e) => e.name.toLowerCase()),
      );
    }

    // Collect all known file paths (from files array + sourceFiles for browser repos)
    const allPaths = new Set<string>();
    for (const file of repo.files) {
      allPaths.add(file.path);
    }
    if (repo.sourceFiles) {
      for (const sf of repo.sourceFiles) {
        allPaths.add(sf.path);
      }
    }

    for (const filePath of allPaths) {
      let score = 0;
      const pathLower = filePath.toLowerCase();
      const pathSegments = pathLower.split(/[/.]/);

      for (const kw of keywords) {
        // Path segment match
        if (pathSegments.some((seg) => seg.includes(kw))) {
          score += 3;
        }
        // Export name match
        const exports = exportsByPath.get(filePath);
        if (exports) {
          for (const name of exports) {
            if (name.includes(kw)) {
              score += 4;
              break;
            }
          }
        }
      }

      // Import hub bonus (capped at 5)
      const hubCount = importCounts.get(`${repo.name}:${filePath}`) || 0;
      score += Math.min(hubCount, 5);

      // Anchor bonus
      const isAnchor =
        ANCHOR_PATTERNS.some((p) => p.test(filePath)) ||
        ENTRY_PATTERNS.some((p) => p.test(filePath));
      if (isAnchor) score += 2;

      if (score > 0) {
        scored.push({ repo: repo.name, path: filePath, score });
      }
    }
  }

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const files = scored
    .slice(0, MAX_PROGRAMMATIC_FILES)
    .map(({ repo, path }) => ({ repo, path }));

  return { files, keywords };
}

function estimateTokens(files: FetchedFile[]): number {
  return Math.ceil(
    files.reduce((sum, f) => sum + f.content.length, 0) / CHARS_PER_TOKEN,
  );
}

// --- Layer 2: Haiku Tool-Use File Selection ---

const READ_FILES_TOOL: Anthropic.Tool = {
  name: "read_files",
  description:
    "Read source files from the repository. Request files you need to understand the codebase for the discussed coding tasks. You can request multiple files at once.",
  input_schema: {
    type: "object" as const,
    properties: {
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository name" },
            path: {
              type: "string",
              description: "File path within the repo",
            },
          },
          required: ["repo", "path"],
        },
        description: "List of files to read",
      },
    },
    required: ["files"],
  },
};

function loadHaikuFileSelectPrompt(): string {
  const paths = [
    join(__dirname, "..", "..", "templates", "haiku-file-select-prompt.txt"),
    join(__dirname, "..", "templates", "haiku-file-select-prompt.txt"),
  ];

  for (const p of paths) {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error("Could not find haiku-file-select-prompt.txt template");
}

async function selectFilesWithHaiku(
  client: Anthropic,
  transcript: string,
  repos: RepoMap[],
  alreadyFetched: FetchedFile[],
  rateLimiter: TokenRateLimiter,
): Promise<FetchedFile[]> {
  const systemPrompt = loadHaikuFileSelectPrompt();
  const repoContext = formatRepoContext(repos);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `## Codebase Map\n\n${repoContext}`,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `## Meeting Transcript\n\n${transcript}\n\n## Already Fetched Files (do not re-request these)\n\n${alreadyFetched.length > 0 ? alreadyFetched.map((f) => `- ${f.repo}/${f.path}`).join("\n") : "(none)"}`,
        },
      ],
    },
  ];

  const allFetched = [...alreadyFetched];
  const fetchedPaths = new Set(
    alreadyFetched.map((f) => `${f.repo}:${f.path}`),
  );

  for (let round = 0; round < MAX_HAIKU_ROUNDS; round++) {
    const estimatedInputTokens = Math.ceil(
      (systemPrompt.length +
        messages.reduce((sum, m) => {
          if (typeof m.content === "string") return sum + m.content.length;
          return sum + m.content.reduce((s, b) => s + ("text" in b ? b.text.length : 0), 0);
        }, 0)) /
        CHARS_PER_TOKEN,
    );

    await rateLimiter.waitIfNeeded(estimatedInputTokens);

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
      tools: [READ_FILES_TOOL],
    });

    rateLimiter.recordUsage(response.usage.input_tokens);

    if (response.stop_reason === "end_turn") break;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0) break;

    // Process all tool calls in this response
    const assistantContent = response.content;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const input = toolUse.input as {
        files: Array<{ repo: string; path: string }>;
      };
      const newRequested = (input.files || [])
        .slice(0, MAX_FILES_PER_ROUND)
        .filter((f) => !fetchedPaths.has(`${f.repo}:${f.path}`));

      const newFiles = fetchRequestedFiles(newRequested, repos);
      allFetched.push(...newFiles);
      newFiles.forEach((f) => fetchedPaths.add(`${f.repo}:${f.path}`));

      const resultText =
        formatSourceFiles(newFiles) ||
        "No files found or all files already fetched.";
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultText,
      });
    }

    // Append assistant message and all tool results
    messages.push({ role: "assistant", content: assistantContent });
    messages.push({ role: "user", content: toolResults });

    // Check budget
    if (estimateTokens(allFetched) >= MAX_SOURCE_FILE_TOKENS - 5000) {
      logger.info("Layer 2: File token budget nearly exhausted, stopping");
      break;
    }
  }

  return allFetched;
}

// --- Layer 3: Extraction with Prompt Caching ---

async function callClaudeWithCache(
  client: Anthropic,
  systemPrompt: string,
  repoContext: string,
  sourceFilesBlock: string,
  transcriptBlock: string,
  model: string,
  rateLimiter: TokenRateLimiter,
): Promise<ExtractedPlan> {
  const MAX_RETRIES = 3;
  const userContent = sourceFilesBlock
    ? `${sourceFilesBlock}\n\n## Meeting Transcript\n\n${transcriptBlock}`
    : `## Meeting Transcript\n\n${transcriptBlock}`;
  const estimatedTokens = Math.ceil(
    (systemPrompt.length + repoContext.length + userContent.length) /
      CHARS_PER_TOKEN,
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
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `## Codebase Map\n\n${repoContext}`,
                  cache_control: { type: "ephemeral" },
                },
                {
                  type: "text",
                  text: userContent,
                },
              ],
            },
          ],
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
      if (
        msg.includes("credit") ||
        msg.includes("api_key") ||
        msg.includes("authentication")
      ) {
        throw lastError;
      }
      if (
        msg.includes("prompt is too long") ||
        msg.includes("context length exceeded") ||
        msg.includes("exceeds the maximum number of tokens")
      ) {
        throw new Error(
          `Codebase too large for analysis — try connecting fewer repos or a larger model. (${msg})`,
        );
      }
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
      const delay = attempt * 2000;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      logger.error(`Claude API error (attempt ${attempt + 1}): ${msg}`);
    }
  }

  throw lastError || new Error("Claude API failed after retries");
}

const __dirname = dirname(fileURLToPath(import.meta.url));


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


export async function extractTasks(
  transcript: string,
  repos: RepoMap[],
  apiKey: string,
  model: string = "claude-sonnet-4-6",
  language?: string,
): Promise<ExtractedPlan> {
  const client = new Anthropic({ apiKey });
  const haikuRateLimiter = new TokenRateLimiter();
  const sonnetRateLimiter = new TokenRateLimiter();
  let systemPrompt = loadSystemPrompt();
  if (language && language !== "English") {
    systemPrompt += `\n\nIMPORTANT: Write your entire response in ${language}. All task titles, descriptions, steps, assumptions, decisions, and other text fields must be in ${language}. Keep file paths, code identifiers, and JSON keys in English.`;
  }
  const repoContext = formatRepoContext(repos);

  // --- Layer 1: Programmatic file selection (zero API cost) ---
  logger.info("Layer 1: Programmatic file selection...");
  const { files: programmaticFiles, keywords } = selectFilesProgrammatically(
    transcript,
    repos,
  );
  const anchorFiles = getAnchorFiles(repos);
  const allInitialRequests = [...anchorFiles, ...programmaticFiles];
  let fetchedFiles = fetchRequestedFiles(allInitialRequests, repos);
  logger.info(
    `Layer 1 selected ${fetchedFiles.length} files (~${estimateTokens(fetchedFiles)} tokens) from ${keywords.length} keywords`,
  );

  // --- Layer 2: Haiku tool-use file discovery (cheap, iterative) ---
  const currentTokens = estimateTokens(fetchedFiles);
  const hasBudget = MAX_SOURCE_FILE_TOKENS - currentTokens > 10_000;
  const hasRepos = repos.length > 0 && repos.some((r) => r.files.length > 0);

  if (hasBudget && hasRepos) {
    logger.info("Layer 2: Haiku file discovery...");
    try {
      fetchedFiles = await selectFilesWithHaiku(
        client,
        transcript,
        repos,
        fetchedFiles,
        haikuRateLimiter,
      );
      logger.info(
        `Layer 2 total: ${fetchedFiles.length} files (~${estimateTokens(fetchedFiles)} tokens)`,
      );
    } catch (err) {
      logger.warn(
        `Layer 2 failed, continuing with Layer 1 selection: ${(err as Error).message}`,
      );
    }
  } else if (!hasRepos) {
    logger.info("Layer 2: Skipped (no repos with source files)");
  } else {
    logger.info("Layer 2: Skipped (file token budget exhausted)");
  }

  // --- Layer 3: Sonnet extraction with prompt caching ---
  const sourceFilesBlock = formatSourceFiles(fetchedFiles);

  if (!shouldChunk(transcript)) {
    logger.info(
      `Layer 3: Extracting tasks with ${fetchedFiles.length} source files...`,
    );
    try {
      return await callClaudeWithCache(
        client,
        systemPrompt,
        repoContext,
        sourceFilesBlock,
        transcript,
        model,
        sonnetRateLimiter,
      );
    } catch (err) {
      // If too large with source files, retry without them
      if (
        fetchedFiles.length > 0 &&
        ((err as Error).message.includes("too large") ||
          (err as Error).message.includes("maximum") ||
          (err as Error).message.includes("413"))
      ) {
        logger.warn(
          "Layer 3 too large with source files, retrying without...",
        );
        return await callClaudeWithCache(
          client,
          systemPrompt,
          repoContext,
          "",
          transcript,
          model,
          sonnetRateLimiter,
        );
      }
      throw err;
    }
  }

  // Chunked extraction for long transcripts
  logger.info("Layer 3: Chunked extraction...");
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
    const chunkTranscript = `## Meeting Transcript (Part ${i + 1}/${chunks.length})\n\n${chunks[i]}`;
    const result = await callClaudeWithCache(
      client,
      systemPrompt,
      repoContext,
      sourceFilesBlock,
      chunkTranscript,
      model,
      sonnetRateLimiter,
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
  const repoContext = formatRepoContext(repos);

  // Build issue content (replaces transcript in the normal flow)
  let issueContent = `## GitHub Issue #${issue.number}: ${issue.title}\n\n`;
  issueContent += `**Author:** ${issue.author}\n`;
  if (issue.labels.length > 0) {
    issueContent += `**Labels:** ${issue.labels.join(", ")}\n`;
  }
  issueContent += `\n### Issue Body\n\n${issue.body || "(empty)"}\n\n`;
  if (issue.comments.length > 0) {
    issueContent += `### Comments\n\n`;
    for (const comment of issue.comments) {
      issueContent += `**${comment.author}** (${comment.createdAt}):\n${comment.body}\n\n`;
    }
  }

  return await callClaudeWithCache(
    client,
    systemPrompt,
    repoContext,
    "",
    issueContent,
    model,
    rateLimiter,
  );
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
