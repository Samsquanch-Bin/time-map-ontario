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
  activeOverlayId: string | null;
  overlayOpacity: number;
  coverageVisible: boolean;
  placesVisible: boolean;
  hiddenCategories: Category[];
  camera: { center: [number, number]; zoom: number };
  installed: Installed;
  catalog: Catalog | null; // the catalogue matching the installed packs
};

type Transient = {
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
      overlayOpacity: 0.8,
      coverageVisible: false,
      placesVisible: true,
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
      storage: createJSONStorage(() => AsyncStorage),
      // compare / showUser are per-session; location is never stored.
      partialize: ({ compare: _c, showUser: _s, view: _v, set: _set, ...rest }) => rest,
    },
  ),
);
