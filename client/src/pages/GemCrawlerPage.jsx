import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Grid, Alert, Button, Slider, Card, CardActionArea,
  CardContent, Avatar, Chip, Rating, LinearProgress, Tooltip, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DiamondIcon from '@mui/icons-material/Diamond';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { startCrawl, getCrawlStatus, getCrawledGems, dismissCrawledApp, resetCrawl } from '../services/api';
import { useAppContext } from '../context/AppContext';

const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'installs', label: 'Installs' },
  { value: 'date', label: 'Date' },
];

const DIR_OPTIONS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

function CrawlGemCard({ gem, onDismiss }) {
  const navigate = useNavigate();
  const appId = gem.app_id;
  const breakdown = typeof gem.gem_breakdown === 'object' ? gem.gem_breakdown : {};

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea
        onClick={() => navigate(`/app/${encodeURIComponent(appId)}`)}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <Avatar src={gem.icon} variant="rounded" sx={{ width: 48, height: 48 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>{gem.title}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{gem.developer}</Typography>
            </Box>
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              bgcolor: gem.gem_score >= 70 ? 'warning.main' : 'primary.main',
              color: 'white', borderRadius: 2, px: 1, py: 0.5, minWidth: 42,
            }}>
              <DiamondIcon sx={{ fontSize: 14 }} />
              <Typography variant="subtitle2" fontWeight={700}>{gem.gem_score}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            {gem.score > 0 && (
              <>
                <Rating value={gem.score} precision={0.1} size="small" readOnly />
                <Typography variant="caption">{Number(gem.score).toFixed(1)}</Typography>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {gem.min_installs > 0 && (
              <Chip label={`${formatNumber(gem.min_installs)} installs`} size="small" variant="outlined" />
            )}
            {gem.developer_app_count != null && (
              <Chip label={`Dev: ${gem.developer_app_count} apps`} size="small" color="info" variant="outlined" />
            )}
            {gem.offers_iap === 1 && <Chip label="IAP" size="small" color="success" variant="outlined" />}
            {gem.free === 0 && gem.price > 0 && (
              <Chip label={`$${Number(gem.price).toFixed(2)}`} size="small" color="success" variant="outlined" />
            )}
            {gem.category && <Chip label={gem.category} size="small" variant="outlined" />}
          </Box>

          {gem.gem_reason && (
            <Typography variant="caption" color="text.secondary">{gem.gem_reason}</Typography>
          )}
        </CardContent>
      </CardActionArea>

      <Box sx={{ px: 1, pb: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="Not interested" arrow>
          <IconButton
            size="small"
            color="default"
            onClick={(e) => { e.stopPropagation(); onDismiss(appId); }}
          >
            <VisibilityOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );
}

export default function GemCrawlerPage() {
  const { crawlerState, setCrawlerState } = useAppContext();
  const [status, setStatus] = useState(crawlerState.status || null);
  const [gems, setGems] = useState(crawlerState.gems || []);
  const [threshold, setThreshold] = useState(crawlerState.threshold || 40);
  const [budget, setBudget] = useState(crawlerState.budget || 200);
  const [sortBy, setSortBy] = useState(crawlerState.sortBy || 'score');
  const [sortDir, setSortDir] = useState(crawlerState.sortDir || 'desc');
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

  const persistState = useCallback((s, g, t, b, sb, sd) => {
    setCrawlerState({ status: s, gems: g, threshold: t, budget: b, sortBy: sb, sortDir: sd });
  }, [setCrawlerState]);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getCrawlStatus();
      setStatus(s);
      if (s.running) {
        const g = await getCrawledGems({ sortBy, sortDir });
        setGems(g);
        persistState(s, g, threshold, budget, sortBy, sortDir);
      }
      return s;
    } catch { return null; }
  }, [threshold, budget, sortBy, sortDir, persistState]);

  const fetchGems = useCallback(async () => {
    try {
      const g = await getCrawledGems({ sortBy, sortDir });
      setGems(g);
      return g;
    } catch { return []; }
  }, [sortBy, sortDir]);

  useEffect(() => {
    fetchStatus().then(s => {
      fetchGems().then(g => persistState(s, g, threshold, budget, sortBy, sortDir));
      if (s?.running) startPolling();
    });
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchGems().then(g => persistState(status, g, threshold, budget, sortBy, sortDir));
  }, [sortBy, sortDir, fetchGems, status, threshold, budget, persistState]);

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const s = await fetchStatus();
      if (s && !s.running) {
        stopPolling();
        const g = await fetchGems();
        persistState(s, g, threshold, budget, sortBy, sortDir);
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleStart = async () => {
    setError(null);
    try {
      const s = await startCrawl({ budget, threshold });
      setStatus(s);
      startPolling();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleReset = async () => {
    stopPolling();
    try {
      await resetCrawl();
      setGems([]);
      const s = await fetchStatus();
      persistState(s, [], threshold, budget, sortBy, sortDir);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleDismiss = async (appId) => {
    try {
      await dismissCrawledApp(appId);
      setGems(prev => prev.filter(g => g.app_id !== appId));
    } catch { /* ignore */ }
  };

  const pct = status?.totalKeywords
    ? Math.round((status.completedKeywords / status.totalKeywords) * 100)
    : 0;

  const isRunning = status?.running;
  const isPaused = !isRunning && status?.stoppedReason === 'budget_exhausted';
  const isComplete = !isRunning && status?.stoppedReason === 'complete';

  const statusLabel = isRunning
    ? `Crawling: ${status.currentKeyword || '...'}  (${status.budgetUsed}/${status.budgetTotal} requests)`
    : isPaused
      ? `Paused -- budget exhausted (${status.budgetUsed}/${status.budgetTotal} requests used). Click "Continue" to resume.`
      : isComplete
        ? 'Crawl complete! All keywords searched.'
        : status?.stoppedReason?.startsWith('error')
          ? `Stopped: ${status.stoppedReason}`
          : 'Ready to crawl';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SearchIcon sx={{ fontSize: 32, color: 'info.main' }} />
        <Typography variant="h4" fontWeight={700}>Gem Crawler</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Systematically search every niche category for replicable apps. The crawler runs in the
        background with a request budget, pausing when the budget runs out. Come back later and
        click "Continue" to keep discovering.
      </Typography>

      {/* Controls */}
      <Card variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-end', mb: 2 }}>
          <Box sx={{ minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Score Threshold
            </Typography>
            <Slider
              value={threshold}
              onChange={(_, v) => setThreshold(v)}
              min={20}
              max={80}
              step={5}
              valueLabelDisplay="auto"
              disabled={isRunning}
              size="small"
            />
            <Typography variant="caption">Min score: {threshold}</Typography>
          </Box>

          <Box sx={{ minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Request Budget
            </Typography>
            <Slider
              value={budget}
              onChange={(_, v) => setBudget(v)}
              min={50}
              max={500}
              step={50}
              valueLabelDisplay="auto"
              disabled={isRunning}
              size="small"
            />
            <Typography variant="caption">{budget} requests per session</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              disableElevation
              startIcon={isPaused ? <SearchIcon /> : <SearchIcon />}
              onClick={handleStart}
              disabled={isRunning}
            >
              {isPaused ? 'Continue Crawl' : isComplete ? 'Crawl Again' : 'Start Crawl'}
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
              disabled={isRunning}
            >
              Reset
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Sort by
            </Typography>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              disabled={isRunning}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d0d0d0' }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Box>
          <Box sx={{ minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Direction
            </Typography>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              disabled={isRunning}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d0d0d0' }}
            >
              {DIR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Box>
        </Box>

        {/* Progress */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>
              {status?.completedKeywords ?? 0} / {status?.totalKeywords ?? '...'} keywords crawled
            </Typography>
            <Typography variant="body2" fontWeight={500}>{pct}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{ height: 8, borderRadius: 4 }}
            color={isComplete ? 'success' : isRunning ? 'primary' : 'inherit'}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          {isRunning && <PauseCircleIcon color="primary" fontSize="small" />}
          {isComplete && <CheckCircleIcon color="success" fontSize="small" />}
          <Typography variant="body2" color="text.secondary">{statusLabel}</Typography>
        </Box>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Gems */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <DiamondIcon color="warning" />
        <Typography variant="h6" fontWeight={600}>
          {gems.length} gem{gems.length !== 1 ? 's' : ''} discovered
        </Typography>
      </Box>

      {gems.length > 0 ? (
        <Grid container spacing={2}>
          {gems.map(gem => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={gem.app_id}>
              <CrawlGemCard gem={gem} onDismiss={handleDismiss} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          {status?.completedKeywords > 0
            ? 'No gems found yet matching your threshold. Try lowering the minimum score.'
            : 'Start a crawl to begin discovering gems across all niche categories.'}
        </Alert>
      )}
    </Box>
  );
}
