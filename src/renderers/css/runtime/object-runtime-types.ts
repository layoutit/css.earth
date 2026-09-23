import type { ObjectControls, ObjectSelection, LensVolume } from "./object-contract.js";
import type { SceneLifetime } from "@cssearth/engine";
import type { CameraPlan } from "../navigation/types.js";
import type { OrbitPublication, OrbitStateUpdate, RetainedCubicSkyOrbit } from "../navigation/object-orbit.js";
import type { RuntimePolicy } from "../navigation/runtime-policy.js";
import type { PreparedAssets } from "../rendering/prepared-residency.js";
import type { PreparedPresentationDefinition } from "../rendering/prepared-presentation.js";
import type { CubicSkyPlan } from "../solar-system/cubic-sky-plan.js";
import type { DirectionalSunPlan } from "../solar-system/directional-sun-coordinate.js";
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedResourceLease } from './prepared-resource-lease.js';
import type { PerspectiveWorldContext } from '../navigation/perspective-dolly.js';
import type { PreparedSurfaceHit } from '../navigation/prepared-surface-hit.js';
import type { PreparedSurfaceFeaturePlan, SurfaceFeatureLayerRuntime, SurfaceFeatureNavigationRuntime } from '../labels/surface-feature-types.js';
export type { SurfaceFeatureNavigationRuntime };
import type { SurfaceFeatureMountOptions } from '../labels/surface-feature-labels.js';
import type { PreparedAssetOrigin } from '../rendering/prepared-asset-origin.js';
export type { PreparedAssetOrigin };

export interface ObjectRuntimeDefinition extends PreparedPresentationDefinition {
  readonly schema: string; readonly id: string; readonly controls: ObjectControls;
  readonly camera: CameraPlan; readonly assets: PreparedAssets; readonly sky: CubicSkyPlan;
  readonly sun?: DirectionalSunPlan | null;
  readonly destinations?: unknown;
  readonly surfaceHit?: PreparedSurfaceHit;
  readonly features?: PreparedSurfaceFeaturePlan;
  /** Set only when the build published this object's textures and scene JSON to an
   * asset origin (`ASSET_ORIGIN`); unset reproduces today's same-origin `/scenes/` behavior. */
  readonly assetOrigin?: PreparedAssetOrigin;
}
export interface ObjectRuntimeView extends OrbitPublication { readonly reference: OrbitPublication; readonly previous: OrbitPublication | null; readonly revision: number; }
export interface PreparedDestination {
  readonly camera: Parameters<RetainedCubicSkyOrbit['flyToState']>[0];
  readonly coverage: string;
}
export interface PreparedDestinationRuntime {
  readonly lensId: string;
  select(place: PreparedDestination, options?: { signal?: AbortSignal }): Promise<{
    status: string; arrival: Promise<{ completed: boolean }>;
  }>;
  reset(options?: { signal?: AbortSignal }): Promise<{ completed: boolean }>;
}
export interface ObjectRuntimeCapabilities {
  createDestinations?(options: { plan: unknown; ready: Promise<void>; lifetime: SceneLifetime;
    navigate(camera: PreparedDestination['camera'], options?: { signal?: AbortSignal }): ReturnType<RetainedCubicSkyOrbit["flyToState"]>;
    reset(options?: { signal?: AbortSignal }): ReturnType<RetainedCubicSkyOrbit["flyToState"]>;
  }): PreparedDestinationRuntime;
  /** Prepared nomenclature labels anchored to the body mesh; the catalogue is fetched and byte-verified by the layer. */
  mountSurfaceFeatures?(options: SurfaceFeatureMountOptions): SurfaceFeatureLayerRuntime;
}
export interface ObjectMountOptions {
  onError(error: unknown): void; onMotionRequest?(requested: boolean): void;
  onFeatureSelect?(id: string): void;
  /** The application owns the world companions required by a body dataset. */
  datasetEffects?: {
    prepare(volume: LensVolume | null, signal: AbortSignal): void | Promise<void>;
    commit(volume: LensVolume | null): void;
    error(error: unknown): void;
  };
  inputSurface: HTMLElement; runtimePolicy: RuntimePolicy;
  diagnostics?: boolean; capabilities?: ObjectRuntimeCapabilities;
  preparedResources?: PreparedResourceLease;
  preparedTree?: import('../rendering/prepared-tree.js').PreparedTreeLease;
  worldContext: PerspectiveWorldContext;
  framePresenter: import('../navigation/world-frame-presenter.js').WorldFramePresenter;
  viewport: import('../navigation/camera-viewport.js').CameraViewport;
  initialWorldCamera?: WorldCameraPose;
  /** The router releases refinement after saved-view restoration or flight. */
  deferTextureRefinement?: boolean;
  /** The camera can accept the live application pose before surface activation completes. */
  onNavigationReady?(navigation: import('./world-navigation-types.js').ObjectWorldNavigation): void;
  /** Caller keeps the destination coarse until ready; direct/restored views stay atomic. */
  progressiveActivation?: boolean;
  /** The camera is still flying to this object; its catalogue loads wait for the flight's end (setNavigationInFlight). */
  arrivingByFlight?: boolean;
  initialProjection?: import('../prepared-data/physical-projection.js').PhysicalProjection;
}
export interface PreparedNavigation { maximumZoom: number; camera?: OrbitStateUpdate; }
export type SelectionSnapshot = ObjectSelection;
