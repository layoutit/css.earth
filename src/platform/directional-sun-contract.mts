export interface DirectionalSunPresentation {
  schema: string; source: string; sourcePath: string; localDirection: readonly number[]; referenceViewDirection: readonly number[];
  appearance: {model: string; nativeBlend: readonly string[]; sourceOverApproximation: string;
    analyticRadialFit: {model: string; coreRadiusPixels: number; falloffScalePixels: number; falloffExponent: number; redProfileSumSquaredResidual: number; qualification: string}};
  projection: {focalX: number; horizontalFovDegrees: number; centerDistanceOverFar: number; halfExtentOverFar: number; halfExtentOverCenter: number;
    apparentViewportWidthShare: number; fixedAngularSize: boolean; runtimeGeometry: boolean};
  culling: {states: readonly string[]; rearCameraAndViewportAtPublication: boolean; planetOccultation: string}; qualification: string;
}
import type { Vector3 } from "../renderers/css/solar-system/types.ts";
export interface PreparedDirectionalSunPlan {
  schema: string; billboard: boolean; bakedIntoStarfield: boolean; runtimeRasterization: boolean;
  asset: { sourcePixels: string; url: string; width: number; height: number };
  localDirection: Vector3; referenceViewDirection: Vector3;
  appearance: { analyticRadialFit: { coreRadiusPixels: number } };
  projection: { focalX: number; apparentViewportWidthShare: number; centerDistanceOverFar: number; halfExtentOverCenter: number; halfExtentOverFar: number; fixedAngularSize: boolean; runtimeGeometry: boolean };
  distanceScaling: { schema: string; model: string; nominalSolarRadiusKilometers: number; astronomicalUnitKilometers: number; observerDistanceModel: string; meanHeliocentricDistanceAu: number; observerDistanceKilometers: number; angularDiameterDegrees: number; physicalDiskViewportWidthShare: number; spriteOpaqueCoreDiameterShare: number; googleEarthMarsSpriteViewportWidthShare: number; physicalToGoogleEarthMarsSpriteScale: number };
}
export const PREPARED_DIRECTIONAL_SUN_SCHEMA =
  "cssearth-prepared-directional-sun@4";

// CSS pixels of the Sun sprite, and the unit of its fitted radial profile (the
// native 128 by 128 texture). The prepared image has two texels per CSS pixel.
export const DIRECTIONAL_SUN_SPRITE_PIXELS = 128;

export const DIRECTIONAL_SUN_DISTANCE_STANDARD = Object.freeze({
  schema: "cssearth-directional-sun-distance-standard@2",
  model: "iau-nominal-photospheric-disc-at-mean-heliocentric-distance",
  nominalSolarRadiusKilometers: 695700,
  astronomicalUnitKilometers: 149597870.7,
  nominalSolarRadiusSource:
    "https://www.iau.org/common/Uploaded%20files/" +
    "IAUGA2015-Resolution-B3-recommended-nominal-conversion.pdf",
  astronomicalUnitSource:
    "https://www.iau.org/static/resolutions/IAU2012_English.pdf",
  observerDistanceModel: "object-catalog-mean-heliocentric-distance",
  qualification:
    "The opaque photospheric core is projected from the IAU nominal solar " +
    "radius and the object catalog's mean heliocentric distance. The retained " +
    "glow profile remains a visual presentation; the distance is not epoch-" +
    "specific.",
});

