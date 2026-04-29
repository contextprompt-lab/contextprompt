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
  Button,
  Skeleton,
  Alert,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReplayIcon from '@mui/icons-material/Replay';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { getMeeting, rerunMeeting, createCheckoutSession, type MeetingDetail as MeetingDetailType } from '../api';
import { TaskCard, buildAgentBlock } from '../components/TaskCard';
import { useAuth } from '../hooks/useAuth';

export function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPro = user?.plan === 'pro';
  const [meeting, setMeeting] = useState<MeetingDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMeeting = () => {
    if (!id) return;
    getMeeting(parseInt(id, 10))
      .then(setMeeting)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  // Poll while processing
  useEffect(() => {
    if (!meeting || meeting.status !== 'processing') return;
    const interval = setInterval(fetchMeeting, 3000);
    return () => clearInterval(interval);
  }, [meeting?.status]);

  const handleRerun = async () => {
    if (!id) return;
    setRerunning(true);
    setError(null);
    try {
      await rerunMeeting(parseInt(id, 10));
      // Set status to processing locally while we poll
      setMeeting(prev => prev ? { ...prev, status: 'processing' } : prev);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRerunning(false);
    }
  };

  const handleExportAll = () => {
    if (!meeting) return;
    const lines: string[] = [`# Meeting — ${formatDate(meeting.date)}\n`];
    if (meeting.plan?.decisions?.length) {
      lines.push('## Decisions');
      meeting.plan.decisions.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
      lines.push('');
    }
    lines.push(`## Tasks (${meeting.tasks.length})`);
    meeting.tasks.forEach((task) => {
      lines.push(`\n### ${task.task_id}: ${task.title}`);
      lines.push(buildAgentBlock(task).trimEnd());
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpgrade = async () => {
    try {
      const { url } = await createCheckoutSession();
      if (url) window.location.href = url;
    } catch { /* ignore */ }
  };

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
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
        <Chip label={`${meeting.duration_minutes}m`} variant="outlined" />
        <Chip label={`${meeting.task_count} tasks`} variant="outlined" />
        {meeting.speaker_count > 0 && (
          <Chip label={`${meeting.speaker_count} speakers`} variant="outlined" />
        )}
        <Chip
          label={meeting.status}
          color={meeting.status === 'completed' ? 'success' : meeting.status === 'failed' ? 'error' : 'default'}
          variant="outlined"
        />
        {/* Rerun hidden for now
        {meeting.transcript && meeting.status !== 'processing' && (
          <Button
            size="small"
            variant="outlined"
            startIcon={rerunning ? <CircularProgress size={16} /> : <ReplayIcon />}
            disabled={rerunning}
            onClick={handleRerun}
          >
            Rerun Analysis
          </Button>
        )}
        */}
        {meeting.status === 'processing' && (
          <CircularProgress size={20} />
        )}
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Tasks</Typography>
        {meeting.tasks.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            color={copied ? 'success' : 'primary'}
            startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
            onClick={handleExportAll}
          >
            {copied ? 'Copied!' : 'Copy all tasks'}
          </Button>
        )}
      </Stack>
      {meeting.tasks.length === 0 ? (
        <Typography color="text.secondary">No tasks extracted.</Typography>
      ) : (
        <Stack spacing={1}>
          {meeting.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </Stack>
      )}
      {!isPro && meeting.tasks.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Need more than 1 hour of recording per month?{' '}
          <Box
            component="span"
            onClick={handleUpgrade}
            sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            Upgrade to Pro for 15 hours/month →
          </Box>
        </Typography>
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
