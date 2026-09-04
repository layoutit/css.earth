import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  MARS_AXIAL_TILT_DEGREES,
  MARS_BODY_ROTATION_DEGREES,
  MARS_EQUATORIAL_RADIUS,
  MARS_EQUATORIAL_RADIUS_KM,
  MARS_POLAR_RADIUS,
  MARS_POLAR_RADIUS_KM,
} from "./body-geometry.mjs";

export const MARS_MATERIAL_PRESENTATION_SIZE = 512;
export const MARS_MATERIAL_DENSITIES = Object.freeze([1, 2]);
export const MARS_MATERIAL_SURFACE_RADIUS = 238;
export const MARS_MATERIAL_COVERAGE_SCALE = 1.002;
export const MARS_MATERIAL_CONTENT_SCALE = 0.992;
export const MARS_MATERIAL_SILHOUETTE_SUPERSAMPLING = 4;
export const MARS_LIGHTING_REFERENCE_CHANNEL = 160;
export const MARS_OPENSPACE_AMBIENT_INTENSITY = 0.05;
export const MARS_OPENSPACE_TERMINATOR_SMOOTHSTEP = Object.freeze([0, 0.1]);
export const MARS_DISPLAY_TRANSFER = "sRGB IEC 61966-2-1";

const DEFAULT_SCENE_PITCH_DEGREES = 18;
const HUBBLE_REFERENCE_PATH = fileURLToPath(new URL(
  "../source/presentation/navigation-marker.jpg",
  import.meta.url,
));
const psgConfiguration = await readFile(new URL(
  "../source/atmosphere/psg-mars-20260829.cfg",
  import.meta.url,
), "utf8");
const openSpaceAtmosphere = await readFile(new URL(
  "../source/openspace/atmosphere.asset",
  import.meta.url,
), "utf8");
const openSpaceConfiguration = openSpaceAtmosphere.replace(/--.*$/gmu, "");

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

export const MARS_WORLD_LIGHT_DIRECTION = Object.freeze(normalize([
  dot(sun, screenRight),
  dot(sun, screenDown),
  dot(sun, observer),
]).map((component) => Number(component.toFixed(6))));
export const MARS_LIGHT_SOURCE_GEOMETRY = Object.freeze({
  source: "NASA PSG pinned Mars configuration",
  sourcePath: "source/atmosphere/psg-mars-20260829.cfg",
  solarLongitudeDegrees,
  solarLatitudeDegrees,
  observerLongitudeDegrees,
  observerLatitudeDegrees,
  phaseAngleDegrees: Number((
    Math.acos(Math.max(-1, Math.min(1, dot(sun, observer)))) * 180 / Math.PI
  ).toFixed(6)),
  defaultScenePitchDegrees: DEFAULT_SCENE_PITCH_DEGREES,
  poleFrame: "north-up-aligned",
  runtimeEphemeris: false,
});

const atmospherePlanetRadiusKm = openSpaceNumber("PlanetRadius");
const atmosphereHeightKm = openSpaceDifference("AtmosphereHeight");
const rayleighScaleHeightKm = openSpaceNumber("H_R");
const mieScaleHeightKm = openSpaceNumber("H_M");
const mieAnisotropy = openSpaceNumber("G");
const groundRadianceEmission = openSpaceNumber("GroundRadianceEmission");
const rayleighWavelengthsNanometers = openSpaceVector(
  "Rayleigh",
  "Wavelengths",
);
const rayleighScatteringPerKm = openSpaceVector("Rayleigh", "Scattering");
const mieScatteringPerKm = openSpaceVector("Mie", "Scattering");
const mieExtinctionPerKm = openSpaceVector("Mie", "Extinction");

