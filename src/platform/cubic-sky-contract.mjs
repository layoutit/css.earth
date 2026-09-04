export const PREPARED_CUBIC_SKY_SCHEMA = "cssearth-prepared-cubic-sky@2";
export const PREPARED_CUBIC_SKY_SUN_SCHEMA =
  "cssearth-prepared-sun-cubemap-bake@1";

export const CUBIC_SKY_CAMERA_PRESENTATION_STANDARD = Object.freeze({
  source: "cssEarth Mars-calibrated cubic-sky camera presentation",
  sourcePath: "src/platform/cubic-sky-contract.mjs",
  rotationResponse: -1,
  zoomResponse: 0,
  horizontalFovDegrees: 60,
  focalLengthOverViewportWidth: Math.sqrt(3) / 2,
  qualification:
    "Shared visual presentation derived from the accepted Mars contract; " +
    "no per-object native camera or ephemeris parity is claimed.",
});

export const CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD = Object.freeze({
  source: "cssEarth Mars-calibrated compact point-source presentation",
  sourcePath: "src/platform/cubic-sky-contract.mjs",
  drawCount: 5_000,
  nativePointSizePixels: 4.5,
  logicalPointFootprintPixels: 1,
  backgroundDiffuseGain: 0.68,
  backgroundDetailGain: 0.4,
});

export const CUBIC_SKY_FACE_IDS = Object.freeze([
  "front",
  "right",
  "back",
  "left",
  "top",
  "bottom",
]);

export const CUBIC_SKY_STANDARD = Object.freeze({
  schema: "cssearth-cubic-sky-standard@2",
  faceSize: 1024,
  sourceMapSize: Object.freeze([6000, 3000]),
  photographicLevels: Object.freeze({
    blackPoint: 8,
    gamma: 1.2,
    gain: 0.6,
  }),
  photographicSeparation: Object.freeze({
    model: "wrapped-gaussian-diffuse-plus-photographic-detail",
    sourceSigmaPixels: 9,
    diffuseGain: 0.85,
    detailGain: 0.65,
  }),
  standardPresentation: Object.freeze({
    model: "prepared-luminance-compression-and-desaturation",
    saturation: 0.42,
    luminanceGamma: 1.1,
    gain: 0.7,
  }),
  photographicRegistrationRotationDegrees: Object.freeze({
    x: -35.5,
    y: 158.5,
    z: -123,
  }),
  cameraPitchResponse: -1.7,
  cameraZoomResponse: 0.12,
  presentationPitchOffsetDegrees: -20,
  presentationYawOffsetDegrees: 66,
  defaultControlYawDegrees: -105,
  sun: Object.freeze({
    logicalSize: 128,
    presentationSize: Object.freeze([214, 214]),
    presentationAlphaGain: 0.12,
    presentationCoreGain: 1.55,
    canonicalFocalPixels: 86.60254 / 100 * 720,
    sourceMedianRadius: 3,
    sourceBlackPoint: 55,
    sourceLevelGamma: 1.2,
  }),
});

const SUN_REFERENCE_VIEW_DIRECTION = Object.freeze(normalize([
  -0.6255297744936478,
  -0.13687068726694163,
  -0.7681008502722811,
]));

export function createCubicSkySunPresentation({
  defaultControlYawDegrees = CUBIC_SKY_STANDARD.defaultControlYawDegrees,
  initialScenePitchDegrees = 40,
} = {}) {
  const initialViewDirection = Object.freeze(rotateY(
    SUN_REFERENCE_VIEW_DIRECTION,
    -defaultControlYawDegrees,
  ));
  const localDirection = Object.freeze(rotateZ(
    rotateX(
      SUN_REFERENCE_VIEW_DIRECTION,
      -(
        initialScenePitchDegrees +
        CUBIC_SKY_STANDARD.presentationPitchOffsetDegrees
      ),
    ),
    -CUBIC_SKY_STANDARD.presentationYawOffsetDegrees,
  ));
  return Object.freeze({
    localDirection,
    initialViewDirection,
    initialSkyDirection: initialViewDirection,
  });
}

export function projectDirectionToCubemapFace([x, y, z]) {
  const maximum = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  if (maximum === Math.abs(z)) {
    return z < 0
      ? Object.freeze({ face: "front", u: x / -z, v: y / -z })
      : Object.freeze({ face: "back", u: -x / z, v: y / z });
  }
  if (maximum === Math.abs(x)) {
    return x > 0
      ? Object.freeze({ face: "right", u: z / x, v: y / x })
      : Object.freeze({ face: "left", u: -z / -x, v: y / -x });
  }
  return y < 0
    ? Object.freeze({ face: "top", u: x / -y, v: -z / -y })
    : Object.freeze({ face: "bottom", u: x / y, v: z / y });
}

export function validatePreparedCubicSky(plan, { requireSun = true } = {}) {
  const faceIds = plan?.faces?.map(({ id }) => id);
  const sun = plan?.sun;
  if (plan?.schema !== PREPARED_CUBIC_SKY_SCHEMA ||
      plan.standard !== CUBIC_SKY_STANDARD.schema ||
      plan.runtimeRasterization !== false ||
      plan.orientation !== "camera-rotation-only-no-translation-or-parallax" ||
      JSON.stringify(faceIds) !== JSON.stringify(CUBIC_SKY_FACE_IDS) ||
      plan.faces.some(({
        url,
        url2x,
        highContrastUrl,
        highContrastUrl2x,
      }) => [url, url2x, highContrastUrl, highContrastUrl2x]
        .some((value) => typeof value !== "string")) ||
      !Number.isFinite(plan.cameraPitchResponse) ||
      !Number.isFinite(plan.cameraZoomResponse) ||
      !Number.isFinite(plan.presentationPitchOffsetDegrees) ||
      !Number.isFinite(plan.presentationYawOffsetDegrees) ||
      (plan.projection !== undefined && (
        plan.projection.axis !== "horizontal" ||
        !Number.isFinite(plan.projection.horizontalFovDegrees) ||
        !Number.isFinite(plan.projection.focalLengthOverViewportWidth) ||
        typeof plan.projection.cssPerspective !== "string" ||
        plan.projection.runtimeProjection !== false
      )) ||
      (requireSun && (
        sun?.schema !== PREPARED_CUBIC_SKY_SUN_SCHEMA ||
        sun.billboard !== false ||
        sun.bakedIntoStarfield !== true ||
        sun.runtimeRasterization !== false ||
        !unitDirection(sun.localDirection) ||
        !unitDirection(sun.initialViewDirection)
      ))) {
    throw new TypeError("Prepared retained cubic sky is incompatible.");
  }
  return plan;
}

function unitDirection(direction) {
  return Array.isArray(direction) && direction.length === 3 &&
    direction.every(Number.isFinite) &&
    Math.abs(Math.hypot(...direction) - 1) < 1e-9;
}

function rotateX([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function normalize(direction) {
  const length = Math.hypot(...direction);
  return direction.map((value) => value / length);
}
