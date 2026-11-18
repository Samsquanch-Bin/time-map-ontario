// App state. Persisted only on this phone (AsyncStorage); nothing is sent anywhere.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ERA_MAX, ERA_MIN, START_VIEW } from "../config";
import type { Catalog, Installed } from "../logic/catalog";
import type { Range } from "../logic/era";
import type { Category } from "../logic/places";

export type ThemePref = "system" | "dark" | "light";
export type Basemap = "standard" | "satellite";

type Persisted = {
  themePref: ThemePref;
  basemap: Basemap;
  esriKey: string;
  era: Range;
  /** A map the person picked by hand; otherwise the most local map here is shown. */
  activeOverlayId: string | null;
  /** A map kept on screen wherever you go, until unlocked. */
  lockedOverlayId: string | null;
  /** Old maps on or off altogether. */
  oldMapOn: boolean;
  overlayOpacity: number;
  coverageVisible: boolean;
  placesVisible: boolean;
  /** Ontario Heritage Trust plaques on the map (fetched from the Trust onto this phone). */
  plaquesVisible: boolean;
  plaquesSavedAt: string | null;
  plaquesCount: number;
  hiddenCategories: Category[];
  camera: { center: [number, number]; zoom: number };
  installed: Installed;
  catalog: Catalog | null; // the catalogue matching the installed packs
};

type Transient = {
  /** Shade hills from the offline elevation pack (off at every launch). */
  terrainOn: boolean;
  compare: boolean;
  showUser: boolean;
  view: { bounds: [number, number, number, number]; zoom: number } | null;
  set: (patch: Partial<Persisted & Omit<Transient, "set">>) => void;
};

export const useApp = create<Persisted & Transient>()(
  persist(
    (set) => ({
      themePref: "system",
      basemap: "standard",
      esriKey: "",
      era: [ERA_MIN, ERA_MAX],
      activeOverlayId: null,
      oldMapOn: true,
      lockedOverlayId: null,
      overlayOpacity: 0.8,
      coverageVisible: false,
      terrainOn: false,
      placesVisible: true,
      plaquesVisible: false,
      plaquesSavedAt: null,
      plaquesCount: 0,
      hiddenCategories: [],
      camera: { center: START_VIEW.center, zoom: START_VIEW.zoom },
      installed: {},
      catalog: null,
      compare: false,
      showUser: false,
      view: null,
      set: (patch) => set(patch),
    }),
    {
      name: "tmo-state-v1",
      // v2: old maps are chosen automatically; start with the outlines off and no hand-picked map.
      // v3: hill shading is no longer remembered between launches.
      version: 3,
      migrate: (old, from) => {
        const o = { ...(old as Record<string, unknown>) };
        delete o.terrainOn;
        return (from < 2 ? { ...o, coverageVisible: false, activeOverlayId: null, oldMapOn: true } : o) as never;
      },
      storage: createJSONStorage(() => AsyncStorage),
      // compare / showUser are per-session; location is never stored.
      partialize: ({ compare: _c, showUser: _s, view: _v, terrainOn: _t, set: _set, ...rest }) => rest,
    },
  ),
);
