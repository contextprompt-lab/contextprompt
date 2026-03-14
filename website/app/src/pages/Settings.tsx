import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { getSettings, setSetting } from '../api';

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
];

export function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch((err) => setError(err.message));
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

      {/* Speakers */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Default Speakers</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Comma-separated list of speaker names (in order of appearance).
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Alice, Bob, Charlie"
              value={settings.default_speakers || ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, default_speakers: e.target.value }))}
            />
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => handleSave('default_speakers', settings.default_speakers || '')}
            >
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>About</Typography>
          <Typography variant="body2" color="text.secondary">
            meetcode v0.1.0
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Capture meeting conversations, understand your codebase, output structured coding tasks.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
