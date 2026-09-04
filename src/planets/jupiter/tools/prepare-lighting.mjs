import { createHash } from "node:crypto";
import { readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_JUPITER_CAMERA } from "../runtime/preparedCamera.mjs";

import {
  JUPITER_DISPLAY_TRANSFER,
  JUPITER_HUBBLE_MINNAERT_MODEL,
  JUPITER_LIGHT_SOURCE_GEOMETRY,
  JUPITER_LIGHTING_REFERENCE_CHANNEL,
  JUPITER_MATERIAL_CONTENT_SCALE,
  JUPITER_MATERIAL_OUTER_RADIUS,
  JUPITER_MATERIAL_PIXEL_DENSITY,
  JUPITER_MATERIAL_PRESENTATION_SCALE,
  JUPITER_MATERIAL_PRESENTATION_SIZE,
  JUPITER_MATERIAL_RASTER_OUTER_RADIUS,
  JUPITER_MATERIAL_RASTER_SURFACE_RADIUS,
  JUPITER_MATERIAL_SIZE,
  JUPITER_MATERIAL_SURFACE_RADIUS,
  JUPITER_OPENSPACE_AMBIENT_INTENSITY,
  JUPITER_OPENSPACE_TERMINATOR_SMOOTHSTEP,
  JUPITER_WORLD_LIGHT_DIRECTION,
  measurePublishedJupiterAtmosphereReference,
  prepareJupiterMaterialFrame,
} from "./prepare-atmosphere.mjs";
import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
} from "./preparation-paths.mjs";
import { validateJupiterSourceGroup } from "./source-manifest.mjs";

await Promise.all([
  validateJupiterSourceGroup("lighting"),
  validateJupiterSourceGroup("atmosphere"),
]);
await ensureJupiterPreparationDirectories();
const atmosphereReference = await measurePublishedJupiterAtmosphereReference();
const bankFingerprintSources = Object.freeze([
  "tools/prepare-atmosphere.mjs",
  "tools/prepare-lighting.mjs",
  "runtime/preparedScene.mjs projection metadata",
  "runtime/preparedCamera.mjs projection metadata",
  "source/atmosphere/psg-jupiter-20260830.cfg",
  "source/atmosphere/hubble-opal-minnaert.json",
  "source/presentation/navigation-marker.png",
  "Saturn accepted OpenSpace default scene-graph Sun direction",
  "sharp runtime versions",
]);
const bankFingerprintHash = createHash("sha256");
for (const path of [
  "./prepare-atmosphere.mjs",
  "./prepare-lighting.mjs",
  "../runtime/preparedCamera.mjs",
  "../source/atmosphere/psg-jupiter-20260830.cfg",
  "../source/atmosphere/hubble-opal-minnaert.json",
  "../source/presentation/navigation-marker.png",
]) {
  bankFingerprintHash.update(await readFile(new URL(path, import.meta.url)));
}
bankFingerprintHash.update(JSON.stringify({
  geometry: PREPARED_JUPITER_SCENE.geometry,
  materialProjection: PREPARED_JUPITER_SCENE.materialProjection,
  materialDepthPresentation:
    PREPARED_JUPITER_CAMERA.materialDepthPresentation,
}));
const bankFingerprint = bankFingerprintHash
  .update(JSON.stringify(sharp.versions))
  .digest("hex")
  .slice(0, 12);

const MINIMUM_PITCH_DEGREES = -3.13;
const MAXIMUM_PITCH_DEGREES = 86.87;
const DEFAULT_PITCH_DEGREES = PREPARED_JUPITER_CAMERA.initialScenePitchDegrees;
const PITCH_STEP_DEGREES = 0.5;
const FRAME_COUNT = Math.round(
  (MAXIMUM_PITCH_DEGREES - MINIMUM_PITCH_DEGREES) / PITCH_STEP_DEGREES,
) + 1;
const FRAMES_PER_ROW = 4;
const ROW_COLUMNS = 4;
const FRAME_GUTTER = 8;
const FRAME_STRIDE = JUPITER_MATERIAL_SIZE + FRAME_GUTTER * 2;
const ROW_COUNT = Math.ceil(FRAME_COUNT / FRAMES_PER_ROW);
const MAXIMUM_RETAINED_ROW_COUNT = 3;
const DEFAULT_FRAME = Math.round(
  (DEFAULT_PITCH_DEGREES - MINIMUM_PITCH_DEGREES) / PITCH_STEP_DEGREES,
);
const DEFAULT_ROW = Math.floor(DEFAULT_FRAME / FRAMES_PER_ROW);
const rows = [];
const presentations = [];

