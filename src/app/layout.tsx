import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import ThemeRegistry from "@/components/ThemeRegistry";
import Header from "@/components/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageTransition from "@/components/PageTransition";
import { AchievementProvider } from "@/components/AchievementToast";
import ScrollProgress from "@/components/ScrollProgress";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import SkipNav from "@/components/SkipNav";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: {
    default: "boredgame.lol — Find Your Next Favorite Game",
    template: "%s | boredgame.lol",
  },
  description:
    "Smart game recommendation engine for board games, video games, word games, and party games. 100,000+ games scored by a 4-layer AI recommendation engine.",
  metadataBase: new URL("https://boredgame.lol"),
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
    title: "boredgame.lol — Find Your Next Favorite Game",
    description: "Tell us what you're in the mood for and we'll match you with something great to play. 100,000+ games.",
    siteName: "boredgame.lol",
  },
  twitter: {
    card: "summary_large_image",
    title: "boredgame.lol",
    description: "Smart game recommendation engine. Board games, video games, word games, and party games.",
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icon-192.png',
  },
  manifest: '/manifest.json',
  alternates: {
    canonical: './',
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('rag_color_mode');if(!m){m=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',m);var p=localStorage.getItem('rag_color_preset');if(p)document.documentElement.setAttribute('data-preset',p)}catch(e){}})()`,
          }}
        />
        <meta name="google-adsense-account" content="ca-pub-5790683982576164" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5790683982576164"
          crossOrigin="anonymous"
        />
      </head>
      <GoogleAnalytics />
      <body className={roboto.className}>
        <AppRouterCacheProvider>
          <ThemeRegistry>
            <SmoothScroll>
              <SkipNav />
              <ScrollProgress />
              <Header />
              <AchievementProvider>
              <ErrorBoundary>
                <main id="main-content" style={{ flex: 1 }}>
                  <PageTransition>
                    {children}
                  </PageTransition>
                </main>
              </ErrorBoundary>
              <Footer />
              <CookieConsent />
              <ServiceWorkerRegistration />
              </AchievementProvider>
            </SmoothScroll>
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
