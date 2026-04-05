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
  mode: "dark",
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
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

// ─── Provider ────────────────────────────────────────────────

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always start with "dark" on server to match default + avoid flash.
  // The inline script in <head> sets the correct data-theme before paint.
  // We sync React state to the real value in useEffect.
  const [mode, setMode] = useState<PaletteMode>("dark");
  const [colorPreset, setColorPresetState] = useState("game-night-glow");
  const [mounted, setMounted] = useState(false);

  // After mount, sync React state to the values the inline script set
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") {
      setMode(attr);
    } else {
      // No inline script ran (shouldn't happen), fall back to stored/system
      const stored = getStoredMode();
      const resolved = stored || getSystemMode();
      setMode(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    }

    const preset = document.documentElement.getAttribute("data-preset") || localStorage.getItem(PRESET_STORAGE_KEY) || "game-night-glow";
    setColorPresetState(preset);

    setMounted(true);
  }, []);

  // Listen for system theme changes (only if no stored preference)
  useEffect(() => {
    if (!mounted) return;
    if (!getStoredMode()) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        if (!getStoredMode()) {
          const next = e.matches ? "dark" : "light";
          setMode(next);
          document.documentElement.setAttribute("data-theme", next);
        }
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mounted]);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  const setColorPreset = useCallback((id: string) => {
    setColorPresetState(id);
    localStorage.setItem(PRESET_STORAGE_KEY, id);
    document.documentElement.setAttribute("data-preset", id);
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
