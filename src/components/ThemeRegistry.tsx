"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, type PaletteMode } from "@mui/material/styles";
import { createAppTheme } from "@/theme";

// ─── Context ─────────────────────────────────────────────────

interface ColorModeContextType {
  mode: PaletteMode;
  toggleMode: () => void;
  colorPreset: string;
  setColorPreset: (id: string) => void;
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: "light",
  toggleMode: () => {},
  colorPreset: 'game-night-glow',
  setColorPreset: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

// ─── Storage ─────────────────────────────────────────────────

const STORAGE_KEY = "rag_color_mode";
const PRESET_STORAGE_KEY = "rag_color_preset";

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
  const [mode, setMode] = useState<PaletteMode>(() => {
    if (typeof document !== "undefined") {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "light" || attr === "dark") return attr;
    }
    return "light";
  });
  const [colorPreset, setColorPresetState] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-preset") || "game-night-glow";
    }
    return "game-night-glow";
  });

  // Listen for system theme changes (only if no stored preference)
  useEffect(() => {
    if (!getStoredMode()) {
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

  const setColorPreset = useCallback((id: string) => {
    setColorPresetState(id);
    localStorage.setItem(PRESET_STORAGE_KEY, id);
  }, []);

  const theme = useMemo(() => createAppTheme(mode, colorPreset), [mode, colorPreset]);

  const contextValue = useMemo(() => ({ mode, toggleMode, colorPreset, setColorPreset }), [mode, toggleMode, colorPreset, setColorPreset]);

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
