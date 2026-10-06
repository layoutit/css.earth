import type { ParsedSurfaceFeatureCatalog as PreparedSurfaceFeatureCatalog } from '@cssearth/objects';
import type { LabelScreenRect } from './screen-label-layout.js';

export interface SurfaceFeatureLayerStats {
  readonly loaded: boolean; readonly count: number; readonly visible: number; readonly eligible: number; readonly hovered: string | null; readonly pinned: string | null;
  readonly enabled: boolean; readonly playing: boolean; readonly frames: number; readonly error: string | null;
  readonly zoomGate: boolean; readonly outlinePieces: number; readonly flying: boolean;
}
/** The shell-facing surface: the loaded catalogue and selection by feature id (pin, caption, outline, flight). */
export interface SurfaceFeatureNavigationRuntime {
  readonly datasetIds: readonly string[];
  catalog(): PreparedSurfaceFeatureCatalog | null;
  loaded(): Promise<PreparedSurfaceFeatureCatalog>;
  select(id: string, options?: { signal?: AbortSignal }): Promise<{ completed: boolean }>;
  selected(): string | null;
  clear(): void;
  /** A flight into this body is under way (true) or has ended (false). A flight that ends with the body on screen has
   * landed; one another navigation replaced has not, and drops the loads it held. */
  setNavigationInFlight?(active: boolean, landed?: boolean): void;
}
export interface SurfaceFeatureLayerRuntime extends SurfaceFeatureNavigationRuntime {
  readonly root: HTMLElement;
  publish(view: Pick<import('../rendering/prepared-view.js').PreparedView, 'projection' | 'levelOfDetail' | 'zoom'>): void;
  setDataset(selection: { readonly id: string | null }): void;
  setPlaying(value: boolean): void;
  stats(): SurfaceFeatureLayerStats;
  inspect(): { readonly labels: Readonly<Record<string, HTMLElement>>; readonly tooltip: HTMLElement; readonly outline: readonly HTMLElement[]; readonly rects: ReadonlyMap<string, LabelScreenRect> };
  destroy(): void;
}
