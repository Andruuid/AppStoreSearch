import {
  Card, CardContent, CardActionArea, Typography, Box, Chip, Avatar, IconButton, Tooltip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Link as RouterLink } from 'react-router-dom';
import SaasFavoriteButton from './SaasFavoriteButton';

const PRICING_LABELS = {
  free: 'Free',
  freemium: 'Freemium',
  subscription: 'Subscription',
  one_time: 'One-time',
  unknown: 'Unknown',
};

export default function SaaSCard({ product, showDismiss, onDismiss, showScore = false }) {
  const detailPath = `/saas/${encodeURIComponent(product.id)}`;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: showScore && product.opportunityScore >= 70 ? 'warning.main' : undefined,
        borderWidth: showScore && product.opportunityScore >= 70 ? 2 : 1,
      }}
    >
      <CardActionArea
        component={RouterLink}
        to={detailPath}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', textDecoration: 'none', color: 'inherit' }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <Avatar src={product.logoUrl} variant="rounded" sx={{ width: 52, height: 52 }}>
              {product.name?.[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>{product.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {product.tagline || product.category}
              </Typography>
            </Box>
            {showScore && product.opportunityScore != null && (
              <Box sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                bgcolor: product.opportunityScore >= 70 ? 'warning.main' : 'primary.main',
                color: 'white', borderRadius: 2, px: 1, py: 0.5, minWidth: 42,
              }}>
                <TrendingUpIcon sx={{ fontSize: 14 }} />
                <Typography variant="subtitle2" fontWeight={700}>{product.opportunityScore}</Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {product.category && (
              <Chip label={product.category} size="small" variant="outlined" />
            )}
            {product.pricingModel && product.pricingModel !== 'unknown' && (
              <Chip
                icon={<AttachMoneyIcon />}
                label={PRICING_LABELS[product.pricingModel] || product.pricingModel}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {product.pricingHint && (
              <Chip label={product.pricingHint} size="small" variant="outlined" />
            )}
            {product.phUpvotes != null && (
              <Chip label={`${product.phUpvotes} PH votes`} size="small" color="info" variant="outlined" />
            )}
            {product.source && (
              <Chip label={product.source.replace('_', ' ')} size="small" variant="outlined" />
            )}
          </Box>

          {product.opportunityReason && showScore && (
            <Typography variant="caption" color="text.secondary">{product.opportunityReason}</Typography>
          )}
        </CardContent>
      </CardActionArea>

      <Box sx={{ px: 1, pb: 1, display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
        {product.url && (
          <Tooltip title="Open website" arrow>
            <IconButton
              size="small"
              component="a"
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <SaasFavoriteButton product={product} />
        {showDismiss && onDismiss && (
          <Tooltip title="Not interested" arrow>
            <IconButton size="small" onClick={() => onDismiss(product.id)}>
              <VisibilityOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Card>
  );
}
