import { Box, Typography, Card, CardActionArea, CardContent, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PersonIcon from '@mui/icons-material/Person';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import WhatshotIcon from '@mui/icons-material/Whatshot';

const STRATEGIES = [
  {
    title: 'High Downloads, Low Ratings',
    description: 'Apps with proven demand but poor execution. Great opportunities to build better alternatives.',
    icon: <TrendingDownIcon sx={{ fontSize: 40 }} />,
    color: '#e53935',
    tab: 0,
  },
  {
    title: 'Solo Dev Apps',
    description: 'Apps by indie developers with significant downloads. Validated niches with less competition.',
    icon: <PersonIcon sx={{ fontSize: 40 }} />,
    color: '#1e88e5',
    tab: 1,
  },
  {
    title: 'Niche Profitable',
    description: 'Paid apps and IAP earners in niche categories. Users willing to pay = proven revenue.',
    icon: <MonetizationOnIcon sx={{ fontSize: 40 }} />,
    color: '#43a047',
    tab: 2,
  },
  {
    title: 'Trending Niche',
    description: 'Recently updated and growing apps in smaller categories. Catch trends early.',
    icon: <WhatshotIcon sx={{ fontSize: 40 }} />,
    color: '#fb8c00',
    tab: 3,
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        App Opportunity Finder
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
        Discover niche app opportunities on the Google Play Store. Find underserved markets,
        poorly-rated popular apps, and profitable indie niches.
      </Typography>

      <Grid container spacing={2.5}>
        {STRATEGIES.map((s, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 6, lg: 3 }} key={i}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                '&:hover': { borderColor: s.color, boxShadow: `0 0 0 1px ${s.color}` },
              }}
            >
              <CardActionArea
                onClick={() => navigate(`/opportunities?tab=${s.tab}`)}
                sx={{ height: '100%' }}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{ color: s.color, mb: 1.5 }}>{s.icon}</Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {s.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {s.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 5 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Quick Search
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Or jump straight to searching for specific apps and keywords.
        </Typography>
        <Card
          variant="outlined"
          sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
          onClick={() => navigate('/search')}
        >
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h6" color="primary">
              Go to Search
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
