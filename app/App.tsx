import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MapScreen } from "./src/components/MapScreen";
import { useApp } from "./src/state/store";
import { darkTheme, lightTheme } from "./src/theme";

export default function App() {
  const pref = useApp((s) => s.themePref);
  const system = useColorScheme();
  const mode = pref === "system" ? (system === "light" ? "light" : "dark") : pref;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={mode === "dark" ? darkTheme : lightTheme}>
          <StatusBar style={mode === "dark" ? "light" : "dark"} />
          <MapScreen mapTheme={mode} />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
