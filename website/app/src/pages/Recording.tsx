import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Fab,
  Stack,
  Chip,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Switch,
  Alert,
  Button,
  LinearProgress,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import {
  getRecordingStatus,
  startRecording,
  stopRecording,
  getRepos,
  type Repo,
  type RecordingStatus,
} from '../api';

export function Recording() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<RecordingStatus>({ status: 'idle', startedAt: null, pid: null, repos: [], logs: [] });
  const [wasProcessing, setWasProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [useMic, setUseMic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Poll recording status
  useEffect(() => {
    const poll = () => {
      getRecordingStatus().then((s) => {
        // Detect transition: processing -> idle = done
        if (wasProcessing && s.status === 'idle') {
          setDone(true);
        }
        setWasProcessing(s.status === 'processing');
        setStatus(s);
      }).catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [wasProcessing]);

  // Load repos
  useEffect(() => {
    getRepos().then((repos) => {
      setRepos(repos);
      setSelectedRepos(new Set(repos.map((r) => r.id)));
    }).catch(() => {});
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (status.status === 'recording' && status.startedAt) {
      const start = new Date(status.startedAt).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [status.status, status.startedAt]);

  const handleStart = async () => {
    setError(null);
    try {
      await startRecording({
        repos: [...selectedRepos],
        mic: useMic,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStop = async () => {
    setError(null);
    try {
      await stopRecording();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleRepo = (id: number) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [status.logs.length]);

  const isRecording = status.status === 'recording';
  const isProcessing = status.status === 'processing';
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
              <Typography variant="h6" sx={{ mb: 1 }}>Meeting processed</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Check the Meetings tab to see your extracted tasks.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center">
                <Button variant="contained" onClick={() => navigate('/')}>View meetings</Button>
                <Button variant="outlined" onClick={() => setDone(false)}>Record another</Button>
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
                    {isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
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
      {!isRecording && !isProcessing && hasRepos && (
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

            <FormControlLabel
              control={<Switch checked={useMic} onChange={(e) => setUseMic(e.target.checked)} />}
              label="Include microphone"
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      )}

      {/* Live logs */}
      {status.logs.length > 0 && (
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
              {status.logs.map((line, i) => (
                <Box key={i} sx={{ color: getLogColor(line) }}>{line}</Box>
              ))}
            </Box>
          </CardContent>
        </Card>
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
  return 'text.secondary';
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
