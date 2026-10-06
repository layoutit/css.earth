import { type DatasetVolume } from '@cssearth/objects';

import type { SharedView } from '../navigation/camera/view-url.js';
import type { SurfaceFeatureNavigationRuntime } from '../labels/surface-feature-types.js';
import type { PreparedDestinationRuntime } from './object-runtime-types.js';
import type { ObjectWorldNavigation } from './world-navigation-types.js';

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
  /** Hears when a chosen dataset starts or stops being prepared: true from the choice until it is drawn. */
  subscribeLoading(listener: (loading: boolean) => void): () => void;
}
export interface ObjectSceneLifecycle {
  readonly ready: Promise<void>;
  readonly sharedView: ObjectSharedView;
  readonly destinations?: PreparedDestinationRuntime;
  /** Prepared named surface features: catalogue and selection, when the object declares them. */
  readonly features?: SurfaceFeatureNavigationRuntime;
  readonly navigation?: ObjectWorldNavigation;
  readonly datasets?: ObjectDatasets;
  pause(): void;
  resume(): void;
  /** Whether pulsating stars play their light curves; separate from pause and resume, which govern illustrative rotation. */
  setLightCurves?(allowed: boolean): void;
  /** Replacement transfers the retained controls to the incoming scene; failure restores native fallback state. */
  destroy(options?: { preserveControls?: boolean }): void;
}
