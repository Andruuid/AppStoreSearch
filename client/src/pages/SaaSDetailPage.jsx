import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, CircularProgress, Alert, Card, CardContent, Chip, Avatar,
  Button, LinearProgress, Grid, Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { getSaasProduct, enrichSaasProduct } from '../services/api';
import SaasFavoriteButton from '../components/SaasFavoriteButton';

const PRICING_LABELS = {
  free: 'Free',
  freemium: 'Freemium',
  subscription: 'Subscription',
  one_time: 'One-time',
  unknown: 'Unknown',
};

function ScoreBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography variant="body2" sx={{ width: 120, flexShrink: 0 }}>{label}</Typography>
      <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 8, borderRadius: 4 }} />
      <Typography variant="body2" fontWeight={600} sx={{ width: 28, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

export default function SaaSDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSaasProduct(id)
      .then(setProduct)
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const updated = await enrichSaasProduct(id);
      setProduct(updated);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !product) {
    return (
      <Box>
        <Button component={RouterLink} to="/saas" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Back to SaaS Finder
        </Button>
        <Alert severity="error">{error || 'Product not found'}</Alert>
      </Box>
    );
  }

  const b = product.opportunityBreakdown || {};

  return (
    <Box>
      <Button component={RouterLink} to="/saas" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to SaaS Finder
      </Button>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Avatar src={product.logoUrl} variant="rounded" sx={{ width: 72, height: 72 }}>
              {product.name?.[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="h5" fontWeight={700}>{product.name}</Typography>
                <SaasFavoriteButton product={product} />
              </Box>
              {product.tagline && (
                <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
                  {product.tagline}
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                {product.category && <Chip label={product.category} size="small" />}
                {product.pricingModel && (
                  <Chip
                    label={PRICING_LABELS[product.pricingModel] || product.pricingModel}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
                {product.pricingHint && <Chip label={product.pricingHint} size="small" variant="outlined" />}
                {product.source && <Chip label={product.source.replace('_', ' ')} size="small" variant="outlined" />}
                {product.enrichmentStatus && (
                  <Chip label={`Enrichment: ${product.enrichmentStatus}`} size="small" variant="outlined" />
                )}
              </Box>
            </Box>
            {product.opportunityScore != null && (
              <Box sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                bgcolor: product.opportunityScore >= 70 ? 'warning.main' : 'primary.main',
                color: 'white', borderRadius: 2, px: 2, py: 1,
              }}>
                <TrendingUpIcon />
                <Typography variant="h6" fontWeight={700}>{product.opportunityScore}</Typography>
                <Typography variant="caption">Opportunity</Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {product.url && (
              <Button
                variant="contained"
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<OpenInNewIcon />}
              >
                Visit website
              </Button>
            )}
            <Button variant="outlined" onClick={handleEnrich} disabled={enriching}>
              {enriching ? 'Enriching…' : 'Re-enrich'}
            </Button>
          </Box>

          {product.description && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>Description</Typography>
              <Typography variant="body2" color="text.secondary">{product.description}</Typography>
            </>
          )}

          {product.tags?.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {product.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Product Hunt metrics</Typography>
              {product.phUpvotes != null ? (
                <>
                  <Typography variant="body2">Upvotes: {product.phUpvotes}</Typography>
                  <Typography variant="body2">Comments: {product.phComments ?? '—'}</Typography>
                  <Typography variant="body2">
                    Launched: {product.phLaunchedAt
                      ? new Date(product.phLaunchedAt).toLocaleDateString()
                      : '—'}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No Product Hunt data</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Opportunity breakdown</Typography>
              {product.opportunityBreakdown ? (
                <>
                  <ScoreBar label="Traction" value={b.tractionScore || 0} max={25} />
                  <ScoreBar label="Pricing clarity" value={b.pricingScore || 0} max={20} />
                  <ScoreBar label="Category niche" value={b.categoryScore || 0} max={20} />
                  <ScoreBar label="Recency" value={b.recencyScore || 0} max={15} />
                  <ScoreBar label="Engagement" value={b.engagementScore || 0} max={20} />
                  {product.opportunityReason && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {product.opportunityReason}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">Not scored yet</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
