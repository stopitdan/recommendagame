import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import ThemeRegistry from "@/components/ThemeRegistry";
import Header from "@/components/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Recommend a Game",
  description:
    "Find your next game to play based on players, budget, and what you already own.",
  metadataBase: new URL("https://recommendagame.com"),
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
            <Header />
            <ErrorBoundary>
              <main style={{ flex: 1 }}>
                {children}
              </main>
            </ErrorBoundary>
            <Footer />
          </ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