export const MARS_MATERIAL_OUTER_RADIUS = Number((
  MARS_MATERIAL_SURFACE_RADIUS *
    (atmospherePlanetRadiusKm + atmosphereHeightKm) /
    atmospherePlanetRadiusKm
).toFixed(6));
export const MARS_OPENSPACE_ATMOSPHERE = Object.freeze({
  source: "OpenSpace Mars RenderableAtmosphere",
  sourcePath: "source/openspace/atmosphere.asset",
  planetRadiusKm: atmospherePlanetRadiusKm,
  atmosphereHeightKm,
  atmosphereRadiusRatio: Number((
    (atmospherePlanetRadiusKm + atmosphereHeightKm) /
      atmospherePlanetRadiusKm
  ).toFixed(9)),
  rayleigh: Object.freeze({
    wavelengthsNanometers: rayleighWavelengthsNanometers,
    scatteringPerKm: rayleighScatteringPerKm,
    scaleHeightKm: rayleighScaleHeightKm,
  }),
  mie: Object.freeze({
    scatteringPerKm: mieScatteringPerKm,
    extinctionPerKm: mieExtinctionPerKm,
    scaleHeightKm: mieScaleHeightKm,
    anisotropy: mieAnisotropy,
  }),
  groundRadianceEmission,
  runtimeAtmosphereMath: false,
});

const atmosphereReference = await measurePublishedMarsAtmosphereReference();
export const MARS_PUBLISHED_ATMOSPHERE_REFERENCE = atmosphereReference;
export const MARS_ATMOSPHERE_COLOR = atmosphereReference.limbMeanRgb8;
export const MARS_SURFACE_REFERENCE_COLOR = atmosphereReference.interiorMeanRgb8;
const MARS_LIMB_MAXIMUM_ALPHA = atmosphereReference.limbChromaticDifference;
const MARS_LIMB_EXPONENT = atmosphereHeightKm / rayleighScaleHeightKm;

export function prepareMarsMaterialFrame(
  pitchDegrees,
  pixelDensity,
  { lightDirection = null, preparedProjection = null } = {},
) {
  if (!MARS_MATERIAL_DENSITIES.includes(pixelDensity)) {
    throw new RangeError(`Unsupported prepared Mars density: ${pixelDensity}.`);
  }
  const size = MARS_MATERIAL_PRESENTATION_SIZE * pixelDensity;
  const materialProjection = preparedProjection ??
    prepareMarsMaterialProjection(pitchDegrees, pixelDensity);
  const projection = materialProjection.projection;
  if (projection.metadata?.pitchDegrees !== pitchDegrees ||
      materialProjection.screenNormals?.length !== size * size * 3 ||
      materialProjection.viewAlignments?.length !== size * size ||
      materialProjection.fillsMissingSurface?.length !== size * size) {
    throw new TypeError("Prepared Mars material projection is incompatible.");
  }
  const data = Buffer.alloc(size * size * 4);
  const light = lightDirection === null
    ? cameraLightDirection(pitchDegrees)
    : validateLightDirection(lightDirection);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pixelIndex = y * size + x;
      const coverageAlpha = projection.coverage[pixelIndex] / 255;
      if (coverageAlpha <= 0) continue;
      const normalOffset = pixelIndex * 3;
      const incidence = Math.max(0,
        materialProjection.screenNormals[normalOffset] * light[0] +
        materialProjection.screenNormals[normalOffset + 1] * light[1] +
        materialProjection.screenNormals[normalOffset + 2] * light[2],
      );
      const terminator = prepareOpenSpaceTerminator(incidence);
      const lightingFactor = (
        MARS_OPENSPACE_AMBIENT_INTENSITY + incidence * terminator
      ) / (1 + MARS_OPENSPACE_AMBIENT_INTENSITY);
      const desiredChannel = applyMarsLinearLight(
        MARS_LIGHTING_REFERENCE_CHANNEL,
        lightingFactor,
      );
      const shadowAlpha =
        1 - desiredChannel / MARS_LIGHTING_REFERENCE_CHANNEL;
      const viewAlignment = materialProjection.viewAlignments[pixelIndex];
      const limb = Math.pow(1 - viewAlignment, MARS_LIMB_EXPONENT);
      const sunwardAmount = groundRadianceEmission +
        (1 - groundRadianceEmission) * Math.sqrt(incidence);
      const atmosphereAlpha = MARS_LIMB_MAXIMUM_ALPHA * limb * sunwardAmount;
      const offset = pixelIndex * 4;
      if (materialProjection.fillsMissingSurface[pixelIndex] === 1) {
        writePreparedOpaqueLimbFill(data, offset, {
          atmosphereAlpha,
          coverageAlpha,
          lightingFactor,
        });
      } else {
        writePreparedOverlay(data, offset, {
          atmosphereAlpha,
          shadowAlpha,
        });
        data[offset + 3] = Math.round(data[offset + 3] * coverageAlpha);
      }
    }
  }
  return Object.freeze({
    data,
    width: size,
    height: size,
    pixelDensity,
    pitchDegrees,
    cameraLightDirection: light.map((component) =>
      Number(component.toFixed(6))),
    projection: projection.metadata,
    silhouetteCoverage: projection.coverage,
  });
}

