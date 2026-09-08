import type { PreparedDestinationPlan, PreparedDestinationOptions, createPreparedDestinations } from '../paging/prepared-destinations.js';
import type { ObjectControls, ObjectSelection } from "./object-contract.js";
import type { SceneLifetime } from "@cssearth/engine";
import type { CameraPlan } from "../navigation/types.js";
import type { OrbitPublication, OrbitStateUpdate, RetainedCubicSkyOrbit } from "../navigation/object-orbit.js";
import type { RuntimePolicy } from "../navigation/runtime-policy.js";
import type { PreparedAssets } from "../rendering/prepared-residency.js";
import type { PreparedPresentationDefinition, mountPreparedPresentation } from "../rendering/prepared-presentation.js";
import type { CubicSkyPlan } from "../solar-system/cubic-sky-runtime.js";
import type { DirectionalSunPlan } from "../solar-system/directional-sun-runtime.js";
import type { HeliocentricMountOptions } from "../solar-system/heliocentric-view-runtime.js";
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedResourceLease } from './prepared-resource-lease.js';
import type { PerspectiveWorldContext } from '../navigation/perspective-dolly.js';
import type { PreparedSurfaceHit } from '../navigation/prepared-surface-hit.js';

export interface ObjectRuntimeDefinition extends PreparedPresentationDefinition {
  readonly schema: string; readonly id: string; readonly controls: ObjectControls;
  readonly camera: CameraPlan; readonly assets: PreparedAssets; readonly sky: CubicSkyPlan;
  readonly sun?: DirectionalSunPlan | null;
  readonly heliocentricView?: { plan: HeliocentricMountOptions["plan"]; bodyMarker: HeliocentricMountOptions["markerSprite"];
    systemMarkers?: HeliocentricMountOptions["systemMarkers"]; labels?: HeliocentricMountOptions["labels"] } | null;
  readonly destinations?: PreparedDestinationPlan;
  readonly surfaceHit?: PreparedSurfaceHit;
}
export interface ObjectRuntimeView extends OrbitPublication { readonly reference: OrbitPublication; readonly previous: OrbitPublication | null; readonly revision: number; }
export type PageLayerRuntime = ReturnType<typeof import('../paging/city-pages.js').mountPreparedMapPages>;
export type PreparedDestinationRuntime = ReturnType<typeof createPreparedDestinations> & {
  ready: Promise<void>; lens(): { id: string | null; ready: boolean }; selectLens(id: string): Promise<boolean>; subscribe(listener: () => void): () => void;
};
export interface ObjectRuntimeCapabilities {
  mountPages?(options: NonNullable<ReturnType<typeof mountPreparedPresentation>["pageLayers"]>[number] & {
    paintLayer: number;
    stage: HTMLElement; scene: HTMLElement; camera: HTMLElement; own(cleanup: () => void): void; onError(error: unknown): void;
    images?: import("../paging/api-image-transport.js").ApiImageScope; onStatus?(): void;
  }): PageLayerRuntime;
  createDestinations?(options: PreparedDestinationOptions): ReturnType<typeof createPreparedDestinations>;
  mountWorldContext?(options: { stage: HTMLElement; before: HTMLElement; skyElement: HTMLElement; worldContext: PerspectiveWorldContext; own(cleanup: () => void): void; onError(error: unknown): void }): WorldContextLayer;
}
export interface WorldContextLayer { publish(world: WorldCameraPose, viewport: WorldCameraViewport): void; destroy(): void; }
export interface ObjectMountOptions {
  onError(error: unknown): void; onMotionRequest?(requested: boolean): void;
  inputSurface: HTMLElement; runtimePolicy: RuntimePolicy; mobilePreviewElement?: HTMLElement | null;
  diagnostics?: boolean; capabilities?: ObjectRuntimeCapabilities;
  worldFrame?: PreparedWorldCameraFrame; preparedResources?: PreparedResourceLease;
  preparedTree?: import('../rendering/prepared-tree.js').PreparedTreeLease;
  worldContext?: PerspectiveWorldContext;
  /** The application owns the contextual universe layer for this mount. */
  externalWorldContext?: boolean;
  viewport?: import('../navigation/camera-viewport.js').CameraViewport;
  initialWorldCamera?: WorldCameraPose;
  /** The camera can accept the live application pose before surface activation completes. */
  onNavigationReady?(navigation: import('./world-navigation-types.js').ObjectWorldNavigation): void;
  /** Caller keeps the destination coarse until ready; direct/restored views stay atomic. */
  progressiveActivation?: boolean;
  initialProjection?: import('../rendering/physical-projection.js').PhysicalProjection;
}
export interface PreparedNavigation { maximumZoom: number; camera?: OrbitStateUpdate; }
export type SelectionSnapshot = ObjectSelection;
