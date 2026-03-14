import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
  IconButton,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { TaskDetail } from '../api';

export function TaskCard({ task }: { task: TaskDetail }) {
  const confidenceColor = task.confidence === 'high' ? 'success' : task.confidence === 'medium' ? 'warning' : 'default';
  const statusColor = task.status === 'ready' ? 'success' : task.status === 'review' ? 'warning' : 'error';

  const handleCopyBlock = () => {
    const block = buildAgentBlock(task);
    navigator.clipboard.writeText(block);
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {task.task_id}: {task.title}
              </Typography>
              <Chip label={task.status} size="small" color={statusColor} variant="outlined" />
              <Chip label={task.confidence} size="small" color={confidenceColor} variant="outlined" />
            </Stack>

            {task.proposed_change && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {task.proposed_change}
              </Typography>
            )}

            {task.files.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                {task.files.map((f, i) => (
                  <Chip key={i} label={f.path} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
                ))}
              </Stack>
            )}

            {task.steps.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Steps:</Typography>
                {task.steps.map((step, i) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                    {i + 1}. {step}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>

          <Stack spacing={0.5}>
            <IconButton size="small" title="Copy Claude Code block" onClick={handleCopyBlock}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
            {task.github_issue_url ? (
              <IconButton size="small" href={task.github_issue_url} target="_blank" title="View GitHub issue">
                <GitHubIcon fontSize="small" color="success" />
              </IconButton>
            ) : (
              <IconButton size="small" title="Create GitHub issue" disabled>
                <GitHubIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export function buildAgentBlock(task: TaskDetail): string {
  let block = `Goal: ${task.proposed_change || task.title}\n\n`;
  if (task.files.length > 0) {
    block += 'Files:\n';
    for (const f of task.files) {
      block += `- ${f.path} — ${f.reason}\n`;
    }
    block += '\n';
  }
  if (task.steps.length > 0) {
    block += 'Steps:\n';
    task.steps.forEach((s, i) => {
      block += `${i + 1}. ${s}\n`;
    });
    block += '\n';
  }
  if (task.ambiguities.length > 0) {
    block += 'Watch out for:\n';
    task.ambiguities.forEach((a) => {
      block += `- ${a}\n`;
    });
  }
  return block;
}
