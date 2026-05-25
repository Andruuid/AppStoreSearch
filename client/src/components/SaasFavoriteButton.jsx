import { IconButton, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useAppContext } from '../context/AppContext';

export default function SaasFavoriteButton({ product, size = 'small' }) {
  const { isSaasFavorite, toggleSaasFavorite } = useAppContext();
  const starred = isSaasFavorite(product.id);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleSaasFavorite(product);
  };

  return (
    <Tooltip title={starred ? 'Remove from favorites' : 'Add to favorites'} arrow>
      <IconButton size={size} onClick={handleClick} color={starred ? 'warning' : 'default'}>
        {starred ? <StarIcon fontSize={size} /> : <StarBorderIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  );
}
