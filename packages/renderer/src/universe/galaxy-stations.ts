import type { PreparedGalaxyStations } from '@cssearth/objects';
import { writeStyle } from '../rendering/dom/retained-write.js';
import { createGalaxyStationSelection, type GalaxyStationLocation } from './galaxy-station-selection.js';
import type { VolumeCameraPublication } from '../volume/types.js';

export interface PreparedGalaxyStationScene {
  /** A complete opaque background and its fixed clouds under this one root. Clouds alone are not a complete station. */
  readonly root: HTMLElement;
  publish(publication: VolumeCameraPublication): void;
  destroy(): void;
  setExposure?(opacity: number): void;
}

/** Dissolves complete prepared scenes. Source-over needs an opaque rear, and only the front changes opacity. */
export function mountGalaxyStations({ host, before = null, stations, load, hysteresisM, fadeMs, coasting = () => false,
  clock = () => performance.now(), requestPublication = () => {}, onError = console.error, interpolation,
  maximumLoadedStations = 3,
  retryDelayMs = 500, later = (callback, milliseconds) => { setTimeout(callback, milliseconds); } }: {
  host: HTMLElement; before?: Node | null; stations: readonly GalaxyStationLocation[];
  load(id: string): Promise<PreparedGalaxyStationScene>;
  hysteresisM: number; fadeMs: number; coasting?: () => boolean; clock?: () => number;
  interpolation?: { readonly paths: readonly (readonly string[])[] };
  requestPublication?: () => void; onError?: (error: unknown) => void;
  maximumLoadedStations?: number;
  retryDelayMs?: number; later?: (callback: () => void, milliseconds: number) => void;
}) {
  if (!Number.isSafeInteger(maximumLoadedStations) || maximumLoadedStations < 3) throw new TypeError('Station cache must hold the two dissolving scenes and one prepared replacement.');
  if (interpolation && maximumLoadedStations !== 3) throw new TypeError('Position stations reserve one of four sky slots for NASA.');
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 1) throw new TypeError('Station retry delay must be finite and positive.');
  const selection = createGalaxyStationSelection(stations, { hysteresisM, fadeMs, interpolation, maximumStations: maximumLoadedStations });
  const loaded = new Map<string, PreparedGalaxyStationScene>(), pending = new Set<string>();
  const failed = new Map<string, { attempts: number; retryAt: number }>(), attempts = new Map<string, number>();
  let destroyed = false, latest: VolumeCameraPublication | null = null;
  let residents = new Set<string>();
  let exposure = 1;
  let requested = new Set<string>();
  const trim = (keep?: string) => {
    for (const [id, scene] of loaded) {
      if (loaded.size <= maximumLoadedStations) break;
      if (residents.has(id) || requested.has(id) || id === keep) continue;
      scene.destroy(); loaded.delete(id);
    }
  };
  const request = (id: string) => {
    const failure = failed.get(id);
    if (destroyed || pending.size || loaded.has(id) || failure && (failure.attempts >= 3 || clock() < failure.retryAt)) return;
    // Reserve the decode slot before starting it: loaded + in-flight never exceeds the cap.
    if (loaded.size >= maximumLoadedStations) {
      for (const [key, scene] of loaded) {
        if (residents.has(key)) continue;
        scene.destroy(); loaded.delete(key);
        if (loaded.size < maximumLoadedStations) break;
      }
      if (loaded.size >= maximumLoadedStations) return;
    }
    const attempt = (attempts.get(id) ?? 0) + 1;
    attempts.set(id, attempt);
    pending.add(id);
    let loading: Promise<PreparedGalaxyStationScene>;
    try { loading = Promise.resolve(load(id)); } catch (error) { loading = Promise.reject(error); }
    void loading.then(scene => {
      pending.delete(id);
      if (destroyed) { scene.destroy(); return; }
      // Load and decode while detached. The load owner must not attach hidden geometry itself.
      if (scene.root.parentNode) { scene.destroy(); throw new TypeError(`Station ${id} loaded with its root already mounted.`); }
      scene.root.dataset.galaxyStation = id;
      scene.root.style.position = 'absolute'; scene.root.style.inset = '0'; scene.root.style.transformStyle = 'flat';
      // An explicit opaque matte makes the COMPLETE scene's dissolve source-over-safe. Child clouds are transparent.
      scene.root.style.background = '#000';
      failed.delete(id); loaded.set(id, scene); trim(id); requestPublication();
      scene.setExposure?.(exposure);
    }).catch(error => {
      pending.delete(id);
      if (destroyed) return;
      const delay = retryDelayMs * 2 ** (attempt - 1);
      failed.set(id, { attempts: attempt, retryAt: clock() + delay });
      onError(error);
      if (attempt < 3) later(() => { if (!destroyed && failed.get(id)?.attempts === attempt) requestPublication(); }, delay);
    });
  };
  return {
    setExposure(opacity: number) { if (opacity === exposure) return; exposure = opacity; for (const scene of loaded.values()) scene.setExposure?.(opacity); },
    publish(publication: VolumeCameraPublication) {
      if (destroyed) return;
      latest = publication;
      const coast = coasting(), state = selection.publish(publication, clock(), coast, new Set(loaded.keys()));
      residents = new Set(state.residentIds);
      requested = new Set(state.requestedIds ?? [state.requestedId]);
      if (!coast) {
        const wanted = new Set(state.residentIds);
        for (const [id, scene] of loaded) if (!wanted.has(id) && scene.root.parentNode === host) scene.root.remove();
        for (const id of state.residentIds) { const scene = loaded.get(id)!; if (scene.root.parentNode !== host) host.insertBefore(scene.root, before); }
      }
      if (!coast) request(state.requestedId);
      // Weights normalized from the rear give the same source-over mix in any stacking order, so retained roots never
      // move: re-inserting a resident sky re-uploads every face texture and stalls the GPU for over 100 ms.
      const stacked = state.weights ? [...host.children].flatMap(node => {
        const id = (node as HTMLElement).dataset.galaxyStation;
        return id !== undefined && state.residentIds.includes(id) ? [id] : [];
      }) : [];
      let cumulative = 0;
      for (const id of [...stacked, ...state.residentIds.filter(id => !stacked.includes(id))]) {
        const scene = loaded.get(id)!;
        scene.publish(publication);
        const weight = state.weights?.[id];
        if (weight !== undefined) cumulative += weight;
        const opacity = String(weight === undefined ? id === state.frontId ? state.frontOpacity : 1 : cumulative > 0 ? weight / cumulative : 0);
        writeStyle(scene.root, 'opacity', opacity);
      }
      if (!state.weights && state.frontId && state.frontOpacity < 1) requestPublication();
      trim(state.requestedId);
    },
    stats() { return { loaded: loaded.size, pending: pending.size, failed: [...failed.keys()],
      failures: [...failed].map(([id, failure]) => ({ id, attempts: failure.attempts, terminal: failure.attempts >= 3, retryAt: failure.retryAt })),
      loadedIds: [...loaded.keys()], pendingIds: [...pending],
      resident: [...loaded].filter(([, scene]) => scene.root.parentNode === host).map(([id]) => id), hasPublication: latest !== null }; },
    destroy() { destroyed = true; for (const scene of loaded.values()) scene.destroy(); loaded.clear(); },
  };
}

export interface GalaxyStationBackgroundOptions {
  readonly interpolation?: PreparedGalaxyStations['interpolation'];
  readonly stations: readonly GalaxyStationLocation[];
  readonly replacesBanks: readonly string[];
  readonly farFadeStartM: number; readonly farFullDistanceM: number;
  readonly farImageOpacity?: number;
  readonly insideSkyFade?: { readonly centerM: readonly [number, number, number]; readonly startM: number; readonly endM: number };
  readonly autoExposure?: import('@cssearth/objects').PreparedGalaxyStations['autoExposure'];
  readonly hysteresisM: number; readonly fadeMs: number;
  load(id: string, document: Document): Promise<PreparedGalaxyStationScene>;
}
