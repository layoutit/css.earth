import type { SharedView } from '../navigation/view-url.js';
import type { SurfaceFeatureNavigationRuntime } from '../labels/surface-feature-types.js';
import type { PreparedDestinationRuntime } from './object-runtime-types.js';
import type { ObjectWorldNavigation } from './world-navigation-types.js';
import type { LensVolume } from './object-contract.js';

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
  readonly volumes: readonly LensVolume[];
  /** The cloud this dataset asks for, if it asks for one. */
  volumeOf(id: string): LensVolume | null;
  current(): string | null;
  select(id: string, options?: { signal?: AbortSignal }): Promise<boolean>;
  subscribe(listener: (id: string) => void): () => void;
}
export interface ObjectSceneLifecycle {
  readonly ready: Promise<void>;
  readonly sharedView: ObjectSharedView;
  readonly destinations?: PreparedDestinationRuntime;
  /** Prepared named surface features: catalogue and selection, when the object declares them. */
  readonly features?: SurfaceFeatureNavigationRuntime;
  readonly navigation?: ObjectWorldNavigation;
  readonly datasets?: ObjectDatasets;
  refineTextures?(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
