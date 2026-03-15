import { useState, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MicIcon from '@mui/icons-material/Mic';
import FolderIcon from '@mui/icons-material/Folder';
import GitHubIcon from '@mui/icons-material/GitHub';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import StarIcon from '@mui/icons-material/Star';
import { useAuth } from '../hooks/useAuth';
import { createPortalSession } from '../api';

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const MAIN_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Setup',
    items: [
      { label: 'Repos', path: '/repos', icon: <FolderIcon /> },
    ],
  },
  {
    section: 'Workflows',
    items: [
      { label: 'Meetings', path: '/record', icon: <MicIcon /> },
      { label: 'Issues', path: '/issues', icon: <GitHubIcon /> },
    ],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
];

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={active}
        onClick={onClick}
        sx={{
          mx: 1,
          borderRadius: 2,
          '&.Mui-selected': {
            bgcolor: 'rgba(108, 99, 255, 0.12)',
            '&:hover': { bgcolor: 'rgba(108, 99, 255, 0.18)' },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, color: active ? 'primary.main' : 'text.secondary' }}>
          {item.icon}
        </ListItemIcon>
        <ListItemText primary={item.label} />
      </ListItemButton>
    </ListItem>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isPro = user?.plan === 'pro';

  // Filter nav items based on plan
  const filteredNav = MAIN_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.path === '/issues' && !isPro) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  // Usage info
  const usagePercent = user?.usage
    ? Math.min(100, Math.round((user.usage.recording_seconds_used / user.usage.recording_seconds_limit) * 100))
    : 0;
  const usageMinutes = user?.usage ? Math.round(user.usage.recording_seconds_used / 60) : 0;
  const limitMinutes = user?.usage ? Math.round(user.usage.recording_seconds_limit / 60) : 0;

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
          contextprompt
        </Typography>
      </Toolbar>

      {/* Main nav sections */}
      <Box sx={{ flex: 1 }}>
        {filteredNav.map((section, i) => (
          <Box key={section.section}>
            {i > 0 && <Divider sx={{ mx: 2, my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />}
            <Typography
              variant="overline"
              sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', color: 'text.secondary', fontSize: '0.65rem', letterSpacing: 1.2 }}
            >
              {section.section}
            </Typography>
            <List dense disablePadding>
              {section.items.map((item) => (
                <NavButton
                  key={item.path}
                  item={item}
                  active={isActive(item.path)}
                  onClick={() => handleNav(item.path)}
                />
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/* Usage indicator */}
      {user?.usage && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Tooltip title={`${usageMinutes} min / ${limitMinutes} min used this ${user.usage.period}`}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Recording</Typography>
                <Typography variant="caption" color="text.secondary">{usageMinutes}m / {limitMinutes}m</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={usagePercent}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: usagePercent >= 90 ? 'error.main' : usagePercent >= 70 ? 'warning.main' : 'primary.main',
                  },
                }}
              />
            </Box>
          </Tooltip>
        </Box>
      )}

      {/* Plan badge + upgrade */}
      {!isPro && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Chip
            icon={<StarIcon sx={{ fontSize: 14 }} />}
            label="Upgrade to Pro"
            size="small"
            color="primary"
            variant="outlined"
            clickable
            onClick={() => {
              window.location.href = '/api/auth/google';
              // Will re-trigger plan selection if needed, or go to stripe
              createPortalSession().catch(() => {
                // Not a subscriber yet — redirect to plan page
                navigate('/');
              });
            }}
            sx={{ width: '100%', justifyContent: 'flex-start' }}
          />
        </Box>
      )}

      {/* Bottom nav (Settings) */}
      <Box>
        <Divider sx={{ mx: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
        <List dense disablePadding sx={{ pb: 1 }}>
          {BOTTOM_NAV.map((item) => (
            <NavButton
              key={item.path}
              item={item}
              active={isActive(item.path)}
              onClick={() => handleNav(item.path)}
            />
          ))}
        </List>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.default',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'none',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          {user && (
            <>
              <Chip
                label={user.plan === 'pro' ? 'Pro' : 'Free'}
                size="small"
                color={user.plan === 'pro' ? 'primary' : 'default'}
                sx={{ mr: 1.5 }}
              />
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                <Avatar
                  src={user.picture || undefined}
                  alt={user.name}
                  sx={{ width: 32, height: 32 }}
                >
                  {user.name[0]}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem disabled>
                  <Typography variant="body2">{user.email}</Typography>
                </MenuItem>
                <Divider />
                {user.plan === 'pro' && (
                  <MenuItem onClick={async () => {
                    setAnchorEl(null);
                    try {
                      const { url } = await createPortalSession();
                      if (url) window.location.href = url;
                    } catch { /* ignore */ }
                  }}>
                    Manage subscription
                  </MenuItem>
                )}
                <MenuItem onClick={async () => {
                  setAnchorEl(null);
                  await logout();
                }}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  Sign out
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, bgcolor: 'background.paper' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              bgcolor: 'background.paper',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: '64px',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
