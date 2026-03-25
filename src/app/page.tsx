"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useTheme, alpha } from "@mui/material/styles";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
} from "motion/react";
import QuickCollections from "@/components/QuickCollections";

/* ─── reusable scroll-triggered section ─── */
function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── stagger container for children ─── */
function StaggerGroup({
  children,
  stagger = 0.1,
}: {
  children: React.ReactNode;
  stagger?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        visible: { transition: { staggerChildren: stagger } },
        hidden: {},
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── child item for stagger groups ─── */
const staggerChild = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

/* ─── floating dice decoration ─── */
function FloatingDice({
  size = 32,
  top,
  left,
  right,
  bottom,
  color,
  delay = 0,
}: {
  size?: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        color,
        display: { xs: "none", md: "block" } as unknown as string,
      }}
      initial={{ opacity: 0, scale: 0, rotate: -180 }}
      animate={{
        opacity: 0.1,
        scale: 1,
        rotate: 0,
        y: [0, -12, 0],
      }}
      transition={{
        opacity: { duration: 0.6, delay },
        scale: { duration: 0.6, delay, type: "spring", bounce: 0.4 },
        rotate: { duration: 0.8, delay },
        y: {
          duration: 4,
          delay: delay + 0.8,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        },
      }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <rect x="2" y="2" width="20" height="20" rx="3" />
        <circle cx="8" cy="8" r="1.5" fill="white" />
        <circle cx="16" cy="8" r="1.5" fill="white" />
        <circle cx="12" cy="12" r="1.5" fill="white" />
        <circle cx="8" cy="16" r="1.5" fill="white" />
        <circle cx="16" cy="16" r="1.5" fill="white" />
      </svg>
    </motion.div>
  );
}

/* ─── animated counter ─── */
function AnimatedCount({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const steps = 50;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── feature card data ─── */
const FEATURES = [
  {
    emoji: "♟",
    title: "Board Games",
    description:
      "22,000+ titles from Catan to Gloomhaven. Rated, categorized, and ready to discover.",
  },
  {
    emoji: "🎮",
    title: "Video Games",
    description:
      "80,000+ titles across every platform. From indie gems to AAA blockbusters.",
  },
  {
    emoji: "🎉",
    title: "Party & Word Games",
    description:
      "Charades, 20 Questions, Wordle, and more. No-equipment games for any group size.",
  },
  {
    emoji: "🧠",
    title: "Smart Engine",
    description:
      "4-layer recommendation engine that learns your taste. The more you use it, the better it gets.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Tell Us What You Want",
    description:
      "Answer a few quick questions about players, mood, time, and genre.",
  },
  {
    number: "02",
    title: "We Find the Matches",
    description:
      "Our engine scores thousands of games to find your best fit.",
  },
  {
    number: "03",
    title: "Play Something Great",
    description:
      "Pick a game, save your favorites, and fine-tune future recommendations.",
  },
];

export default function Home() {
  const theme = useTheme();

  // Parallax on hero
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 120]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const smoothY = useSpring(heroY, { stiffness: 80, damping: 20 });
  const smoothOpacity = useSpring(heroOpacity, { stiffness: 80, damping: 20 });

  return (
    <Box component="main" sx={{ overflow: "hidden" }}>
      {/* ═══════════ HERO ═══════════ */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          minHeight: { xs: "85vh", md: "90vh" },
          display: "flex",
          alignItems: "center",
          background: `
            radial-gradient(ellipse 80% 60% at 50% 0%, ${alpha(theme.palette.info.light, 0.5)} 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 80% 100%, ${alpha(theme.palette.info.main, 0.15)} 0%, transparent 60%),
            ${theme.palette.background.default}
          `,
        }}
      >
        {/* Floating dice */}
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <FloatingDice size={48} top="12%" left="8%" color={theme.palette.primary.main} delay={0.8} />
          <FloatingDice size={36} top="20%" right="12%" color={theme.palette.info.main} delay={1.0} />
          <FloatingDice size={28} bottom="22%" left="15%" color={theme.palette.secondary.main} delay={1.2} />
          <FloatingDice size={42} bottom="28%" right="8%" color={theme.palette.primary.light} delay={1.4} />
        </Box>

        <Container maxWidth="md">
          <motion.div style={{ y: smoothY, opacity: smoothOpacity }}>
            <Stack spacing={4} alignItems="center" textAlign="center">
              {/* Tagline */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <Typography
                  variant="h6"
                  component="p"
                  sx={{
                    color: "secondary.main",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    fontSize: { xs: "0.75rem", md: "0.85rem" },
                  }}
                >
                  Board Games · Video Games · Word Games
                </Typography>
              </motion.div>

              {/* Main headline */}
              <motion.div
                initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <Typography
                  variant="h1"
                  component="h1"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.5rem" },
                    letterSpacing: "-0.04em",
                    lineHeight: 1.05,
                    color: "primary.main",
                  }}
                >
                  Find your next
                  <br />
                  <Box component="span" sx={{ color: "secondary.main", position: "relative" }}>
                    favorite game
                    <motion.span
                      style={{
                        position: "absolute",
                        bottom: 2,
                        left: 0,
                        right: 0,
                        height: "0.12em",
                        background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.info.main})`,
                        borderRadius: 2,
                        display: "block",
                        transformOrigin: "left",
                      }}
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </Box>
                </Typography>
              </motion.div>

              {/* Subhead */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <Typography
                  variant="h6"
                  component="p"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 400,
                    maxWidth: 520,
                    lineHeight: 1.6,
                    fontSize: { xs: "1rem", md: "1.15rem" },
                  }}
                >
                  Tell us what you&apos;re in the mood for — players, complexity,
                  genre, vibe — and we&apos;ll match you with something great to play.
                </Typography>
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.75,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Link href="/questionnaire" style={{ textDecoration: "none" }}>
                    <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="contained"
                        size="large"
                        sx={{
                          px: { xs: 4, md: 6 },
                          py: 1.8,
                          fontSize: { xs: "1rem", md: "1.15rem" },
                          borderRadius: 3,
                          fontWeight: 700,
                          boxShadow: `0 8px 32px ${alpha(theme.palette.secondary.main, 0.35)}`,
                        }}
                      >
                        Find Me a Game
                      </Button>
                    </motion.div>
                  </Link>
                  <Link href="/leaderboard" style={{ textDecoration: "none" }}>
                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outlined"
                        size="large"
                        sx={{
                          px: { xs: 3, md: 4 },
                          py: 1.8,
                          fontSize: { xs: "1rem", md: "1.15rem" },
                          borderRadius: 3,
                          borderWidth: 2,
                          "&:hover": { borderWidth: 2 },
                        }}
                      >
                        Top Games
                      </Button>
                    </motion.div>
                  </Link>
                </Stack>
              </motion.div>
            </Stack>
          </motion.div>
        </Container>

        {/* Bottom gradient fade */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            background: `linear-gradient(transparent, ${theme.palette.background.default})`,
            pointerEvents: "none",
          }}
        />
      </Box>

      {/* ═══════════ FEATURES ═══════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: "background.default" }}>
        <Container maxWidth="lg">
          <Section>
            <Typography
              variant="h3"
              component="h2"
              sx={{
                textAlign: "center",
                fontWeight: 800,
                mb: { xs: 4, md: 6 },
                letterSpacing: "-0.02em",
              }}
            >
              Every kind of game,{" "}
              <Box component="span" sx={{ color: "secondary.main" }}>
                one place
              </Box>
            </Typography>
          </Section>

          <StaggerGroup stagger={0.12}>
            <Grid container spacing={3}>
              {FEATURES.map((feat) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feat.title}>
                  <motion.div variants={staggerChild}>
                    <motion.div
                      whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                    >
                      <Card
                        variant="outlined"
                        sx={{
                          height: "100%",
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: "background.paper",
                          transition: "border-color 200ms, box-shadow 300ms",
                          "&:hover": {
                            borderColor: "info.main",
                            boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.08)}`,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 3.5 }}>
                          <motion.div
                            initial={{ scale: 1 }}
                            whileHover={{ scale: 1.15, rotate: [0, -5, 5, 0] }}
                            transition={{ type: "spring", stiffness: 400 }}
                            style={{ display: "inline-block" }}
                          >
                            <Typography sx={{ fontSize: "2.2rem", mb: 1.5, lineHeight: 1 }}>
                              {feat.emoji}
                            </Typography>
                          </motion.div>
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 700, mb: 1, color: "primary.main" }}
                          >
                            {feat.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary", lineHeight: 1.6 }}
                          >
                            {feat.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </StaggerGroup>
        </Container>
      </Box>

      {/* ═══════════ QUICK PICKS ═══════════ */}
      <Box sx={{ py: { xs: 4, md: 6 }, bgcolor: "background.default" }}>
        <Section>
          <QuickCollections />
        </Section>
      </Box>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background: `linear-gradient(180deg, ${theme.palette.background.default}, ${alpha(theme.palette.info.light, 0.3)}, ${theme.palette.background.default})`,
        }}
      >
        <Container maxWidth="md">
          <Section>
            <Typography
              variant="h3"
              component="h2"
              sx={{
                textAlign: "center",
                fontWeight: 800,
                mb: { xs: 6, md: 8 },
                letterSpacing: "-0.02em",
              }}
            >
              How it works
            </Typography>
          </Section>

          <StaggerGroup stagger={0.2}>
            <Stack spacing={{ xs: 4, md: 6 }}>
              {STEPS.map((step, i) => (
                <motion.div key={step.number} variants={staggerChild}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", md: "center" },
                      gap: { xs: 2.5, md: 4 },
                    }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: { xs: 56, md: 72 },
                          height: { xs: 56, md: 72 },
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: i === 1 ? "secondary.main" : "primary.main",
                          color: "primary.contrastText",
                          boxShadow: `0 4px 20px ${alpha(
                            i === 1
                              ? theme.palette.secondary.main
                              : theme.palette.primary.main,
                            0.3
                          )}`,
                        }}
                      >
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: { xs: "1.1rem", md: "1.4rem" },
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {step.number}
                        </Typography>
                      </Box>
                    </motion.div>
                    <Box>
                      <Typography
                        variant="h5"
                        sx={{ fontWeight: 700, mb: 0.5, color: "primary.main" }}
                      >
                        {step.title}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ color: "text.secondary", lineHeight: 1.6 }}
                      >
                        {step.description}
                      </Typography>
                    </Box>
                  </Box>
                </motion.div>
              ))}
            </Stack>
          </StaggerGroup>
        </Container>
      </Box>

      {/* ═══════════ STATS ═══════════ */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: "background.default" }}>
        <Container maxWidth="md">
          <StaggerGroup stagger={0.15}>
            <Grid container spacing={4} justifyContent="center">
              {[
                { value: 100000, suffix: "+", label: "Games in our database" },
                { value: 4, suffix: "", label: "Game categories" },
                { value: 200, suffix: "+", label: "Genres & mechanics" },
              ].map((stat) => (
                <Grid size={{ xs: 12, sm: 4 }} key={stat.label}>
                  <motion.div variants={staggerChild}>
                    <Stack alignItems="center" textAlign="center" spacing={0.5}>
                      <Typography
                        variant="h3"
                        sx={{
                          fontWeight: 800,
                          color: "secondary.main",
                          letterSpacing: "-0.03em",
                        }}
                      >
                        <AnimatedCount target={stat.value} suffix={stat.suffix} />
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ color: "text.secondary", fontWeight: 500 }}
                      >
                        {stat.label}
                      </Typography>
                    </Stack>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </StaggerGroup>
        </Container>
      </Box>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          textAlign: "center",
          background: `
            radial-gradient(ellipse 70% 60% at 50% 100%, ${alpha(theme.palette.info.light, 0.4)} 0%, transparent 70%),
            ${theme.palette.background.default}
          `,
        }}
      >
        <Container maxWidth="sm">
          <Section>
            <Typography
              variant="h3"
              component="h2"
              sx={{
                fontWeight: 800,
                mb: 2,
                letterSpacing: "-0.02em",
                color: "primary.main",
              }}
            >
              Ready to play?
            </Typography>
          </Section>
          <Section delay={0.15}>
            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                mb: 4,
                lineHeight: 1.6,
                fontSize: "1.1rem",
              }}
            >
              It takes 30 seconds to find your next favorite game. No signup
              required.
            </Typography>
          </Section>
          <Section delay={0.3}>
            <Link href="/questionnaire" style={{ textDecoration: "none" }}>
              <motion.div
                whileHover={{ y: -4, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{ display: "inline-block" }}
              >
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    px: 6,
                    py: 2,
                    fontSize: "1.2rem",
                    borderRadius: 3,
                    fontWeight: 700,
                    boxShadow: `0 8px 32px ${alpha(theme.palette.secondary.main, 0.35)}`,
                  }}
                >
                  Find Me a Game
                </Button>
              </motion.div>
            </Link>
          </Section>
        </Container>
      </Box>
    </Box>
  );
}
