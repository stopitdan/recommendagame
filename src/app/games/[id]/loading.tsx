import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function GameLoading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
      <CircularProgress sx={{ color: 'secondary.main' }} />
    </Box>
  );
}
