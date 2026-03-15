import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Stack,
  Chip,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Button,
  TextField,
  LinearProgress,
  Divider,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import GroupIcon from '@mui/icons-material/Group';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  getRepos,
  getMeetings,
  getRecallStatus,
  sendBot,
  getBotStatus,
  leaveBotCall,
  deleteMeeting,
  rerunMeeting,
  buildRepoMaps,
  updateBotRepoMaps,
  type Repo,
  type Meeting,
} from '../api';

// Friendly labels for Recall.ai bot status codes
const STATUS_LABELS: Record<string, string> = {
  joining: 'Joining meeting...',
  joining_call: 'Joining meeting...',
  in_waiting_room: 'In waiting room — please admit the bot',
  in_call_not_recording: 'In meeting, waiting to record...',
  recording_permission_allowed: 'Recording permission granted',
  recording_permission_denied: 'Recording permission was denied',
  in_call_recording: 'Recording meeting...',
  call_ended: 'Meeting ended, processing...',
  done: 'Done — processing transcript...',
  fatal: 'Bot encountered an error',
};

export function Recording() {
  const navigate = useNavigate();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [recallConfigured, setRecallConfigured] = useState<boolean | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  // Active bot state
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<number | null>(null);
  const [botStatus, setBotStatus] = useState<string>('');
  const [sending, setSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRepos = repos.length > 0;
  const hasSelected = selectedRepos.size > 0;
  const isActive = !!activeBotId;
  const isRecording = botStatus === 'in_call_recording';
  const isDone = botStatus === 'done' || botStatus === 'call_ended';

  const loadMeetings = useCallback(() => {
    getMeetings().then(setMeetings).catch(() => {});
  }, []);

  useEffect(() => {
    getRepos().then((repos) => {
      setRepos(repos);
      setSelectedRepos(new Set(repos.map((r) => r.id)));
    }).catch(() => {});
    getRecallStatus().then((s) => setRecallConfigured(s.configured)).catch(() => setRecallConfigured(false));
    loadMeetings();
  }, [loadMeetings]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback((botId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const status = await getBotStatus(botId);
        setBotStatus(status.status);

        if (status.status === 'done') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          // Poll meeting status until processing completes
          setTimeout(() => {
            loadMeetings();
            const checkMeeting = setInterval(() => {
              getMeetings().then((meetings) => {
                setMeetings(meetings);
                const meeting = meetings.find(m => m.id === status.meeting_id);
                if (meeting && (meeting.status === 'completed' || meeting.status === 'failed')) {
                  clearInterval(checkMeeting);
                  // Clear active bot — processing is done
                  setActiveBotId(null);
                  setActiveMeetingId(null);
                  setBotStatus('');
                }
              }).catch(() => {});
            }, 3000);
            // Stop checking after 5 minutes
            setTimeout(() => {
              clearInterval(checkMeeting);
              setActiveBotId(null);
              setActiveMeetingId(null);
              setBotStatus('');
            }, 300000);
          }, 2000);
        } else if (status.status === 'fatal' || status.status === 'recording_permission_denied') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setError(STATUS_LABELS[status.status] || 'Bot failed');
          setActiveBotId(null);
          setActiveMeetingId(null);
          setBotStatus('');
        }
      } catch {
        // Transient error, keep polling
      }
    }, 3000);
  }, [loadMeetings]);

  const handleSendBot = async () => {
    if (!meetingUrl.trim()) return;
    setError(null);
    setSending(true);

    try {
      const selectedIds = [...selectedRepos];

      // Send bot immediately — no waiting for repo scans
      const result = await sendBot(meetingUrl.trim(), selectedIds);
      setActiveBotId(result.bot_id);
      setActiveMeetingId(result.meeting_id);
      setBotStatus('joining');
      setMeetingUrl('');
      startPolling(result.bot_id);

      // Scan browser repos in background and send maps when ready
      const browserRepoIds = repos
        .filter(r => r.path.startsWith('browser://') && selectedIds.includes(r.id))
        .map(r => r.id);
      if (browserRepoIds.length > 0) {
        buildRepoMaps(browserRepoIds)
          .then(repoMaps => updateBotRepoMaps(result.bot_id, repoMaps))
          .catch(err => console.warn(`Background repo scan failed: ${(err as Error).message}`));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleStopBot = async () => {
    if (!activeBotId) return;
    try {
      await leaveBotCall(activeBotId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const [rerunningId, setRerunningId] = useState<number | null>(null);

  const handleRerunMeeting = async (id: number) => {
    setRerunningId(id);
    setError(null);
    try {
      await rerunMeeting(id);
      setMeetings((prev) => prev.map((m) => m.id === id ? { ...m, status: 'processing' } : m));
      // Poll until done
      const checkInterval = setInterval(() => {
        getMeetings().then((updated) => {
          setMeetings(updated);
          const meeting = updated.find(m => m.id === id);
          if (meeting && meeting.status !== 'processing') {
            clearInterval(checkInterval);
            setRerunningId(null);
          }
        }).catch(() => {});
      }, 3000);
      setTimeout(() => { clearInterval(checkInterval); setRerunningId(null); }, 300000);
    } catch (err) {
      setError((err as Error).message);
      setRerunningId(null);
    }
  };

  const handleDeleteMeeting = async (id: number) => {
    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
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

  // Not configured state
  if (recallConfigured === false) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>Meetings</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Set <strong>RECALL_API_KEY</strong> in your project <strong>.env</strong> file to start recording meetings.
          Get your key at <strong>recall.ai</strong>.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Meetings</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Active bot status */}
      {isActive && (
        <Card sx={{ mb: 3, textAlign: 'center', py: 3 }}>
          <CardContent>
            <SmartToyIcon sx={{ fontSize: 48, color: isRecording ? 'error.main' : 'primary.main', mb: 1 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {STATUS_LABELS[botStatus] || botStatus}
            </Typography>
            {(botStatus === 'in_call_recording' || botStatus === 'joining_call' || botStatus === 'in_waiting_room' || botStatus === 'in_call_not_recording') && (
              <LinearProgress
                sx={{ mx: 'auto', maxWidth: 300, mt: 1 }}
                variant={isRecording ? 'indeterminate' : 'indeterminate'}
              />
            )}
            {isDone && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress sx={{ mx: 'auto', maxWidth: 300, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Extracting tasks from transcript...
                </Typography>
              </Box>
            )}
            {botStatus === 'in_waiting_room' && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                The contextprompt bot is in the waiting room. Please admit it from your meeting.
              </Typography>
            )}
            {isRecording && (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopCircleIcon />}
                onClick={handleStopBot}
                sx={{ mt: 2 }}
              >
                Stop recording
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send bot form */}
      {!isActive && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {!hasRepos ? (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  Add repos before recording
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  contextprompt needs to scan your codebase to map meeting conversations to code.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => navigate('/repos')}
                >
                  Add repos
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h6" sx={{ mb: 2 }}>Record a meeting</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Paste Zoom, Teams, or Google Meet link..."
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendBot()}
                    disabled={sending}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendBot}
                    disabled={!meetingUrl.trim() || !hasSelected || sending}
                    startIcon={<SmartToyIcon />}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {sending ? 'Sending...' : 'Send bot'}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  A bot will join your meeting, record the conversation, and extract coding tasks when it ends.
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Repo selection */}
      {!isActive && hasRepos && (
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

      {/* Past meetings */}
      {meetings.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" sx={{ mb: 2 }}>Past Meetings</Typography>
          <Stack spacing={1}>
            {meetings.map((meeting) => (
              <Card key={meeting.id}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CardActionArea
                    onClick={() => meeting.status === 'completed' && navigate(`/meetings/${meeting.id}`)}
                    disabled={meeting.status !== 'completed'}
                    sx={{ flex: 1 }}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {formatDate(meeting.date)}
                          </Typography>
                          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                            {meeting.status === 'completed' && (
                              <>
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
                              </>
                            )}
                          </Stack>
                        </Box>
                        <Chip
                          label={meeting.status}
                          size="small"
                          color={
                            meeting.status === 'completed' ? 'success'
                            : meeting.status === 'failed' ? 'error'
                            : meeting.status === 'recording' ? 'warning'
                            : 'default'
                          }
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </CardActionArea>
                  {/* Rerun hidden for now
                  {meeting.status === 'failed' && (
                    <IconButton
                      size="small"
                      onClick={() => handleRerunMeeting(meeting.id)}
                      disabled={rerunningId === meeting.id}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      title="Rerun analysis"
                    >
                      <ReplayIcon fontSize="small" />
                    </IconButton>
                  )}
                  */}
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteMeeting(meeting.id)}
                    sx={{ mr: 1, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Card>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
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
