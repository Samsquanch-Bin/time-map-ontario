// Loads places.json from phone storage whenever a new copy is installed.
import { useEffect, useState } from "react";

import { type Place, parsePlaces } from "../logic/places";
import { useApp } from "../state/store";
import { readPlacesFile } from "./packs";

export function usePlaces(): Place[] {
  const sha = useApp((s) => s.installed["places.json"]);
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    let alive = true;
    if (!sha) {
      setPlaces([]);
      return;
    }
    readPlacesFile()
      .then((text) => alive && setPlaces(text ? parsePlaces(text) : []))
      .catch(() => alive && setPlaces([]));
    return () => {
      alive = false;
    };
  }, [sha]);
  return places;
}
