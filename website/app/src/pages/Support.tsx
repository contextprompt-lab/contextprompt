import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { submitSupportRequest } from '../api';

export function Support() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await submitSupportRequest(email, message);
      setSuccess(true);
      setMessage('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Contact Support
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Message sent! We'll get back to you soon.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Have a question or running into an issue? Send us a message and we'll get back to you.
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              size="small"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Message"
              fullWidth
              required
              multiline
              rows={5}
              size="small"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              inputProps={{ maxLength: 5000 }}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !email || !message.trim()}
            >
              {loading ? 'Sending...' : 'Send message'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
