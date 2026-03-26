"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, type PaletteMode } from "@mui/material/styles";
import { createAppTheme } from "@/theme";

// ─── Context ─────────────────────────────────────────────────

interface ColorModeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: "light",
  toggleMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

// ─── Storage ─────────────────────────────────────────────────

const STORAGE_KEY = "rag_color_mode";

function getStoredMode(): PaletteMode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return null;
}

function getSystemMode(): PaletteMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// ─── Provider ────────────────────────────────────────────────

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<PaletteMode>("light");

  // Initialize from stored preference or system setting
  useEffect(() => {
    const stored = getStoredMode();
    setMode(stored ?? getSystemMode());

    // Listen for system theme changes (only if no stored preference)
    if (!stored) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        if (!getStoredMode()) setMode(e.matches ? "dark" : "light");
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const contextValue = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
