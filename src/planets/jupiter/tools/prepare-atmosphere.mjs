import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_JUPITER_CAMERA } from "../runtime/preparedCamera.mjs";

export const JUPITER_MATERIAL_PRESENTATION_SIZE = 512;
export const JUPITER_MATERIAL_PIXEL_DENSITY = 1;
export const JUPITER_MATERIAL_SIZE =
  JUPITER_MATERIAL_PRESENTATION_SIZE * JUPITER_MATERIAL_PIXEL_DENSITY;
export const JUPITER_MATERIAL_SURFACE_RADIUS = 238;
export const JUPITER_MATERIAL_OUTER_RADIUS = JUPITER_MATERIAL_SURFACE_RADIUS;
export const JUPITER_MATERIAL_RASTER_SURFACE_RADIUS =
  JUPITER_MATERIAL_SURFACE_RADIUS * JUPITER_MATERIAL_PIXEL_DENSITY;
export const JUPITER_MATERIAL_RASTER_OUTER_RADIUS =
  JUPITER_MATERIAL_RASTER_SURFACE_RADIUS;
export const JUPITER_MATERIAL_PRESENTATION_SCALE = 1.002;
export const JUPITER_MATERIAL_CONTENT_SCALE = 0.992;
export const JUPITER_LIGHTING_REFERENCE_CHANNEL = 160;
export const JUPITER_OPENSPACE_AMBIENT_INTENSITY = 0.05;
export const JUPITER_OPENSPACE_TERMINATOR_SMOOTHSTEP = Object.freeze([0, 0.1]);
export const JUPITER_DISPLAY_TRANSFER = "sRGB IEC 61966-2-1";
const DEFAULT_SCENE_PITCH_DEGREES =
  PREPARED_JUPITER_CAMERA.initialScenePitchDegrees;
const JUPITER_EQUATORIAL_RADIUS =
  PREPARED_JUPITER_SCENE.geometry.equatorialRadius;
const JUPITER_POLAR_RADIUS = PREPARED_JUPITER_SCENE.geometry.polarRadius;
const JUPITER_SYSTEM_ROTATION_X_DEGREES =
  PREPARED_JUPITER_SCENE.materialProjection.cssSystemRotationXDegrees;
const HUBBLE_REFERENCE_PATH = fileURLToPath(new URL(
  "../source/presentation/navigation-marker.png",
  import.meta.url,
));
const MINNAERT_SOURCE_PATH =
  "source/atmosphere/hubble-opal-minnaert.json";