export function prepareMarsMaterialProjection(pitchDegrees, pixelDensity) {
  if (!MARS_MATERIAL_DENSITIES.includes(pixelDensity)) {
    throw new RangeError(`Unsupported prepared Mars density: ${pixelDensity}.`);
  }
  const size = MARS_MATERIAL_PRESENTATION_SIZE * pixelDensity;
  const center = size / 2;
  const rasterPixelsPerBodyUnit = MARS_MATERIAL_SURFACE_RADIUS * pixelDensity /
    MARS_EQUATORIAL_RADIUS;
  const projection = prepareMarsProjectedSilhouette(pitchDegrees, pixelDensity);
  const screenNormals = new Float32Array(size * size * 3);
  const viewAlignments = new Float32Array(size * size);
  const fillsMissingSurface = new Uint8Array(size * size);
  const materialScale = 1 / MARS_MATERIAL_CONTENT_SCALE;
  for (let y = 0; y < size; y += 1) {
    const localY = y + 0.5 - center;
    for (let x = 0; x < size; x += 1) {
      const pixelIndex = y * size + x;
      if (projection.coverage[pixelIndex] === 0) continue;
      const localX = x + 0.5 - center;
      const screenX = localX / rasterPixelsPerBodyUnit;
      const screenY = localY / rasterPixelsPerBodyUnit;
      const coverageHit = intersectMarsViewRay(projection, screenX, screenY);
      if (!coverageHit) continue;
      let hit = intersectMarsViewRay(
        projection,
        screenX * materialScale,
        screenY * materialScale,
      );
      const fills = hit === null;
      if (fills) {
        let lowerScale = 1;
        let upperScale = materialScale;
        hit = coverageHit;
        for (let step = 0; step < 12; step += 1) {
          const sampleScale = (lowerScale + upperScale) / 2;
          const candidate = intersectMarsViewRay(
            projection,
            screenX * sampleScale,
            screenY * sampleScale,
          );
          if (candidate) {
            lowerScale = sampleScale;
            hit = candidate;
          } else {
            upperScale = sampleScale;
          }
        }
      }
      const screenNormal = marsObjectToScreenDirection(
        hit.normal,
        pitchDegrees,
      );
      const normalOffset = pixelIndex * 3;
      screenNormals[normalOffset] = screenNormal[0];
      screenNormals[normalOffset + 1] = screenNormal[1];
      screenNormals[normalOffset + 2] = screenNormal[2];
      viewAlignments[pixelIndex] = Math.max(
        0,
        dot(hit.normal, projection.view),
      );
      fillsMissingSurface[pixelIndex] = fills ? 1 : 0;
    }
  }
  return Object.freeze({
    projection,
    screenNormals,
    viewAlignments,
    fillsMissingSurface,
  });
}

function validateLightDirection(direction) {
  if (!Array.isArray(direction) || direction.length !== 3 ||
      direction.some((component) => !Number.isFinite(component)) ||
      Math.hypot(...direction) < 1e-9) {
    throw new TypeError("Prepared Mars light direction is invalid.");
  }
  return normalize(direction);
}

