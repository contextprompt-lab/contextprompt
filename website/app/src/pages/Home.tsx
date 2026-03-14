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
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import GroupIcon from '@mui/icons-material/Group';
import { getMeetings, type Meeting } from '../api';

export function Home() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getMeetings()
      .then(setMeetings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
