import type { SharedView } from '../navigation/view-url.js';
import type { SurfaceFeatureNavigationRuntime } from '../labels/surface-feature-types.js';
import type { PreparedDestinationRuntime } from './object-runtime-types.js';
import type { ObjectWorldNavigation } from './world-navigation-types.js';
import type { DatasetVolume } from './object-contract.js';
import type { PreparedSurfacePanoramas } from '../panorama/types.js';
import type { SurfacePanoramaView } from '../panorama/panorama-view.js';

export interface ObjectSharedView {
  capture(motionRequested?: boolean): SharedView | null;
  restore(view: SharedView): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}
/** Prepared dataset choices, published only after the scene is ready. */
export interface ObjectDatasets {
  readonly ids: readonly string[];
  readonly defaultId: string;
  /** Every companion cloud this body's datasets can ask for, so a caller can turn the others off. */
  readonly volumes: readonly DatasetVolume[];
  /** The cloud this dataset asks for, if it asks for one. */
  volumeOf(id: string): DatasetVolume | null;
  current(): string | null;
  select(id: string, options?: { signal?: AbortSignal }): Promise<boolean>;
  subscribe(listener: (id: string) => void): () => void;
}
/** A body's surface panoramas: opening one covers the stage with its look-around view until it closes. */
export interface ObjectPanoramas {
  readonly plan: PreparedSurfacePanoramas;
  current(): string | null;
  /** Mount it in `host` (the stage by default): the shell's viewport, so it covers the world and takes the input.
   * `onZoomOut` runs when the reader zooms out past its widest view. */
  open(id: string, host?: HTMLElement, onZoomOut?: () => void): SurfacePanoramaView | null;
  close(): void;
}
export interface ObjectSceneLifecycle {
  readonly ready: Promise<void>;
  readonly sharedView: ObjectSharedView;
  readonly destinations?: PreparedDestinationRuntime;
  /** Prepared named surface features: catalogue and selection, when the object declares them. */
  readonly features?: SurfaceFeatureNavigationRuntime;
  readonly panoramas?: ObjectPanoramas;
  readonly navigation?: ObjectWorldNavigation;
  readonly datasets?: ObjectDatasets;
  pause(): void;
  resume(): void;
  /** Whether pulsating stars play their light curves; separate from pause and resume, which govern illustrative rotation. */
  setLightCurves?(allowed: boolean): void;
  /** Replacement transfers the retained controls to the incoming scene; failure restores native fallback state. */
  destroy(options?: { preserveControls?: boolean }): void;
}
