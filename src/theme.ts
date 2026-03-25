import { createTheme } from "@mui/material/styles";

/**
 * Recommend a Game — MUI Theme
 *
 * Color palette derived from the design system (docs/DESIGN-SYSTEM.md):
 *   Granite (#3A4F41) — Primary brand
 *   Rosewood (#B9314F) — Accent / CTA
 *   Rosy Taupe (#D5A18E) — Secondary warm
 *   Almond Silk (#DEC3BE) — Warm backgrounds
 *   Alabaster Grey (#E1DEE3) — Cool neutral
 */

const theme = createTheme({
  typography: {
    fontFamily:
      'var(--font-roboto), "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, color: "#3A4F41" },
    h2: { fontWeight: 700, color: "#3A4F41" },
    h3: { fontWeight: 700, color: "#3A4F41" },
    h4: { fontWeight: 700, color: "#3A4F41" },
    h5: { fontWeight: 600, color: "#3A4F41" },
    h6: { fontWeight: 600, color: "#3A4F41" },
  },
  palette: {
    mode: "light",
    primary: {
      main: "#3A4F41",     // Granite
      dark: "#2D3D32",
      light: "#5A7A63",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#B9314F",     // Rosewood
      dark: "#9A2840",
      light: "#F2E0E4",    // Rosewood tint (selected card backgrounds)
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#FAF7F5",  // Warm White
      paper: "#FFFFFF",
    },
    text: {
      primary: "#2A2A2A",  // Charcoal
      secondary: "#6B6B6B",
    },
    divider: "#E1DEE3",    // Alabaster Grey
    info: {
      main: "#D5A18E",     // Rosy Taupe
      light: "#DEC3BE",    // Almond Silk
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
          padding: "8px 20px",
        },
        containedPrimary: {
          backgroundColor: "#B9314F",
          "&:hover": {
            backgroundColor: "#9A2840",
          },
        },
        containedSecondary: {
          backgroundColor: "#3A4F41",
          "&:hover": {
            backgroundColor: "#2D3D32",
          },
        },
        outlinedPrimary: {
          borderColor: "#3A4F41",
          color: "#3A4F41",
          "&:hover": {
            borderColor: "#2D3D32",
            backgroundColor: "rgba(58, 79, 65, 0.04)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: "box-shadow 200ms ease, transform 200ms ease",
          "&:hover": {
            boxShadow: "0 4px 20px rgba(58, 79, 65, 0.12)",
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
        },
        outlined: {
          borderColor: "#E1DEE3",
          "&:hover": {
            borderColor: "#D5A18E",
            backgroundColor: "rgba(213, 161, 142, 0.08)",
          },
        },
        filledPrimary: {
          backgroundColor: "#B9314F",
          color: "#FFFFFF",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#3A4F41",
          color: "#FFFFFF",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: "#E1DEE3",
          borderRadius: 4,
        },
        bar: {
          background: "linear-gradient(90deg, #3A4F41, #D5A18E)",
          borderRadius: 4,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#3A4F41",
            },
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: "#3A4F41",
        },
        thumb: {
          "&:hover, &.Mui-active": {
            boxShadow: "0 0 0 8px rgba(58, 79, 65, 0.16)",
          },
        },
        track: {
          background: "linear-gradient(90deg, #3A4F41, #D5A18E)",
          border: "none",
        },
        rail: {
          backgroundColor: "#E1DEE3",
        },
      },
    },
  },
});

export default theme;