const minnaertSource = JSON.parse(await readFile(new URL(
  "../source/atmosphere/hubble-opal-minnaert.json",
  import.meta.url,
), "utf8"));
assertMinnaertSource(minnaertSource);
export const JUPITER_HUBBLE_MINNAERT_MODEL = Object.freeze({
  source: "Simon, Wong, and Orton 2015 Hubble OPAL Jupiter photometry",
  sourcePath: MINNAERT_SOURCE_PATH,
  sourceDoi: minnaertSource.source.doi,
  law: minnaertSource.photometricLaw.name,
  channels: Object.freeze([
    minnaertChannel("red"),
    minnaertChannel("green"),
    minnaertChannel("blue"),
  ]),
  mapComposite: "red=F631N, green=F502N, blue=F395N",
  runtimePhotometry: false,
});
const RED_MINNAERT_K = JUPITER_HUBBLE_MINNAERT_MODEL.channels[0].minnaertK;
const GREEN_MINNAERT_K = JUPITER_HUBBLE_MINNAERT_MODEL.channels[1].minnaertK;
const BLUE_MINNAERT_K = JUPITER_HUBBLE_MINNAERT_MODEL.channels[2].minnaertK;
const psgConfiguration = await readFile(new URL(
  "../source/atmosphere/psg-jupiter-20260830.cfg",
  import.meta.url,
), "utf8");
const solarLongitudeDegrees = psgNumber("OBJECT-SOLAR-LONGITUDE");
const solarLatitudeDegrees = psgNumber("OBJECT-SOLAR-LATITUDE");
const observerLongitudeDegrees = psgNumber("OBJECT-OBS-LONGITUDE");
const observerLatitudeDegrees = psgNumber("OBJECT-OBS-LATITUDE");
const sun = sphericalDirection(solarLongitudeDegrees, solarLatitudeDegrees);
const observer = sphericalDirection(
  observerLongitudeDegrees,
  observerLatitudeDegrees,
);
const observerLongitudeRadians = observerLongitudeDegrees * Math.PI / 180;
const observerLatitudeRadians = observerLatitudeDegrees * Math.PI / 180;
const screenRight = Object.freeze([
  -Math.sin(observerLongitudeRadians),
  Math.cos(observerLongitudeRadians),
  0,
]);
const screenDown = Object.freeze([
  Math.sin(observerLatitudeRadians) * Math.cos(observerLongitudeRadians),
  Math.sin(observerLatitudeRadians) * Math.sin(observerLongitudeRadians),
  -Math.cos(observerLatitudeRadians),
]);
export const JUPITER_OBSERVATION_LIGHT_DIRECTION = Object.freeze(normalize([
  dot(sun, screenRight),
  dot(sun, screenDown),
  dot(sun, observer),
]).map((component) => Number(component.toFixed(6))));
export const JUPITER_WORLD_LIGHT_DIRECTION = Object.freeze([
  0.883835,
  -0.385595,
  0.264864,
]);
const normalizedPresentationLight = normalize(JUPITER_WORLD_LIGHT_DIRECTION);
export const JUPITER_LIGHT_SOURCE_GEOMETRY = Object.freeze({
  source: "NASA PSG pinned Jupiter configuration",
  sourcePath: "source/atmosphere/psg-jupiter-20260830.cfg",
  solarLongitudeDegrees,
  solarLatitudeDegrees,
  observerLongitudeDegrees,
  observerLatitudeDegrees,
  phaseAngleDegrees: Number((
    Math.acos(Math.max(-1, Math.min(1, dot(sun, observer)))) * 180 / Math.PI
  ).toFixed(6)),
  observationLightDirection: JUPITER_OBSERVATION_LIGHT_DIRECTION,
  presentation: Object.freeze({
    authority: "OpenSpace default scene-graph Sun direction",
    qualityReference: "Saturn",
    referencePath: "src/planets/saturn/runtime/preparedRingPoints.mjs",
    sourceRenderer:
      "OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl",
    worldLightDirection: JUPITER_WORLD_LIGHT_DIRECTION,
    cameraAngleDegrees: Number((
      Math.acos(Math.max(-1, Math.min(1, normalizedPresentationLight[2]))) *
        180 / Math.PI
    ).toFixed(6)),
    screenshotDerived: false,
    runtimeEphemeris: false,
  }),
  defaultScenePitchDegrees: DEFAULT_SCENE_PITCH_DEGREES,
  poleFrame: "north-up-aligned",
  runtimeEphemeris: false,
});

export function prepareJupiterMaterialFrame(
  pitchDegrees,
  { shadowless = false } = {},
) {
  const size = JUPITER_MATERIAL_SIZE;
  const center = size / 2;
  const data = Buffer.alloc(size * size * 4);
  const light = shadowless
    ? Object.freeze([0, 0, 1])
    : cameraLightDirection(pitchDegrees);
  const projection = prepareJupiterMaterialProjection(pitchDegrees);
  for (let y = 0; y < size; y += 1) {
    const localY = y + 0.5 - center;
    for (let x = 0; x < size; x += 1) {
      const localX = x + 0.5 - center;
      const radius = Math.hypot(localX, localY);
      const directionX = radius === 0 ? 1 : localX / radius;
      const directionY = radius === 0 ? 0 : localY / radius;
      const surfaceBoundary = ellipseBoundary(
        projection.rasterCoverageRadiusX,
        projection.rasterCoverageRadiusY,
        directionX,
        directionY,
      );
      if (radius > surfaceBoundary + 0.5) continue;
      const normal = projectedSurfaceNormal(
        localX,
        localY,
        projection,
      );
      const incidence = Math.max(
        0,
        normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2],
      );
      const offset = (y * size + x) * 4;
      writeJupiterPhotometricOverlay(
        data,
        offset,
        incidence,
        Math.max(0, normal[2]),
        edgeCoverage(surfaceBoundary - radius),
      );
    }
  }
  return Object.freeze({
    data,
    width: size,
    height: size,
    pitchDegrees,
    cameraLightDirection: light.map((component) =>
      Number(component.toFixed(6))),
    projection,
  });
}

