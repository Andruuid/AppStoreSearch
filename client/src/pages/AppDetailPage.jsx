import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, CircularProgress, Alert, Grid, Chip, Rating,
  Avatar, Card, CardContent, Button, Divider, Link,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import AppCard from '../components/AppCard';
import { getAppDetail, getSimilarApps, getDeveloperInfo } from '../services/api';

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

export default function AppDetailPage() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [devInfo, setDevInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await getAppDetail(appId);
        setApp(detail);

        getSimilarApps(appId).then(setSimilar).catch(() => {});

        if (detail.developerId) {
          getDeveloperInfo(detail.developerId).then(setDevInfo).catch(() => {});
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!app) return null;

  const devAppCount = devInfo?.appCount ?? devInfo?.app_count;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
            <Avatar src={app.icon} variant="rounded" sx={{ width: 80, height: 80 }} />

            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Typography variant="h5" fontWeight={700}>{app.title}</Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {app.developer}
                {devAppCount != null && (
                  <Chip
                    label={`${devAppCount} apps`}
                    size="small"
                    sx={{ ml: 1 }}
                    color={devAppCount <= 5 ? 'warning' : 'default'}
                    variant="outlined"
                  />
                )}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {app.score != null && (
                  <>
                    <Rating value={app.score} precision={0.1} readOnly />
                    <Typography variant="body1" fontWeight={600}>{app.score.toFixed(1)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ({formatNumber(app.ratings)} ratings)
                    </Typography>
                  </>
                )}
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Chip icon={<DownloadIcon />} label={`${formatNumber(app.minInstalls)} installs`} size="small" />
                {app.free ? (
                  <Chip label="Free" color="success" size="small" />
                ) : (
                  <Chip label={`$${app.price?.toFixed(2)}`} color="primary" size="small" />
                )}
                {app.offersIAP && <Chip label="In-App Purchases" size="small" color="info" />}
                {app.genre && <Chip label={app.genre} size="small" variant="outlined" />}
                {app.updated && <Chip label={`Updated: ${app.updated}`} size="small" variant="outlined" />}
              </Box>
            </Box>

            <Box>
              <Link href={app.url} target="_blank" rel="noopener noreferrer" underline="none">
                <Button variant="outlined" endIcon={<OpenInNewIcon />}>
                  Play Store
                </Button>
              </Link>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {app.summary && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>About</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {app.description || app.summary}
            </Typography>
          </CardContent>
        </Card>
      )}

      {app.histogram && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>Rating Breakdown</Typography>
            {Object.entries(app.histogram).reverse().map(([stars, count]) => (
              <Box key={stars} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ width: 20 }}>{stars}</Typography>
                <Box sx={{ flex: 1, bgcolor: 'grey.200', borderRadius: 1, height: 8 }}>
                  <Box
                    sx={{
                      width: `${(count / Math.max(...Object.values(app.histogram))) * 100}%`,
                      bgcolor: 'primary.main',
                      borderRadius: 1,
                      height: '100%',
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ width: 50, textAlign: 'right' }}>
                  {formatNumber(count)}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {similar.length > 0 && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>Similar Apps</Typography>
          <Grid container spacing={2}>
            {similar.slice(0, 8).map(s => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={s.appId}>
                <AppCard app={s} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
