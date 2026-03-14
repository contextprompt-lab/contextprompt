import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Stack,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Breadcrumbs,
  Link,
  Divider,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SourceIcon from '@mui/icons-material/Source';
import {
  getRepos, addRepo, removeRepo, browseFolders, connectRepoGithub, disconnectRepoGithub,
  registerBrowserRepo, supportsFileSystemAccess, scanDirectoryHandle, saveDirectoryHandle, removeDirectoryHandle,
  type Repo, type BrowseResult,
} from '../api';

export function Repos() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Browse dialog state (fallback for local dev)
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // Upload progress state (File System Access API)
  const [scanProgress, setScanProgress] = useState<string | null>(null);

  const loadRepos = () => {
    getRepos()
      .then(setRepos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRepos(); }, []);

  const [connectingId, setConnectingId] = useState<number | null>(null);

  const handleRemove = async (id: number) => {
    try {
      await removeDirectoryHandle(id).catch(() => {}); // Clean up IndexedDB handle
      await removeRepo(id);
      loadRepos();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleConnectGithub = async (id: number) => {
    setConnectingId(id);
    setError(null);
    try {
      await connectRepoGithub(id);
      loadRepos();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnectGithub = async (id: number) => {
    try {
      await disconnectRepoGithub(id);
      loadRepos();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // --- Folder browser ---
  const openBrowser = async () => {
    // Use File System Access API when available (deployed / Chrome)
    if (supportsFileSystemAccess()) {
      setError(null);
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
        setScanProgress('Scanning folder...');

        // Scan locally to verify it works
        await scanDirectoryHandle(dirHandle, setScanProgress);

        // Register on server (just the name, no files)
        setScanProgress('Registering...');
        const result = await registerBrowserRepo(dirHandle.name);

        // Store the handle in IndexedDB for future re-reads
        await saveDirectoryHandle(result.id, dirHandle);

        setScanProgress(null);
        loadRepos();
      } catch (err: any) {
        setScanProgress(null);
        if (err.name === 'AbortError') return; // User cancelled
        setError(err.message);
      }
      return;
    }

    // Fallback: server-side browse (local dev)
    setBrowseOpen(true);
    setBrowseError(null);
    setBrowseLoading(true);
    try {
      const data = await browseFolders();
      setBrowseData(data);
    } catch (err) {
      setBrowseError((err as Error).message);
    } finally {
      setBrowseLoading(false);
    }
  };

  const navigateTo = async (path: string) => {
    setBrowseError(null);
    setBrowseLoading(true);
    try {
      const data = await browseFolders(path);
      setBrowseData(data);
    } catch (err) {
      setBrowseError((err as Error).message);
    } finally {
      setBrowseLoading(false);
    }
  };

  const selectFolder = async (path: string) => {
    setError(null);
    try {
      await addRepo(path);
      setBrowseOpen(false);
      loadRepos();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const selectCurrentFolder = () => {
    if (browseData) selectFolder(browseData.current);
  };

  // Build breadcrumb segments from current path
  const breadcrumbs = browseData ? buildBreadcrumbs(browseData.current) : [];

  const isBrowserRepo = (repo: Repo) => repo.path.startsWith('browser://');

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Repos</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {scanProgress && <Alert severity="info" sx={{ mb: 2 }}>{scanProgress}</Alert>}

      {/* Add repo */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Add a repository</Typography>
            <Button
              variant="contained"
              startIcon={<FolderOpenIcon />}
              onClick={openBrowser}
              disabled={!!scanProgress}
            >
              Browse folders
            </Button>
          </Stack>
          {supportsFileSystemAccess() && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Your files stay on your machine. Only a structural summary is used during analysis.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Repo list */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Connected repos ({repos.length})
          </Typography>
          {repos.length === 0 && !loading ? (
            <Typography color="text.secondary">
              No repos added yet. Click "Browse folders" above to get started.
            </Typography>
          ) : (
            <List>
              {repos.map((repo) => (
                <ListItem
                  key={repo.id}
                  sx={{
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                  }}
                >
                  <ListItemIcon>
                    {repo.exists || isBrowserRepo(repo) ? (
                      <FolderIcon color="primary" />
                    ) : (
                      <ErrorOutlineIcon color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{repo.name}</span>
                        {isBrowserRepo(repo) && (
                          <Chip label="local" size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                        {!repo.exists && !isBrowserRepo(repo) && (
                          <Chip label="not found" size="small" color="error" variant="outlined" />
                        )}
                        {repo.github_owner && repo.github_repo && (
                          <Chip
                            icon={<GitHubIcon sx={{ fontSize: '0.85rem' }} />}
                            label={`${repo.github_owner}/${repo.github_repo}`}
                            size="small"
                            variant="outlined"
                            onDelete={() => handleDisconnectGithub(repo.id)}
                            deleteIcon={<LinkOffIcon sx={{ fontSize: '0.85rem' }} />}
                            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={isBrowserRepo(repo) ? 'Connected from your browser' : repo.path}
                    secondaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={0.5}>
                      {!repo.github_owner && !isBrowserRepo(repo) && repo.exists && (
                        <Button
                          size="small"
                          startIcon={<GitHubIcon />}
                          onClick={() => handleConnectGithub(repo.id)}
                          disabled={connectingId === repo.id}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {connectingId === repo.id ? 'Detecting...' : 'Connect GitHub'}
                        </Button>
                      )}
                      <IconButton edge="end" onClick={() => handleRemove(repo.id)} title="Remove">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Folder browser dialog (local dev fallback) */}
      <Dialog
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { minHeight: 500 } }}
      >
        <DialogTitle>
          Browse folders
        </DialogTitle>
        <DialogContent dividers>
          {browseError && <Alert severity="error" sx={{ mb: 1 }}>{browseError}</Alert>}

          {browseData && (
            <>
              {/* Breadcrumb path */}
              <Breadcrumbs sx={{ mb: 1, fontSize: '0.8rem' }}>
                {breadcrumbs.map((seg, i) => (
                  i === breadcrumbs.length - 1 ? (
                    <Typography key={seg.path} variant="body2" color="text.primary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {seg.name}
                    </Typography>
                  ) : (
                    <Link
                      key={seg.path}
                      component="button"
                      variant="body2"
                      onClick={() => navigateTo(seg.path)}
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      {seg.name}
                    </Link>
                  )
                ))}
              </Breadcrumbs>

              <Divider sx={{ mb: 1 }} />

              {/* Go up */}
              {browseData.current !== browseData.parent && (
                <ListItemButton
                  onClick={() => navigateTo(browseData.parent)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <ArrowUpwardIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary=".." primaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
                </ListItemButton>
              )}

              {/* Directory listing */}
              <List dense disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
                {browseLoading && browseData.dirs.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 2 }}>Loading...</Typography>
                )}
                {browseData.dirs.map((dir) => (
                  <ListItem key={dir.path} disablePadding>
                    <ListItemButton
                      onClick={() => navigateTo(dir.path)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {dir.isGitRepo ? (
                          <SourceIcon fontSize="small" color="success" />
                        ) : (
                          <FolderIcon fontSize="small" color="action" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{dir.name}</span>
                            {dir.isGitRepo && (
                              <Chip label="git" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                            )}
                          </Stack>
                        }
                      />
                      {dir.isGitRepo && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectFolder(dir.path);
                          }}
                          title="Add this repo"
                          sx={{ color: 'primary.main' }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      )}
                    </ListItemButton>
                  </ListItem>
                ))}
                {!browseLoading && browseData.dirs.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No subfolders
                  </Typography>
                )}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBrowseOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={selectCurrentFolder}
            startIcon={<AddIcon />}
          >
            Add current folder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function buildBreadcrumbs(path: string): Array<{ name: string; path: string }> {
  const parts = path.split('/').filter(Boolean);
  const crumbs: Array<{ name: string; path: string }> = [];
  // Add root
  crumbs.push({ name: '/', path: '/' });
  let current = '';
  for (const part of parts) {
    current += '/' + part;
    crumbs.push({ name: part, path: current });
  }
  return crumbs;
}
