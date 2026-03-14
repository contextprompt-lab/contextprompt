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
  TextField,
  Button,
  Stack,
} from '@mui/material';
import { getSettings, setSetting } from '../api';

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
];

const RECALL_REGIONS = [
  { value: 'us-east-1', label: 'US East (Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

export function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recallKey, setRecallKey] = useState('');

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      // Show masked key if configured
      if (s.recall_api_key) {
        setRecallKey('••••••••••••' + s.recall_api_key.slice(-4));
      }
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

  const handleSaveRecallKey = async () => {
    if (!recallKey || recallKey.startsWith('••')) return;
    await handleSave('recall_api_key', recallKey);
    setRecallKey('••••••••••••' + recallKey.slice(-4));
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Settings</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved</Alert>}

      {/* Recall.ai */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>Recall.ai</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Recall.ai sends a bot to your meetings to record and transcribe. Get your API key from your Recall.ai dashboard.
          </Typography>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                label="API Key"
                value={recallKey}
                onChange={(e) => setRecallKey(e.target.value)}
                onFocus={() => {
                  if (recallKey.startsWith('••')) setRecallKey('');
                }}
                placeholder="Enter your Recall.ai API key"
                type={recallKey.startsWith('••') ? 'text' : 'password'}
              />
              <Button
                variant="contained"
                onClick={handleSaveRecallKey}
                disabled={!recallKey || recallKey.startsWith('••')}
              >
                Save
              </Button>
            </Stack>
            <FormControl fullWidth size="small">
              <InputLabel>Region</InputLabel>
              <Select
                value={settings.recall_region || 'us-east-1'}
                label="Region"
                onChange={(e) => handleSave('recall_region', e.target.value)}
              >
                {RECALL_REGIONS.map((r) => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

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

    </Box>
  );
}
