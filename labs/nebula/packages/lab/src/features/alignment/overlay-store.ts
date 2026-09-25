import { resolveLabModelPath } from '../../resources/model-paths.ts';
import { defaultOverlayPlacement, updateOverlayPlacement, type OverlayPlacement } from '@cssearth/bake/volume';

export interface SavedOverlay {
  id: string; enabled: boolean; opacity: number; placement: OverlayPlacement; basis: string;
  defaultPlacement?: OverlayPlacement;
}
/** Follow corrected defaults only while the saved placement is still the previous default. */
export function resolveSavedPlacement(saved: OverlayPlacement, previousDefault = defaultOverlayPlacement(), nextDefault = defaultOverlayPlacement()): OverlayPlacement {
  return (Object.keys(previousDefault) as (keyof OverlayPlacement)[]).every(key => saved[key] === previousDefault[key]) ? { ...nextDefault } : { ...saved };
}
const KEY = 'cssearth-nebula-overlay-state-v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
function browserStorage(): StoragePort | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}
export function readOverlaySessions(storage = browserStorage()): Map<string, SavedOverlay[]> {
  const result = new Map<string, SavedOverlay[]>();
  try {
    const stored = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (stored?.schema !== 'cssearth-nebula-overlay-state@1' || !Array.isArray(stored.catalogues)) return result;
    for (const entry of stored.catalogues) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) continue;
      const values: SavedOverlay[] = [];
      for (const row of entry[1]) {
        try {
          if (!row || typeof row.id !== 'string' || typeof row.basis !== 'string' || typeof row.enabled !== 'boolean' ||
              typeof row.opacity !== 'number' || !Number.isFinite(row.opacity) || row.opacity < 0 || row.opacity > 1 ||
              !row.placement || Object.keys(row.placement).length !== 7) continue;
          values.push({ id: row.id, basis: row.basis, enabled: row.enabled, opacity: row.opacity,
            placement: updateOverlayPlacement(defaultOverlayPlacement(), row.placement),
            ...(row.defaultPlacement ? { defaultPlacement: updateOverlayPlacement(defaultOverlayPlacement(), row.defaultPlacement) } : {}) });
        } catch { /* Discard only the malformed record. */ }
      }
      result.set(resolveLabModelPath(entry[0]), values);
    }
  } catch { /* Storage can be unavailable or contain an old experiment. */ }
  return result;
}
export function writeOverlaySessions(sessions: Map<string, SavedOverlay[]>, storage = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(KEY, JSON.stringify({ schema: 'cssearth-nebula-overlay-state@1', catalogues: [...sessions] }));
    return true;
  } catch { return false; }
}