export function prepareMarsProjectedSilhouette(pitchDegrees, pixelDensity) {
  if (!MARS_MATERIAL_DENSITIES.includes(pixelDensity)) {
    throw new RangeError(`Unsupported prepared Mars density: ${pixelDensity}.`);
  }
  const size = MARS_MATERIAL_PRESENTATION_SIZE * pixelDensity;
  const center = size / 2;
  const rasterPixelsPerBodyUnit = MARS_MATERIAL_SURFACE_RADIUS * pixelDensity /
    MARS_EQUATORIAL_RADIUS;
  const right = screenToMarsObjectDirection([1, 0, 0], pitchDegrees);
  const down = screenToMarsObjectDirection([0, 1, 0], pitchDegrees);
  const view = screenToMarsObjectDirection([0, 0, 1], pitchDegrees);
  const projectedRadius = (direction) => Math.sqrt(
    MARS_EQUATORIAL_RADIUS ** 2 *
      (direction[0] ** 2 + direction[1] ** 2) +
    MARS_POLAR_RADIUS ** 2 * direction[2] ** 2
  );
  const radiusX = projectedRadius(right);
  const radiusY = projectedRadius(down);
  const coverage = prepareAnalyticEllipsoidCoverage(
    right,
    down,
    size,
    rasterPixelsPerBodyUnit,
    MARS_MATERIAL_SILHOUETTE_SUPERSAMPLING,
  );
  return Object.freeze({
    right,
    down,
    view,
    coverage,
    metadata: Object.freeze({
      model: "prepared-oblate-ellipsoid-camera-projection",
      pitchDegrees,
      radiusX: Number(radiusX.toFixed(6)),
      radiusY: Number(radiusY.toFixed(6)),
      presentationScale: MARS_MATERIAL_COVERAGE_SCALE,
      materialScale: MARS_MATERIAL_CONTENT_SCALE,
      planeMarginPixels: Number((
        MARS_MATERIAL_SURFACE_RADIUS *
          (MARS_MATERIAL_COVERAGE_SCALE - 1)
      ).toFixed(6)),
      right: Object.freeze(right.map((value) => Number(value.toFixed(9)))),
      down: Object.freeze(down.map((value) => Number(value.toFixed(9)))),
      view: Object.freeze(view.map((value) => Number(value.toFixed(9)))),
      meshCoverage: Object.freeze({
        model: "prepared-analytic-oblate-ellipsoid-proportional-overscan",
        coverageScale: MARS_MATERIAL_COVERAGE_SCALE,
        materialScale: MARS_MATERIAL_CONTENT_SCALE,
        rimFill: "prepared-source-calibrated-opaque-limb-fill",
        sourcePixelBleed: 0,
        supersampling: MARS_MATERIAL_SILHOUETTE_SUPERSAMPLING,
        alphaClamp: true,
        runtimeWork: false,
      }),
    }),
  });
}

export async function measurePublishedMarsAtmosphereReference() {
  const { data, info } = await sharp(HUBBLE_REFERENCE_PATH)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const thresholdRgb8 = 8;
  const component = floodDiscComponent(data, info, thresholdRgb8);
  const centerX = (component.minimumX + component.maximumX) / 2;
  const centerY = (component.minimumY + component.maximumY) / 2;
  const radiusX = (component.maximumX - component.minimumX + 1) / 2;
  const radiusY = (component.maximumY - component.minimumY + 1) / 2;
  const limbAnnulus = Object.freeze([0.96, 0.99]);
  const interiorAnnulus = Object.freeze([0.8, 0.9]);
  const exteriorAnnulus = Object.freeze([1.005, 1.03]);
  const limb = annulusStatistics({
    data,
    info,
    centerX,
    centerY,
    radiusX,
    radiusY,
    annulus: limbAnnulus,
    thresholdRgb8,
  });
  const interior = annulusStatistics({
    data,
    info,
    centerX,
    centerY,
    radiusX,
    radiusY,
    annulus: interiorAnnulus,
    thresholdRgb8,
  });
  const exterior = annulusStatistics({
    data,
    info,
    centerX,
    centerY,
    radiusX,
    radiusY,
    annulus: exteriorAnnulus,
    thresholdRgb8: -1,
  });
  const limbMeanRgb8 = Object.freeze(limb.meanRgb8.map(Math.round));
  const limbChromaticDifference = Number((Math.hypot(
    ...limb.meanRgb8.map((channel, index) =>
      channel - interior.meanRgb8[index]),
  ) / 255).toFixed(6));
  return Object.freeze({
    source:
      "NASA, ESA, Hubble Heritage Team, J. Bell, and M. Wolff 12 May 2016 full disc",
    sourcePath: "source/presentation/navigation-marker.jpg",
    sourceSize: Object.freeze([info.width, info.height]),
    sourceColorSpace: MARS_DISPLAY_TRANSFER,
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
    limbAnnulus,
    limbSampleCount: limb.sampleCount,
    limbMeanRgb8,
    interiorAnnulus,
    interiorSampleCount: interior.sampleCount,
    interiorMeanRgb8: Object.freeze(interior.meanRgb8.map(Math.round)),
    limbChromaticDifference,
    exteriorAnnulus,
    exteriorSampleCount: exterior.sampleCount,
    exteriorMaximumRgb8: exterior.maximumRgb8,
    calibration:
      "limb color and opacity are measured from the checked published Hubble disc",
  });
}

