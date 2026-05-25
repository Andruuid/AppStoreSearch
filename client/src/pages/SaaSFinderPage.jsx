import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Grid, CircularProgress, Alert, TextField, Button, Chip,
  MenuItem, Select, FormControl, InputLabel, Tabs, Tab, Dialog, DialogTitle,
  DialogContent, DialogActions, LinearProgress, Card, CardContent,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import SyncIcon from '@mui/icons-material/Sync';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AddIcon from '@mui/icons-material/Add';
import SaaSCard from '../components/SaaSCard';
import { useAppContext } from '../context/AppContext';
import {
  getSaasProducts, getSaasStats, getSaasCategories, getSaasSyncStatus,
  addSaasProduct, syncProductHunt, enrichSaasPending, dismissSaasProduct,
  importSaasSeed,
} from '../services/api';

const PAGE_SIZE = 48;

const SORT_OPTIONS = [
  { value: 'date', label: 'Recently added' },
  { value: 'name', label: 'Name' },
  { value: 'opportunity_score', label: 'Opportunity score' },
  { value: 'ph_upvotes', label: 'PH upvotes' },
  { value: 'category', label: 'Category' },
];

function ScoreBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      <Typography variant="caption" sx={{ width: 110, flexShrink: 0 }}>{label}</Typography>
      <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
      <Typography variant="caption" fontWeight={600} sx={{ width: 24, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

export default function SaaSFinderPage() {
  const { saasFinderState, setSaasFinderState } = useAppContext();
  const [tab, setTab] = useState(saasFinderState.tab || 0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState(saasFinderState.search || '');
  const [category, setCategory] = useState(saasFinderState.category || '');
  const [source, setSource] = useState(saasFinderState.source || '');
  const [pricingModel, setPricingModel] = useState(saasFinderState.pricingModel || '');
  const [sortBy, setSortBy] = useState(saasFinderState.sortBy || 'date');
  const [sortDir, setSortDir] = useState(saasFinderState.sortDir || 'desc');

  const [addOpen, setAddOpen] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [adding, setAdding] = useState(false);

  const pollingRef = useRef(null);

  const persistFilters = useCallback((t, s, c, src, pm, sb, sd) => {
    setSaasFinderState({
      tab: t,
      search: s,
      category: c,
      source: src,
      pricingModel: pm,
      sortBy: sb,
      sortDir: sd,
    });
  }, [setSaasFinderState]);

  const loadStats = useCallback(async () => {
    try {
      const [s, cats] = await Promise.all([getSaasStats(), getSaasCategories()]);
      setStats(s);
      setCategories(cats);
    } catch {
      // non-fatal
    }
  }, []);

  const loadProducts = useCallback(async (reset = true) => {
    const nextOffset = reset ? 0 : offset + PAGE_SIZE;
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await getSaasProducts({
        search: search || undefined,
        category: category || undefined,
        source: source || undefined,
        pricingModel: pricingModel || undefined,
        opportunitiesOnly: tab === 1 ? 'true' : undefined,
        sortBy: tab === 1 && sortBy === 'date' ? 'opportunity_score' : sortBy,
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
  }, [search, category, source, pricingModel, sortBy, sortDir, tab, offset]);

  const pollSyncStatus = useCallback(async () => {
    try {
      const status = await getSaasSyncStatus();
      setSyncStatus(status);
      const running = status.productHunt?.running || status.enrichment?.running;
      if (!running && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        loadStats();
        loadProducts(true);
      }
    } catch {
      // ignore
    }
  }, [loadStats, loadProducts]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadProducts(true);
    persistFilters(tab, search, category, source, pricingModel, sortBy, sortDir);
  }, [tab, search, category, source, pricingModel, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    pollSyncStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollSyncStatus]);

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(pollSyncStatus, 3000);
  };

  const handleSyncPH = async () => {
    try {
      await syncProductHunt({ maxPages: 5 });
      startPolling();
      pollSyncStatus();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleEnrich = async () => {
    try {
      await enrichSaasPending({ budget: 30 });
      startPolling();
      pollSyncStatus();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleImportSeed = async () => {
    try {
      await importSaasSeed();
      loadStats();
      loadProducts(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleAdd = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    try {
      await addSaasProduct({
        url: addUrl.trim(),
        name: addName.trim() || undefined,
        category: addCategory.trim() || undefined,
      });
      setAddOpen(false);
      setAddUrl('');
      setAddName('');
      setAddCategory('');
      loadStats();
      loadProducts(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await dismissSaasProduct(id);
      setItems(prev => prev.filter(p => p.id !== id));
      setTotal(prev => prev - 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const isSyncRunning = syncStatus?.productHunt?.running || syncStatus?.enrichment?.running;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <CloudIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>SaaS Finder</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Browse a catalogue of SaaS and micro-SaaS products, sync from Product Hunt, and discover opportunities.
      </Typography>

      {stats && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip label={`${stats.total} products`} color="primary" variant="outlined" />
          <Chip label={`${stats.opportunityCount || 0} opportunities`} color="warning" variant="outlined" />
          {stats.byEnrichmentStatus?.pending != null && (
            <Chip label={`${stats.byEnrichmentStatus.pending} pending enrichment`} variant="outlined" />
          )}
          {!stats.productHuntConfigured && (
            <Chip label="PH token not set" size="small" color="default" />
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
          Add product
        </Button>
        <Button startIcon={<SyncIcon />} variant="outlined" onClick={handleSyncPH} disabled={isSyncRunning}>
          Sync Product Hunt
        </Button>
        <Button startIcon={<AutoFixHighIcon />} variant="outlined" onClick={handleEnrich} disabled={isSyncRunning}>
          Enrich pending
        </Button>
        <Button variant="text" onClick={handleImportSeed}>Re-import seed</Button>
      </Box>

      {isSyncRunning && syncStatus && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            {syncStatus.productHunt?.running && (
              <Typography variant="body2">
                Syncing Product Hunt… {syncStatus.productHunt.processed} processed
              </Typography>
            )}
            {syncStatus.enrichment?.running && (
              <>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Enriching websites… {syncStatus.enrichment.processed}/{syncStatus.enrichment.total}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={syncStatus.enrichment.total
                    ? (syncStatus.enrichment.processed / syncStatus.enrichment.total) * 100
                    : 0}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Catalogue" />
        <Tab label="Opportunities" />
      </Tabs>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 180 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Category</InputLabel>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        {tab === 0 && (
          <>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Source</InputLabel>
              <Select label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="seed">Seed</MenuItem>
                <MenuItem value="product_hunt">Product Hunt</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Pricing</InputLabel>
              <Select label="Pricing" value={pricingModel} onChange={(e) => setPricingModel(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="freemium">Freemium</MenuItem>
                <MenuItem value="subscription">Subscription</MenuItem>
                <MenuItem value="one_time">One-time</MenuItem>
              </Select>
            </FormControl>
          </>
        )}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sort by</InputLabel>
          <Select label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Direction</InputLabel>
          <Select label="Direction" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
            <MenuItem value="desc">Descending</MenuItem>
            <MenuItem value="asc">Ascending</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Alert severity="info">No SaaS products found. Try importing the seed or adding a URL.</Alert>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Showing {items.length} of {total}
          </Typography>
          <Grid container spacing={2}>
            {items.map(product => (
              <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4 }}>
                {tab === 1 ? (
                  <Box>
                    <SaaSCard
                      product={product}
                      showScore
                      showDismiss
                      onDismiss={handleDismiss}
                    />
                    {product.opportunityBreakdown && (
                      <Box sx={{ mt: 1, px: 0.5 }}>
                        <ScoreBar label="Traction" value={product.opportunityBreakdown.tractionScore || 0} max={25} />
                        <ScoreBar label="Pricing" value={product.opportunityBreakdown.pricingScore || 0} max={20} />
                        <ScoreBar label="Category" value={product.opportunityBreakdown.categoryScore || 0} max={20} />
                        <ScoreBar label="Recency" value={product.opportunityBreakdown.recencyScore || 0} max={15} />
                        <ScoreBar label="Engagement" value={product.opportunityBreakdown.engagementScore || 0} max={20} />
                      </Box>
                    )}
                  </Box>
                ) : (
                  <SaaSCard product={product} />
                )}
              </Grid>
            ))}
          </Grid>
          {items.length < total && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button variant="outlined" onClick={() => loadProducts(false)} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </Box>
          )}
        </>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add SaaS product</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Website URL"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="https://example.com"
            required
            fullWidth
          />
          <TextField
            label="Name (optional)"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            fullWidth
          />
          <TextField
            label="Category (optional)"
            value={addCategory}
            onChange={(e) => setAddCategory(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={adding || !addUrl.trim()}>
            {adding ? 'Adding…' : 'Add & enrich'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