export function prepareJupiterMaterialProjection(pitchDegrees) {
  const rotationXDegrees = pitchDegrees + JUPITER_SYSTEM_ROTATION_X_DEGREES;
  const radians = rotationXDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const radiusX = JUPITER_EQUATORIAL_RADIUS;
  const radiusY = Math.hypot(
    JUPITER_EQUATORIAL_RADIUS * cosine,
    JUPITER_POLAR_RADIUS * sine,
  );
  const rasterRadiusX = JUPITER_MATERIAL_RASTER_SURFACE_RADIUS;
  const rasterRadiusY = rasterRadiusX * radiusY / radiusX;
  return Object.freeze({
    model: "prepared-oblate-ellipsoid-camera-projection",
    pitchDegrees,
    rotationXDegrees: Number(rotationXDegrees.toFixed(6)),
    radiusX: Number(radiusX.toFixed(6)),
    radiusY: Number(radiusY.toFixed(6)),
    rasterRadiusX,
    rasterRadiusY: Number(rasterRadiusY.toFixed(6)),
    rasterCoverageRadiusX: Number((
      rasterRadiusX * JUPITER_MATERIAL_PRESENTATION_SCALE
    ).toFixed(6)),
    rasterCoverageRadiusY: Number((
      rasterRadiusY * JUPITER_MATERIAL_PRESENTATION_SCALE
    ).toFixed(6)),
    presentationScale: JUPITER_MATERIAL_PRESENTATION_SCALE,
    materialScale: JUPITER_MATERIAL_CONTENT_SCALE,
    right: Object.freeze([1, 0, 0]),
    down: Object.freeze([
      0,
      Number(cosine.toFixed(12)),
      Number((-sine).toFixed(12)),
    ]),
    view: Object.freeze([
      0,
      Number(sine.toFixed(12)),
      Number(cosine.toFixed(12)),
    ]),
    runtime: false,
  });
}

export async function measurePublishedJupiterAtmosphereReference() {
  const { data, info } = await sharp(HUBBLE_REFERENCE_PATH)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const thresholdRgb8 = 4;
  const component = floodDiscComponent(data, info, thresholdRgb8);
  const centerX = (component.minimumX + component.maximumX) / 2;
  const centerY = (component.minimumY + component.maximumY) / 2;
  const radiusX = (component.maximumX - component.minimumX + 1) / 2;
  const radiusY = (component.maximumY - component.minimumY + 1) / 2;
  const exteriorAnnulus = Object.freeze([1.005, 1.03]);
  let exteriorSampleCount = 0;
  let exteriorMaximumRgb8 = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const normalizedRadius = Math.hypot(
        (x + 0.5 - centerX) / radiusX,
        (y + 0.5 - centerY) / radiusY,
      );
      if (normalizedRadius < exteriorAnnulus[0] ||
          normalizedRadius >= exteriorAnnulus[1]) continue;
      exteriorSampleCount += 1;
      exteriorMaximumRgb8 = Math.max(
        exteriorMaximumRgb8,
        maximumRgb8(data, info, x, y),
      );
    }
  }
  if (exteriorMaximumRgb8 !== 0) {
    throw new Error(
      "NASA Hubble Jupiter reference no longer supports a halo-free limb.",
    );
  }
  return Object.freeze({
    source: "NASA, ESA, STScI, and Amy Simon Hubble 5 January 2024 full disc",
    sourcePath: "source/presentation/navigation-marker.png",
    sourceSize: Object.freeze([info.width, info.height]),
    sourceColorSpace: JUPITER_DISPLAY_TRANSFER,
    discDetection: Object.freeze({
      thresholdRgb8,
      bounds: Object.freeze([
        component.minimumX,
        component.minimumY,
        component.maximumX - component.minimumX + 1,
        component.maximumY - component.minimumY + 1,
      ]),
      connectedPixelCount: component.pixelCount,
    }),
    exteriorAnnulus,
    exteriorSampleCount,
    exteriorMaximumRgb8,
    publishedExteriorHalo: false,
  });
}