export function applyMarsLinearLight(channel, factor) {
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

function writePreparedOverlay(data, offset, { atmosphereAlpha, shadowAlpha }) {
  const alpha = atmosphereAlpha + shadowAlpha * (1 - atmosphereAlpha);
  if (alpha <= 0) return;
  const atmosphereContribution = atmosphereAlpha / alpha;
  data[offset] = Math.round(MARS_ATMOSPHERE_COLOR[0] * atmosphereContribution);
  data[offset + 1] = Math.round(
    MARS_ATMOSPHERE_COLOR[1] * atmosphereContribution,
  );
  data[offset + 2] = Math.round(
    MARS_ATMOSPHERE_COLOR[2] * atmosphereContribution,
  );
  data[offset + 3] = Math.round(alpha * 255);
}

function writePreparedOpaqueLimbFill(
  data,
  offset,
  { atmosphereAlpha, coverageAlpha, lightingFactor },
) {
  for (let channel = 0; channel < 3; channel += 1) {
    const ground = applyMarsLinearLight(
      MARS_SURFACE_REFERENCE_COLOR[channel],
      lightingFactor,
    );
    data[offset + channel] = Math.round(
      ground * (1 - atmosphereAlpha) +
        MARS_ATMOSPHERE_COLOR[channel] * atmosphereAlpha,
    );
  }
  data[offset + 3] = Math.round(coverageAlpha * 255);
}

function prepareOpenSpaceTerminator(lambert) {
  const [edge0, edge1] = MARS_OPENSPACE_TERMINATOR_SMOOTHSTEP;
  return smoothstep(edge0, edge1, lambert);
}

function cameraLightDirection(pitchDegrees) {
  const radians = (
    pitchDegrees - DEFAULT_SCENE_PITCH_DEGREES
  ) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const [x, y, z] = MARS_WORLD_LIGHT_DIRECTION;
  return normalize([x, y * cosine - z * sine, y * sine + z * cosine]);
}

function intersectMarsViewRay(projection, screenX, screenY) {
  const origin = [0, 1, 2].map((axis) =>
    projection.right[axis] * screenX +
      projection.down[axis] * screenY);
  const direction = projection.view;
  const equatorialSquared = MARS_EQUATORIAL_RADIUS ** 2;
  const polarSquared = MARS_POLAR_RADIUS ** 2;
  const coefficientA =
    (direction[0] ** 2 + direction[1] ** 2) / equatorialSquared +
    direction[2] ** 2 / polarSquared;
  const coefficientB = 2 * (
    (origin[0] * direction[0] + origin[1] * direction[1]) /
      equatorialSquared +
    origin[2] * direction[2] / polarSquared
  );
  const coefficientC =
    (origin[0] ** 2 + origin[1] ** 2) / equatorialSquared +
    origin[2] ** 2 / polarSquared - 1;
  const discriminant = coefficientB ** 2 - 4 * coefficientA * coefficientC;
  if (!Number.isFinite(discriminant) || discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [
    (-coefficientB - root) / (2 * coefficientA),
    (-coefficientB + root) / (2 * coefficientA),
  ].map((distance) => {
    const position = [0, 1, 2].map((axis) =>
      origin[axis] + direction[axis] * distance);
    const normal = normalize([
      position[0] / equatorialSquared,
      position[1] / equatorialSquared,
      position[2] / polarSquared,
    ]);
    return { position, normal, visibility: dot(normal, direction) };
  });
  const selected = candidates[0].visibility >= candidates[1].visibility
    ? candidates[0]
    : candidates[1];
  return Object.freeze({
    position: Object.freeze(selected.position),
    normal: Object.freeze(selected.normal),
  });
}

function marsObjectToScreenDirection(
  [x, y, z],
  pitchDegrees,
  normalizeResult = true,
) {
  let result = [y, x, z];
  result = rotateZ(
    result,
    -MARS_BODY_ROTATION_DEGREES * Math.PI / 180,
  );
  result = rotateY(
    result,
    -MARS_AXIAL_TILT_DEGREES * Math.PI / 180,
  );
  result = rotateX(result, pitchDegrees * Math.PI / 180);
  return normalizeResult ? normalize(result) : result;
}

function screenToMarsObjectDirection(vector, pitchDegrees) {
  let result = rotateX(vector, -pitchDegrees * Math.PI / 180);
  result = rotateY(
    result,
    MARS_AXIAL_TILT_DEGREES * Math.PI / 180,
  );
  result = rotateZ(
    result,
    MARS_BODY_ROTATION_DEGREES * Math.PI / 180,
  );
  return normalize([result[1], result[0], result[2]]);
}

function prepareAnalyticEllipsoidCoverage(
  right,
  down,
  size,
  rasterPixelsPerBodyUnit,
  supersampling,
) {
  const equatorialSquared = MARS_EQUATORIAL_RADIUS ** 2;
  const polarSquared = MARS_POLAR_RADIUS ** 2;
  const projectedXX = equatorialSquared *
      (right[0] ** 2 + right[1] ** 2) + polarSquared * right[2] ** 2;
  const projectedYY = equatorialSquared *
      (down[0] ** 2 + down[1] ** 2) + polarSquared * down[2] ** 2;
  const projectedXY = equatorialSquared *
      (right[0] * down[0] + right[1] * down[1]) +
    polarSquared * right[2] * down[2];
  const determinant = projectedXX * projectedYY - projectedXY ** 2;
  if (!Number.isFinite(determinant) || determinant <= 0) {
    throw new Error("Prepared Mars analytic silhouette is invalid.");
  }
  const coefficientX = projectedYY / determinant;
  const coefficientXY = -projectedXY / determinant;
  const coefficientY = projectedXX / determinant;
  const center = size / 2;
  const accumulatedCoverage = new Float32Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let sampleIndex = 0;
      sampleIndex < supersampling;
      sampleIndex += 1) {
      const sampleY = row + (sampleIndex + 0.5) / supersampling;
      const screenY = (sampleY - center) / rasterPixelsPerBodyUnit;
      const linear = coefficientXY * screenY;
      const constant = coefficientY * screenY ** 2 - 1;
      const discriminant = linear ** 2 - coefficientX * constant;
      if (discriminant <= 0) continue;
      const root = Math.sqrt(discriminant);
      const left = Math.max(
        0,
        center + (-linear - root) / coefficientX * rasterPixelsPerBodyUnit,
      );
      const rightEdge = Math.min(
        size,
        center + (-linear + root) / coefficientX * rasterPixelsPerBodyUnit,
      );
      const minimumColumn = Math.max(0, Math.floor(left));
      const maximumColumn = Math.min(
        size - 1,
        Math.floor(Math.max(left, rightEdge - Number.EPSILON)),
      );
      for (let column = minimumColumn;
        column <= maximumColumn;
        column += 1) {
        const horizontalCoverage = Math.max(
          0,
          Math.min(column + 1, rightEdge) - Math.max(column, left),
        );
        accumulatedCoverage[row * size + column] +=
          horizontalCoverage / supersampling;
      }
    }
  }
  const coverage = Buffer.alloc(size * size);
  for (let index = 0; index < coverage.length; index += 1) {
    coverage[index] = Math.round(
      Math.max(0, Math.min(1, accumulatedCoverage[index])) * 255,
    );
  }
  return coverage;
}

