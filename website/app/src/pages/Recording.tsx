import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Fab,
  Stack,
  Chip,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Button,
  LinearProgress,
  Divider,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MicIcon from '@mui/icons-material/Mic';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import GroupIcon from '@mui/icons-material/Group';
import {
  getRepos,
  getMeetings,
  getRecordingStatus,
  getWsUrl,
  type Repo,
  type Meeting,
} from '../api';

interface Utterance {
  speaker: string;
  text: string;
}

export function Recording() {
  const navigate = useNavigate();
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [done, setDone] = useState(false);
  const [doneMetadata, setDoneMetadata] = useState<{ meetingId: number | null; taskCount: number }>({ meetingId: null, taskCount: 0 });
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);

  // Load repos and meetings
  const loadMeetings = useCallback(() => {
    getMeetings().then(setMeetings).catch(() => {});
  }, []);

  useEffect(() => {
    getRepos().then((repos) => {
      setRepos(repos);
      setSelectedRepos(new Set(repos.map((r) => r.id)));
    }).catch(() => {});
    loadMeetings();
  }, [loadMeetings]);

  // Check if already recording (e.g. page refresh)
  useEffect(() => {
    getRecordingStatus().then((s) => {
      if (s.status === 'recording' || s.status === 'processing') {
        setRecordingStatus(s.status);
        setLogs(s.logs);
      }
    }).catch(() => {});
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (recordingStatus === 'recording') {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      const tick = () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (recordingStatus === 'idle') {
        setElapsed(0);
        startTimeRef.current = 0;
      }
    }
  }, [recordingStatus]);

  // Auto-scroll transcript and logs
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [utterances.length]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs.length]);

  const addLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev, line];
      return next.length > 50 ? next.slice(-50) : next;
    });
  }, []);

  const cleanupMedia = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startMediaRecorder = useCallback((stream: MediaStream, ws: WebSocket) => {
    const recorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    recorder.start(250); // 250ms chunks
    recorderRef.current = recorder;
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    setDone(false);
    setUtterances([]);
    setLogs([]);

    // Request mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone permission denied. Please allow mic access and try again.');
      return;
    }
    streamRef.current = stream;

    // Open WebSocket
    const ws = new WebSocket(getWsUrl('/ws/recording'));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'start',
        repos: [...selectedRepos],
      }));
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'started':
          setRecordingStatus('recording');
          startTimeRef.current = Date.now();
          startMediaRecorder(stream, ws);
          break;
        case 'utterance':
          setUtterances((prev) => [...prev, { speaker: msg.speaker, text: msg.text }]);
          break;
        case 'log':
          addLog(msg.message);
          break;
        case 'processing':
          setRecordingStatus('processing');
          break;
        case 'done':
          setRecordingStatus('idle');
          setDone(true);
          setDoneMetadata({ meetingId: msg.meetingId, taskCount: msg.taskCount });
          cleanupMedia();
          loadMeetings();
          break;
        case 'error':
          setError(msg.message);
          cleanupMedia();
          break;
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection failed. Is the server running?');
      cleanupMedia();
    };

    ws.onclose = (event) => {
      // Only show error if unexpected close during recording
      if (!event.wasClean) {
        setRecordingStatus((prev) => {
          if (prev === 'recording') {
            setError('Connection lost during recording');
            return 'idle';
          }
          return prev;
        });
        cleanupMedia();
      }
    };
  }, [selectedRepos, addLog, cleanupMedia, startMediaRecorder]);

  const handleStop = useCallback(async () => {
    setError(null);

    // Stop MediaRecorder
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    // Stop mic tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Tell server to stop and process
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  // Send stop on page unload to trigger processing
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const toggleRepo = (id: number) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isRecording = recordingStatus === 'recording';
  const isProcessing = recordingStatus === 'processing';
  const hasRepos = repos.length > 0;
  const hasSelected = selectedRepos.size > 0;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Record</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Recording status */}
      <Card sx={{ mb: 3, textAlign: 'center', py: 4 }}>
        <CardContent>
          {done && !isRecording && !isProcessing ? (
            <Box>
              <Chip label="DONE" color="success" sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Meeting processed — {doneMetadata.taskCount} task{doneMetadata.taskCount !== 1 ? 's' : ''} extracted
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Check the Meetings tab to see your extracted tasks.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center">
                {doneMetadata.meetingId && (
                  <Button variant="contained" onClick={() => navigate(`/meetings/${doneMetadata.meetingId}`)}>
                    View meeting
                  </Button>
                )}
                <Button variant={doneMetadata.meetingId ? 'outlined' : 'contained'} onClick={() => navigate('/')}>
                  All meetings
                </Button>
                <Button variant="outlined" onClick={() => { setDone(false); setUtterances([]); setLogs([]); }}>
                  Record another
                </Button>
              </Stack>
            </Box>
          ) : isProcessing ? (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Processing meeting...</Typography>
              <LinearProgress sx={{ mx: 'auto', maxWidth: 300 }} />
            </Box>
          ) : (
            <>
              {isRecording && (
                <Box sx={{ mb: 2 }}>
                  <Chip
                    icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
                    label="RECORDING"
                    color="error"
                    sx={{ animation: 'pulse 1.5s infinite', mb: 1 }}
                  />
                  <Typography variant="h3" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                    {formatElapsed(elapsed)}
                  </Typography>
                </Box>
              )}

              {!isRecording && !hasRepos && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                    Add repos before recording
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    meetcode needs to scan your codebase to map meeting conversations to files.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<FolderOpenIcon />}
                    onClick={() => navigate('/repos')}
                  >
                    Add repos
                  </Button>
                </Box>
              )}

              {(hasRepos || isRecording) && (
                <>
                  <Fab
                    color={isRecording ? 'error' : 'primary'}
                    onClick={isRecording ? handleStop : handleStart}
                    disabled={isProcessing || (!isRecording && !hasSelected)}
                    sx={{
                      width: 80,
                      height: 80,
                      '& svg': { fontSize: 40 },
                    }}
                  >
                    {isRecording ? <StopIcon /> : <MicIcon />}
                  </Fab>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {isRecording
                      ? 'Click to stop recording'
                      : hasSelected
                        ? `Click to start recording (${selectedRepos.size} repo${selectedRepos.size !== 1 ? 's' : ''})`
                        : 'Select at least one repo below'}
                  </Typography>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Repo selection (only when not recording) */}
      {!isRecording && !isProcessing && !done && hasRepos && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Repos to scan</Typography>
              <Button size="small" onClick={() => navigate('/repos')}>Manage repos</Button>
            </Stack>
            <List dense>
              {repos.map((repo) => (
                <ListItem key={repo.id} disablePadding>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      checked={selectedRepos.has(repo.id)}
                      onChange={() => toggleRepo(repo.id)}
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <FolderIcon fontSize="small" color={repo.exists ? 'action' : 'error'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={repo.name}
                    secondary={repo.path}
                    secondaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Live transcript */}
      {utterances.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Live Transcript</Typography>
            <Box
              ref={transcriptRef}
              sx={{
                bgcolor: '#0d1117',
                borderRadius: 1,
                p: 1.5,
                maxHeight: 300,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                lineHeight: 1.8,
              }}
            >
              {utterances.map((u, i) => (
                <Box key={i}>
                  <Box component="span" sx={{ color: '#7ee787', fontWeight: 600 }}>{u.speaker}: </Box>
                  <Box component="span" sx={{ color: '#e6edf3' }}>{u.text}</Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Activity log */}
      {logs.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Activity log</Typography>
            <Box
              ref={logRef}
              sx={{
                bgcolor: '#0d1117',
                borderRadius: 1,
                p: 1.5,
                maxHeight: 200,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                lineHeight: 1.6,
              }}
            >
              {logs.map((line, i) => (
                <Box key={i} sx={{ color: getLogColor(line) }}>{line}</Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Past meetings */}
      {meetings.length > 0 && !isRecording && !isProcessing && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" sx={{ mb: 2 }}>Past Meetings</Typography>
          <Stack spacing={1}>
            {meetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardActionArea onClick={() => navigate(`/meetings/${meeting.id}`)}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {formatDate(meeting.date)}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <AccessTimeIcon sx={{ fontSize: 14 }} color="action" />
                            <Typography variant="caption" color="text.secondary">
                              {formatDuration(meeting.duration_minutes)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <TaskAltIcon sx={{ fontSize: 14 }} color="action" />
                            <Typography variant="caption" color="text.secondary">
                              {meeting.task_count} task{meeting.task_count !== 1 ? 's' : ''}
                            </Typography>
                          </Stack>
                          {meeting.speaker_count > 0 && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <GroupIcon sx={{ fontSize: 14 }} color="action" />
                              <Typography variant="caption" color="text.secondary">
                                {meeting.speaker_count} speaker{meeting.speaker_count !== 1 ? 's' : ''}
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      </Box>
                      <Chip
                        label={meeting.status}
                        size="small"
                        color={meeting.status === 'completed' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Box>
  );
}

function getLogColor(line: string): string {
  if (line.includes('[error]') || line.includes('Error')) return '#f85149';
  if (line.includes('[warn]')) return '#d29922';
  if (line.includes('[info]') || line.includes('Extracted') || line.includes('Output written')) return '#58a6ff';
  if (line.includes('[transcript]')) return '#7ee787';
  if (line.includes('[success]')) return '#3fb950';
  return '#8b949e';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
