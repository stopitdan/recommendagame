import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import ThemeRegistry from "@/components/ThemeRegistry";
import Header from "@/components/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AchievementProvider } from "@/components/AchievementToast";
import ScrollProgress from "@/components/ScrollProgress";
import Footer from "@/components/Footer";
import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: {
    default: "Recommend a Game — Find Your Next Favorite Game",
    template: "%s | Recommend a Game",
  },
  description:
    "Smart game recommendation engine for board games, video games, word games, and party games. 100,000+ games scored by a 4-layer AI recommendation engine.",
  metadataBase: new URL("https://recommendagame.com"),
  keywords: [
    "game recommendations",
    "board game finder",
    "video game recommendations",
    "what game should I play",
    "party game ideas",
    "game night",
    "board game geek",
    "game suggestion engine",
  ],
  openGraph: {
    type: "website",
    title: "Recommend a Game — Find Your Next Favorite Game",
    description: "Tell us what you're in the mood for and we'll match you with something great to play. 100,000+ games.",
    siteName: "Recommend a Game",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recommend a Game",
    description: "Smart game recommendation engine. Board games, video games, word games, and party games.",
  },
  icons: {
    icon: '/favicon.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className={roboto.className}>
        <AppRouterCacheProvider>
          <ThemeRegistry>
            <ScrollProgress />
            <Header />
            <AchievementProvider>
            <ErrorBoundary>
              <main style={{ flex: 1 }}>
                {children}
              </main>
            </ErrorBoundary>
            <Footer />
            </AchievementProvider>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
