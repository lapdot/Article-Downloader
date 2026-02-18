import { createTheme } from "@mui/material/styles";

export const guiTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0b7285",
    },
    background: {
      default: "#eef3f7",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif",
  },
  shape: {
    borderRadius: 10,
  },
});
