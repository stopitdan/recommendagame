import { createTheme, type PaletteMode } from "@mui/material/styles";

/**
 * Recommend a Game — MUI Theme Factory
 *
 * "Game Night Glow" palette — vibrant, playful, inviting.
 *
 * Supports light and dark modes. Dark mode uses deeper backgrounds
 * while keeping the same vibrant accent colors.
 */

// ─── Shared Colors (same in both modes) ──────────────────────

const INDIGO = "#5B4FDB";
const INDIGO_DARK = "#4A3FC5";
const INDIGO_LIGHT = "#7B71E8";
const CORAL = "#FF6D3F";
const CORAL_DARK = "#E85A2E";
const TEAL = "#0EC6C6";
const AMBER = "#FFB020";

// ─── Mode-Specific Colors ────────────────────────────────────

const lightPalette = {
  background: { default: "#FDFAF6", paper: "#FFFFFF" },
  text: { primary: "#1A1A2E", secondary: "#64648C" },
  divider: "#EEEDF5",
  secondaryLight: "#FFF0EB",
  infoLight: "#E5FAFA",
  successLight: "#ECFDF5",
  warningLight: "#FFF8E8",
  errorLight: "#FEF2F2",
  cardBorder: "#EEEDF5",
  chipBorder: "#EEEDF5",
  hoverBg: "rgba(91, 79, 219, 0.06)",
  progressBg: "#EEEDF5",
  sliderRail: "#EEEDF5",
  appBarBg: "linear-gradient(135deg, #1A1A2E 0%, #2D2B55 100%)",
  tooltipBg: "#1A1A2E",
  alertSuccessBg: "#ECFDF5",
  alertSuccessText: "#166534",
  alertErrorBg: "#FEF2F2",
  alertErrorText: "#991B1B",
  alertInfoBg: "#E5FAFA",
  alertInfoText: "#0AA3A3",
};

const darkPalette = {
  background: { default: "#0F0F1A", paper: "#1A1A2E" },
  text: { primary: "#EEEDF5", secondary: "#A0A0C0" },
  divider: "#2D2B55",
  secondaryLight: "rgba(255, 109, 63, 0.15)",
  infoLight: "rgba(14, 198, 198, 0.15)",
  successLight: "rgba(34, 197, 94, 0.15)",
  warningLight: "rgba(255, 176, 32, 0.15)",
  errorLight: "rgba(239, 68, 68, 0.15)",
  cardBorder: "#2D2B55",
  chipBorder: "#3D3B65",
  hoverBg: "rgba(91, 79, 219, 0.12)",
  progressBg: "#2D2B55",
  sliderRail: "#2D2B55",
  appBarBg: "linear-gradient(135deg, #0A0A14 0%, #1A1A2E 100%)",
  tooltipBg: "#2D2B55",
  alertSuccessBg: "rgba(34, 197, 94, 0.15)",
  alertSuccessText: "#86EFAC",
  alertErrorBg: "rgba(239, 68, 68, 0.15)",
  alertErrorText: "#FCA5A5",
  alertInfoBg: "rgba(14, 198, 198, 0.15)",
  alertInfoText: "#5EEAD4",
};

// ─── Theme Factory ───────────────────────────────────────────

