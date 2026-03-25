import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function Home() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="h3" component="h1" fontWeight={700}>
            Recommend a Game
          </Typography>
          <Typography variant="body1" color="text.secondary">
            A recommendation engine for your next session—players, budget, and
            what you already own, powered by APIs you wire in later.
          </Typography>
          <Button variant="contained" size="large" disabled>
            Get started (coming soon)
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