export const DIRECTIONAL_SUN_PRESENTATION_STANDARD = Object.freeze({
  schema: "cssearth-directional-sun-presentation-standard@1",
  source: "Google Earth Pro Mars native Sun contract-derived visual standard",
  sourcePath:
    "src/planets/mars/source/sky/google-earth-pro-contract.json",
  localDirection: Object.freeze([
    0.888810066045983,
    0.13368164386698683,
    0.43834448164469403,
  ]),
  referenceViewDirection: Object.freeze([
    -0.22665800735781816,
    0.13368726790267435,
    -0.964755856215085,
  ]),
  appearance: Object.freeze({
    model: "clean-room-native-radial-profile-fit",
    nativeBlend: Object.freeze(["SRC_ALPHA", "ONE"]),
    sourceOverApproximation:
      "alpha-encoded-additive-radiance-without-runtime-blend-mode",
    analyticRadialFit: Object.freeze({
      model: "opaque-core-generalized-exponential-falloff",
      coreRadiusPixels: 18.9,
      falloffScalePixels: 17.8,
      falloffExponent: 1.36,
      redProfileSumSquaredResidual: 0.0010404800442828858,
      qualification:
        "Least-squares fit to annular red-channel means from the bound " +
        "native 128 by 128 Sun texture; fitted values only, no source pixels.",
    }),
  }),
  projection: Object.freeze({
    focalX: 1.7320508201475806,
    horizontalFovDegrees: 59.999999639646695,
    centerDistanceOverFar: 0.9395660778622476,
    halfExtentOverFar: 0.056785294765488575,
    halfExtentOverCenter: 0.06043778729728664,
    apparentViewportWidthShare: 0.10468131905617035,
    fixedAngularSize: true,
    runtimeGeometry: false,
  }),
  culling: Object.freeze({
    states: Object.freeze([
      "behind-camera",
      "outside-viewport",
      "partially-visible",
      "fully-visible",
    ]),
    rearCameraAndViewportAtPublication: true,
    planetOccultation: "retained-paint-order-behind-opaque-body",
  }),
  qualification:
    "Mars-derived clean-room Sun appearance and camera-relative motion are " +
    "shared as a cssEarth presentation standard; no per-object native Sun " +
    "position or ephemeris is claimed.",
});

export function validateDirectionalSunPlan(input: unknown): PreparedDirectionalSunPlan {
  const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!record(input) || !record(input.asset) || !record(input.appearance) || !record(input.appearance.analyticRadialFit) ||
      !record(input.projection) || !record(input.distanceScaling) ||
      typeof input.appearance.analyticRadialFit.coreRadiusPixels !== "number" ||
      input.asset.width !== DIRECTIONAL_SUN_SPRITE_PIXELS * 2 || input.asset.height !== input.asset.width) throw new TypeError("Prepared directional Sun is incompatible.");
  // Candidate view only: every required value is checked by the shape and
  // dimensional invariants before this boundary returns the original plan.
  const plan = input as unknown as PreparedDirectionalSunPlan;
  const distance = plan?.distanceScaling;
  const expectedObserverDistance = distance?.meanHeliocentricDistanceAu *
    DIRECTIONAL_SUN_DISTANCE_STANDARD.astronomicalUnitKilometers;
  const expectedAngularRadius = Math.atan(
    DIRECTIONAL_SUN_DISTANCE_STANDARD.nominalSolarRadiusKilometers /
      expectedObserverDistance,
  );
  const expectedAngularDiameterDegrees = expectedAngularRadius * 2 *
    180 / Math.PI;
  const expectedPhysicalDiskShare = plan?.projection?.focalX *
    Math.tan(expectedAngularRadius);
  const expectedCoreDiameterShare =
    plan?.appearance?.analyticRadialFit?.coreRadiusPixels * 2 /
      DIRECTIONAL_SUN_SPRITE_PIXELS;
  const expectedSpriteShare = expectedPhysicalDiskShare /
    expectedCoreDiameterShare;
  const expectedHalfExtentOverCenter = expectedSpriteShare /
    plan?.projection?.focalX;
  const expectedHalfExtentOverFar = expectedHalfExtentOverCenter *
    plan?.projection?.centerDistanceOverFar;
  if (plan?.schema !== PREPARED_DIRECTIONAL_SUN_SCHEMA ||
      plan.billboard !== true || plan.bakedIntoStarfield !== false ||
      plan.runtimeRasterization !== false ||
      plan.asset?.sourcePixels !== "repository-authored-clean-room-raster" ||
      typeof plan.asset.url !== "string" ||
      !unitDirection(plan.localDirection) ||
      !unitDirection(plan.referenceViewDirection) ||
      !Number.isFinite(plan.projection?.focalX) ||
      !Number.isFinite(plan.projection?.apparentViewportWidthShare) ||
      !positiveFinite(plan.projection?.centerDistanceOverFar) ||
      !positiveFinite(plan.projection?.halfExtentOverCenter) ||
      !positiveFinite(plan.projection?.halfExtentOverFar) ||
      plan.projection?.fixedAngularSize !== true ||
      plan.projection?.runtimeGeometry !== false ||
      distance?.model !== DIRECTIONAL_SUN_DISTANCE_STANDARD.model ||
      distance?.schema !== DIRECTIONAL_SUN_DISTANCE_STANDARD.schema ||
      distance?.nominalSolarRadiusKilometers !==
        DIRECTIONAL_SUN_DISTANCE_STANDARD.nominalSolarRadiusKilometers ||
      distance?.astronomicalUnitKilometers !==
        DIRECTIONAL_SUN_DISTANCE_STANDARD.astronomicalUnitKilometers ||
      distance?.observerDistanceModel !==
        DIRECTIONAL_SUN_DISTANCE_STANDARD.observerDistanceModel ||
      !positiveFinite(distance?.meanHeliocentricDistanceAu) ||
      !positiveFinite(distance?.observerDistanceKilometers) ||
      !positiveFinite(distance?.angularDiameterDegrees) ||
      !positiveFinite(distance?.physicalDiskViewportWidthShare) ||
      !positiveFinite(distance?.spriteOpaqueCoreDiameterShare) ||
      !positiveFinite(distance?.googleEarthMarsSpriteViewportWidthShare) ||
      !positiveFinite(distance?.physicalToGoogleEarthMarsSpriteScale) ||
      !approximatelyEqual(distance.observerDistanceKilometers,
        expectedObserverDistance) ||
      !approximatelyEqual(distance.angularDiameterDegrees,
        expectedAngularDiameterDegrees) ||
      !approximatelyEqual(distance.physicalDiskViewportWidthShare,
        expectedPhysicalDiskShare) ||
      !approximatelyEqual(distance.spriteOpaqueCoreDiameterShare,
        expectedCoreDiameterShare) ||
      !approximatelyEqual(distance.physicalToGoogleEarthMarsSpriteScale,
        expectedSpriteShare /
          distance.googleEarthMarsSpriteViewportWidthShare) ||
      !approximatelyEqual(plan.projection.apparentViewportWidthShare,
        expectedSpriteShare) ||
      !approximatelyEqual(plan.projection.halfExtentOverCenter,
        expectedHalfExtentOverCenter) ||
      !approximatelyEqual(plan.projection.halfExtentOverFar,
        expectedHalfExtentOverFar)) {
    throw new TypeError("Prepared directional Sun is incompatible.");
  }
  return plan;
}

