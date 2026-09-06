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

export interface ObjectRuntimeDefinition extends PreparedPresentationDefinition {
  readonly schema: string; readonly id: string; readonly controls: ObjectControls;
  readonly camera: CameraPlan; readonly assets: PreparedAssets; readonly sky: CubicSkyPlan;
  readonly sun?: DirectionalSunPlan | null;
  readonly heliocentricView?: { plan: HeliocentricMountOptions["plan"]; bodyMarker: HeliocentricMountOptions["markerSprite"];
    systemMarkers?: HeliocentricMountOptions["systemMarkers"]; labels?: HeliocentricMountOptions["labels"] } | null;
  readonly destinations?: unknown;
}
export interface ObjectRuntimeView extends OrbitPublication { readonly reference: OrbitPublication; readonly previous: OrbitPublication | null; readonly revision: number; }
export interface PageLayerRuntime {
  setPlaying(value: boolean): void; setLens(selection: { id: string | null }): void; publish(view: ObjectRuntimeView): void; stats(): unknown;
}
export interface PreparedDestinationRuntime {
  load(signal?: AbortSignal): Promise<unknown>;
  select(place: unknown): Promise<unknown>;
  reset(): unknown;
}
export interface ObjectRuntimeCapabilities {
  mountPages?(options: NonNullable<ReturnType<typeof mountPreparedPresentation>["pageLayers"]>[number] & {
    stage: HTMLElement; scene: HTMLElement; camera: HTMLElement; own(cleanup: () => void): void; onError(error: unknown): void;
  }): PageLayerRuntime;
  createDestinations?(options: { plan: unknown; ready: Promise<void>; lifetime: SceneLifetime;
    selectLens(id: string): Promise<boolean>; navigate(camera: Parameters<RetainedCubicSkyOrbit["flyToState"]>[0]): ReturnType<RetainedCubicSkyOrbit["flyToState"]>;
    reset(): ReturnType<RetainedCubicSkyOrbit["flyToState"]> | undefined;
  }): PreparedDestinationRuntime;
  mountWorldContext?(options: { stage: HTMLElement; before: HTMLElement; skyElement: HTMLElement; worldContext: PerspectiveWorldContext; own(cleanup: () => void): void; onError(error: unknown): void }): WorldContextLayer;
}
export interface WorldContextLayer { publish(world: WorldCameraPose, viewport: WorldCameraViewport): void; destroy(): void; }
export interface ObjectMountOptions {
  onError(error: unknown): void; onMotionRequest?(requested: boolean): void;
  inputSurface: HTMLElement; runtimePolicy: RuntimePolicy; mobilePreviewElement?: HTMLElement | null;
  diagnostics?: boolean; capabilities?: ObjectRuntimeCapabilities;
  worldFrame?: PreparedWorldCameraFrame; preparedResources?: PreparedResourceLease;
  worldContext?: PerspectiveWorldContext;
  initialWorldCamera?: WorldCameraPose;
}
export interface PreparedNavigation { maximumZoom: number; camera?: OrbitStateUpdate; }
export type SelectionSnapshot = ObjectSelection;
