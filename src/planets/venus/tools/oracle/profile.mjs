export const GOOGLE_MAPS_VENUS_URL =
  "https://www.google.com/maps/space/venus/";

export const ORACLE_VIEWPORT = Object.freeze({
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
});

// The crop excludes Google Maps' collapsed-panel tab, top-right account chrome,
// compass/zoom controls and their transient tooltips, logo, scale, and
// attribution strip. cssEarth uses the identical crop after its shell has been
// hidden by the capture harness.
export const ORACLE_SCENE_CLIP = Object.freeze({
  x: 24,
  y: 64,
  width: 960,
  height: 608,
});

export const ORACLE_SCENE_CENTER = Object.freeze({
  x: ORACLE_VIEWPORT.width / 2 - ORACLE_SCENE_CLIP.x,
  y: ORACLE_VIEWPORT.height / 2 - ORACLE_SCENE_CLIP.y,
});

export const ORACLE_STABILITY = Object.freeze({
  actionSettleMilliseconds: 700,
  intervalMilliseconds: 500,
  maximumAttempts: 30,
  maximumChangedPixelRatio: 0.0005,
  pixelmatchThreshold: 0.1,
  requiredStableComparisons: 2,
});

export const ORACLE_LENS = "clouds";

export const ORACLE_DEFAULT_BROWSER_CAMERA = Object.freeze({
  controlPitch: 34.23076923076923,
  controlYaw: 0,
  zoom: 1.1,
});

export const ORACLE_BROWSER_ZOOM_BOUNDS = Object.freeze({
  minimum: 0.42,
  maximum: 4,
});

export const ORACLE_CAMERA_TOLERANCE = 0.005;

// Measured from the valid 1,246-endpoint Google sweep with explicit 0 degree
// tilt and heading. Google and cssEarth use different longitudinal zeroes.
// This is a coordinate registration, not a per-frame visual adjustment.
export const ORACLE_EXPLICIT_CAMERA_REGISTRATION = Object.freeze({
  tiltDegrees: 0,
  headingDegrees: 0,
  longitudePhaseDegrees: -87,
  qualification: "SOURCE_MEASURED_EXPLICIT_GOOGLE_CAMERA_SWEEP",
});

export const ORACLE_CAMERA_MODEL = Object.freeze({
  google: "canonical-url-plus-settled-control-sequence",
  browser: "full-matrix3d-pitch-yaw-zoom",
  mapping:
    "settled-google-geodetic-delta-plus-explicit-heading-registration-with-prepared-zoom-bounds",
  browserCoordinates: Object.freeze([
    "controlPitch",
    "controlYaw",
    "zoom",
  ]),
});

export const ORACLE_COMPONENT_WEIGHTS = Object.freeze({
  starfield: 0.5,
  sun: 0.5,
});

const ENDPOINT_CONTRACT = Object.freeze({
  maximumSunCentroidDeltaPixels: 20,
});

function action(id, count = 1) {
  return Object.freeze({ id, count });
}

function pose(id, label, googleActions) {
  return Object.freeze({
    id,
    label,
    googleActions: Object.freeze(googleActions),
    endpointContract: ENDPOINT_CONTRACT,
    mappingQualification: "SOURCE_DERIVED_SETTLED_GOOGLE_URL",
  });
}

export const ORACLE_POSES = Object.freeze([
  pose("default", "Default", []),
  ...Array.from({ length: 6 }, (_, index) => pose(
    `orbit-right-${index + 1}`,
    `Orbit right ${index + 1}`,
    [action("pan-right", index + 1)],
  )),
  pose("orbit-right-3-up", "Orbit right 3, latitude up", [
    action("pan-right", 3),
    action("pan-up"),
  ]),
  pose("orbit-right-3-down", "Orbit right 3, latitude down", [
    action("pan-right", 3),
    action("pan-down"),
  ]),
  pose("orbit-right-1-zoom-in", "Orbit right 1, zoom in", [
    action("pan-right"),
    action("zoom-in"),
  ]),
  pose("orbit-right-1-zoom-in-2", "Orbit right 1, zoom in twice", [
    action("pan-right"),
    action("zoom-in", 2),
  ]),
]);

