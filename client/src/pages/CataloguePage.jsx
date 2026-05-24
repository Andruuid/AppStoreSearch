import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, CircularProgress, Alert, Card, TextField,
  FormControlLabel, Switch, Button, Chip, MenuItem, Select, InputLabel, FormControl,
} from '@mui/material';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import DiamondIcon from '@mui/icons-material/Diamond';
import AppCard from '../components/AppCard';
import {
  getCatalogue, getCatalogueStats, getCatalogueCategories, getCatalogueKeywords,
  hideCatalogueApp, unhideCatalogueApp, unhideAllCatalogueApps,
} from '../services/api';

const SORT_OPTIONS = [
  { value: 'date', label: 'Recently seen' },
  { value: 'installs', label: 'Installs' },
  { value: 'score', label: 'Rating' },
  { value: 'gem_score', label: 'Gem score' },
  { value: 'title', label: 'Title' },
];

const PAGE_SIZE = 48;

export default function CataloguePage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [gemsOnly, setGemsOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [offset, setOffset] = useState(0);

  const loadStats = useCallback(async () => {
    try {
      const [s, cats, kws] = await Promise.all([
        getCatalogueStats(),
        getCatalogueCategories(),
        getCatalogueKeywords(),
      ]);
      setStats(s);
      setCategories(cats);
      setKeywords(kws);
    } catch {
      // Non-fatal
    }
  }, []);

  const loadCatalogue = useCallback(async (reset = true) => {
    const nextOffset = reset ? 0 : offset + PAGE_SIZE;
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await getCatalogue({
        search: search || undefined,
        category: category || undefined,
        keyword: keyword || undefined,
        gemsOnly: gemsOnly || undefined,
        hiddenOnly: showHidden || undefined,
        sortBy,
        sortDir,
        limit: PAGE_SIZE,
        offset: reset ? 0 : nextOffset,
      });

      if (reset) {
        setItems(data.items);
        setOffset(0);
      } else {
        setItems(prev => [...prev, ...data.items]);
        setOffset(nextOffset);
      }
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, category, keyword, gemsOnly, showHidden, sortBy, sortDir, offset]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCatalogue(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, keyword, gemsOnly, showHidden, sortBy, sortDir]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadCatalogue(true);
  };

  const handleHide = async (appId) => {
    try {
      await hideCatalogueApp(appId);
      setItems(prev => prev.filter(a => a.appId !== appId));
      setTotal(prev => Math.max(0, prev - 1));
      setStats(prev => prev ? { ...prev, hidden: (prev.hidden || 0) + 1 } : prev);
    } catch { /* ignore */ }
  };

  const handleUnhide = async (appId) => {
    try {
      await unhideCatalogueApp(appId);
      setItems(prev => prev.filter(a => a.appId !== appId));
      setTotal(prev => Math.max(0, prev - 1));
      setStats(prev => prev ? { ...prev, hidden: Math.max(0, (prev.hidden || 0) - 1) } : prev);
    } catch { /* ignore */ }
  };

  const handleUnhideAll = async () => {
    try {
      await unhideAllCatalogueApps();
      setShowHidden(false);
      setStats(prev => prev ? { ...prev, hidden: 0 } : prev);
      loadCatalogue(true);
    } catch { /* ignore */ }
  };

  const hasMore = items.length < total;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LibraryBooksIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight={700}>App Catalogue</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Browse all apps stored from Gem Crawler searches. Metadata is stored locally;
        icons and screenshots load from Play Store URLs when online.
      </Typography>

      {stats && (
        <Card variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label={`${stats.total_apps} apps`} color="primary" variant="outlined" />
          <Chip label={`${stats.categories} categories`} variant="outlined" />
          <Chip
            icon={<DiamondIcon />}
            label={`${stats.gems} gems`}
            color="warning"
            variant="outlined"
          />
          {(stats.hidden || 0) > 0 && (
            <Chip label={`${stats.hidden} hidden`} variant="outlined" color="default" />
          )}
        </Card>
      )}

      <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box component="form" onSubmit={handleSearchSubmit} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Search title or developer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 220, flex: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {categories.map(c => (
                <MenuItem key={c} value={c}>{c.replace(/_/g, ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Discovered via</InputLabel>
            <Select value={keyword} label="Discovered via" onChange={(e) => setKeyword(e.target.value)}>
              <MenuItem value="">Any keyword</MenuItem>
              {keywords.map(k => (
                <MenuItem key={k} value={k}>{k}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Sort by</InputLabel>
            <Select value={sortBy} label="Sort by" onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Order</InputLabel>
            <Select value={sortDir} label="Order" onChange={(e) => setSortDir(e.target.value)}>
              <MenuItem value="desc">Descending</MenuItem>
              <MenuItem value="asc">Ascending</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={gemsOnly} onChange={(e) => setGemsOnly(e.target.checked)} />}
            label="Gems only"
          />

          <FormControlLabel
            control={<Switch checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />}
            label="Show hidden"
          />

          {(stats?.hidden || 0) > 0 && (
            <Button variant="outlined" color="secondary" onClick={handleUnhideAll}>
              Unhide all
            </Button>
          )}

          <Button type="submit" variant="contained" disableElevation>
            Search
          </Button>
        </Box>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Alert severity="info">
          {showHidden
            ? 'No hidden apps. Use the hide button on any app to remove it from the catalogue.'
            : 'No apps in the catalogue yet. Run the Gem Crawler to start building your library.'}
        </Alert>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {showHidden
              ? `Showing ${items.length} of ${total} hidden apps`
              : `Showing ${items.length} of ${total} apps`}
          </Typography>

          <Grid container spacing={2}>
            {items.map(app => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={app.appId}>
                <AppCard
                  app={{
                    ...app,
                    opportunityReason: app.gemScore != null
                      ? `Gem score ${app.gemScore}`
                      : undefined,
                  }}
                  hidden={showHidden}
                  onHide={showHidden ? undefined : () => handleHide(app.appId)}
                  onUnhide={showHidden ? () => handleUnhide(app.appId) : undefined}
                />
              </Grid>
            ))}
          </Grid>

          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => loadCatalogue(false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
