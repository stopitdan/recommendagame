import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  typography: {
    fontFamily:
      'var(--font-roboto), "Roboto", "Helvetica Neue", Arial, sans-serif',
  },
  palette: {
    mode: "light",
    primary: {
      main: "#5c6bc0",
    },
    secondary: {
      main: "#26a69a",
    },
  },
});

export default theme;
