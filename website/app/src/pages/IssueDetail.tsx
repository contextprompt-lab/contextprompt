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
  Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GitHubIcon from '@mui/icons-material/GitHub';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getIssueAnalysis, type IssueAnalysisDetail, type TaskDetail } from '../api';
import { TaskCard, buildAgentBlock } from '../components/TaskCard';

export function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<IssueAnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getIssueAnalysis(parseInt(id, 10))
      .then(setAnalysis)
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

  if (error || !analysis) {
    return <Alert severity="error">{error || 'Analysis not found'}</Alert>;
  }

  const plan = analysis.plan;
  const tasks: TaskDetail[] = (plan?.tasks ?? []).map((t, i) => ({
    id: i,
    task_id: t.id,
    title: t.title,
    status: t.status,
    confidence: t.confidence,
    confidence_reason: t.confidence_reason,
    proposed_change: t.proposed_change,
    evidence: t.evidence,
    files: [...(t.high_confidence_files ?? []), ...(t.possible_related_files ?? [])],
    steps: t.agent_steps ?? [],
    dependencies: t.dependencies ?? [],
    ambiguities: t.ambiguities ?? [],
    github_issue_url: analysis.issue_url,
  }));

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/issues')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          Issue #{analysis.issue_number}: {analysis.issue_title}
        </Typography>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap">
        <Chip
          icon={<GitHubIcon />}
          label={
            <Link href={analysis.issue_url} target="_blank" rel="noopener" sx={{ color: 'inherit', textDecoration: 'none' }}>
              View on GitHub
            </Link>
          }
          variant="outlined"
          clickable
          component="a"
          href={analysis.issue_url}
          target="_blank"
        />
        <Chip label={`${analysis.task_count} tasks`} variant="outlined" />
        <Chip label={analysis.repo_name} variant="outlined" />
        <Chip
          label={analysis.status}
          color={analysis.status === 'completed' ? 'success' : analysis.status === 'failed' ? 'error' : 'warning'}
          variant="outlined"
        />
        {analysis.labels?.map((label) => (
          <Chip key={label} label={label} size="small" color="primary" variant="outlined" />
        ))}
      </Stack>

      {/* Fix Summary */}
      {plan?.fix_summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>How to Fix</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {plan.fix_summary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Decisions */}
      {plan?.decisions && plan.decisions.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Decisions / Triage</Typography>
            <Stack spacing={0.5}>
              {plan.decisions.map((d, i) => (
                <Typography key={i} variant="body2" color="text.secondary">
                  {i + 1}. {d}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Execution Buckets */}
      {plan?.execution_buckets && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Execution Status</Typography>
            <Stack spacing={1}>
              {plan.execution_buckets.ready_now.length > 0 && (
                <Box>
                  <Chip label="Ready Now" color="success" size="small" sx={{ mr: 1 }} />
                  <Typography variant="body2" component="span" color="text.secondary">
                    {plan.execution_buckets.ready_now.join(', ')}
                  </Typography>
                </Box>
              )}
              {plan.execution_buckets.review_before_execution.length > 0 && (
                <Box>
                  <Chip label="Review First" color="warning" size="small" sx={{ mr: 1 }} />
                  <Typography variant="body2" component="span" color="text.secondary">
                    {plan.execution_buckets.review_before_execution.join(', ')}
                  </Typography>
                </Box>
              )}
              {plan.execution_buckets.needs_clarification.length > 0 && (
                <Box>
                  <Chip label="Needs Clarification" color="error" size="small" sx={{ mr: 1 }} />
                  <Typography variant="body2" component="span" color="text.secondary">
                    {plan.execution_buckets.needs_clarification.join(', ')}
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <Typography variant="h5" sx={{ mb: 2 }}>Tasks</Typography>
      {tasks.length === 0 ? (
        <Typography color="text.secondary">No tasks extracted.</Typography>
      ) : (
        <Stack spacing={1}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </Stack>
      )}

      {/* Assumptions */}
      {plan?.assumptions && plan.assumptions.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Assumptions</Typography>
            <Stack spacing={0.5}>
              {plan.assumptions.map((a, i) => (
                <Typography key={i} variant="body2" color="text.secondary">
                  - {a}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Incomplete Items */}
      {plan?.incomplete_items && plan.incomplete_items.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Incomplete Items</Typography>
            <Stack spacing={1}>
              {plan.incomplete_items.map((item, i) => (
                <Box key={i}>
                  <Typography variant="body2" fontWeight={600}>{item.text}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.why_incomplete}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Issue Body */}
      {analysis.issue_body && (
        <Accordion sx={{ mt: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Issue Body</Typography>
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
              {analysis.issue_body}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Agent Execution Blocks */}
      {tasks.length > 0 && (
        <Accordion sx={{ mt: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Agent Execution Blocks</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Copy-paste any block below directly into Claude Code.
            </Typography>
            <Stack spacing={2}>
              {tasks.map((task) => (
                <Card key={task.id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        {task.task_id}: {task.title}
                      </Typography>
                      <IconButton
                        size="small"
                        title="Copy to clipboard"
                        onClick={() => navigator.clipboard.writeText(buildAgentBlock(task))}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Box
                      component="pre"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        color: 'text.secondary',
                        bgcolor: 'rgba(0,0,0,0.2)',
                        p: 1.5,
                        borderRadius: 1,
                      }}
                    >
                      {buildAgentBlock(task)}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}
