import { IconButton, Tooltip } from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';

export default function HideButton({ hidden = false, onHide, onUnhide, size = 'small' }) {
  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (hidden) onUnhide?.();
    else onHide?.();
  };

  return (
    <Tooltip title={hidden ? 'Show again' : 'Not interested'} arrow>
      <IconButton size={size} color="default" onClick={handleClick}>
        {hidden
          ? <VisibilityIcon fontSize={size} />
          : <VisibilityOffIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  );
}
