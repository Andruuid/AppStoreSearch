import {
  Card, CardActionArea, CardContent, Typography, Box, Chip, Rating, Avatar,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useNavigate } from 'react-router-dom';

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

export default function AppListItem({ app }) {
  const navigate = useNavigate();

  return (
    <Card variant="outlined">
      <CardActionArea onClick={() => navigate(`/app/${encodeURIComponent(app.appId)}`)}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
          <Avatar src={app.icon} variant="rounded" sx={{ width: 44, height: 44 }} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>{app.title}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{app.developer}</Typography>
          </Box>

          {app.score != null && app.score > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Rating value={app.score} precision={0.1} size="small" readOnly />
              <Typography variant="caption">{app.score.toFixed(1)}</Typography>
            </Box>
          )}

          {app.minInstalls > 0 && (
            <Chip icon={<DownloadIcon />} label={formatNumber(app.minInstalls)} size="small" variant="outlined" />
          )}

          {app.opportunityReason && (
            <Chip label={app.opportunityReason} size="small" color="warning" sx={{ maxWidth: 280 }} />
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