for (let rowIndex = 0; rowIndex < ROW_COUNT; rowIndex += 1) {
  const firstFrame = rowIndex * FRAMES_PER_ROW;
  const rowFrameCount = Math.min(FRAMES_PER_ROW, FRAME_COUNT - firstFrame);
  const rowColumns = Math.min(ROW_COLUMNS, rowFrameCount);
  const rowLines = Math.ceil(rowFrameCount / ROW_COLUMNS);
  const rowWidth = rowColumns * FRAME_STRIDE;
  const rowHeight = rowLines * FRAME_STRIDE;
  const composites = [];
  for (let column = 0; column < rowFrameCount; column += 1) {
    const frameIndex = firstFrame + column;
    const pitchDegrees = MINIMUM_PITCH_DEGREES +
      frameIndex * PITCH_STEP_DEGREES;
    const prepared = prepareJupiterMaterialFrame(pitchDegrees);
    const frameColumn = column % ROW_COLUMNS;
    const frameLine = Math.floor(column / ROW_COLUMNS);
    composites.push(Object.freeze({
      input: prepared.data,
      raw: {
        width: JUPITER_MATERIAL_SIZE,
        height: JUPITER_MATERIAL_SIZE,
        channels: 4,
      },
      left: frameColumn * FRAME_STRIDE + FRAME_GUTTER,
      top: frameLine * FRAME_STRIDE + FRAME_GUTTER,
    }));
    presentations.push(Object.freeze({
      frameIndex,
      pitchDegrees,
      rowIndex,
      url: `/scenes/jupiter/jupiter-material-${bankFingerprint}-row-${String(rowIndex).padStart(2, "0")}.webp`,
      backgroundPosition:
        `${-(frameColumn * FRAME_STRIDE + FRAME_GUTTER) /
          JUPITER_MATERIAL_PIXEL_DENSITY}px ` +
        `${-(frameLine * FRAME_STRIDE + FRAME_GUTTER) /
          JUPITER_MATERIAL_PIXEL_DENSITY}px`,
      backgroundSize:
        `${rowWidth / JUPITER_MATERIAL_PIXEL_DENSITY}px ` +
        `${rowHeight / JUPITER_MATERIAL_PIXEL_DENSITY}px`,
      cameraLightDirection: prepared.cameraLightDirection,
      projection: prepared.projection,
    }));
  }
  const filename =
    `jupiter-material-${bankFingerprint}-row-${String(rowIndex).padStart(2, "0")}.webp`;
  const path = resolve(JUPITER_PUBLIC_ROOT, filename);
  await sharp({
    create: {
      width: rowWidth,
      height: rowHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ lossless: true, effort: 6, alphaQuality: 100 })
    .toFile(path);
  const bytes = await readFile(path);
  rows.push(Object.freeze({
    rowIndex,
    url: `/scenes/jupiter/${filename}`,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: rowWidth,
    height: rowHeight,
    decodedRgbaBytes: rowWidth * rowHeight * 4,
  }));
}

const shadowlessFrame = prepareJupiterMaterialFrame(
  DEFAULT_PITCH_DEGREES,
  { shadowless: true },
);
const shadowlessFilename =
  `jupiter-material-${bankFingerprint}-shadowless.webp`;
const shadowlessPath = resolve(JUPITER_PUBLIC_ROOT, shadowlessFilename);
await sharp(shadowlessFrame.data, {
  raw: {
    width: JUPITER_MATERIAL_SIZE,
    height: JUPITER_MATERIAL_SIZE,
    channels: 4,
  },
}).webp({ lossless: true, effort: 6, alphaQuality: 100 })
  .toFile(shadowlessPath);
const shadowlessBytes = await readFile(shadowlessPath);
const shadowless = Object.freeze({
  url: `/scenes/jupiter/${shadowlessFilename}`,
  bytes: shadowlessBytes.byteLength,
  sha256: createHash("sha256").update(shadowlessBytes).digest("hex"),
  width: JUPITER_MATERIAL_SIZE,
  height: JUPITER_MATERIAL_SIZE,
  backgroundPosition: "0px 0px",
  backgroundSize:
    `${JUPITER_MATERIAL_PRESENTATION_SIZE}px ` +
    `${JUPITER_MATERIAL_PRESENTATION_SIZE}px`,
  lightSpace: "prepared-view-aligned-shadowless-flood",
});

const initialWarmRows = Object.freeze([
  Math.max(0, DEFAULT_ROW - 1),
  DEFAULT_ROW,
  Math.min(ROW_COUNT - 1, DEFAULT_ROW + 1),
].filter((rowIndex, index, entries) => entries.indexOf(rowIndex) === index));
const initialDecodedWorkingSetBytes = initialWarmRows.reduce(
  (total, rowIndex) => total + rows[rowIndex].decodedRgbaBytes,
  0,
);
const maximumDecodedWorkingSetBytes = [...rows]
  .sort((left, right) => right.decodedRgbaBytes - left.decodedRgbaBytes)
  .slice(0, MAXIMUM_RETAINED_ROW_COUNT)
  .reduce((total, row) => total + row.decodedRgbaBytes, 0);
const output = Object.freeze({
  schema: "cssjupiter-prepared-lighting@3",
  model: "fixed-world-light-prepared-row-shard-presentations",
  bankFingerprint,
  bankFingerprintSources,
  minimumPitchDegrees: MINIMUM_PITCH_DEGREES,
  maximumPitchDegrees: MAXIMUM_PITCH_DEGREES,
  defaultPitchDegrees: DEFAULT_PITCH_DEGREES,
  pitchStepDegrees: PITCH_STEP_DEGREES,
  frameCount: FRAME_COUNT,
  frameSize: JUPITER_MATERIAL_SIZE,
  presentationFrameSize: JUPITER_MATERIAL_PRESENTATION_SIZE,
  preparedPixelDensity: JUPITER_MATERIAL_PIXEL_DENSITY,
  surfaceRadius: JUPITER_MATERIAL_SURFACE_RADIUS,
  outerRadius: JUPITER_MATERIAL_OUTER_RADIUS,
  rasterSurfaceRadius: JUPITER_MATERIAL_RASTER_SURFACE_RADIUS,
  rasterOuterRadius: JUPITER_MATERIAL_RASTER_OUTER_RADIUS,
  silhouetteCoverage: Object.freeze({
    model: "prepared-analytic-oblate-ellipsoid-alpha-coverage",
    projectionModel: "prepared-oblate-ellipsoid-camera-projection",
    presentationScale: JUPITER_MATERIAL_PRESENTATION_SCALE,
    materialScale: JUPITER_MATERIAL_CONTENT_SCALE,
    rimFill: "prepared-subpixel-analytic-ellipse-edge-coverage",
    sourcePixelBleed: 0,
    perPitch: true,
    supersampling: 1,
    screenshotDerived: false,
    runtime: false,
  }),
  worldLightDirection: JUPITER_WORLD_LIGHT_DIRECTION,
  illuminationGeometry: JUPITER_LIGHT_SOURCE_GEOMETRY,
  atmosphere: Object.freeze({
    model: "prepared-hubble-opal-minnaert-visible-cloud-atmosphere",
    source: "NASA Hubble WFC3 visible atmosphere and OPAL photometry",
    photometry: JUPITER_HUBBLE_MINNAERT_MODEL,
    sourceReference: atmosphereReference,
    colorOverlay: true,
    externalHalo: false,
    runtimeRasterization: false,
    runtimePhotometry: false,
  }),
  shadow: Object.freeze({
    model: "prepared-saturn-standard-openspace-terminator-opal-minnaert",
    source:
      "OpenSpace scene light, RenderableGlobe geometry, and Hubble OPAL photometry",
    ambientFloor: JUPITER_OPENSPACE_AMBIENT_INTENSITY,
    terminatorSmoothstep: JUPITER_OPENSPACE_TERMINATOR_SMOOTHSTEP,
    displayTransfer: JUPITER_DISPLAY_TRANSFER,
    referenceChannel: JUPITER_LIGHTING_REFERENCE_CHANNEL,
    linearLight: true,
    fixedWorldDirection: true,
    runtimeLightingMath: false,
  }),
  transport: Object.freeze({
    model: "row-shard-cache",
    preloadBeforeMount: true,
    retainedLeafCount: 1,
    interpolation: "nearest-prepared-half-degree-frame",
    frameGutter: FRAME_GUTTER / JUPITER_MATERIAL_PIXEL_DENSITY,
    rasterFrameGutter: FRAME_GUTTER,
    framesPerRow: FRAMES_PER_ROW,
    rowColumns: ROW_COLUMNS,
    rowCount: ROW_COUNT,
    defaultFrame: DEFAULT_FRAME,
    defaultRow: DEFAULT_ROW,
    initialWarmRows,
    maximumRetainedRowCount: MAXIMUM_RETAINED_ROW_COUNT,
    addressWritesOnlyOnInput: true,
    retainLastReadyPresentation: true,
    encoding: "lossless-webp",
    idleCallbacks: 0,
    publicationModel: "content-addressed-complete-bank-switch",
    initialDecodedWorkingSetBytes,
    maximumDecodedWorkingSetBytes,
  }),
  rows: Object.freeze(rows),
  presentations: Object.freeze(presentations),
  shadowless,
  totalBytes: rows.reduce((total, row) => total + row.bytes, 0),
  fullBankDecodedRgbaBytes: rows.reduce(
    (total, row) => total + row.decodedRgbaBytes,
    0,
  ),
});

const preparedModule =
  "// Generated by tools/prepare-lighting.mjs. Do not edit by hand.\n" +
    `export const PREPARED_JUPITER_LIGHTING = ${JSON.stringify(output)};\n`;
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

const expectedRowFiles = new Set(rows.map(({ url }) => url.split("/").at(-1)));
const existingRowFiles = (await readdir(JUPITER_PUBLIC_ROOT)).filter((name) =>
  /^jupiter-material-(?:row-\d{2,3}|[a-f0-9]{12}-(?:row-\d{2,3}|shadowless))\.webp$/u.test(name));
await Promise.all(existingRowFiles
  .filter((name) => name !== shadowlessFilename && !expectedRowFiles.has(name))
  .map((name) => unlink(resolve(JUPITER_PUBLIC_ROOT, name))));

console.log(
  `Prepared ${FRAME_COUNT} Jupiter material states in ${ROW_COUNT} bounded rows ` +
  `and ${output.totalBytes} bytes.`,
);
