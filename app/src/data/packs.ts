// Downloads data packs from the GitHub release into app storage.
import * as FS from "expo-file-system/legacy";

import { CATALOG_URL } from "../config";
import { type Catalog, type Installed, type Pack, packsToDownload, parseCatalog, staleFiles } from "../logic/catalog";

export const PACK_DIR = `${FS.documentDirectory}packs/`;

/** pmtiles:// URL for a downloaded pack, read straight from phone storage. */
export function pmtilesUrl(file: string): string {
  return `pmtiles://${PACK_DIR}${file}`;
}

export async function fetchRemoteCatalog(): Promise<Catalog> {
  const res = await fetch(CATALOG_URL, { headers: { "Cache-Control": "no-cache" } });
  if (res.status === 404) throw new Error("No data has been published yet (the data build hasn't run).");
  if (!res.ok) throw new Error(`Couldn't reach GitHub (HTTP ${res.status}).`);
  return parseCatalog(await res.text());
}

export type Progress = { file: string; index: number; count: number; written: number; total: number };

/**
 * Download every pack that's missing or changed, then delete files the catalogue
 * no longer lists. Returns the new `installed` map. Files are downloaded to a
 * .part name and only renamed once complete, so an interrupted download never
 * leaves a broken pack in place.
 */
export async function syncPacks(
  catalog: Catalog,
  installed: Installed,
  onProgress: (p: Progress) => void,
  shouldCancel: () => boolean,
): Promise<Installed> {
  await FS.makeDirectoryAsync(PACK_DIR, { intermediates: true }).catch(() => {});
  const todo = packsToDownload(catalog, installed);
  const next: Installed = { ...installed };
  for (const [i, pack] of todo.entries()) {
    if (shouldCancel()) break;
    await downloadOne(pack, (written, total) =>
      onProgress({ file: pack.file, index: i + 1, count: todo.length, written, total }),
    );
    next[pack.file] = pack.sha256;
  }
  // Only clean up once everything new is in place; a stopped download keeps old files.
  if (packsToDownload(catalog, next).length > 0) return next;
  for (const f of staleFiles(catalog, next)) {
    await FS.deleteAsync(PACK_DIR + f, { idempotent: true });
    delete next[f];
  }
  return next;
}

async function downloadOne(pack: Pack, progress: (written: number, total: number) => void) {
  const part = `${PACK_DIR}${pack.file}.part`;
  await FS.deleteAsync(part, { idempotent: true });
  const task = FS.createDownloadResumable(pack.url, part, {}, (d) =>
    progress(d.totalBytesWritten, d.totalBytesExpectedToWrite || pack.bytes),
  );
  const result = await task.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error(`Download of ${pack.file} failed (HTTP ${result?.status ?? "?"}).`);
  }
  const info = await FS.getInfoAsync(part);
  if (!info.exists || info.size !== pack.bytes) {
    await FS.deleteAsync(part, { idempotent: true });
    throw new Error(`${pack.file} arrived incomplete — try again on Wi-Fi.`);
  }
  await FS.deleteAsync(PACK_DIR + pack.file, { idempotent: true });
  await FS.moveAsync({ from: part, to: PACK_DIR + pack.file });
}

export async function deleteAllPacks(): Promise<void> {
  await FS.deleteAsync(PACK_DIR, { idempotent: true });
}

export async function freeSpaceBytes(): Promise<number | null> {
  try {
    return await FS.getFreeDiskStorageAsync();
  } catch {
    return null;
  }
}
