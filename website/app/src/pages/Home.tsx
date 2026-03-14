import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import GroupIcon from '@mui/icons-material/Group';
import ReplayIcon from '@mui/icons-material/Replay';
import { getMeetings, rerunMeeting, type Meeting } from '../api';

export function Home() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [rerunningId, setRerunningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchMeetings = () => {
    getMeetings()
      .then(setMeetings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Poll while any meeting is processing
  useEffect(() => {
    const hasProcessing = meetings.some(m => m.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(fetchMeetings, 3000);
    return () => clearInterval(interval);
  }, [meetings]);

  const handleRerun = async (e: React.MouseEvent, meetingId: number) => {
    e.stopPropagation(); // Don't navigate to meeting detail
    setRerunningId(meetingId);
    try {
      await rerunMeeting(meetingId);
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, status: 'processing' } : m));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRerunningId(null);
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>Meetings</Typography>
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={100} />
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Meetings</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {meetings.length === 0 && !error && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No meetings yet
          </Typography>
          <Typography color="text.secondary">
            Go to the Record tab to capture your first meeting.
          </Typography>
        </Card>
      )}

      <Stack spacing={2}>
        {meetings.map((meeting) => (
          <Card key={meeting.id}>
            <CardActionArea onClick={() => navigate(`/meetings/${meeting.id}`)}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h6">
                      {formatDate(meeting.date)}
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {formatDuration(meeting.duration_minutes)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <TaskAltIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {meeting.task_count} task{meeting.task_count !== 1 ? 's' : ''}
                        </Typography>
                      </Stack>
                      {meeting.speaker_count > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <GroupIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {meeting.speaker_count} speaker{meeting.speaker_count !== 1 ? 's' : ''}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {meeting.status === 'failed' && (
                      <Tooltip title="Rerun analysis">
                        <IconButton
                          size="small"
                          onClick={(e) => handleRerun(e, meeting.id)}
                          disabled={rerunningId === meeting.id}
                        >
                          {rerunningId === meeting.id ? <CircularProgress size={18} /> : <ReplayIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                    {meeting.status === 'processing' && (
                      <CircularProgress size={18} />
                    )}
                    <Chip
                      label={meeting.status}
                      size="small"
                      color={meeting.status === 'completed' ? 'success' : meeting.status === 'failed' ? 'error' : 'default'}
                      variant="outlined"
                    />
                  </Stack>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
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