export function applyJupiterLinearLight(channel, factor) {
  const srgb = channel / 255;
  const linear = srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
  const lit = Math.max(0, Math.min(1, linear * factor));
  const encoded = lit <= 0.0031308
    ? lit * 12.92
    : 1.055 * Math.pow(lit, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}

function writeJupiterPhotometricOverlay(
  data,
  offset,
  incidence,
  emission,
  coverage,
) {
  const terminator = prepareOpenSpaceTerminator(incidence);
  const resolvedEmission = Math.max(
    emission,
    0.5 / JUPITER_MATERIAL_RASTER_SURFACE_RADIUS,
  );
  const desiredRed = preparedMinnaertChannel(
    incidence,
    resolvedEmission,
    terminator,
    RED_MINNAERT_K,
  );
  const desiredGreen = preparedMinnaertChannel(
    incidence,
    resolvedEmission,
    terminator,
    GREEN_MINNAERT_K,
  );
  const desiredBlue = preparedMinnaertChannel(
    incidence,
    resolvedEmission,
    terminator,
    BLUE_MINNAERT_K,
  );
  const alpha = Math.max(0, Math.min(
    1,
    1 - Math.min(desiredRed, desiredGreen, desiredBlue) /
      JUPITER_LIGHTING_REFERENCE_CHANNEL,
  ));
  if (alpha === 0 || coverage === 0) return;
  const retainedBase = JUPITER_LIGHTING_REFERENCE_CHANNEL * (1 - alpha);
  data[offset] = sourceOverChannel(desiredRed, retainedBase, alpha);
  data[offset + 1] = sourceOverChannel(desiredGreen, retainedBase, alpha);
  data[offset + 2] = sourceOverChannel(desiredBlue, retainedBase, alpha);
  data[offset + 3] = Math.round(alpha * coverage * 255);
}

function preparedMinnaertChannel(incidence, emission, terminator, minnaertK) {
  const direct = Math.min(
    1,
    Math.pow(incidence, minnaertK) *
      Math.pow(emission, minnaertK - 1) * terminator,
  );
  const factor = Math.max(0, Math.min(
    1,
    (JUPITER_OPENSPACE_AMBIENT_INTENSITY + direct) /
      (1 + JUPITER_OPENSPACE_AMBIENT_INTENSITY),
  ));
  return applyJupiterLinearLight(JUPITER_LIGHTING_REFERENCE_CHANNEL, factor);
}

function sourceOverChannel(desired, retainedBase, alpha) {
  return Math.max(0, Math.min(
    255,
    Math.round((desired - retainedBase) / alpha),
  ));
}

function prepareOpenSpaceTerminator(lambert) {
  const [edge0, edge1] = JUPITER_OPENSPACE_TERMINATOR_SMOOTHSTEP;
  const amount = Math.max(0, Math.min(1, (lambert - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function minnaertChannel(channel) {
  const record = minnaertSource.mapComposite[channel];
  return Object.freeze({
    channel,
    filter: record.filter,
    wavelengthNanometers: record.wavelengthNanometers,
    minnaertK: record.minnaertK,
  });
}

function assertMinnaertSource(source) {
  if (source?.schema !== "cssjupiter-hubble-opal-minnaert@1" ||
      source?.source?.doi !== "10.1088/0004-637X/812/1/55" ||
      source?.photometricLaw?.name !== "Minnaert") {
    throw new Error("Invalid checked Hubble OPAL Jupiter photometry source.");
  }
  const expected = Object.freeze([
    ["red", "F631N", 631, 0.999],
    ["green", "F502N", 502, 0.95],
    ["blue", "F395N", 395, 0.85],
  ]);
  for (const [channel, filter, wavelengthNanometers, minnaertK] of expected) {
    const record = source.mapComposite?.[channel];
    if (record?.filter !== filter ||
        record?.wavelengthNanometers !== wavelengthNanometers ||
        record?.minnaertK !== minnaertK) {
      throw new Error(
        `Invalid Hubble OPAL Jupiter ${channel} Minnaert source value.`,
      );
    }
  }
}

function floodDiscComponent(data, info, thresholdRgb8) {
  const startX = Math.floor(info.width / 2);
  const startY = Math.floor(info.height / 2);
  const visited = new Uint8Array(info.width * info.height);
  const queue = new Int32Array(info.width * info.height);
  let head = 0;
  let tail = 0;
  const start = startY * info.width + startX;
  queue[tail] = start;
  tail += 1;
  visited[start] = 1;
  let minimumX = info.width;
  let maximumX = 0;
  let minimumY = info.height;
  let maximumY = 0;
  let pixelCount = 0;
  while (head < tail) {
    const position = queue[head];
    head += 1;
    const y = Math.floor(position / info.width);
    const x = position - y * info.width;
    if (maximumRgb8(data, info, x, y) < thresholdRgb8) continue;
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
    pixelCount += 1;
    enqueueDiscNeighbor(x - 1, y);
    enqueueDiscNeighbor(x + 1, y);
    enqueueDiscNeighbor(x, y - 1);
    enqueueDiscNeighbor(x, y + 1);
  }
  if (pixelCount === 0) {
    throw new Error("NASA Hubble Jupiter reference disc was not found.");
  }
  return Object.freeze({ minimumX, maximumX, minimumY, maximumY, pixelCount });

  function enqueueDiscNeighbor(x, y) {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) return;
    const position = y * info.width + x;
    if (visited[position]) return;
    visited[position] = 1;
    queue[tail] = position;
    tail += 1;
  }
}

function maximumRgb8(data, info, x, y) {
  const offset = (y * info.width + x) * info.channels;
  return Math.max(data[offset], data[offset + 1], data[offset + 2]);
}

function projectedSurfaceNormal(localX, localY, projection) {
  const rasterToScene = JUPITER_EQUATORIAL_RADIUS /
    JUPITER_MATERIAL_RASTER_SURFACE_RADIUS;
  let screenX = localX * rasterToScene / JUPITER_MATERIAL_CONTENT_SCALE;
  let screenY = localY * rasterToScene / JUPITER_MATERIAL_CONTENT_SCALE;
  const screenRadius = Math.hypot(screenX, screenY);
  const directionX = screenRadius === 0 ? 1 : screenX / screenRadius;
  const directionY = screenRadius === 0 ? 0 : screenY / screenRadius;
  const materialBoundary = ellipseBoundary(
    projection.radiusX,
    projection.radiusY,
    directionX,
    directionY,
  );
  if (screenRadius >= materialBoundary) {
    const clampScale = materialBoundary * (1 - 1e-9) / screenRadius;
    screenX *= clampScale;
    screenY *= clampScale;
  }
  const origin = [0, 1, 2].map((axis) =>
    projection.right[axis] * screenX + projection.down[axis] * screenY);
  const inverseEquatorialSquared = 1 / JUPITER_EQUATORIAL_RADIUS ** 2;
  const inversePolarSquared = 1 / JUPITER_POLAR_RADIUS ** 2;
  const axisWeight = (axis) => axis === 2
    ? inversePolarSquared
    : inverseEquatorialSquared;
  const a = projection.view.reduce((sum, component, axis) =>
    sum + component * component * axisWeight(axis), 0);
  const b = 2 * projection.view.reduce((sum, component, axis) =>
    sum + origin[axis] * component * axisWeight(axis), 0);
  const c = origin.reduce((sum, component, axis) =>
    sum + component * component * axisWeight(axis), -1);
  const discriminant = Math.max(0, b * b - 4 * a * c);
  const depth = (-b + Math.sqrt(discriminant)) / (2 * a);
  const hit = origin.map((component, axis) =>
    component + projection.view[axis] * depth);
  const objectNormal = normalize(hit.map((component, axis) =>
    component * axisWeight(axis)));
  return normalize([
    dot(objectNormal, projection.right),
    dot(objectNormal, projection.down),
    dot(objectNormal, projection.view),
  ]);
}

function ellipseBoundary(radiusX, radiusY, directionX, directionY) {
  return 1 / Math.hypot(directionX / radiusX, directionY / radiusY);
}

function cameraLightDirection(pitchDegrees) {
  const radians = (
    pitchDegrees - DEFAULT_SCENE_PITCH_DEGREES
  ) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const [x, y, z] = JUPITER_WORLD_LIGHT_DIRECTION;
  return normalize([x, y * cosine - z * sine, y * sine + z * cosine]);
}

function psgNumber(name) {
  const match = psgConfiguration.match(new RegExp(
    `^<${name}>([-+0-9.eE]+)$`,
    "mu",
  ));
  const value = Number(match?.[1]);
  if (!Number.isFinite(value)) {
    throw new Error(`NASA PSG Jupiter field is missing: ${name}.`);
  }
  return value;
}

function sphericalDirection(longitudeDegrees, latitudeDegrees) {
  const longitude = longitudeDegrees * Math.PI / 180;
  const latitude = latitudeDegrees * Math.PI / 180;
  return Object.freeze([
    Math.cos(latitude) * Math.cos(longitude),
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
  ]);
}

function dot(left, right) {
  return left.reduce((sum, component, index) =>
    sum + component * right[index], 0);
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

function edgeCoverage(distance) {
  return Math.max(0, Math.min(1, distance + 0.5));
}
