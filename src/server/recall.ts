/**
 * Recall.ai API client for sending meeting bots and retrieving recordings/transcripts.
 */

import { logger } from '../utils/logger.js';

const DEFAULT_REGION = 'us-east-1';

function getBaseUrl(): string {
  const region = process.env.RECALL_REGION || DEFAULT_REGION;
  return `https://${region}.recall.ai/api/v1`;
}

function getApiKey(): string {
  const key = process.env.RECALL_API_KEY;
  if (!key) {
    throw new Error('RECALL_API_KEY not set in .env file.');
  }
  return key;
}

async function recallFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Token ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Recall.ai API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// --- Types ---

export interface RecallBot {
  id: string;
  meeting_url: string;
  bot_name: string;
  status_changes: Array<{
    code: string;
    sub_code: string | null;
    created_at: string;
  }>;
  recordings: Array<{
    id: string;
    media_shortcuts: {
      video_mixed?: { data: { download_url: string } };
      transcript?: { data: { download_url: string } };
    };
  }>;
}

export interface RecallTranscriptWord {
  text: string;
  start_time: number;
  end_time: number;
  confidence: number;
}

export interface RecallTranscriptEntry {
  speaker: string;
  speaker_id: number;
  words: RecallTranscriptWord[];
}

// --- API calls ---

export async function createBot(meetingUrl: string, botName = 'contextprompt'): Promise<RecallBot> {
  logger.info(`Creating Recall.ai bot for meeting: ${meetingUrl}`);
  return recallFetch<RecallBot>('/bot/', {
    method: 'POST',
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {},
          },
        },
      },
    }),
  });
}

export async function getBot(botId: string): Promise<RecallBot> {
  return recallFetch<RecallBot>(`/bot/${botId}/`);
}

export async function downloadTranscript(downloadUrl: string): Promise<RecallTranscriptEntry[]> {
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Failed to download transcript: ${res.status}`);
  }
  return res.json() as Promise<RecallTranscriptEntry[]>;
}

/**
 * Convert Recall.ai transcript format to a plain text transcript
 * with speaker labels, suitable for our Claude task extraction pipeline.
 */
export function formatRecallTranscript(entries: RecallTranscriptEntry[]): {
  text: string;
  speakerCount: number;
  wordCount: number;
} {
  const speakers = new Set<number>();
  let wordCount = 0;
  const lines: string[] = [];

  for (const entry of entries) {
    speakers.add(entry.speaker_id);
    const text = entry.words.map(w => w.text).join(' ');
    wordCount += entry.words.length;
    lines.push(`${entry.speaker}: ${text}`);
  }

  return {
    text: lines.join('\n'),
    speakerCount: speakers.size,
    wordCount,
  };
}

export async function leaveBotCall(botId: string): Promise<void> {
  logger.info(`Telling bot ${botId} to leave call...`);
  await recallFetch<void>(`/bot/${botId}/leave_call/`, { method: 'POST' });
}

export function isRecallConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}
