import type { PreparedPresentationDefinition, PreparedSurfaceHit, PreparedSurfaceFeaturePlan } from '../presentation/runtime-presentation-types.js';
import type { ObjectControls } from './object-controls.js';
import type { PerspectiveCameraPlan, CubicSkyPlan, DirectionalSunPlan } from '../camera/runtime-camera-types.js';
import type { PreparedAssets, PreparedAssetOrigin } from './runtime-resource-types.js';
export interface ObjectRuntimeDefinition extends PreparedPresentationDefinition {
  readonly schema: string; readonly id: string; readonly controls: ObjectControls;
  readonly camera: PerspectiveCameraPlan; readonly assets: PreparedAssets; readonly sky: CubicSkyPlan;
  readonly sun?: DirectionalSunPlan | null;
  readonly destinations?: unknown;
  readonly surfaceHit?: PreparedSurfaceHit;
  readonly features?: PreparedSurfaceFeaturePlan;
  /** Set only when the build published this object's textures and scene JSON to an
   * asset origin (`ASSET_ORIGIN`); unset reproduces today's same-origin `/scenes/` behavior. */
  readonly assetOrigin?: PreparedAssetOrigin;
}
