// "Night Survey": dark-first Material 3 theme with one amber accent,
// plus a high-contrast light variant for bright sun.
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";

export const AMBER = "#FFB300";

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: AMBER,
    onPrimary: "#2A1C00",
    primaryContainer: "#3D2E00",
    onPrimaryContainer: "#FFDF9E",
    secondary: "#C9C6BE",
    onSecondary: "#1D1B16",
    secondaryContainer: "#2C3139",
    onSecondaryContainer: "#E2E6EE",
    background: "#0E1116",
    onBackground: "#E4E7EC",
    surface: "#151A21",
    onSurface: "#E4E7EC",
    surfaceVariant: "#232A33",
    onSurfaceVariant: "#B8C0CC",
    outline: "#6B7584",
    outlineVariant: "#333C48",
    elevation: {
      level0: "transparent",
      level1: "#171C24",
      level2: "#1A2029",
      level3: "#1D242E",
      level4: "#1F2630",
      level5: "#222A35",
    },
  },
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: {
    ...MD3LightTheme.colors,
    // Darker amber keeps 4.5:1 contrast on white for text and controls.
    primary: "#7A5400",
    onPrimary: "#FFFFFF",
    primaryContainer: "#FFDF9E",
    onPrimaryContainer: "#261A00",
    background: "#FFFFFF",
    onBackground: "#111418",
    surface: "#FFFFFF",
    onSurface: "#111418",
    surfaceVariant: "#ECEEF1",
    onSurfaceVariant: "#3B434E",
    outline: "#5B6472",
  },
};
