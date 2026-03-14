import { useEffect, useState } from 'react';
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
} from '@mui/material';
import { getSettings, setSetting } from '../api';

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
];

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
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Settings</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved</Alert>}

      {/* Model */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Default Model</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Claude Model</InputLabel>
            <Select
              value={settings.default_model || 'claude-sonnet-4-6'}
              label="Claude Model"
              onChange={(e) => handleSave('default_model', e.target.value)}
            >
              {MODELS.map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
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

    </Box>
  );
}
