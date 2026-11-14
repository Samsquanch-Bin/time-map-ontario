// Expo app config. versionCode comes from the GitHub Actions run number so every
// build installs over the previous one.
const runNumber = parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10);

module.exports = {
  expo: {
    name: "Time Map Ontario",
    slug: "time-map-ontario",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    backgroundColor: "#0E1116",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0E1116",
    },
    android: {
      package: "io.github.samsquanchbin.timemapontario",
      versionCode: runNumber,
      adaptiveIcon: {
        backgroundColor: "#0E1116",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      // Foreground location only, used for the "you are here" dot. No background location.
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
      blockedPermissions: [
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.RECORD_AUDIO",
      ],
      predictiveBackGestureEnabled: false,
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "io.github.samsquanchbin.timemapontario",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Shows where you are on the map and your elevation. Your location never leaves the phone.",
      },
    },
    plugins: [
      "@maplibre/maplibre-react-native",
      "./plugins/withMapAssets",
      "./plugins/withReleaseSigning",
    ],
  },
};
