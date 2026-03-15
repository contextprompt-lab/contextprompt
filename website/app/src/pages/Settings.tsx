import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import { getSettings, setSetting, testAnalysis, getRepos, buildRepoMaps } from '../api';

const LANGUAGES = [
  'English',
  'French',
  'Spanish',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
  'Russian',
  'Japanese',
  'Chinese',
  'Korean',
  'Arabic',
];

export function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
    }).catch((err) => setError(err.message));
  }, []);

  const handleSave = async (key: string, value: string) => {
    setError(null);
    setSaved(false);
    try {
      await setSetting(key, value);
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const [analyzeStatus, setAnalyzeStatus] = useState('');

  const handleTestAnalysis = async () => {
    if (!transcript.trim()) return;
    setError(null);
    setAnalyzing(true);
    try {
      // Build repo maps from browser-connected repos
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

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Settings</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved</Alert>}

      {/* AI Model */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>AI Model</Typography>
          <Typography variant="body2" color="text.secondary">
            Powered by Claude from Anthropic.
          </Typography>
        </CardContent>
      </Card>

      {/* Response Language */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Response Language</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose the language for extracted tasks, decisions, and summaries. File paths and code stay in English.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Language</InputLabel>
            <Select
              value={settings.response_language || 'English'}
              label="Language"
              onChange={(e) => handleSave('response_language', e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang} value={lang}>{lang}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Test Analysis */}
      <Card sx={{ mb: 3 }}>
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

    </Box>
  );
}
