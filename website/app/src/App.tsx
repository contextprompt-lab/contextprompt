import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { theme } from './theme';
import { AppLayout } from './components/AppLayout';
import { Home } from './pages/Home';
import { MeetingDetail } from './pages/MeetingDetail';
import { Recording } from './pages/Recording';
import { Repos } from './pages/Repos';
import { Settings } from './pages/Settings';
import { Issues } from './pages/Issues';
import { IssueDetail } from './pages/IssueDetail';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename="/app">
        <AppLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/meetings/:id" element={<MeetingDetail />} />
            <Route path="/record" element={<Recording />} />
            <Route path="/repos" element={<Repos />} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/issues/:id" element={<IssueDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ThemeProvider>
  );
}
