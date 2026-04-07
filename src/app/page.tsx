"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
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
import AnimatedHeadline from "@/components/landing/AnimatedHeadline";
import JsonLd from "@/components/JsonLd";
import NewsletterSignup from "@/components/NewsletterSignup";
import DailyPick from "@/components/DailyPick";
import TrendingGames from "@/components/TrendingGames";
import { Puzzle, Gamepad2, PartyPopper, Brain } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Lazy load heavy interactive components (canvas, game)
const InteractiveParticles = dynamic(() => import("@/components/landing/InteractiveParticles"), { ssr: false });
// const MeepleRunner = dynamic(() => import("@/components/landing/MeepleRunner"), { ssr: false });

// Client-only: uses react-speech-recognition which has different module-level
// state on server vs client, causing hydration mismatches if SSR'd
const HeroSearch = dynamic(() => import("@/components/landing/HeroSearch"), { ssr: false });


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
const FEATURES: { Icon: LucideIcon; title: string; description: string; href: string; stat: string; statLabel: string; iconColor: string }[] = [
  {
    Icon: Puzzle,
    title: "Board Games",
    description:
      "From Catan to Gloomhaven. Rated, categorized, and ready to discover.",
    href: "/browse?type=board",
    stat: "65,000+",
    statLabel: "titles indexed",
    iconColor: "primary.main",
  },
  {
    Icon: Gamepad2,
    title: "Video Games",
    description:
      "Every platform covered. From indie gems to AAA blockbusters.",
    href: "/browse?type=video",
    stat: "14,000+",
    statLabel: "titles indexed",
    iconColor: "secondary.main",
  },
  {
    Icon: PartyPopper,
    title: "Party & Word Games",
    description:
      "Charades, 20 Questions, Wordle, and more. No equipment needed.",
    href: "/browse?type=party",
    stat: "50+",
    statLabel: "no-equipment games",
    iconColor: "info.main",
  },
  {
    Icon: Brain,
    title: "Smart Engine",
    description:
      "7 search strategies, 10 scoring dimensions, AI re-ranking, and learning from your feedback. It gets smarter every time you use it.",
    href: "/find-a-game",
    stat: "6 layers",
    statLabel: "of recommendation AI",
    iconColor: "success.main",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Tell Us What You Want",
    description:
      "Answer a few quick questions or just describe what you're looking for in plain English. Our AI understands natural language, not just checkboxes.",
  },
  {
    number: "02",
    title: "We Search Everything",
    description:
      "7 search strategies run in parallel across 80,000+ games. Then 10 scoring dimensions, AI re-ranking, and diversity balancing find the best matches.",
  },
  {
    number: "03",
    title: "Play Something Great",
    description:
      "Every result comes with reasons why it was picked. Save favorites, give feedback, and the engine learns your taste over time.",
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
    <Box component="main" sx={{ overflow: "hidden", pb: { xs: '30px', md: '34px' } }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'boredgame.lol',
        url: 'https://boredgame.lol',
        description: 'Smart game recommendation engine for board games, video games, word games, and party games. 100,000+ games.',
        publisher: {
          '@type': 'Organization',
          name: 'boredgame.lol',
          url: 'https://boredgame.lol',
          logo: 'https://boredgame.lol/favicon.png',
          email: 'contact@boredgame.lol',
          sameAs: [],
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://boredgame.lol/browse?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      }} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'boredgame.lol',
        url: 'https://boredgame.lol',
        applicationCategory: 'Entertainment',
        operatingSystem: 'Web',
        description: 'AI-powered game recommendation engine. Tell us what you\'re in the mood for and we\'ll match you with something great from 80,000+ board games, video games, word games, and party games.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.5',
          ratingCount: '100',
          bestRating: '5',
        },
      }} />
      {/* ═══════════ HERO ═══════════ */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          minHeight: { xs: "90vh", md: "100vh" },
          display: "flex",
          alignItems: "center",
          pt: { xs: 0, md: 0 }, // nav is ~64px, but we use negative margin below to compensate
          mt: { xs: '-32px', md: '-40px' }, // shift content up to account for nav
          // Animated gradient mesh background
          background: `
            radial-gradient(ellipse 80% 50% at 20% 20%, ${alpha(theme.palette.primary.light, 0.15)} 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 80%, ${alpha(theme.palette.secondary.main, 0.12)} 0%, transparent 50%),
            radial-gradient(ellipse 70% 60% at 50% 0%, ${alpha(theme.palette.info.main, 0.2)} 0%, transparent 70%),
            radial-gradient(ellipse 50% 50% at 90% 10%, ${alpha(theme.palette.info.light, 0.1)} 0%, transparent 50%),
            ${theme.palette.background.default}
          `,
          // Animated swirling gradient blobs
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '-20%',
            background: `
              radial-gradient(ellipse 40% 40% at 30% 30%, ${alpha(theme.palette.primary.light, 0.08)} 0%, transparent 70%),
              radial-gradient(ellipse 35% 35% at 70% 60%, ${alpha(theme.palette.secondary.main, 0.06)} 0%, transparent 70%),
              radial-gradient(ellipse 45% 30% at 50% 80%, ${alpha(theme.palette.info.main, 0.07)} 0%, transparent 70%)
            `,
            animation: 'gradientSwirl 20s ease-in-out infinite',
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: '-15%',
            background: `
              radial-gradient(ellipse 50% 40% at 60% 20%, ${alpha(theme.palette.info.main, 0.05)} 0%, transparent 60%),
              radial-gradient(ellipse 30% 50% at 20% 70%, ${alpha(theme.palette.primary.main, 0.06)} 0%, transparent 60%)
            `,
            animation: 'gradientSwirl2 25s ease-in-out infinite',
            pointerEvents: 'none',
          },
          '@keyframes gradientSwirl': {
            '0%': { transform: 'translate(0%, 0%) rotate(0deg) scale(1)' },
            '33%': { transform: 'translate(5%, -3%) rotate(3deg) scale(1.05)' },
            '66%': { transform: 'translate(-3%, 5%) rotate(-2deg) scale(0.95)' },
            '100%': { transform: 'translate(0%, 0%) rotate(0deg) scale(1)' },
          },
          '@keyframes gradientSwirl2': {
            '0%': { transform: 'translate(0%, 0%) rotate(0deg)' },
            '50%': { transform: 'translate(-4%, 4%) rotate(-4deg)' },
            '100%': { transform: 'translate(0%, 0%) rotate(0deg)' },
          },
        }}
      >
        {/* Interactive particle field (desktop only) */}
        <Box sx={{ display: { xs: "none", md: "block" }, position: "absolute", inset: 0, zIndex: 0 }}>
          <InteractiveParticles count={100} />
        </Box>

        <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
          <motion.div style={{ y: smoothY, opacity: smoothOpacity }}>
            <Stack spacing={3} alignItems="center" textAlign="center">
              {/* Animated headline (word-by-word spring) */}
              <AnimatedHeadline />

              {/* Search input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: "100%", maxWidth: 560, pointerEvents: "auto" }}
              >
                <HeroSearch />
              </motion.div>

              {/* Browse All link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.4 }}
                style={{ pointerEvents: "auto" }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    or
                  </Typography>
                  <Link href="/browse" style={{ textDecoration: "none" }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "primary.main",
                        fontWeight: 600,
                        cursor: "pointer",
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      browse all 80,000+ games
                    </Typography>
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
            height: 160,
            background: `linear-gradient(transparent, ${theme.palette.background.default})`,
            pointerEvents: "none",
            zIndex: 2,
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
              {FEATURES.map((feat) => {
                // Resolve the icon color token to an actual value for the gradient
                const iconColorValue =
                  feat.iconColor === "primary.main" ? theme.palette.primary.main
                  : feat.iconColor === "secondary.main" ? theme.palette.secondary.main
                  : feat.iconColor === "info.main" ? theme.palette.info.main
                  : theme.palette.success.main;

                return (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feat.title}>
                    <motion.div variants={staggerChild}>
                      <Link href={feat.href} style={{ textDecoration: "none" }}>
                        <motion.div
                          whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                        >
                          <Card
                            variant="outlined"
                            sx={{
                              height: "100%",
                              border: "1px solid",
                              borderColor: "divider",
                              background: `linear-gradient(135deg, ${alpha(iconColorValue, 0.04)} 0%, ${alpha(iconColorValue, 0)} 60%), ${theme.palette.background.paper}`,
                              cursor: "pointer",
                              transition: "border-color 200ms, box-shadow 300ms",
                              "&:hover": {
                                borderColor: "info.main",
                                boxShadow: `0 12px 40px ${alpha(iconColorValue, 0.12)}`,
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
                                <Box
                                  sx={{
                                    mb: 1.5,
                                    color: feat.iconColor,
                                    width: 56,
                                    height: 56,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: alpha(iconColorValue, 0.12),
                                  }}
                                >
                                  <feat.Icon size={28} strokeWidth={1.5} />
                                </Box>
                              </motion.div>
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: 700, mb: 0.5, color: "primary.main" }}
                              >
                                {feat.title}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary", lineHeight: 1.6, mb: 1.5 }}
                              >
                                {feat.description}
                              </Typography>
                              <Box
                                sx={{
                                  pt: 1.5,
                                  borderTop: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                <Typography
                                  variant="h6"
                                  sx={{ fontWeight: 800, color: feat.iconColor, lineHeight: 1 }}
                                >
                                  {feat.stat}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: "text.secondary" }}
                                >
                                  {feat.statLabel}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </Link>
                    </motion.div>
                  </Grid>
                );
              })}
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

      {/* ═══════════ TRENDING ═══════════ */}
      <Box sx={{ py: { xs: 4, md: 6 }, bgcolor: "background.default" }}>
        <Section>
          <TrendingGames />
        </Section>
      </Box>

      {/* ═══════════ DAILY PICK ═══════════ */}
      <Box sx={{ py: { xs: 4, md: 6 }, bgcolor: "background.default" }}>
        <Section>
          <DailyPick />
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
            <Box sx={{ position: "relative" }}>
              {/* Vertical connecting line between step circles */}
              <Box
                sx={{
                  display: { xs: "none", md: "block" },
                  position: "absolute",
                  left: 36, // center of the 72px circle
                  top: 72, // below first circle
                  bottom: 72, // above last circle
                  width: 2,
                  background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.3)}, ${alpha(theme.palette.secondary.main, 0.3)}, ${alpha(theme.palette.primary.main, 0.3)})`,
                  zIndex: 0,
                }}
              />
              <Box
                sx={{
                  display: { xs: "block", md: "none" },
                  position: "absolute",
                  left: 28, // center of the 56px circle
                  top: 56,
                  bottom: 56,
                  width: 2,
                  background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)}, ${alpha(theme.palette.primary.main, 0.2)})`,
                  zIndex: 0,
                }}
              />
              <Stack spacing={{ xs: 4, md: 6 }}>
                {STEPS.map((step, i) => (
                  <motion.div key={step.number} variants={staggerChild}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", md: "center" },
                        gap: { xs: 2.5, md: 4 },
                        position: "relative",
                        zIndex: 1,
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
            </Box>
          </StaggerGroup>
        </Container>
      </Box>

      {/* ═══════════ STATS ═══════════ */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: "background.default" }}>
        <Container maxWidth="lg">
          <StaggerGroup stagger={0.1}>
            <Grid container spacing={4} justifyContent="center">
              {[
                { value: 80000, suffix: "+", label: "Games indexed", sublabel: "From BGG, IGDB, and RAWG" },
                { value: 4, suffix: "", label: "Game categories", sublabel: "Board, video, word, and party" },
                { value: 200, suffix: "+", label: "Genres and mechanics", sublabel: "From deck-building to open world" },
                { value: 2000000, suffix: "+", label: "Community ratings", sublabel: "Aggregated from every source" },
                { value: 6, suffix: "", label: "AI recommendation layers", sublabel: "NLU, search, scoring, similarity, AI re-ranking, learning" },
              ].map((stat) => (
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={stat.label}>
                  <motion.div variants={staggerChild}>
                    <Stack alignItems="center" textAlign="center" spacing={0.5}>
                      <Typography
                        variant="h3"
                        sx={{
                          fontWeight: 800,
                          color: "secondary.main",
                          letterSpacing: "-0.03em",
                          fontSize: { xs: "1.8rem", md: "2.4rem" },
                        }}
                      >
                        <AnimatedCount target={stat.value} suffix={stat.suffix} />
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ color: "text.primary", fontWeight: 600, lineHeight: 1.2 }}
                      >
                        {stat.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", lineHeight: 1.3 }}
                      >
                        {stat.sublabel}
                      </Typography>
                    </Stack>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </StaggerGroup>
        </Container>
      </Box>

      {/* ═══════════ NEWSLETTER ═══════════ */}
      <Box sx={{ py: { xs: 2, md: 4 }, bgcolor: "background.default" }}>
        <Section>
          <NewsletterSignup />
        </Section>
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
            <Link href="/find-a-game" style={{ textDecoration: "none" }}>
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

      {/* ═══════════ MEEPLE RUNNER GAME (fixed bottom bar) ═══════════ */}
      {/* <MeepleRunner /> */}
    </Box>
  );
}
