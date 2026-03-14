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
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MicIcon from '@mui/icons-material/Mic';
import FolderIcon from '@mui/icons-material/Folder';
import GitHubIcon from '@mui/icons-material/GitHub';
import SettingsIcon from '@mui/icons-material/Settings';

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
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
          meetcode
        </Typography>
      </Toolbar>

      {/* Main nav sections */}
      <Box sx={{ flex: 1 }}>
        {MAIN_NAV.map((section, i) => (
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
