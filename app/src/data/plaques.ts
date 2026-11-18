// Fetches the Ontario Heritage Trust's plaques straight from the Trust's map service
// and keeps the copy on this phone only (see src/logic/plaques.ts for why).
import * as FS from "expo-file-system/legacy";
import { useCallback, useEffect, useState } from "react";

import { type Plaque, parsePlaquesPage, plaquesPageUrl } from "../logic/plaques";
import { useApp } from "../state/store";

const FILE = `${FS.documentDirectory}plaques.json`;
const PAGE = 1000;

export async function downloadPlaques(): Promise<Plaque[]> {
  const all: Plaque[] = [];
  for (let offset = 0, guard = 0; guard < 20; guard++) {
    const res = await fetch(plaquesPageUrl(offset, PAGE), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`The plaque service answered ${res.status}.`);
    const { plaques, more } = parsePlaquesPage(await res.json());
    all.push(...plaques);
    if (!more) break;
    offset += PAGE;
  }
  if (all.length === 0) throw new Error("The plaque service returned no plaques.");
  await FS.writeAsStringAsync(FILE, JSON.stringify(all));
  return all;
}

async function readSaved(): Promise<Plaque[] | null> {
  const info = await FS.getInfoAsync(FILE);
  if (!info.exists) return null;
  return JSON.parse(await FS.readAsStringAsync(FILE)) as Plaque[];
}

export async function deleteSavedPlaques(): Promise<void> {
  await FS.deleteAsync(FILE, { idempotent: true });
}

let cache: Plaque[] | null = null;

/** The plaques saved on this phone. When the switch is on and none are saved yet,
 *  they're fetched once; `refresh` fetches them again. */
export function usePlaques(): { plaques: Plaque[]; busy: boolean; error: string; refresh: () => void } {
  const on = useApp((s) => s.plaquesVisible);
  const savedAt = useApp((s) => s.plaquesSavedAt);
  const set = useApp((s) => s.set);
  const [plaques, setPlaques] = useState<Plaque[]>(cache ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchNow = useCallback(() => {
    setBusy(true);
    setError("");
    downloadPlaques()
      .then((p) => {
        cache = p;
        setPlaques(p);
        set({ plaquesSavedAt: new Date().toISOString(), plaquesCount: p.length });
      })
      .catch((e: unknown) => setError(`${e instanceof Error ? e.message : String(e)} Check your internet connection and try again.`))
      .finally(() => setBusy(false));
  }, [set]);

  useEffect(() => {
    if (!on) return;
    let alive = true;
    if (cache) {
      setPlaques(cache);
      return;
    }
    readSaved()
      .then((p) => {
        if (!alive) return;
        if (p && p.length) {
          cache = p;
          setPlaques(p);
        } else {
          fetchNow();
        }
      })
      .catch(() => alive && fetchNow());
    return () => {
      alive = false;
    };
  }, [on, savedAt, fetchNow]);

  return { plaques: on ? plaques : [], busy, error, refresh: fetchNow };
}
