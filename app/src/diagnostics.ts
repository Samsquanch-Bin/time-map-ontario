// Small on-phone diagnostics log (map load status + MapLibre warnings/errors),
// shown in Settings & data so problems can be screenshotted. Never sent anywhere.
import { LogManager } from "@maplibre/maplibre-react-native";
import { useSyncExternalStore } from "react";

export type DiagEntry = { time: string; level: string; message: string };

let entries: DiagEntry[] = [];
let mapStatus = "not started";
const listeners = new Set<() => void>();
let snapshot = { entries, mapStatus };

function emit() {
  snapshot = { entries, mapStatus };
  listeners.forEach((l) => l());
}

export function logDiag(level: string, message: string) {
  const time = new Date().toTimeString().slice(0, 8);
  entries = [{ time, level, message: message.slice(0, 300) }, ...entries].slice(0, 25);
  emit();
}

export function setMapStatus(status: string) {
  mapStatus = status;
  logDiag("info", `map: ${status}`);
}

let started = false;
export function startDiagnostics() {
  if (started) return;
  started = true;
  LogManager.onLog((e) => {
    if (e.level === "error" || e.level === "warn") logDiag(e.level, `[${e.tag}] ${e.message}`);
    return false; // still print to the console
  });
  LogManager.start();
}

export function useDiagnostics() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}
