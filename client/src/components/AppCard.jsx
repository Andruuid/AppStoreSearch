import {
  Card, CardContent, CardActionArea, Typography, Box, Chip, Rating, Avatar,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { useNavigate } from 'react-router-dom';

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

export default function AppCard({ app }) {
  const navigate = useNavigate();

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea
        onClick={() => navigate(`/app/${encodeURIComponent(app.appId)}`)}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <Avatar
              src={app.icon}
              variant="rounded"
              sx={{ width: 56, height: 56 }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {app.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {app.developer}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {app.score != null && app.score > 0 && (
              <>
                <Rating value={app.score} precision={0.1} size="small" readOnly />
                <Typography variant="body2" color="text.secondary">
                  {app.score.toFixed(1)}
                </Typography>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {app.minInstalls > 0 && (
              <Chip
                icon={<DownloadIcon />}
                label={formatNumber(app.minInstalls)}
                size="small"
                variant="outlined"
              />
            )}
            {!app.free && (
              <Chip
                icon={<AttachMoneyIcon />}
                label={`$${app.price?.toFixed(2)}`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {app.offersIAP && (
              <Chip label="IAP" size="small" color="info" variant="outlined" />
            )}
            {app.category && (
              <Chip label={app.category} size="small" variant="outlined" />
            )}
          </Box>

          {app.opportunityReason && (
            <Chip
              label={app.opportunityReason}
              size="small"
              color="warning"
              sx={{ mt: 1, maxWidth: '100%' }}
            />
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
