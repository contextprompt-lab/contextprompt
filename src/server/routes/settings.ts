import { Router } from 'express';
import { getSetting, setSetting, deleteSetting } from '../db.js';

export const settingsRouter = Router();

const ALLOWED_KEYS = ['auth_token', 'default_model', 'default_speakers', 'verbose'];

// Get all settings
settingsRouter.get('/', (_req, res) => {
  const settings: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    const value = getSetting(key);
    if (value !== undefined) settings[key] = value;
  }
  res.json(settings);
});

// Get a single setting
settingsRouter.get('/:key', (req, res) => {
  const { key } = req.params;
  const value = getSetting(key);
  if (value === undefined) {
    res.status(404).json({ error: 'Setting not found' });
    return;
  }
  res.json({ key, value });
});

// Set a setting
settingsRouter.put('/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ error: `Invalid setting key: ${key}` });
    return;
  }

  if (typeof value !== 'string') {
    res.status(400).json({ error: 'Value must be a string' });
    return;
  }

  setSetting(key, value);
  res.json({ ok: true });
});

// Delete a setting
settingsRouter.delete('/:key', (req, res) => {
  const { key } = req.params;
  deleteSetting(key);
  res.json({ ok: true });
});