export function validateDirectionalSunPresentationStandard(standard: DirectionalSunPresentation) {
  if (standard?.schema !==
        DIRECTIONAL_SUN_PRESENTATION_STANDARD.schema ||
      typeof standard.source !== "string" ||
      typeof standard.sourcePath !== "string" ||
      !unitDirection(standard.localDirection) ||
      !unitDirection(standard.referenceViewDirection) ||
      standard.appearance?.analyticRadialFit?.model !==
        "opaque-core-generalized-exponential-falloff" ||
      [
        standard.appearance.analyticRadialFit.coreRadiusPixels,
        standard.appearance.analyticRadialFit.falloffScalePixels,
        standard.appearance.analyticRadialFit.falloffExponent,
        standard.projection?.focalX,
        standard.projection?.apparentViewportWidthShare,
      ].some((value) => !Number.isFinite(value) || value <= 0) ||
      standard.projection.fixedAngularSize !== true ||
      standard.projection.runtimeGeometry !== false) {
    throw new TypeError("Directional Sun presentation standard is invalid.");
  }
  return standard;
}

function unitDirection(direction: unknown): direction is Vector3 {
  return Array.isArray(direction) && direction.length === 3 &&
    direction.every(Number.isFinite) &&
    Math.abs(Math.hypot(...direction) - 1) < 1e-9;
}

function positiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function approximatelyEqual(left: number, right: number) {
  return Number.isFinite(left) && Number.isFinite(right) &&
    Math.abs(left - right) <= Number.EPSILON *
      Math.max(1, Math.abs(left), Math.abs(right)) * 8;
}