export const ORACLE_QUALIFICATION = Object.freeze({
  visualBehavior: "GOOGLE_MAPS_PRESENTATION_REFERENCE",
  sourceParity: "INVALID",
  scientificLightingFidelity: "UNPROVEN",
  reason:
    "Google Maps' loaded Venus imagery and renderer inputs are not byte-bound " +
    "to cssEarth's prepared source closure, and the reference does not expose " +
    "an ephemeris-bound Sun and observer model.",
});

export function parseGoogleCameraUrl(value) {
  const url = new URL(value);
  if (url.origin !== "https://www.google.com" ||
      url.pathname.split("/").slice(0, 4).join("/") !== "/maps/space/venus") {
    throw new TypeError(`Not a Google Maps Venus URL: ${value}`);
  }
  const camera = url.pathname.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)([am])(?:,(\d+(?:\.\d+)?)y)?(?:,(\d+(?:\.\d+)?)h)?/u,
  );
  if (!camera) {
    return Object.freeze({
      latitude: null,
      longitude: null,
      range: null,
      rangeUnit: null,
      tilt: null,
      heading: null,
    });
  }
  return Object.freeze({
    latitude: Number(camera[1]),
    longitude: Number(camera[2]),
    range: Number(camera[3]),
    rangeUnit: camera[4],
    tilt: camera[5] === undefined ? null : Number(camera[5]),
    heading: camera[6] === undefined ? null : Number(camera[6]),
  });
}

export function deriveBrowserCamera(referenceCamera, defaultReferenceCamera) {
  let cameraMode = null;
  for (const [label, camera] of [
    ["reference", referenceCamera],
    ["default reference", defaultReferenceCamera],
  ]) {
    const nextMode = camera?.tilt === null && camera?.heading === null
      ? "implicit"
      : camera?.tilt === ORACLE_EXPLICIT_CAMERA_REGISTRATION.tiltDegrees &&
          camera?.heading === ORACLE_EXPLICIT_CAMERA_REGISTRATION.headingDegrees
        ? "explicit-flat"
        : null;
    if (!Number.isFinite(camera?.latitude) ||
        !Number.isFinite(camera?.longitude) ||
        !Number.isFinite(camera?.range) || camera.rangeUnit !== "m" ||
        nextMode === null || (cameraMode !== null && nextMode !== cameraMode)) {
      throw new TypeError(
        `${label} camera is not a flat metric Google Venus endpoint.`,
      );
    }
    cameraMode = nextMode;
  }
  const latitudeDelta = referenceCamera.latitude - defaultReferenceCamera.latitude;
  const longitudeDelta = shortestAngleDelta(
    referenceCamera.longitude,
    defaultReferenceCamera.longitude,
  );
  const longitudePhase = cameraMode === "explicit-flat"
    ? ORACLE_EXPLICIT_CAMERA_REGISTRATION.longitudePhaseDegrees
    : 0;
  return Object.freeze({
    controlPitch: ORACLE_DEFAULT_BROWSER_CAMERA.controlPitch - latitudeDelta,
    controlYaw:
      ORACLE_DEFAULT_BROWSER_CAMERA.controlYaw + longitudeDelta + longitudePhase,
    zoom: Math.max(
      ORACLE_BROWSER_ZOOM_BOUNDS.minimum,
      Math.min(
        ORACLE_BROWSER_ZOOM_BOUNDS.maximum,
        ORACLE_DEFAULT_BROWSER_CAMERA.zoom *
          defaultReferenceCamera.range / referenceCamera.range,
      ),
    ),
  });
}

export function intersectsSceneClip(box) {
  if (!box) return false;
  return box.x < ORACLE_SCENE_CLIP.x + ORACLE_SCENE_CLIP.width &&
    box.x + box.width > ORACLE_SCENE_CLIP.x &&
    box.y < ORACLE_SCENE_CLIP.y + ORACLE_SCENE_CLIP.height &&
    box.y + box.height > ORACLE_SCENE_CLIP.y;
}

function shortestAngleDelta(value, origin) {
  return ((value - origin + 540) % 360) - 180;
}
