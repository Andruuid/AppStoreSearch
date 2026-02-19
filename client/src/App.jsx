import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import AppDetailPage from './pages/AppDetailPage';
import GemFinderPage from './pages/GemFinderPage';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6366f1' },
    background: { default: '#fafafa' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/opportunities" element={<OpportunitiesPage />} />
            <Route path="/gems" element={<GemFinderPage />} />
            <Route path="/app/:appId" element={<AppDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  );
}
