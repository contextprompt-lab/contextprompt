import { useState } from 'react';
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
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { adminQuery } from '../api';

export function Admin() {
  const [sql, setSql] = useState('SELECT * FROM users;');
  const [result, setResult] = useState<{ columns: string[]; rows: unknown[][] } | { changes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
