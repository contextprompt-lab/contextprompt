import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Skeleton,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getMeeting, type MeetingDetail as MeetingDetailType } from '../api';
import { TaskCard } from '../components/TaskCard';

export function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getMeeting(parseInt(id, 10))
      .then(setMeeting)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rounded" height={200} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error || !meeting) {
    return <Alert severity="error">{error || 'Meeting not found'}</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          {formatDate(meeting.date)}
        </Typography>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Chip label={`${meeting.duration_minutes}m`} variant="outlined" />
        <Chip label={`${meeting.task_count} tasks`} variant="outlined" />
        {meeting.speaker_count > 0 && (
          <Chip label={`${meeting.speaker_count} speakers`} variant="outlined" />
        )}
        <Chip
          label={meeting.status}
          color={meeting.status === 'completed' ? 'success' : 'default'}
          variant="outlined"
        />
      </Stack>

      {/* Decisions */}
      {meeting.plan?.decisions && meeting.plan.decisions.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Decisions Made</Typography>
            <Stack spacing={0.5}>
              {meeting.plan.decisions.map((d, i) => (
                <Typography key={i} variant="body2" color="text.secondary">
                  {i + 1}. {d}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <Typography variant="h5" sx={{ mb: 2 }}>Tasks</Typography>
      {meeting.tasks.length === 0 ? (
        <Typography color="text.secondary">No tasks extracted.</Typography>
      ) : (
        <Stack spacing={1}>
          {meeting.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </Stack>
      )}

      {/* Transcript */}
      {meeting.transcript && (
        <Accordion sx={{ mt: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Transcript</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                color: 'text.secondary',
                maxHeight: 500,
                overflow: 'auto',
              }}
            >
              {meeting.transcript}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
