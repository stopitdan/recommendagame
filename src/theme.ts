import { createTheme, type PaletteMode } from "@mui/material/styles";
import { type ColorPreset, getPreset, DEFAULT_PRESET_ID } from "@/lib/color-presets";

/**
 * boredgame.lol — MUI Theme Factory
 *
 * Reads from the color preset system. To change colors:
 * 1. Edit or add a preset in src/lib/color-presets.ts
 * 2. That's it — theme auto-generates from the preset
 */

export function createAppTheme(mode: PaletteMode, presetId?: string) {
  const c = getPreset(presetId ?? DEFAULT_PRESET_ID);
  const isDark = mode === "dark";

  const bg = isDark
    ? { default: c.darkBg, paper: c.darkPaper }
    : { default: c.lightBg, paper: c.lightPaper };

  const text = isDark
    ? { primary: c.darkText, secondary: c.darkTextSecondary }
    : { primary: c.lightText, secondary: c.lightTextSecondary };

  const divider = isDark ? c.darkDivider : c.lightDivider;

  const hoverBg = isDark
    ? `${c.primary}20`
    : `${c.primary}10`;

  const secondaryLight = isDark
    ? `${c.secondary}25`
    : `${c.secondary}18`;

  return createTheme({
    typography: {
      fontFamily:
        '"DM Sans", "Nunito", var(--font-roboto), "Helvetica Neue", Arial, sans-serif',
      h1: { fontWeight: 800, letterSpacing: "-0.02em" },
      h2: { fontWeight: 800, letterSpacing: "-0.02em" },
      h3: { fontWeight: 700, letterSpacing: "-0.01em" },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600, letterSpacing: "0.01em" },
    },
    palette: {
      mode,
      primary: {
        main: c.primary,
        dark: c.primaryDark,
        light: c.primaryLight,
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: c.secondary,
        dark: c.secondaryDark,
        light: secondaryLight,
        contrastText: "#FFFFFF",
      },
      background: bg,
      text,
      divider,
      info: {
        main: c.accent,
        light: isDark ? `${c.accent}25` : `${c.accent}18`,
        dark: c.accent,
        contrastText: "#FFFFFF",
      },
      success: {
        main: "#22C55E",
        light: isDark ? "rgba(34, 197, 94, 0.15)" : "#ECFDF5",
      },
      warning: {
        main: c.rating,
        light: isDark ? `${c.rating}25` : `${c.rating}18`,
      },
      error: {
        main: "#EF4444",
        light: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
      },
    },
    shape: {
      borderRadius: 14,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 10,
            padding: "10px 22px",
            fontSize: "0.95rem",
            transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${c.primary} 0%, ${c.primaryLight} 100%)`,
            boxShadow: `0 4px 14px ${c.primary}4D`,
            "&:hover": {
              background: `linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 100%)`,
              boxShadow: `0 6px 20px ${c.primary}66`,
              transform: "translateY(-1px)",
            },
            "&:active": { transform: "translateY(0)" },
          },
          containedSecondary: {
            background: `linear-gradient(135deg, ${c.secondary} 0%, ${c.secondary}CC 100%)`,
            boxShadow: `0 4px 14px ${c.secondary}4D`,
            "&:hover": {
              background: `linear-gradient(135deg, ${c.secondaryDark} 0%, ${c.secondary} 100%)`,
              boxShadow: `0 6px 20px ${c.secondary}66`,
              transform: "translateY(-1px)",
            },
            "&:active": { transform: "translateY(0)" },
          },
          outlinedPrimary: {
            borderColor: c.primary,
            borderWidth: 2,
            color: c.primary,
            "&:hover": {
              borderColor: c.primaryDark,
              borderWidth: 2,
              backgroundColor: hoverBg,
            },
          },
          outlinedSecondary: {
            borderColor: c.secondary,
            borderWidth: 2,
            color: c.secondary,
            "&:hover": {
              borderColor: c.secondaryDark,
              borderWidth: 2,
              backgroundColor: `${c.secondary}10`,
            },
          },
          text: {
            "&:hover": { backgroundColor: hoverBg },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: `1px solid ${divider}`,
            backgroundColor: bg.paper,
            transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              boxShadow: isDark
                ? `0 8px 30px ${c.primary}33, 0 2px 8px rgba(0,0,0,0.3)`
                : `0 8px 30px ${c.primary}1F, 0 2px 8px rgba(0,0,0,0.06)`,
              borderColor: `${c.primary}33`,
            },
          },
        },
      },
      MuiCardActionArea: {
        styleOverrides: {
          root: {
            transition: "transform 150ms ease",
            "&:active": { transform: "scale(0.98)" },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            transition: "all 150ms ease",
            borderRadius: 8,
          },
          outlined: {
            borderColor: divider,
            "&:hover": {
              borderColor: c.primary,
              backgroundColor: hoverBg,
            },
          },
          filledPrimary: {
            background: `linear-gradient(135deg, ${c.primary}, ${c.primaryLight})`,
            color: "#FFFFFF",
          },
          filledSecondary: {
            background: `linear-gradient(135deg, ${c.secondary}, ${c.secondary}CC)`,
            color: "#FFFFFF",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: isDark
              ? `linear-gradient(135deg, ${c.darkBg} 0%, ${c.darkPaper} 100%)`
              : `linear-gradient(135deg, ${c.lightText} 0%, ${c.lightText}DD 100%)`,
            color: "#FFFFFF",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            backgroundColor: divider,
            borderRadius: 6,
            height: 6,
          },
          bar: {
            background: `linear-gradient(90deg, ${c.primary}, ${c.accent}, ${c.secondary})`,
            borderRadius: 6,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 10,
              transition: "box-shadow 200ms ease",
              "&.Mui-focused": {
                boxShadow: `0 0 0 3px ${c.primary}25`,
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: c.primary,
                borderWidth: 2,
              },
            },
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: { color: c.primary, height: 6 },
          thumb: {
            width: 20,
            height: 20,
            "&:hover, &.Mui-active": {
              boxShadow: `0 0 0 8px ${c.primary}28`,
            },
          },
          track: {
            background: `linear-gradient(90deg, ${c.primary}, ${c.accent})`,
            border: "none",
          },
          rail: {
            backgroundColor: divider,
            opacity: 1,
          },
        },
      },
      MuiRating: {
        styleOverrides: {
          root: { color: c.rating },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardSuccess: {
            backgroundColor: isDark ? "rgba(34,197,94,0.15)" : "#ECFDF5",
            color: isDark ? "#86EFAC" : "#166534",
          },
          standardError: {
            backgroundColor: isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2",
            color: isDark ? "#FCA5A5" : "#991B1B",
          },
          standardInfo: {
            backgroundColor: isDark ? `${c.accent}25` : `${c.accent}18`,
            color: isDark ? `${c.accent}` : c.accent,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 20 },
        },
      },
      MuiTooltip: {
        defaultProps: {
          enterDelay: 500,
          enterNextDelay: 300,
          arrow: true,
        },
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? c.darkDivider : c.lightText,
            color: "#FFFFFF",
            borderRadius: 10,
            fontSize: "0.82rem",
            fontWeight: 500,
            padding: "8px 14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          },
          arrow: {
            color: isDark ? c.darkDivider : c.lightText,
          },
        },
      },
    },
  });
}

// Default export for backward compatibility
const theme = createAppTheme("light");
export default theme;
