import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, CircularProgress, Alert, TextField, MenuItem, Button,
  Card, CardActionArea, CardContent, Avatar, Chip, Rating, LinearProgress,
  Tooltip,
} from '@mui/material';
import DiamondIcon from '@mui/icons-material/Diamond';
import { useNavigate } from 'react-router-dom';
import { getGems, getCategories } from '../services/api';
import { useAppContext } from '../context/AppContext';

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

function ScoreBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  return (
    <Tooltip title={`${value}/${max}`} arrow>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="caption" sx={{ width: 90, flexShrink: 0 }}>{label}</Typography>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ flex: 1, height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption" fontWeight={600} sx={{ width: 24, textAlign: 'right' }}>
          {value}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function GemCard({ app }) {
  const navigate = useNavigate();
  const b = app.gemBreakdown || {};

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: app.gemScore >= 70 ? 'warning.main' : undefined,
        borderWidth: app.gemScore >= 70 ? 2 : 1,
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/app/${encodeURIComponent(app.appId)}`)}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <Avatar src={app.icon} variant="rounded" sx={{ width: 52, height: 52 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>{app.title}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{app.developer}</Typography>
            </Box>
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              bgcolor: app.gemScore >= 70 ? 'warning.main' : 'primary.main',
              color: 'white', borderRadius: 2, px: 1.2, py: 0.5, minWidth: 44,
            }}>
              <DiamondIcon sx={{ fontSize: 16 }} />
              <Typography variant="subtitle2" fontWeight={700}>{app.gemScore}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            {app.score > 0 && (
              <>
                <Rating value={app.score} precision={0.1} size="small" readOnly />
                <Typography variant="caption">{app.score.toFixed(1)}</Typography>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {app.minInstalls > 0 && (
              <Chip label={`${formatNumber(app.minInstalls)} installs`} size="small" variant="outlined" />
            )}
            {app.developerAppCount != null && (
              <Chip label={`Dev: ${app.developerAppCount} app${app.developerAppCount > 1 ? 's' : ''}`} size="small" color="info" variant="outlined" />
            )}
            {app.offersIAP && <Chip label="IAP" size="small" color="success" variant="outlined" />}
            {!app.free && <Chip label={`$${app.price?.toFixed(2)}`} size="small" color="success" variant="outlined" />}
          </Box>

          <Box sx={{ mb: 1 }}>
            <ScoreBar label="Developer" value={b.devScore || 0} max={25} />
            <ScoreBar label="Installs" value={b.installScore || 0} max={25} />
            <ScoreBar label="Revenue" value={b.monetizationScore || 0} max={20} />
            <ScoreBar label="Niche" value={b.categoryScore || 0} max={15} />
            <ScoreBar label="Rating" value={b.ratingScore || 0} max={15} />
          </Box>

          {app.gemReason && (
            <Typography variant="caption" color="text.secondary">{app.gemReason}</Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function GemFinderPage() {
  const { gemState, setGemState } = useAppContext();
  const { results, searched, category } = gemState;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleFind = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGems({ category: category || undefined });
      setGemState(prev => ({
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

  const handleCategoryChange = (e) => {
    setGemState(prev => ({ ...prev, category: e.target.value }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <DiamondIcon sx={{ fontSize: 32, color: 'warning.main' }} />
        <Typography variant="h4" fontWeight={700}>Gem Finder</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Discover apps you can realistically rebuild. Finds niche, profitable apps made by solo
        developers -- no mega-brands, no billion-user platforms. Each app is scored on how
        replicable and profitable it is.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <TextField
          select
          value={category}
          onChange={handleCategoryChange}
          size="small"
          sx={{ minWidth: 220 }}
          label="Category"
        >
          <MenuItem value="">All Niche Categories</MenuItem>
          {categories.map(c => (
            <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
          ))}
        </TextField>

        <Button
          variant="contained"
          disableElevation
          onClick={handleFind}
          disabled={loading}
          startIcon={<DiamondIcon />}
        >
          {loading ? 'Searching...' : 'Find Gems'}
        </Button>
      </Box>

      {loading && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Searching niche keywords, checking developers, scoring apps...
            This can take 30-60 seconds.
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && results.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {results.length} gems found, sorted by replicability score
          </Typography>
          <Grid container spacing={2}>
            {results.map(app => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={app.appId}>
                <GemCard app={app} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {!loading && !error && results.length === 0 && !searched && (
        <Alert severity="info">
          Pick a category (or leave "All") and click "Find Gems" to discover replicable apps.
        </Alert>
      )}

      {!loading && !error && results.length === 0 && searched && (
        <Alert severity="warning">
          No gems found for this category. Try a different one.
        </Alert>
      )}
    </Box>
  );
}
