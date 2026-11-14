// Foreground location permission. Accepts "approximate" (coarse) as well as precise.
// Location is only used to draw the dot; it is never stored or sent anywhere.
import { PermissionsAndroid, Platform } from "react-native";
import { LocationManager } from "@maplibre/maplibre-react-native";

export async function requestForegroundLocation(): Promise<boolean> {
  if (Platform.OS !== "android") return LocationManager.requestPermissions();
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);
  return Object.values(res).some((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}
