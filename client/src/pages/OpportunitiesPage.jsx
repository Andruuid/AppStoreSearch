import { useState, useEffect, useMemo } from 'react';
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

const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'installs', label: 'Installs' },
  { value: 'date', label: 'Date' },
];

const DIR_OPTIONS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

function getDateValue(app) {
  return Date.parse(app.released || app.releasedDate || app.updated || '') || 0;
}

export default function OpportunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { opportunityState, setOpportunityState } = useAppContext();
  const {
    results,
    searched,
    tab,
    category,
    sortBy = 'installs',
    sortDir = 'desc',
  } = opportunityState;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  const sortedResults = useMemo(() => {
    const arr = [...results];
    const factor = sortDir === 'asc' ? 1 : -1;
    return arr.sort((a, b) => {
      if (sortBy === 'score') return ((a.score || 0) - (b.score || 0)) * factor;
      if (sortBy === 'date') return (getDateValue(a) - getDateValue(b)) * factor;
      return ((a.minInstalls || 0) - (b.minInstalls || 0)) * factor;
    });
  }, [results, sortBy, sortDir]);

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

  const handleSortByChange = (e) => {
    setOpportunityState(prev => ({ ...prev, sortBy: e.target.value }));
  };

  const handleSortDirChange = (e) => {
    setOpportunityState(prev => ({ ...prev, sortDir: e.target.value }));
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

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          select
          value={sortBy}
          onChange={handleSortByChange}
          size="small"
          sx={{ minWidth: 180 }}
          label="Sort by"
        >
          {SORT_OPTIONS.map(o => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          value={sortDir}
          onChange={handleSortDirChange}
          size="small"
          sx={{ minWidth: 180 }}
          label="Direction"
        >
          {DIR_OPTIONS.map(o => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
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
            {sortedResults.map(app => (
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
