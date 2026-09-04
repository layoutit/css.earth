import { createHash } from "node:crypto";
import { readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { PREPARED_MARS_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";
import {
  MARS_ATMOSPHERE_COLOR,
  MARS_DISPLAY_TRANSFER,
  MARS_LIGHT_SOURCE_GEOMETRY,
  MARS_LIGHTING_REFERENCE_CHANNEL,
  MARS_MATERIAL_CONTENT_SCALE,
  MARS_MATERIAL_COVERAGE_SCALE,
  MARS_MATERIAL_DENSITIES,
  MARS_MATERIAL_OUTER_RADIUS,
  MARS_MATERIAL_PRESENTATION_SIZE,
  MARS_MATERIAL_SURFACE_RADIUS,
  MARS_MATERIAL_SILHOUETTE_SUPERSAMPLING,
  MARS_OPENSPACE_AMBIENT_INTENSITY,
  MARS_OPENSPACE_ATMOSPHERE,
  MARS_OPENSPACE_TERMINATOR_SMOOTHSTEP,
  MARS_PUBLISHED_ATMOSPHERE_REFERENCE,
  MARS_WORLD_LIGHT_DIRECTION,
  prepareMarsMaterialFrame,
  prepareMarsMaterialProjection,
} from "./prepare-atmosphere.mjs";
import {
  ensureMarsPreparationDirectories,
  MARS_PUBLIC_ROOT,
} from "./preparation-paths.mjs";
import { validateMarsSourceGroup } from "./source-manifest.mjs";

await Promise.all([
  validateMarsSourceGroup("lighting"),
  validateMarsSourceGroup("atmosphere"),
]);
await ensureMarsPreparationDirectories();

const bankFingerprintSources = Object.freeze([
  "platform/cubic-sky-contract.mjs",
  "platform/directional-sun-coordinate.mjs",
  "tools/body-geometry.mjs",
  "tools/prepare-atmosphere.mjs",
  "tools/prepare-lighting.mjs",
  "source/atmosphere/psg-mars-20260829.cfg",
  "source/openspace/atmosphere.asset",
  "source/presentation/navigation-marker.jpg",
  "source/sky/google-earth-pro-contract.json",
  "runtime/preparedSkySun.mjs",
  "sharp runtime versions",
]);
const bankFingerprintHash = createHash("sha256");
for (const path of [
  "../../../platform/cubic-sky-contract.mjs",
  "../../../platform/directional-sun-coordinate.mjs",
  "./body-geometry.mjs",
  "./prepare-atmosphere.mjs",
  "./prepare-lighting.mjs",
  "../source/atmosphere/psg-mars-20260829.cfg",
  "../source/openspace/atmosphere.asset",
  "../source/presentation/navigation-marker.jpg",
  "../source/sky/google-earth-pro-contract.json",
  "../runtime/preparedSkySun.mjs",
]) {
  bankFingerprintHash.update(await readFile(new URL(path, import.meta.url)));
}
const bankFingerprint = bankFingerprintHash
  .update(JSON.stringify(sharp.versions))
  .digest("hex")
  .slice(0, 12);

const FRAME_COUNT = 256;
const MINIMUM_LIGHT_VIEW_Z = -1;
const MAXIMUM_LIGHT_VIEW_Z = 1;
const PRESENTATION_PITCH_DEGREES = 40;
const sunPresentation = PREPARED_MARS_SKY_SUN;
const initialViewLightDirection = viewSunDirectionToPreparedLightDirection(
  sunPresentation.referenceViewDirection,
);
const BASE_LIGHT_AZIMUTH_DEGREES = Math.atan2(
  initialViewLightDirection[1],
  initialViewLightDirection[0],
) * 180 / Math.PI;
const DEFAULT_FRAME = phaseFrameForViewZ(
  initialViewLightDirection[2],
);
const banks = {};
const projectionSamples = [];
const preparedFrames1x = [];

for (const pixelDensity of MARS_MATERIAL_DENSITIES) {
  banks[pixelDensity] = await prepareDensityBank(pixelDensity);
}

const output = Object.freeze({
  schema: "cssmars-prepared-lighting@5",
  model:
    "source-calibrated-fixed-projection-full-sun-phase-density-row-shards",
  bankFingerprint,
  bankFingerprintSources,
  frameCount: FRAME_COUNT,
  defaultFrame: DEFAULT_FRAME,
  presentationFrameSize: MARS_MATERIAL_PRESENTATION_SIZE,
  preparedPixelDensities: MARS_MATERIAL_DENSITIES,
  surfaceRadius: MARS_MATERIAL_SURFACE_RADIUS,
  outerRadius: MARS_MATERIAL_OUTER_RADIUS,
  worldLightDirection: sunPresentation.localDirection,
  initialViewLightDirection,
  sourceWorldLightDirection: MARS_WORLD_LIGHT_DIRECTION,
  illuminationGeometry: MARS_LIGHT_SOURCE_GEOMETRY,
  minimumLightViewZ: MINIMUM_LIGHT_VIEW_Z,
  maximumLightViewZ: MAXIMUM_LIGHT_VIEW_Z,
  baseLightAzimuthDegrees: Number(BASE_LIGHT_AZIMUTH_DEGREES.toFixed(9)),
  cameraContract:
    "google-earth-pro-view-x-up-y-forward-minus-z-to-material-x-down-y-front-plus-z",
  projection: Object.freeze({
    model: "prepared-oblate-ellipsoid-fixed-camera-projection",
    presentationPitchDegrees: PRESENTATION_PITCH_DEGREES,
    phaseStateCount: FRAME_COUNT,
    presentationScale: MARS_MATERIAL_COVERAGE_SCALE,
    materialScale: MARS_MATERIAL_CONTENT_SCALE,
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
    samples: Object.freeze(projectionSamples),
    screenshotDerived: false,
    runtimeGeometry: false,
    runtimeRasterization: false,
  }),
  atmosphere: Object.freeze({
    model: "prepared-openspace-height-hubble-limb-calibration",
    source:
      "OpenSpace Mars atmosphere parameters and published NASA ESA Hubble full disc",
    openSpace: MARS_OPENSPACE_ATMOSPHERE,
    sourceReference: MARS_PUBLISHED_ATMOSPHERE_REFERENCE,
    color: MARS_ATMOSPHERE_COLOR,
    externalHalo: "prepared-analytic-oblate-silhouette-overscan",
    runtimeRasterization: false,
    runtimeAtmosphereMath: false,
  }),
  shadow: Object.freeze({
    model:
      "prepared-directional-sun-phase-with-psg-qualified-openspace-lambert-terminator",
    source:
      "Google Earth Pro measured Sun direction, NASA PSG qualification, and OpenSpace RenderableGlobe lighting model",
    ambientFloor: MARS_OPENSPACE_AMBIENT_INTENSITY,
    terminatorSmoothstep: MARS_OPENSPACE_TERMINATOR_SMOOTHSTEP,
    displayTransfer: MARS_DISPLAY_TRANSFER,
    referenceChannel: MARS_LIGHTING_REFERENCE_CHANNEL,
    linearLight: true,
    fixedCelestialDirection: true,
    runtimeLightingMath: false,
  }),
  banks: Object.freeze(banks),
  totalBytes: Object.values(banks).reduce(
    (total, bank) => total + bank.totalBytes,
    0,
  ),
});

const preparedModule =
  "// Generated by tools/prepare-lighting.mjs. Do not edit by hand.\n" +
    `export const PREPARED_MARS_LIGHTING = ${JSON.stringify(output)};\n`;
const preparedModulePath = new URL(
  "../runtime/preparedLighting.mjs",
  import.meta.url,
);
const preparedModuleStagingPath = new URL(
  "../runtime/preparedLighting.mjs.next",
  import.meta.url,
);
await writeFile(preparedModuleStagingPath, preparedModule);
await rename(preparedModuleStagingPath, preparedModulePath);

const expectedFiles = new Set(Object.values(banks).flatMap((bank) =>
  bank.rows.map(({ url }) => url.split("/").at(-1))));
const existingFiles = (await readdir(MARS_PUBLIC_ROOT)).filter((name) =>
  /^mars-material-(?:row-\d+|[a-f0-9]{12}-\dx-row-\d+)\.webp$/u.test(name));
await Promise.all(existingFiles
  .filter((name) => !expectedFiles.has(name))
  .map((name) => unlink(resolve(MARS_PUBLIC_ROOT, name))));

console.log(
  `Prepared ${FRAME_COUNT} Mars Sun-phase material states at DPR 1 and DPR 2 ` +
  `in ${Object.values(banks).reduce((count, bank) =>
    count + bank.rows.length, 0)} bounded shards and ${output.totalBytes} bytes.`,
);

async function prepareDensityBank(pixelDensity) {
  const frameSize = MARS_MATERIAL_PRESENTATION_SIZE * pixelDensity;
  const rasterFrameGutter = 4 * pixelDensity;
  const frameStride = frameSize + rasterFrameGutter * 2;
  const rows = [];
  const presentations = [];
  const preparedProjection = pixelDensity === 1
    ? prepareMarsMaterialProjection(PRESENTATION_PITCH_DEGREES, pixelDensity)
    : null;
  for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
    const viewZ = MINIMUM_LIGHT_VIEW_Z +
      frameIndex / (FRAME_COUNT - 1) *
        (MAXIMUM_LIGHT_VIEW_Z - MINIMUM_LIGHT_VIEW_Z);
    const lightDirection = phaseDirection(viewZ);
    const prepared = pixelDensity === 1
      ? prepareMarsMaterialFrame(
        PRESENTATION_PITCH_DEGREES,
        pixelDensity,
        { lightDirection, preparedProjection },
      )
      : await prepareDpr2Frame(frameIndex, lightDirection);
    if (pixelDensity === 1) preparedFrames1x[frameIndex] = prepared.data;
    if (pixelDensity === 1 && [0, DEFAULT_FRAME, FRAME_COUNT - 1]
      .includes(frameIndex)) {
      projectionSamples.push(Object.freeze({
        frameIndex,
        lightViewZ: Number(viewZ.toFixed(9)),
        pitchDegrees: prepared.projection.pitchDegrees,
        radiusX: prepared.projection.radiusX,
        radiusY: prepared.projection.radiusY,
        right: prepared.projection.right,
        down: prepared.projection.down,
        view: prepared.projection.view,
      }));
    }
    const filename = `mars-material-${bankFingerprint}-${pixelDensity}x-row-${
      String(frameIndex).padStart(3, "0")}.webp`;
    const path = resolve(MARS_PUBLIC_ROOT, filename);
    await sharp(prepared.data, {
      raw: {
        width: prepared.width,
        height: prepared.height,
        channels: 4,
      },
    })
      .extend({
        top: rasterFrameGutter,
        right: rasterFrameGutter,
        bottom: rasterFrameGutter,
        left: rasterFrameGutter,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 75, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toFile(path);
    const bytes = await readFile(path);
    const url = `/scenes/mars/${filename}`;
    rows.push(Object.freeze({
      rowIndex: frameIndex,
      url,
      encoding: "webp-q75-alpha-q100",
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: frameStride,
      height: frameStride,
      decodedRgbaBytes: frameStride * frameStride * 4,
    }));
    presentations.push(Object.freeze({
      frameIndex,
      lightViewZ: Number(viewZ.toFixed(9)),
      rowIndex: frameIndex,
      url,
      backgroundPosition:
        `${-rasterFrameGutter / pixelDensity}px ` +
        `${-rasterFrameGutter / pixelDensity}px`,
      backgroundSize:
        `${frameStride / pixelDensity}px ${frameStride / pixelDensity}px`,
      cameraLightDirection: prepared.cameraLightDirection,
    }));
  }
  const initialWarmRows = Object.freeze([
    Math.max(0, DEFAULT_FRAME - 1),
    DEFAULT_FRAME,
    Math.min(FRAME_COUNT - 1, DEFAULT_FRAME + 1),
  ]);
  const initialDecodedWorkingSetBytes = initialWarmRows.reduce(
    (total, rowIndex) => total + rows[rowIndex].decodedRgbaBytes,
    0,
  );
  const maximumDecodedWorkingSetBytes = [...rows]
    .sort((left, right) => right.decodedRgbaBytes - left.decodedRgbaBytes)
    .slice(0, 3)
    .reduce((total, row) => total + row.decodedRgbaBytes, 0);
  return Object.freeze({
    schema: "cssmars-prepared-lighting-bank@1",
    preparedPixelDensity: pixelDensity,
    frameSize,
    presentationFrameSize: MARS_MATERIAL_PRESENTATION_SIZE,
    surfaceRadius: MARS_MATERIAL_SURFACE_RADIUS,
    rasterSurfaceRadius: MARS_MATERIAL_SURFACE_RADIUS * pixelDensity,
    outerRadius: MARS_MATERIAL_OUTER_RADIUS,
    rasterOuterRadius: MARS_MATERIAL_OUTER_RADIUS * pixelDensity,
    transport: Object.freeze({
      model: "row-shard-cache",
      encoding: "webp-q75-alpha-q100",
      preloadBeforeMount: true,
      retainedLeafCount: 1,
      interpolation: "nearest-prepared-view-light-z-with-runtime-css-roll",
      frameGutter: rasterFrameGutter / pixelDensity,
      rasterFrameGutter,
      framesPerRow: 1,
      rowColumns: 1,
      rowCount: FRAME_COUNT,
      defaultFrame: DEFAULT_FRAME,
      defaultRow: DEFAULT_FRAME,
      initialWarmRows,
      maximumRetainedRowCount: 3,
      addressWritesOnlyOnInput: true,
      retainLastReadyPresentation: true,
      idleCallbacks: 0,
      publicationModel: "content-addressed-complete-density-bank-switch",
      initialDecodedWorkingSetBytes,
      maximumDecodedWorkingSetBytes,
    }),
    rows: Object.freeze(rows),
    presentations: Object.freeze(presentations),
    totalBytes: rows.reduce((total, row) => total + row.bytes, 0),
    fullBankDecodedRgbaBytes: rows.reduce(
      (total, row) => total + row.decodedRgbaBytes,
      0,
    ),
  });
}

async function prepareDpr2Frame(frameIndex, lightDirection) {
  const source = preparedFrames1x[frameIndex];
  if (!source) {
    throw new Error(`Mars DPR 1 material frame is missing: ${frameIndex}.`);
  }
  const width = MARS_MATERIAL_PRESENTATION_SIZE * 2;
  const data = await sharp(source, {
    raw: {
      width: MARS_MATERIAL_PRESENTATION_SIZE,
      height: MARS_MATERIAL_PRESENTATION_SIZE,
      channels: 4,
    },
  }).resize(width, width, { kernel: "lanczos3" }).raw().toBuffer();
  return Object.freeze({
    data,
    width,
    height: width,
    pixelDensity: 2,
    pitchDegrees: PRESENTATION_PITCH_DEGREES,
    cameraLightDirection: lightDirection.map((component) =>
      Number(component.toFixed(6))),
    projection: null,
  });
}

function phaseFrameForViewZ(viewZ) {
  const amount = Math.max(0, Math.min(1,
    (viewZ - MINIMUM_LIGHT_VIEW_Z) /
      (MAXIMUM_LIGHT_VIEW_Z - MINIMUM_LIGHT_VIEW_Z),
  ));
  return Math.round(amount * (FRAME_COUNT - 1));
}

function phaseDirection(viewZ) {
  const radians = BASE_LIGHT_AZIMUTH_DEGREES * Math.PI / 180;
  const projectedLength = Math.sqrt(Math.max(0, 1 - viewZ ** 2));
  return Object.freeze([
    Math.cos(radians) * projectedLength,
    Math.sin(radians) * projectedLength,
    viewZ,
  ]);
}
