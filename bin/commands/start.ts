import { resolve } from 'node:path';
import { platform } from 'node:os';
import { writeFileSync, existsSync } from 'node:fs';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../../src/config.js';
import { createAudioCapture } from '../../src/audio/capture.js';
import { MicCapture } from '../../src/audio/mic.js';
import { AudioMixer } from '../../src/audio/mixer.js';
import { Transcript } from '../../src/transcription/transcript.js';
import { scanRepo } from '../../src/repo/scanner.js';
import { extractTasks } from '../../src/tasks/extractor.js';
import { renderMarkdown, generateOutputFilename } from '../../src/output/markdown.js';
import { writeLockfile, removeLockfile, watchForStopSentinel } from '../../src/utils/lockfile.js';
import { logger, setLogLevel } from '../../src/utils/logger.js';
import { insertMeeting, insertTasksForMeeting } from '../../src/server/db.js';

const CLEANUP_TIMEOUT_MS = 10_000;

interface StartOptions {
  repos: string[];
  output?: string;
  speakers?: string[];
  model: string;
  verbose: boolean;
  mic: boolean;
  micOnly: boolean;
  audioDevice?: string;
}

export async function startCommand(options: StartOptions): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  if (options.verbose) {
    setLogLevel('debug');
  }

  // Resolve and validate repo paths
  const repoPaths = options.repos.map((r) => resolve(r));
  for (const repoPath of repoPaths) {
    if (!existsSync(repoPath)) {
      logger.error(`Repo path does not exist: ${repoPath}`);
      process.exit(1);
    }
  }

  // Write lockfile for stop command
  writeLockfile();

  const transcript = new Transcript(options.speakers);
  const useMicOnly = options.micOnly;
  const useMixer = options.mic && !useMicOnly;
  const audio = useMicOnly ? null : await createAudioCapture(options.audioDevice);
  const mic = (options.mic || useMicOnly) ? new MicCapture() : null;
  const mixer = useMixer ? new AudioMixer() : null;
  const startTime = Date.now();

  // Wire audio sources
  let audioChunks = 0;

  if (useMicOnly && mic) {
    mic.on('data', (chunk) => {
      audioChunks++;
      if (audioChunks === 1) {
        logger.debug(`First mic chunk (${chunk.length} bytes)`);
      }
      if (audioChunks % 100 === 0) {
        logger.debug(`Mic chunks sent: ${audioChunks}`);
      }
    });

    mic.on('error', (err) => {
      logger.error(`Mic error: ${err.message}`);
    });
  } else if (mixer && mic && audio) {
    audio.on('data', (chunk) => mixer.pushSystem(chunk));
    mic.on('data', (chunk) => mixer.pushMic(chunk));

    mixer.on('data', (chunk) => {
      audioChunks++;
      if (audioChunks === 1) {
        logger.debug(`First mixed audio chunk (${chunk.length} bytes)`);
      }
      if (audioChunks % 100 === 0) {
        logger.debug(`Mixed audio chunks sent: ${audioChunks}`);
      }
    });

    mic.on('error', (err) => {
      logger.error(`Mic error: ${err.message}`);
    });
  } else if (audio) {
    audio.on('data', (chunk) => {
      audioChunks++;
      if (audioChunks === 1) {
        logger.debug(`First audio chunk received (${chunk.length} bytes)`);
      }
      if (audioChunks % 100 === 0) {
        logger.debug(`Audio chunks sent: ${audioChunks}`);
      }
    });
  }

  if (audio) {
    audio.on('error', (err) => {
      logger.error(`Audio error: ${err.message}`);
    });
  }

  // Start recording
  const spinner = ora({
    text: chalk.green('Recording... Press Ctrl+C to stop'),
    color: 'green',
  });

  try {
    await Promise.all([
      ...(audio ? [audio.start()] : []),
      ...(mic ? [mic.start()] : []),
    ]);
    if (useMicOnly) logger.debug('Mic-only capture: microphone (no system audio)');
    else if (mic) logger.debug('Bidirectional capture: system audio + microphone');
    if (mixer) mixer.start();
    spinner.start();
  } catch (err) {
    logger.error((err as Error).message);
    removeLockfile();
    process.exit(1);
  }

  // Handle shutdown
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      logger.warn('Force quitting...');
      removeLockfile();
      process.exit(1);
    }
    shuttingDown = true;

    spinner.stop();
    console.log('\n');
    logger.info('Stopping recording...');

    const forceExit = setTimeout(() => {
      logger.warn(`Cleanup timed out after ${CLEANUP_TIMEOUT_MS / 1000}s, force quitting...`);
      removeLockfile();
      process.exit(1);
    }, CLEANUP_TIMEOUT_MS);

    // Phase 1: Stop audio sources (stop producing data)
    const sourceResults = await Promise.allSettled([
      mic ? mic.stop() : Promise.resolve(),
      audio ? audio.stop() : Promise.resolve(),
    ]);
    // Phase 2: Flush mixer
    if (mixer) mixer.stop();
    for (const result of [...sourceResults]) {
      if (result.status === 'rejected') {
        logger.debug(`Cleanup step failed: ${result.reason}`);
      }
    }

    clearTimeout(forceExit);

    const durationMs = Date.now() - startTime;
    const durationMinutes = Math.round(durationMs / 60000);

    if (transcript.isEmpty()) {
      logger.warn('No speech was captured. Nothing to process.');
      removeLockfile();
      process.exit(0);
    }

    logger.info(`Captured ${transcript.getWordCount()} words in ~${durationMinutes} minutes`);

    // Post-processing pipeline
    const postSpinner = ora('Scanning repositories...').start();

    try {
      // 1. Scan repos
      const repoMaps = [];
      for (const repoPath of repoPaths) {
        const map = await scanRepo(repoPath);
        repoMaps.push(map);
      }
      postSpinner.text = `Scanned ${repoMaps.length} repo(s)`;
      postSpinner.succeed();

      // 2. Extract tasks
      const extractSpinner = ora(`Extracting tasks with ${options.model}...`).start();
      const formattedTranscript = transcript.toFormattedText();
      const plan = await extractTasks(
        formattedTranscript,
        repoMaps,
        config.anthropicApiKey,
        options.model
      );
      extractSpinner.succeed(`Extracted ${plan.tasks.length} task(s)`);

      // 3. Generate output
      const outputPath = options.output || generateOutputFilename();
      const resolvedOutput = resolve(outputPath);
      const markdown = renderMarkdown(plan, transcript, durationMinutes);
      writeFileSync(resolvedOutput, markdown, 'utf-8');

      // Persist to SQLite for dashboard
      try {
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
        logger.debug(`Meeting saved to dashboard (id: ${meetingId})`);
      } catch (dbErr) {
        logger.debug(`Failed to save to dashboard DB: ${(dbErr as Error).message}`);
      }

      console.log('');
      logger.success(`Output written to ${resolvedOutput}`);
      console.log('');

      if (plan.tasks.length > 0) {
        console.log(chalk.dim('Tasks:'));
        for (const task of plan.tasks) {
          const confColor = task.confidence === 'high' ? chalk.green : task.confidence === 'medium' ? chalk.yellow : chalk.gray;
          console.log(`  ${task.id}: ${task.title} ${confColor(`[${task.confidence}]`)}`);
        }
        console.log('');
        console.log(chalk.dim(`Feed to Claude Code: claude "Read ${outputPath} and implement task T1"`));
      }
    } catch (err) {
      postSpinner.fail('Processing failed');
      logger.error((err as Error).message);
      if (options.verbose) {
        console.error(err);
      }
    }

    removeLockfile();
    process.exit(0);
  };

  // Handle Ctrl+C
  process.on('SIGINT', shutdown);
  // Handle `contextprompt stop`
  if (platform() === 'win32') {
    // Windows: watch for sentinel file since SIGUSR2 doesn't exist
    watchForStopSentinel(shutdown);
  } else {
    process.on('SIGUSR2', shutdown);
  }
}
