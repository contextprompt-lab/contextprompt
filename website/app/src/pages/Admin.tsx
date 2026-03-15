import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Alert,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { adminQuery, testAnalysis, getRepos, buildRepoMaps } from '../api';

export function Admin() {
  const navigate = useNavigate();
  const [sql, setSql] = useState('SELECT * FROM users;');
  const [result, setResult] = useState<{ columns: string[]; rows: unknown[][] } | { changes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('');

  const handleTestAnalysis = async () => {
    if (!transcript.trim()) return;
    setError(null);
    setAnalyzing(true);
    try {
      setAnalyzeStatus('Fetching repos...');
      const repos = await getRepos();
      const browserRepoIds = repos
        .filter(r => r.path.startsWith('browser://'))
        .map(r => r.id);

      let repoMaps;
      if (browserRepoIds.length > 0) {
        setAnalyzeStatus(`Scanning ${browserRepoIds.length} repos...`);
        repoMaps = await buildRepoMaps(browserRepoIds, (msg) => setAnalyzeStatus(msg));
        setAnalyzeStatus(`Scanned ${repoMaps.length} repos, submitting...`);
      } else {
        setAnalyzeStatus('No browser repos found, submitting...');
      }

      const result = await testAnalysis(transcript.trim(), repoMaps);
      navigate(`/meetings/${result.meeting_id}`);
    } catch (err) {
      setError((err as Error).message);
      setAnalyzing(false);
      setAnalyzeStatus('');
    }
  };

  const handleRun = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await adminQuery(sql);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Admin Console</Typography>

      {/* Test Analysis */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>Test Analysis</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste a transcript to test the extraction pipeline without recording a meeting.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={12}
            placeholder="Paste meeting transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={analyzing}
            size="small"
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleTestAnalysis}
            disabled={analyzing || !transcript.trim()}
          >
            {analyzing ? <><CircularProgress size={18} sx={{ mr: 1 }} /> Analyzing...</> : 'Run Analysis'}
          </Button>
          {analyzeStatus && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {analyzeStatus}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2 }}>SQL Query</Typography>
      <TextField
        fullWidth
        multiline
        minRows={3}
        maxRows={10}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter SQL query..."
        sx={{
          mb: 2,
          '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 14 },
        }}
      />

      <Button
        variant="contained"
        startIcon={<PlayArrowIcon />}
        onClick={handleRun}
        disabled={loading || !sql.trim()}
        sx={{ mb: 3 }}
      >
        {loading ? 'Running...' : 'Run Query'}
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
        Cmd+Enter to run
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && 'columns' in result && (
        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {result.columns.map((col) => (
                  <TableCell key={col} sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {result.rows.map((row, i) => (
                <TableRow key={i} hover>
                  {row.map((val, j) => (
                    <TableCell key={j} sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {val === null ? <em style={{ opacity: 0.4 }}>NULL</em> : String(val)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {result && 'columns' in result && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {result.rows.length} row(s)
        </Typography>
      )}

      {result && 'changes' in result && (
        <Alert severity="success">{result.changes} row(s) affected</Alert>
      )}
    </Box>
  );
}
