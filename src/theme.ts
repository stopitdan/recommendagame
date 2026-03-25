import { createTheme } from "@mui/material/styles";

/**
 * Recommend a Game — MUI Theme
 *
 * "Game Night Glow" palette — vibrant, playful, inviting.
 * Feels like the energy of pulling out a board game at a party.
 *
 *   Vivid Indigo (#5B4FDB)  — Primary brand: bold, immersive, modern
 *   Sunset Coral (#FF6D3F)  — Secondary/CTA: warm, energetic, inviting
 *   Electric Teal (#0EC6C6) — Info/accent: fresh, techy, highlights
 *   Amber (#FFB020)         — Ratings/stars: achievement glow
 *   Deep Navy (#1A1A2E)     — Text: rich, readable
 *   Warm White (#FDFAF6)    — Background: cozy, approachable
 */

const theme = createTheme({
  typography: {
    fontFamily:
      '"DM Sans", "Nunito", var(--font-roboto), "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.02em" },
    h2: { fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.02em" },
    h3: { fontWeight: 700, color: "#1A1A2E", letterSpacing: "-0.01em" },
    h4: { fontWeight: 700, color: "#1A1A2E" },
    h5: { fontWeight: 600, color: "#1A1A2E" },
    h6: { fontWeight: 600, color: "#1A1A2E" },
    button: { fontWeight: 600, letterSpacing: "0.01em" },
  },
  palette: {
    mode: "light",
    primary: {
      main: "#5B4FDB",      // Vivid Indigo
      dark: "#4A3FC5",
      light: "#7B71E8",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#FF6D3F",      // Sunset Coral
      dark: "#E85A2E",
      light: "#FFF0EB",     // Coral tint (selected backgrounds)
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#FDFAF6",   // Warm White
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1A1A2E",   // Deep Navy
      secondary: "#64648C", // Muted Slate
    },
    divider: "#EEEDF5",     // Soft lavender grey
    info: {
      main: "#0EC6C6",      // Electric Teal
      light: "#E5FAFA",     // Teal tint
      dark: "#0AA3A3",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#22C55E",
      light: "#ECFDF5",
    },
    warning: {
      main: "#FFB020",      // Amber (ratings)
      light: "#FFF8E8",
    },
    error: {
      main: "#EF4444",
      light: "#FEF2F2",
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
          background: "linear-gradient(135deg, #5B4FDB 0%, #7B71E8 100%)",
          boxShadow: "0 4px 14px rgba(91, 79, 219, 0.3)",
          "&:hover": {
            background: "linear-gradient(135deg, #4A3FC5 0%, #5B4FDB 100%)",
            boxShadow: "0 6px 20px rgba(91, 79, 219, 0.4)",
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        },
        containedSecondary: {
          background: "linear-gradient(135deg, #FF6D3F 0%, #FF8F6B 100%)",
          boxShadow: "0 4px 14px rgba(255, 109, 63, 0.3)",
          "&:hover": {
            background: "linear-gradient(135deg, #E85A2E 0%, #FF6D3F 100%)",
            boxShadow: "0 6px 20px rgba(255, 109, 63, 0.4)",
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        },
        outlinedPrimary: {
          borderColor: "#5B4FDB",
          borderWidth: 2,
          color: "#5B4FDB",
          "&:hover": {
            borderColor: "#4A3FC5",
            borderWidth: 2,
            backgroundColor: "rgba(91, 79, 219, 0.06)",
          },
        },
        outlinedSecondary: {
          borderColor: "#FF6D3F",
          borderWidth: 2,
          color: "#FF6D3F",
          "&:hover": {
            borderColor: "#E85A2E",
            borderWidth: 2,
            backgroundColor: "rgba(255, 109, 63, 0.06)",
          },
        },
        text: {
          "&:hover": {
            backgroundColor: "rgba(91, 79, 219, 0.06)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid #EEEDF5",
          transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            boxShadow: "0 8px 30px rgba(91, 79, 219, 0.12), 0 2px 8px rgba(0,0,0,0.06)",
            borderColor: "rgba(91, 79, 219, 0.2)",
          },
        },
      },
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: {
          transition: "transform 150ms ease",
          "&:active": {
            transform: "scale(0.98)",
          },
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
          borderColor: "#EEEDF5",
          "&:hover": {
            borderColor: "#5B4FDB",
            backgroundColor: "rgba(91, 79, 219, 0.06)",
          },
        },
        filledPrimary: {
          background: "linear-gradient(135deg, #5B4FDB, #7B71E8)",
          color: "#FFFFFF",
        },
        filledSecondary: {
          background: "linear-gradient(135deg, #FF6D3F, #FF8F6B)",
          color: "#FFFFFF",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "linear-gradient(135deg, #1A1A2E 0%, #2D2B55 100%)",
          color: "#FFFFFF",
          boxShadow: "0 2px 12px rgba(26, 26, 46, 0.15)",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: "#EEEDF5",
          borderRadius: 6,
          height: 6,
        },
        bar: {
          background: "linear-gradient(90deg, #5B4FDB, #0EC6C6, #FF6D3F)",
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
              borderColor: "#5B4FDB",
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: "#5B4FDB",
          height: 6,
        },
        thumb: {
          width: 20,
          height: 20,
          "&:hover, &.Mui-active": {
            boxShadow: "0 0 0 8px rgba(91, 79, 219, 0.16)",
          },
        },
        track: {
          background: "linear-gradient(90deg, #5B4FDB, #0EC6C6)",
          border: "none",
        },
        rail: {
          backgroundColor: "#EEEDF5",
          opacity: 1,
        },
      },
    },
    MuiRating: {
      styleOverrides: {
        root: {
          color: "#FFB020",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: "#ECFDF5",
          color: "#166534",
        },
        standardError: {
          backgroundColor: "#FEF2F2",
          color: "#991B1B",
        },
        standardInfo: {
          backgroundColor: "#E5FAFA",
          color: "#0AA3A3",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1A1A2E",
          borderRadius: 8,
          fontSize: "0.8rem",
          padding: "8px 14px",
        },
      },
    },
  },
});

export default theme;