export function createAppTheme(mode: PaletteMode) {
  const p = mode === "dark" ? darkPalette : lightPalette;

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
        main: INDIGO,
        dark: INDIGO_DARK,
        light: INDIGO_LIGHT,
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: CORAL,
        dark: CORAL_DARK,
        light: p.secondaryLight,
        contrastText: "#FFFFFF",
      },
      background: p.background,
      text: p.text,
      divider: p.divider,
      info: {
        main: TEAL,
        light: p.infoLight,
        dark: "#0AA3A3",
        contrastText: "#FFFFFF",
      },
      success: {
        main: "#22C55E",
        light: p.successLight,
      },
      warning: {
        main: AMBER,
        light: p.warningLight,
      },
      error: {
        main: "#EF4444",
        light: p.errorLight,
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
            background: `linear-gradient(135deg, ${INDIGO} 0%, ${INDIGO_LIGHT} 100%)`,
            boxShadow: "0 4px 14px rgba(91, 79, 219, 0.3)",
            "&:hover": {
              background: `linear-gradient(135deg, ${INDIGO_DARK} 0%, ${INDIGO} 100%)`,
              boxShadow: "0 6px 20px rgba(91, 79, 219, 0.4)",
              transform: "translateY(-1px)",
            },
            "&:active": { transform: "translateY(0)" },
          },
          containedSecondary: {
            background: `linear-gradient(135deg, ${CORAL} 0%, #FF8F6B 100%)`,
            boxShadow: "0 4px 14px rgba(255, 109, 63, 0.3)",
            "&:hover": {
              background: `linear-gradient(135deg, ${CORAL_DARK} 0%, ${CORAL} 100%)`,
              boxShadow: "0 6px 20px rgba(255, 109, 63, 0.4)",
              transform: "translateY(-1px)",
            },
            "&:active": { transform: "translateY(0)" },
          },
          outlinedPrimary: {
            borderColor: INDIGO,
            borderWidth: 2,
            color: INDIGO,
            "&:hover": {
              borderColor: INDIGO_DARK,
              borderWidth: 2,
              backgroundColor: p.hoverBg,
            },
          },
          outlinedSecondary: {
            borderColor: CORAL,
            borderWidth: 2,
            color: CORAL,
            "&:hover": {
              borderColor: CORAL_DARK,
              borderWidth: 2,
              backgroundColor: "rgba(255, 109, 63, 0.06)",
            },
          },
          text: {
            "&:hover": { backgroundColor: p.hoverBg },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: `1px solid ${p.cardBorder}`,
            backgroundColor: p.background.paper,
            transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              boxShadow: mode === "dark"
                ? "0 8px 30px rgba(91, 79, 219, 0.2), 0 2px 8px rgba(0,0,0,0.3)"
                : "0 8px 30px rgba(91, 79, 219, 0.12), 0 2px 8px rgba(0,0,0,0.06)",
              borderColor: "rgba(91, 79, 219, 0.2)",
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
            borderColor: p.chipBorder,
            "&:hover": {
              borderColor: INDIGO,
              backgroundColor: p.hoverBg,
            },
          },
          filledPrimary: {
            background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_LIGHT})`,
            color: "#FFFFFF",
          },
          filledSecondary: {
            background: `linear-gradient(135deg, ${CORAL}, #FF8F6B)`,
            color: "#FFFFFF",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: p.appBarBg,
            color: "#FFFFFF",
            boxShadow: "0 2px 12px rgba(26, 26, 46, 0.15)",
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            backgroundColor: p.progressBg,
            borderRadius: 6,
            height: 6,
          },
          bar: {
            background: `linear-gradient(90deg, ${INDIGO}, ${TEAL}, ${CORAL})`,
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
                boxShadow: "0 0 0 3px rgba(91, 79, 219, 0.15)",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: INDIGO,
                borderWidth: 2,
              },
            },
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: { color: INDIGO, height: 6 },
          thumb: {
            width: 20,
            height: 20,
            "&:hover, &.Mui-active": {
              boxShadow: "0 0 0 8px rgba(91, 79, 219, 0.16)",
            },
          },
          track: {
            background: `linear-gradient(90deg, ${INDIGO}, ${TEAL})`,
            border: "none",
          },
          rail: {
            backgroundColor: p.sliderRail,
            opacity: 1,
          },
        },
      },
      MuiRating: {
        styleOverrides: {
          root: { color: AMBER },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardSuccess: { backgroundColor: p.alertSuccessBg, color: p.alertSuccessText },
          standardError: { backgroundColor: p.alertErrorBg, color: p.alertErrorText },
          standardInfo: { backgroundColor: p.alertInfoBg, color: p.alertInfoText },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 20 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: p.tooltipBg,
            borderRadius: 8,
            fontSize: "0.8rem",
            padding: "8px 14px",
          },
        },
      },
    },
  });
}

// Default export for backward compatibility
const theme = createAppTheme("light");
export default theme;
