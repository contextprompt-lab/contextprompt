import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Stack,
  Alert,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  IconButton,
  Divider,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import {
  getRepos,
  getGithubIssues,
  getIssueAnalyses,
  analyzeIssue,
  getAnalysisStatus,
  deleteIssueAnalysis,
  type Repo,
  type GitHubIssueSummary,
  type IssueAnalysis,
} from '../api';

export function Issues() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<number | ''>('');
  const [issues, setIssues] = useState<GitHubIssueSummary[]>([]);
  const [analyses, setAnalyses] = useState<IssueAnalysis[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzingIds, setAnalyzingIds] = useState<Map<string, number>>(new Map());

  const pollTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const connectedRepos = repos.filter((r) => r.github_owner && r.github_repo);

  useEffect(() => {
    getRepos().then(setRepos).catch(() => {});
    loadAnalyses();
  }, []);

  const loadAnalyses = () => {
    getIssueAnalyses()
      .then(setAnalyses)
      .catch((err) => setError(err.message))
      .finally(() => setAnalysesLoading(false));
  };

  const loadIssues = useCallback(async (repoId?: number) => {
    setIssuesLoading(true);
    setError(null);
    try {
      const data = await getGithubIssues(repoId);
      setIssues(data);
    } catch (err) {
      setError((err as Error).message);
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connectedRepos.length > 0) {
      loadIssues(selectedRepoId || undefined);
    }
  }, [selectedRepoId, connectedRepos.length, loadIssues]);

  // Cleanup poll timers on unmount
  useEffect(() => {
    return () => {
      pollTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, []);

  const handleAnalyze = async (repoId: number, issueNumber: number) => {
    const key = `${repoId}-${issueNumber}`;
    setError(null);
    try {
      const { id } = await analyzeIssue(repoId, issueNumber);
      setAnalyzingIds((prev) => new Map(prev).set(key, id));

      // Poll for completion
      const timer = setInterval(async () => {
        try {
          const status = await getAnalysisStatus(id);
          if (status.status === 'completed') {
            clearInterval(timer);
            pollTimers.current.delete(id);
            setAnalyzingIds((prev) => {
              const next = new Map(prev);
              next.delete(key);
              return next;
            });
            navigate(`/issues/${id}`);
          } else if (status.status === 'failed') {
            clearInterval(timer);
            pollTimers.current.delete(id);
            setAnalyzingIds((prev) => {
              const next = new Map(prev);
              next.delete(key);
              return next;
            });
            setError(`Analysis failed: ${status.error || 'Unknown error'}`);
            loadAnalyses();
          }
        } catch {
          // Keep polling on transient errors
        }
      }, 2000);
      pollTimers.current.set(id, timer);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteAnalysis = async (id: number) => {
    try {
      await deleteIssueAnalysis(id);
      loadAnalyses();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (connectedRepos.length === 0 && !analysesLoading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>Issues</Typography>
        <Alert severity="info">
          No repos are connected to GitHub yet. Go to the{' '}
          <strong>Repos</strong> page and click "Connect GitHub" on a repo to get started.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Issues</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Open Issues Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Open Issues</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by repo</InputLabel>
              <Select
                value={selectedRepoId}
                label="Filter by repo"
                onChange={(e) => setSelectedRepoId(e.target.value as number | '')}
              >
                <MenuItem value="">All repos</MenuItem>
                {connectedRepos.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.github_owner}/{r.github_repo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {issuesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={32} />
            </Box>
          ) : issues.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No open issues found.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {issues.map((issue) => {
                const analyzeKey = `${issue.repo_id}-${issue.number}`;
                const isAnalyzing = analyzingIds.has(analyzeKey);
                return (
                  <Card key={`${issue.repo_id}-${issue.number}`} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle2" fontWeight={600}>
                              #{issue.number}
                            </Typography>
                            <Typography variant="body2">{issue.title}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip
                              label={`${issue.github_owner}/${issue.github_repo}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                            {issue.labels.map((label) => (
                              <Chip
                                key={label}
                                label={label}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            ))}
                            <Typography variant="caption" color="text.secondary">
                              by {issue.author}
                            </Typography>
                          </Stack>
                        </Box>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={isAnalyzing ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                          onClick={() => handleAnalyze(issue.repo_id, issue.number)}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* Past Analyses Section */}
      <Typography variant="h6" sx={{ mb: 2 }}>Past Analyses</Typography>
      {analysesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={32} />
        </Box>
      ) : analyses.length === 0 ? (
        <Typography color="text.secondary">
          No analyses yet. Select an issue above and click "Analyze" to get started.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {analyses.map((analysis) => (
            <Card key={analysis.id} variant="outlined">
              <CardActionArea onClick={() => analysis.status === 'completed' && navigate(`/issues/${analysis.id}`)}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <GitHubIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight={600}>
                          #{analysis.issue_number}: {analysis.issue_title}
                        </Typography>
                        <Chip
                          label={analysis.status}
                          size="small"
                          color={analysis.status === 'completed' ? 'success' : analysis.status === 'failed' ? 'error' : 'warning'}
                          variant="outlined"
                        />
                        {analysis.status === 'completed' && (
                          <Chip label={`${analysis.task_count} tasks`} size="small" variant="outlined" />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {analysis.repo_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(analysis.created_at).toLocaleString()}
                        </Typography>
                      </Stack>
                      {analysis.error && (
                        <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                          {analysis.error}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAnalysis(analysis.id);
                      }}
                      title="Delete analysis"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