function rotateX([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function psgNumber(name) {
  const match = psgConfiguration.match(new RegExp(
    `^<${name}>([-+0-9.eE]+)$`,
    "mu",
  ));
  const value = Number(match?.[1]);
  if (!Number.isFinite(value)) {
    throw new Error(`NASA PSG Mars field is missing: ${name}.`);
  }
  return value;
}

function openSpaceNumber(name) {
  const match = openSpaceConfiguration.match(new RegExp(
    `\\b${name}\\s*=\\s*([-+0-9.eE]+)`,
    "u",
  ));
  const value = Number(match?.[1]);
  if (!Number.isFinite(value)) {
    throw new Error(`OpenSpace Mars atmosphere field is missing: ${name}.`);
  }
  return value;
}

function openSpaceDifference(name) {
  const match = openSpaceConfiguration.match(new RegExp(
    `\\b${name}\\s*=\\s*([-+0-9.eE]+)\\s*-\\s*([-+0-9.eE]+)`,
    "u",
  ));
  const upper = Number(match?.[1]);
  const lower = Number(match?.[2]);
  if (!Number.isFinite(upper) || !Number.isFinite(lower) || upper <= lower) {
    throw new Error(`OpenSpace Mars atmosphere span is invalid: ${name}.`);
  }
  return upper - lower;
}

function openSpaceVector(section, name) {
  const sectionStart = openSpaceConfiguration.indexOf(`${section} = {`);
  if (sectionStart < 0) {
    throw new Error(`OpenSpace Mars atmosphere section is missing: ${section}.`);
  }
  const sectionSource = openSpaceConfiguration.slice(sectionStart);
  const match = sectionSource.match(new RegExp(
    `\\b${name}\\s*=\\s*\\{([^}]+)\\}`,
    "u",
  ));
  const values = match?.[1].split(",").map((expression) => {
    const terms = expression.trim().split("/").map(Number);
    if (terms.some((value) => !Number.isFinite(value))) return Number.NaN;
    return terms.reduce((value, divisor, index) =>
      index === 0 ? divisor : value / divisor, 0);
  });
  if (!values || values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(
      `OpenSpace Mars atmosphere vector is invalid: ${section}.${name}.`,
    );
  }
  return Object.freeze(values.map((value) => Number(value.toFixed(9))));
}

function annulusStatistics({
  data,
  info,
  centerX,
  centerY,
  radiusX,
  radiusY,
  annulus,
  thresholdRgb8,
}) {
  const sum = [0, 0, 0];
  let sampleCount = 0;
  let maximumRgb8 = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const radius = Math.hypot(
        (x + 0.5 - centerX) / radiusX,
        (y + 0.5 - centerY) / radiusY,
      );
      if (radius < annulus[0] || radius >= annulus[1]) continue;
      const offset = (y * info.width + x) * info.channels;
      const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      maximumRgb8 = Math.max(maximumRgb8, maximum);
      if (maximum <= thresholdRgb8) continue;
      sampleCount += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        sum[channel] += data[offset + channel];
      }
    }
  }
  if (sampleCount === 0) {
    throw new Error("Published Hubble Mars annulus contains no samples.");
  }
  return Object.freeze({
    sampleCount,
    maximumRgb8,
    meanRgb8: Object.freeze(sum.map((value) => value / sampleCount)),
  });
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
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }
  if (pixelCount === 0) {
    throw new Error("Published Hubble Mars disc was not found.");
  }
  return Object.freeze({ minimumX, maximumX, minimumY, maximumY, pixelCount });

  function enqueue(x, y) {
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

function smoothstep(edge0, edge1, value) {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}
