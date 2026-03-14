import { type Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { DeepgramTranscriber } from '../transcription/deepgram.js';
import { Transcript } from '../transcription/transcript.js';
import { scanRepo } from '../repo/scanner.js';
import { extractTasks } from '../tasks/extractor.js';
import { renderMarkdown, generateOutputFilename } from '../output/markdown.js';
import { loadConfig } from '../config.js';
import { getRepos, touchRepo, insertMeeting, insertTasksForMeeting } from './db.js';
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
    let transcriber: DeepgramTranscriber | null = null;
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
      // Binary = audio data from MediaRecorder
      if (isBinary) {
        if (transcriber && active) {
          transcriber.send(data as Buffer);
        }
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

      // Load API keys
      let config;
      try {
        config = loadConfig();
      } catch (err) {
        sendJson(ws, { type: 'error', message: (err as Error).message });
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
      transcriber = new DeepgramTranscriber(config.deepgramApiKey);

      // Wire utterances back to browser
      transcriber.on('utterance', (utterance) => {
        transcript!.addUtterance(utterance);
        const label = transcript!.getSpeakerLabel(utterance.speaker);
        log(`[transcript] ${label}: ${utterance.text}`);
        sendJson(ws, {
          type: 'utterance',
          speaker: label,
          text: utterance.text,
          startTime: utterance.startTime,
          endTime: utterance.endTime,
        });
      });

      transcriber.on('error', (err) => {
        log(`[error] Transcription error: ${err.message}`);
      });

      try {
        // Browser MediaRecorder sends WebM/Opus at 48kHz
        await transcriber.connect({
          encoding: 'opus',
          sampleRate: 48000,
          channels: 1,
        });
      } catch (err) {
        sendJson(ws, { type: 'error', message: `Failed to connect to Deepgram: ${(err as Error).message}` });
        return;
      }

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
      if (!active || !transcriber || !transcript) {
        sendJson(ws, { type: 'error', message: 'Not recording' });
        return;
      }

      active = false;
      setRecordingState({ status: 'processing' });
      sendJson(ws, { type: 'processing' });
      log('[info] Stopping recording...');

      // Close transcriber (finalize + wait for last results)
      await Promise.allSettled([transcriber.close()]);

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
        // Load config again for Anthropic key
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
        log(`[info] Extracting tasks with ${model}...`);
        const formattedTranscript = transcript.toFormattedText();
        const plan = await extractTasks(
          formattedTranscript,
          repoMaps,
          config.anthropicApiKey,
          model,
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
      if (transcriber) {
        await Promise.allSettled([transcriber.close()]);
        transcriber = null;
      }
      transcript = null;
      active = false;
      resetRecordingState();
    }
  });

  logger.debug('WebSocket server attached at /ws/recording');
}
