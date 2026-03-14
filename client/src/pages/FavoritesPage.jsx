import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, CircularProgress, Alert,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { getFavorites } from '../services/api';
import AppCard from '../components/AppCard';
import { useAppContext } from '../context/AppContext';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { favoriteIds } = useAppContext();

  useEffect(() => {
    setLoading(true);
    getFavorites()
      .then(data => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, [favoriteIds]);

  const mapped = favorites
    .filter(f => favoriteIds.has(f.app_id))
    .map(f => ({
      appId: f.app_id,
      title: f.title,
      developer: f.developer,
      developerId: f.developer_id,
      icon: f.icon,
      score: f.score,
      minInstalls: f.min_installs,
      price: f.price,
      free: !!f.free,
      offersIAP: !!f.offers_iap,
      category: f.category,
      url: f.url,
    }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <StarIcon sx={{ fontSize: 32, color: 'warning.main' }} />
        <Typography variant="h4" fontWeight={700}>Favorites</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Apps you've starred across all views. Click the star on any app to add or remove it here.
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && mapped.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {mapped.length} favorite{mapped.length !== 1 ? 's' : ''}
          </Typography>
          <Grid container spacing={2}>
            {mapped.map(app => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={app.appId}>
                <AppCard app={app} />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {!loading && mapped.length === 0 && (
        <Alert severity="info">
          No favorites yet. Click the star on any app to add it here.
        </Alert>
      )}
    </Box>
  );
}
