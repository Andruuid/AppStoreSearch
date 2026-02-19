import { useState } from 'react';
import {
  Box, Typography, Grid, CircularProgress, Alert,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import FilterBar from '../components/FilterBar';
import AppCard from '../components/AppCard';
import AppListItem from '../components/AppListItem';
import { searchApps } from '../services/api';

export default function SearchPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  const handleSearch = async ({ term, category, price }) => {
    if (!term) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchApps({ term, category, price, num: 50 });
      setResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Search Apps
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Search the Google Play Store for apps by keyword, category, and price.
      </Typography>

      <FilterBar onSearch={handleSearch} />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && searched && results.length === 0 && (
        <Alert severity="info">No results found. Try a different search term.</Alert>
      )}

      {results.length > 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {results.length} results
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
              size="small"
            >
              <ToggleButton value="grid"><ViewModuleIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {results.map(app => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={app.appId}>
                  <AppCard app={app} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {results.map(app => (
                <AppListItem key={app.appId} app={app} />
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
