export const GITHUB_REPO = "Samsquanch-Bin/time-map-ontario";
export const CATALOG_URL = `https://github.com/${GITHUB_REPO}/releases/download/data-latest/catalog.json`;
export const ISSUES_EMAIL_SUBJECT = "Time Map Ontario correction";

// Toronto, Hamilton and Niagara: where the map opens the first time.
export const START_VIEW = { center: [-79.55, 43.5] as [number, number], zoom: 8.6 };

// Lowest year the era slider can reach (village sites of the 1300s–1500s).
// Online map shown until the offline basemap has been downloaded (OpenFreeMap:
// free, no key; © OpenMapTiles © OpenStreetMap contributors).
export const ONLINE_STYLE = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

export const ERA_MIN = 1300;
export const ERA_MAX = new Date().getFullYear();
