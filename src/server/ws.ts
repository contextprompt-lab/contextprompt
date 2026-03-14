import { type Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Transcript } from '../transcription/transcript.js';
import { scanRepo } from '../repo/scanner.js';
import { extractTasks } from '../tasks/extractor.js';
import { renderMarkdown, generateOutputFilename } from '../output/markdown.js';
import { loadConfig } from '../config.js';
import { getRepos, touchRepo, insertMeeting, insertTasksForMeeting, getSetting } from './db.js';
import { getRecordingState, setRecordingState, addRecordingLog, resetRecordingState } from './recording-state.js';
import { logger } from '../utils/logger.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface StartMessage {
  type: 'start';
  repos: number[];
  speakers?: string[];
  model?: string;
}

interface StopMessage {
  type: 'stop';
}

type ClientMessage = StartMessage | StopMessage;

function sendJson(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/recording' });

  wss.on('connection', (ws) => {
    let transcript: Transcript | null = null;
    let startTime = 0;
    let repoPaths: string[] = [];
    let model = 'claude-sonnet-4-6';
    let active = false;

    const log = (msg: string) => {
      addRecordingLog(msg);
      sendJson(ws, { type: 'log', message: msg });
    };

    ws.on('message', async (data, isBinary) => {
      // Binary = audio data (currently unused)
      if (isBinary) {
        return;
      }

      // JSON control messages
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendJson(ws, { type: 'error', message: 'Invalid message format' });
        return;
      }

      if (msg.type === 'start') {
        await handleStart(msg);
      } else if (msg.type === 'stop') {
        await handleStop();
      }
    });

    ws.on('close', async () => {
      if (active) {
        // Client disconnected during recording — cleanup
        await cleanup();
      }
    });

    ws.on('error', (err) => {
      logger.error(`WebSocket error: ${err.message}`);
    });

    async function handleStart(msg: StartMessage) {
      const state = getRecordingState();
      if (state.status !== 'idle') {
        sendJson(ws, { type: 'error', message: 'Already recording' });
        return;
      }

      // Resolve repos
      if (msg.repos && msg.repos.length > 0) {
        const allRepos = getRepos();
        for (const id of msg.repos) {
          const repo = allRepos.find(r => r.id === id);
          if (repo) {
            repoPaths.push(repo.path);
            touchRepo(repo.path);
          }
        }
      }

      if (repoPaths.length === 0) {
        const allRepos = getRepos();
        repoPaths = allRepos.map(r => r.path);
      }

      if (repoPaths.length === 0) {
        sendJson(ws, { type: 'error', message: 'No repos configured. Add repos first.' });
        return;
      }

      model = msg.model || 'claude-sonnet-4-6';
      transcript = new Transcript(msg.speakers);

      active = true;
      startTime = Date.now();

      setRecordingState({
        status: 'recording',
        startedAt: new Date().toISOString(),
        pid: null,
        repos: repoPaths,
        logs: [],
      });

      log('[info] Recording started (browser mic)');
      sendJson(ws, { type: 'started' });
    }

    async function handleStop() {
      if (!active || !transcript) {
        sendJson(ws, { type: 'error', message: 'Not recording' });
        return;
      }

      active = false;
      setRecordingState({ status: 'processing' });
      sendJson(ws, { type: 'processing' });
      log('[info] Stopping recording...');

      const durationMs = Date.now() - startTime;
      const durationMinutes = Math.round(durationMs / 60000);

      if (transcript.isEmpty()) {
        log('[warn] No speech was captured');
        sendJson(ws, { type: 'done', meetingId: null, taskCount: 0 });
        resetRecordingState();
        return;
      }

      log(`[info] Captured ${transcript.getWordCount()} words in ~${durationMinutes} minutes`);

      try {
        // Load config for Anthropic key
        const config = loadConfig();

        // 1. Scan repos
        log('[info] Scanning repositories...');
        const repoMaps = [];
        for (const repoPath of repoPaths) {
          const map = await scanRepo(repoPath);
          repoMaps.push(map);
        }
        log(`[info] Scanned ${repoMaps.length} repo(s)`);

        // 2. Extract tasks
        const language = getSetting('response_language') || undefined;
        log(`[info] Extracting tasks with ${model}...`);
        const formattedTranscript = transcript.toFormattedText();
        const plan = await extractTasks(
          formattedTranscript,
          repoMaps,
          config.anthropicApiKey,
          model,
          language,
        );
        log(`[success] Extracted ${plan.tasks.length} task(s)`);

        // 3. Generate output
        const outputPath = generateOutputFilename();
        const resolvedOutput = resolve(outputPath);
        const markdown = renderMarkdown(plan, transcript, durationMinutes);
        writeFileSync(resolvedOutput, markdown, 'utf-8');

        // 4. Save to DB
        const meetingId = insertMeeting({
          date: new Date().toISOString(),
          duration_minutes: durationMinutes,
          speaker_count: transcript.getSpeakerMap().length,
          task_count: plan.tasks.length,
          transcript: formattedTranscript,
          plan_json: JSON.stringify(plan),
          output_path: resolvedOutput,
        });

        if (plan.tasks.length > 0) {
          insertTasksForMeeting(meetingId, plan.tasks.map(t => ({
            task_id: t.id,
            title: t.title,
            status: t.status,
            confidence: t.confidence,
            confidence_reason: t.confidence_reason,
            proposed_change: t.proposed_change,
            evidence: t.evidence,
            files_json: JSON.stringify([...t.high_confidence_files, ...t.possible_related_files]),
            steps_json: JSON.stringify(t.agent_steps),
            dependencies_json: JSON.stringify(t.dependencies),
            ambiguities_json: JSON.stringify(t.ambiguities),
          })));
        }

        log(`[success] Output written to ${resolvedOutput}`);
        sendJson(ws, { type: 'done', meetingId, taskCount: plan.tasks.length });
      } catch (err) {
        log(`[error] Processing failed: ${(err as Error).message}`);
        sendJson(ws, { type: 'error', message: (err as Error).message });
      }

      resetRecordingState();
    }

    async function cleanup() {
      transcript = null;
      active = false;
      resetRecordingState();
    }
  });

  logger.debug('WebSocket server attached at /ws/recording');
}
