export interface OrbitGuidePresentation { baseOpacity: number; hoverOpacity: number; }
export interface OrbitGuideBody { id: string; displayOrbitRadius: number; inclinationDeg: number; nodeDeg: number; }
export interface OrbitGuideHitTestSettings { thresholdPixels: number; touchTapMaxDurationMilliseconds: number; touchTapMaxMovementPixels: number; }
export interface PreparedOrbitGuides {
  schema: string; planetId: string; model: string; source: string;
  guideCount: number; retainedLeafCount: number; runtimeGeometryPreparation: boolean;
  runtimeJavaScriptWritesPerFrame: number; animationCount: number;
  presentation: OrbitGuidePresentation;
  guides: readonly (OrbitGuideBody & { orbitRadius: number; planeTransform: string; leaf: { tag: string; style: string } })[];
  asset: { url: string; url2x: string; width: number; height: number; width2x: number; height2x: number;
    referenceRadius: number; transparentPaddingPixels: number; browserImageType: string;
    runtimePathGeneration: boolean; bytes: number; bytes2x: number; sha256: string; sha256_2x: string;
    selectedDensityImageCount: number };
  hitTest: OrbitGuideHitTestSettings & { model: string; projectedOrbitModel: string; screenDistanceModel: string;
    projectionRefreshEvents: readonly string[]; layoutRefreshEvents: readonly string[];
    orbitTestsPerCallback: number; pointSamplesPerOrbit: number; animationTimeReadsPerCallback: number;
    trigonometricCallsPerCallback: number; layoutReadsPerHoverCallback: number;
    layoutReadsPerCameraInteractionEnd: number; runtimeIdleCallbacks: number; runtimeTemporaryObjectsPerOrbit: number };
}

const PLANET_ID = /^[a-z][a-z0-9-]*$/u;
const BODY_ID = /^[a-z][a-z0-9-]*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const ASSET_NAME = /^[a-z][a-z0-9@._-]*\.svg$/u;

export const PREPARED_ORBIT_GUIDE_SCHEMA =
  "cssearth-prepared-orbit-guides@1";

export function validatePreparedOrbitGuides<T extends PreparedOrbitGuides>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.schema !== PREPARED_ORBIT_GUIDE_SCHEMA ||
      !PLANET_ID.test(value.planetId ?? "") ||
      value.model !== "one-prepared-vector-circle-leaf-per-orbit-guide" ||
      typeof value.source !== "string" || value.source.trim().length === 0 ||
      !Array.isArray(value.guides) || value.guides.length === 0 ||
      value.guideCount !== value.guides.length ||
      value.retainedLeafCount !== value.guides.length ||
      value.runtimeGeometryPreparation !== false ||
      value.runtimeJavaScriptWritesPerFrame !== 0 ||
      value.animationCount !== 0 ||
      !validPresentation(value.presentation)) {
    throw new TypeError("Prepared orbit-guide plan is incompatible.");
  }
  const ids = new Set<string>();
  for (const guide of value.guides) {
    if (!guide || typeof guide !== "object" ||
        !BODY_ID.test(guide.id ?? "") || ids.has(guide.id) ||
        !positive(guide.displayOrbitRadius) ||
        !positive(guide.orbitRadius) ||
        !finite(guide.inclinationDeg) ||
        !finite(guide.nodeDeg) ||
        typeof guide.planeTransform !== "string" ||
        guide.leaf?.tag !== "s" ||
        typeof guide.leaf.style !== "string") {
      throw new TypeError("Prepared orbit guide is incompatible.");
    }
    ids.add(guide.id);
  }
  const prefix = `/scenes/${value.planetId}/`;
  if (!value.asset || !validAssetUrl(value.asset.url, prefix) ||
      !validAssetUrl(value.asset.url2x, prefix) ||
      value.asset.url === value.asset.url2x ||
      !positive(value.asset.referenceRadius) ||
      !Number.isSafeInteger(value.asset.width) || value.asset.width <= 2 ||
      value.asset.height !== value.asset.width ||
      value.asset.width2x !== value.asset.width ||
      value.asset.height2x !== value.asset.height ||
      !Number.isSafeInteger(value.asset.bytes) || value.asset.bytes <= 0 ||
      !Number.isSafeInteger(value.asset.bytes2x) || value.asset.bytes2x <= 0 ||
      !SHA256.test(value.asset.sha256 ?? "") ||
      !SHA256.test(value.asset.sha256_2x ?? "") ||
      value.asset.browserImageType !== "image/svg+xml" ||
      value.asset.runtimePathGeneration !== false ||
      value.asset.selectedDensityImageCount !== 1) {
    throw new TypeError("Prepared orbit-guide asset is incompatible.");
  }
  if (!value.hitTest || !positive(value.hitTest.thresholdPixels) ||
      value.hitTest.model !==
        "event-driven-preprojected-static-conic-nearest-orbit" ||
      value.hitTest.projectedOrbitModel !==
        "static-circle-homography-to-screen-conic" ||
      value.hitTest.screenDistanceModel !==
        "implicit-conic-gradient-pixel-distance" ||
      !positive(value.hitTest.touchTapMaxDurationMilliseconds) ||
      !positive(value.hitTest.touchTapMaxMovementPixels) ||
      value.hitTest.orbitTestsPerCallback !== value.guides.length ||
      value.hitTest.pointSamplesPerOrbit !== 0 ||
      value.hitTest.animationTimeReadsPerCallback !== 0 ||
      value.hitTest.trigonometricCallsPerCallback !== 0 ||
      value.hitTest.layoutReadsPerHoverCallback !== 0 ||
      value.hitTest.layoutReadsPerCameraInteractionEnd !== 0 ||
      value.hitTest.runtimeIdleCallbacks !== 0 ||
      value.hitTest.runtimeTemporaryObjectsPerOrbit !== 0 ||
      !sameStrings(value.hitTest.projectionRefreshEvents, [
        "initial-mount",
        "camera-interaction-end",
        "programmatic-camera-state",
        "resize",
      ]) ||
      !sameStrings(value.hitTest.layoutRefreshEvents, [
        "initial-mount",
        "resize",
      ])) {
    throw new TypeError("Prepared orbit-guide hit-test plan is incompatible.");
  }
  return value;
}

function validAssetUrl(value: unknown, prefix: string) {
  return typeof value === "string" && value.startsWith(prefix) &&
    ASSET_NAME.test(value.slice(prefix.length));
}

function validPresentation(value: OrbitGuidePresentation | undefined) {
  return value && finite(value.baseOpacity) && finite(value.hoverOpacity) &&
    value.baseOpacity >= 0 && value.baseOpacity <= 1 &&
    value.hoverOpacity >= value.baseOpacity && value.hoverOpacity <= 1;
}

function sameStrings(actual: readonly string[], expected: readonly string[]) {
  return Array.isArray(actual) && actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
