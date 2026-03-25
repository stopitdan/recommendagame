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
        py: 8,
        background: (theme) => `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.info.light} 100%)`,
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center" textAlign="center">
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 800,
              color: "primary.main",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Find your next
            <br />
            favorite game
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: "text.secondary",
              fontWeight: 400,
              maxWidth: 420,
              lineHeight: 1.5,
            }}
          >
            Tell us what you&apos;re in the mood for and we&apos;ll recommend
            the perfect board game, video game, or word game.
          </Typography>
          <Link href="/questionnaire" style={{ textDecoration: "none" }}>
            <Button
              variant="contained"
              size="large"
              sx={{
                px: 5,
                py: 1.5,
                fontSize: "1.1rem",
                borderRadius: 2,
                boxShadow: (theme) => `0 4px 14px ${theme.palette.secondary.main}4D`,
                "&:hover": {
                  boxShadow: (theme) => `0 6px 20px ${theme.palette.secondary.main}66`,
                  transform: "translateY(-1px)",
                },
                transition: "all 200ms ease",
              }}
            >
              Find Me a Game
            </Button>
          </Link>
        </Stack>
      </Container>
    </Box>
  );
}
