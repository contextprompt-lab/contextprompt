# contextprompt — Claude Code Instructions

## What this project is

A TypeScript CLI that captures meeting audio, transcribes it via Recall.ai, scans connected repos, and uses Claude API to extract structured coding tasks into a markdown file.

## Architecture

```
bin/contextprompt.ts → commands/start.ts (pipeline orchestration)
                → commands/stop.ts  (SIGUSR2 signal)
                → commands/config.ts (API key setup)

src/audio/
  types.ts              → AudioSource interface + AudioSourceEvents type
  capture.ts            → Platform factory (dynamic import macOS/Windows)
  capture-macos.ts      → audiotee (CoreAudio Process Tap)
  capture-windows.ts    → FFmpeg DirectShow loopback
  mic.ts                → Microphone capture (sox/ffmpeg)
  mixer.ts              → PCM 16-bit LE audio mixer

src/transcription/
  types.ts              → Utterance, TranscriptSegment
  transcript.ts         → Utterance accumulator with speaker merging

src/repo/
  types.ts              → RepoMap, FileEntry, ExportInfo
  scanner.ts            → .gitignore-aware file tree walker + token budget
  indexer.ts            → TypeScript compiler API (parse-only export extraction)

src/tasks/
  types.ts              → Task, ExtractedPlan
  extractor.ts          → Claude API (structured JSON extraction with zod validation)
  chunker.ts            → Long transcript splitting + Jaccard dedup

src/output/
  markdown.ts           → Renders .md output with table escaping

src/config.ts           → Loads ~/.contextprompt/.env
src/utils/
  typed-emitter.ts      → Shared TypedEmitter<T> base class (on/off/emit/removeAllListeners)
  logger.ts             → Colored console logger with levels
  lockfile.ts           → PID lockfile + Windows sentinel for start/stop coordination

templates/task-prompt.txt → Editable Claude system prompt
```

## Key patterns

- **Pipeline flow:** audio capture → Recall.ai transcription → transcript accumulation → repo scan → Claude extraction → markdown output
- **TypedEmitter base class:** All event sources (AudioCapture, MicCapture, AudioMixer) extend `TypedEmitter<T>` from `src/utils/typed-emitter.ts`. Do NOT duplicate on/emit/listeners boilerplate — use the base class
- **Event types must be `type`, not `interface`:** TypeScript interfaces don't satisfy `Record<string, ...>` constraints. All event maps (AudioSourceEvents, MicCaptureEvents, etc.) use `type` aliases
- **Repo indexing is parse-only:** Uses `ts.createSourceFile()` for AST parsing, NOT `ts.createProgram()`. No type checking, no resolution — just export extraction
- **Token budget management:** Repo maps are capped at ~20k tokens per repo with progressive trimming (drop signatures → drop deep files)
- **Chunked extraction:** Transcripts >100k tokens are split into overlapping chunks, tasks are extracted per chunk, then deduplicated via Jaccard word similarity
- **Zod validation:** Claude API JSON responses are validated with `ExtractedPlanSchema` in `extractor.ts`. Invalid responses throw and trigger retry. Never silently return empty tasks on parse failure
- **Markdown escaping:** All values interpolated into markdown table cells must go through `escapeTableCell()` in `markdown.ts` to escape `|` and strip newlines
- **Shutdown cleanup:** Uses `Promise.allSettled` to ensure all resources (mic, audio) get cleanup even if one throws. Never use sequential try/catch for multi-resource cleanup

## Dependencies

- `audiotee` — macOS system audio capture (CoreAudio Process Tap, macOS 14.2+)
- `@anthropic-ai/sdk` — Claude API
- `zod` — runtime validation of Claude API responses
- `typescript` — used at runtime for AST parsing in repo indexer
- `commander` — CLI
- `ignore` — .gitignore parsing
- `ora` / `chalk` — terminal UX

## Commands

```bash
npm run dev        # Run via tsx (development)
npm run build      # Build with tsup (ESM + .d.ts)
npm start          # Run built version
npm test           # Run vitest test suite
npm run test:watch # Run vitest in watch mode
```

## Testing

Tests use **vitest** and live in `__tests__/` directories next to the source:

```
src/transcription/__tests__/transcript.test.ts   — utterance merging, speaker labels, formatting
src/tasks/__tests__/chunker.test.ts              — splitting, overlap, deduplication
src/tasks/__tests__/extractor.test.ts            — JSON parsing, zod validation, error cases
src/output/__tests__/markdown.test.ts            — rendering, table escaping, filename format
src/repo/__tests__/indexer.test.ts               — source file detection
src/repo/__tests__/scanner.test.ts               — .gitignore, skip patterns, exports, token budget
```

**Testing conventions:**
- Test pure functions directly (transcript, chunker, markdown, extractor parser)
- Scanner tests use `mkdtempSync` for isolated temp directories
- Extractor tests import `parseClaudeResponse` (exported for testability)
- Use `vi.useFakeTimers()` for time-dependent tests (e.g., filename generation)
- No mocking of external services in unit tests — those are integration concerns

## Strict rules

- Config lives at `~/.contextprompt/.env` — never commit API keys
- The `templates/task-prompt.txt` is the Claude system prompt — it's intentionally a file so users can customize it
- Audio capture is macOS-only (audiotee) for system audio. Windows uses FFmpeg DirectShow. Do not add cross-platform audio without a clear abstraction boundary
- Repo scanning must respect .gitignore and skip node_modules/dist/build
- Keep repo map under 20k tokens per repo — use progressive trimming
- The output is always a plain .md file — no services, no APIs, no databases
- All event emitters must extend `TypedEmitter<T>` — no standalone on/emit implementations
- Validate repo paths with `existsSync()` before starting audio capture
- Log errors in scanner `walkDir()` — never silently swallow permission errors
- Cleanup timeout is `CLEANUP_TIMEOUT_MS` constant (10s) in `start.ts` — don't hardcode timeouts

## Do NOT

- Use `ts.createProgram()` in the indexer — parse-only with `ts.createSourceFile()`
- Store API keys anywhere except `~/.contextprompt/.env`
- Add a database or persistence layer — this is a stateless CLI
- Add real-time UI during recording beyond the terminal spinner and `--verbose` transcript
- Silently return empty results on parse errors — throw so the retry loop can handle it
- Use `interface` for event type maps — use `type` aliases (interfaces don't satisfy `Record` constraints)
- Duplicate the TypedEmitter pattern in new classes — extend the base class
- Use sequential try/catch for multi-resource cleanup — use `Promise.allSettled`
