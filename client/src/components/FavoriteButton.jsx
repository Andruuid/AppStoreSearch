import { IconButton, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useAppContext } from '../context/AppContext';

export default function FavoriteButton({ app, size = 'small' }) {
  const { isFavorite, toggleFavorite } = useAppContext();
  const appId = app.appId || app.app_id;
  const starred = isFavorite(appId);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite(app);
  };

  return (
    <Tooltip title={starred ? 'Remove from favorites' : 'Add to favorites'} arrow>
      <IconButton size={size} onClick={handleClick} color={starred ? 'warning' : 'default'}>
        {starred ? <StarIcon fontSize={size} /> : <StarBorderIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  );
}
