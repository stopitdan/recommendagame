import Link from "next/link";
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
        minHeight: "calc(100vh - 64px)",
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
            Tell us what you&apos;re in the mood for — players, complexity, genres,
            vibe — and we&apos;ll find the perfect game for you.
          </Typography>
          <Link href="/questionnaire" style={{ textDecoration: 'none' }}>
            <Button variant="contained" size="large">
              Find Me a Game
            </Button>
          </Link>
        </Stack>
      </Container>
    </Box>
  );
}
