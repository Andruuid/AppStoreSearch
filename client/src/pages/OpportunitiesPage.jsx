import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, Grid, CircularProgress, Alert,
  TextField, MenuItem, Button,
} from '@mui/material';
import AppCard from '../components/AppCard';
import { getLowRated, getSoloDev, getNicheProfitable, getTrending, getCategories } from '../services/api';
import { useAppContext } from '../context/AppContext';

const TAB_CONFIG = [
  { label: 'Low Rated', fetcher: getLowRated, description: 'Popular apps with poor ratings -- ripe for a better alternative.' },
  { label: 'Solo Dev', fetcher: getSoloDev, description: 'Apps by small indie developers with significant downloads.' },
  { label: 'Profitable Niche', fetcher: getNicheProfitable, description: 'Paid apps or IAP earners proving users will pay.' },
  { label: 'Trending', fetcher: getTrending, description: 'Recently updated and growing apps in niche categories.' },
];

export default function OpportunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { opportunityState, setOpportunityState } = useAppContext();
  const { results, searched, tab, category } = opportunityState;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  const initialTab = parseInt(searchParams.get('tab'));
  useEffect(() => {
    if (!isNaN(initialTab) && initialTab !== tab) {
      setOpportunityState(prev => ({ ...prev, tab: initialTab, results: [], searched: false }));
    }
  }, []);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = TAB_CONFIG[tab];
      const data = await config.fetcher({ category: category || undefined });
      setOpportunityState(prev => ({
        ...prev,
        results: Array.isArray(data) ? data : [],
        searched: true,
      }));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_, newTab) => {
    setOpportunityState(prev => ({ ...prev, tab: newTab, results: [], searched: false }));
    setSearchParams({ tab: newTab });
    setError(null);
  };

  const handleCategoryChange = (e) => {
    setOpportunityState(prev => ({ ...prev, category: e.target.value }));
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Opportunities
      </Typography>

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
        {TAB_CONFIG.map((t, i) => (
          <Tab key={i} label={t.label} />
        ))}
      </Tabs>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {TAB_CONFIG[tab].description}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <TextField
          select
          value={category}
          onChange={handleCategoryChange}
          size="small"
          sx={{ minWidth: 200 }}
          label="Category"
        >
          <MenuItem value="">All Categories</MenuItem>
          {categories.map(c => (
            <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
          ))}
        </TextField>

        <Button variant="contained" disableElevation onClick={handleFetch}>
          Find Opportunities
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && results.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {results.length} opportunities found
          </Typography>
          <Grid container spacing={2}>
            {results.map(app => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={app.appId}>
                <AppCard app={app} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {!loading && !error && results.length === 0 && !searched && (
        <Alert severity="info">
          Select a category and click "Find Opportunities" to discover apps.
        </Alert>
      )}

      {!loading && !error && results.length === 0 && searched && (
        <Alert severity="warning">
          No opportunities found for this category. Try a different category or strategy.
        </Alert>
      )}
    </Box>
  );
}
