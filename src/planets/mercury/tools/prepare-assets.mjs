#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { createCubicSkySunPresentation } from
  "../../../platform/cubic-sky-contract.mjs";
import { packProjectiveSurfaceRaster } from
  "../../../platform/projective-surface-raster.mjs";
import {
  ensureMercuryPreparationDirectories,
  MERCURY_PUBLIC_ROOT,
  MERCURY_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMercurySourceGroup } from "./source-manifest.mjs";

const SOURCE_WIDTH = 4096;
const SOURCE_HEIGHT = 2048;
const SURFACE_WIDTH = 2048;
const SURFACE_HEIGHT = 1024;
const SURFACE_LATITUDE_BANDS = 16;
const SURFACE_GUTTER = SURFACE_HEIGHT / SURFACE_LATITUDE_BANDS / 4;
const SOURCE_SURFACE_GUTTER = SURFACE_GUTTER * 2;
const POLAR_TILE = 256;
const POLAR_TILE_2X = POLAR_TILE * 2;
const LIGHT_PRESENTATION_SIZE = 460;
const LIGHT_FRAME = 512;
const LIGHT_COLUMNS = 8;
const LIGHT_FRAME_COUNT = 256;
const INTERIOR_WIDTH = 1024;
const INTERIOR_HEIGHT = 512;
const INTERIOR_POLE_TILE = 256;
const INTERIOR_SECTION_WIDTH = 2048;
const INTERIOR_SECTION_HEIGHT = 2048;
const OPENSPACE_WORLD_LIGHT_DIRECTION = Object.freeze([
  0.883835,
  -0.385595,
  0.264864,
]);
const OPENSPACE_AMBIENT_INTENSITY = 0.05;
const SHADOWLESS_FLOOD_LIMB_FLOOR = 0.35;
const MINIMUM_LIGHT_VIEW_Z = -1;
const MAXIMUM_LIGHT_VIEW_Z = 1;
const CUBIC_SKY_SUN = createCubicSkySunPresentation();
const DEFAULT_LIGHT_VIEW_Z = CUBIC_SKY_SUN.initialViewDirection[2];
const DEFAULT_LIGHT_FRAME_INDEX = Math.round(
  (DEFAULT_LIGHT_VIEW_Z - MINIMUM_LIGHT_VIEW_Z) /
    (MAXIMUM_LIGHT_VIEW_Z - MINIMUM_LIGHT_VIEW_Z) *
    (LIGHT_FRAME_COUNT - 1),
);

await Promise.all([
  validateMercurySourceGroup("assets"),
  validateMercurySourceGroup("interior"),
]);
await ensureMercuryPreparationDirectories();

const normalSourcePath = resolve(
  MERCURY_SOURCE_ROOT,
  "maps/mercury-bdr-global.png",
);
const enhancedSourcePath = resolve(
  MERCURY_SOURCE_ROOT,
  "maps/mercury-enhanced-global.png",
);
const topographySourcePath = resolve(
  MERCURY_SOURCE_ROOT,
  "maps/mercury-topography-global.png",
);
const structure = JSON.parse(await readFile(resolve(
  MERCURY_SOURCE_ROOT,
  "interior/mercury-structure.json",
), "utf8"));

if (structure.schema !== "cssmercury-structure@1" ||
    structure.metallicCoreRadiusFraction !== 0.85 ||
    structure.metallicCoreRadiusKm / structure.planetRadiusKm !==
      structure.metallicCoreRadiusFraction ||
    structure.outerShellThicknessKm !==
      structure.planetRadiusKm - structure.metallicCoreRadiusKm ||
    structure.publishedApproximateOuterShellThicknessKm !== 400 ||
    structure.presentation?.model !==
      "declared-illustrative-retained-cross-section" ||
    !validPalette(structure.presentation.palette) ||
    structure.presentation.lighting?.model !==
      "prepared-object-space-lambert-and-illustrative-depth-shading" ||
    JSON.stringify(structure.presentation.lighting.worldLightDirection) !==
      JSON.stringify(OPENSPACE_WORLD_LIGHT_DIRECTION) ||
    structure.presentation.cutaway?.centerLongitudeDegrees !== -56.25 ||
    structure.presentation.cutaway?.widthDegrees !== 112.5 ||
    typeof structure.presentation.qualification !== "string") {
  throw new Error("Mercury structure source is incompatible.");
}

const topographyRgba = await sourceRgba(topographySourcePath);
const normalRgba = await sourceRgba(normalSourcePath);
const enhancedSourceRgba = await sourceRgba(enhancedSourcePath);
const enhancedCoverage = completeEnhancedCoverage(
  enhancedSourceRgba,
  normalRgba,
  topographyRgba,
);
const interiorOuterSourceRgba = shadeInteriorOuter(normalRgba);
const interiorOuterRgba = orientLatitudeBands(interiorOuterSourceRgba, 16);

const surfaces = [
  { id: "normal", rgba: normalRgba, falseColor: false },
  {
    id: "enhanced",
    rgba: enhancedCoverage.rgba,
    falseColor: true,
    coverageCompletion: enhancedCoverage.metadata,
    polarCoverageFallback: normalRgba,
  },
  { id: "topography", rgba: topographyRgba, falseColor: true },
];

for (const surface of surfaces) {
  await writeResponsiveSurface(surface.id, surface.rgba);
}
await writePolarAtlas(surfaces, POLAR_TILE, "mercury-poles.webp");
await writePolarAtlas(surfaces, POLAR_TILE_2X, "mercury-poles@2x.webp");
await removeObsoleteLightingAssets();
const lightingBanks = Object.freeze({
  1: await writeLightingBank(1),
  2: await writeLightingBank(2),
});
await Promise.all([
  writeInteriorOuterSurface(
    interiorOuterRgba,
    SURFACE_WIDTH,
    SURFACE_HEIGHT,
    "mercury-interior-outer.webp",
  ),
  writeInteriorOuterSurface(
    interiorOuterRgba,
    SOURCE_WIDTH,
    SOURCE_HEIGHT,
    "mercury-interior-outer@2x.webp",
  ),
  writeInteriorOuterPoleAtlas(
    interiorOuterSourceRgba,
    INTERIOR_POLE_TILE,
    "mercury-interior-outer-poles.webp",
    structure.presentation.cutaway,
  ),
  writeInteriorOuterPoleAtlas(
    interiorOuterSourceRgba,
    INTERIOR_POLE_TILE * 2,
    "mercury-interior-outer-poles@2x.webp",
    structure.presentation.cutaway,
  ),
  writeInteriorLayer(
    INTERIOR_WIDTH,
    INTERIOR_HEIGHT,
    "mercury-interior-core.webp",
    "core",
  ),
  writeInteriorLayer(
    INTERIOR_WIDTH * 2,
    INTERIOR_HEIGHT * 2,
    "mercury-interior-core@2x.webp",
    "core",
  ),
  writeInteriorCorePoleAtlas(
    INTERIOR_POLE_TILE,
    "mercury-interior-core-poles.webp",
    structure.presentation.cutaway,
  ),
  writeInteriorCorePoleAtlas(
    INTERIOR_POLE_TILE * 2,
    "mercury-interior-core-poles@2x.webp",
    structure.presentation.cutaway,
  ),
  writeInteriorSection(
    INTERIOR_SECTION_WIDTH,
    INTERIOR_SECTION_HEIGHT,
    "mercury-interior-section.webp",
    structure,
  ),
  writeInteriorSection(
    INTERIOR_SECTION_WIDTH * 2,
    INTERIOR_SECTION_HEIGHT * 2,
    "mercury-interior-section@2x.webp",
    structure,
  ),
]);
await writeLensThumbnails();
await Promise.all([
  "mercury-interior.webp",
  "mercury-interior@2x.webp",
  "mercury-interior-shell.webp",
  "mercury-interior-shell@2x.webp",
].map((fileName) => rm(resolve(MERCURY_PUBLIC_ROOT, fileName), {
  force: true,
})));

const assetFiles = [
  "mercury-surface-normal.webp",
  "mercury-surface-normal@2x.webp",
  "mercury-surface-enhanced.webp",
  "mercury-surface-enhanced@2x.webp",
  "mercury-surface-topography.webp",
  "mercury-surface-topography@2x.webp",
  "mercury-poles.webp",
  "mercury-poles@2x.webp",
  ...Object.values(lightingBanks).flatMap((bank) =>
    bank.rows.map(({ url }) => url.split("/").at(-1))),
  "mercury-interior-outer.webp",
  "mercury-interior-outer@2x.webp",
  "mercury-interior-outer-poles.webp",
  "mercury-interior-outer-poles@2x.webp",
  "mercury-interior-core.webp",
  "mercury-interior-core@2x.webp",
  "mercury-interior-core-poles.webp",
  "mercury-interior-core-poles@2x.webp",
  "mercury-interior-section.webp",
  "mercury-interior-section@2x.webp",
  "mercury-lens-normal.webp",
  "mercury-lens-enhanced.webp",
  "mercury-lens-topography.webp",
  "mercury-lens-interior.webp",
];
const hashes = Object.fromEntries(await Promise.all(assetFiles.map(async (file) => {
  const bytes = await readFile(resolve(MERCURY_PUBLIC_ROOT, file));
  return [file, Object.freeze({
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  })];
})));

const prepared = Object.freeze({
  schema: "cssmercury-prepared-assets@1",
  sourceDimensions: Object.freeze({ width: SOURCE_WIDTH, height: SOURCE_HEIGHT }),
  surfaceDimensions: Object.freeze({ width: SURFACE_WIDTH, height: SURFACE_HEIGHT }),
  surfaces: Object.freeze(Object.fromEntries(surfaces.map(({
    id,
    falseColor,
    coverageCompletion,
  }) => [
    id,
    Object.freeze({
      id,
      falseColor,
      url: `/scenes/mercury/mercury-surface-${id}.webp`,
      url2x: `/scenes/mercury/mercury-surface-${id}@2x.webp`,
      sourcePositionVariable: "--mercury-surface-position",
      ...(coverageCompletion ? { coverageCompletion } : {}),
    }),
  ]))),
  poles: Object.freeze({
    url: "/scenes/mercury/mercury-poles.webp",
    url2x: "/scenes/mercury/mercury-poles@2x.webp",
    tileSize: POLAR_TILE,
    tileCount: surfaces.length * 2,
    order: Object.freeze(surfaces.flatMap(({ id }) => [`${id}-north`, `${id}-south`])),
  }),
  lighting: Object.freeze({
    schema: "cssmercury-prepared-lighting@3",
    storageModel: "prepared-full-resolution-density-row-shards",
    frameCount: LIGHT_FRAME_COUNT,
    presentationFrameSize: LIGHT_PRESENTATION_SIZE,
    defaultFrame: DEFAULT_LIGHT_FRAME_INDEX,
    preparedPixelDensities: Object.freeze([1, 2]),
    banks: lightingBanks,
    model: "prepared-full-phase-openspace-lambert-cubic-sky-sun-no-atmosphere",
    sourceRenderer:
      "OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl",
    rendererSourceSnapshot:
      "source/renderer/texturetilemapping-lighting.glsl",
    worldLightDirection: CUBIC_SKY_SUN.localDirection,
    sourceWorldLightDirection: OPENSPACE_WORLD_LIGHT_DIRECTION,
    ambientIntensity: OPENSPACE_AMBIENT_INTENSITY,
    shadowlessFloodLimbFloor: SHADOWLESS_FLOOD_LIMB_FLOOR,
    orenNayarRoughness: 0,
    terminatorSmoothstep: Object.freeze([0, 0.1]),
    minimumLightViewZ: MINIMUM_LIGHT_VIEW_Z,
    maximumLightViewZ: MAXIMUM_LIGHT_VIEW_Z,
    baseLightAzimuthDegrees: 0,
    defaultLightViewZ: DEFAULT_LIGHT_VIEW_Z,
    cameraContract: "unbounded-accumulated-matrix3d-phase-and-roll",
    runtimeRasterization: false,
  }),
  interior: Object.freeze({
    schema: "cssmercury-prepared-interior-assets@2",
    coreUrl: "/scenes/mercury/mercury-interior-core.webp",
    core2xUrl: "/scenes/mercury/mercury-interior-core@2x.webp",
    corePolesUrl: "/scenes/mercury/mercury-interior-core-poles.webp",
    corePoles2xUrl: "/scenes/mercury/mercury-interior-core-poles@2x.webp",
    sectionUrl: "/scenes/mercury/mercury-interior-section.webp",
    section2xUrl: "/scenes/mercury/mercury-interior-section@2x.webp",
    outerSurfaceUrl: "/scenes/mercury/mercury-interior-outer.webp",
    outerSurface2xUrl: "/scenes/mercury/mercury-interior-outer@2x.webp",
    outerPolesUrl: "/scenes/mercury/mercury-interior-outer-poles.webp",
    outerPoles2xUrl: "/scenes/mercury/mercury-interior-outer-poles@2x.webp",
    poleDimensions: Object.freeze({
      width: INTERIOR_POLE_TILE * 2,
      height: INTERIOR_POLE_TILE,
    }),
    textureDimensions: Object.freeze({
      width: INTERIOR_WIDTH,
      height: INTERIOR_HEIGHT,
    }),
    sectionDimensions: Object.freeze({
      width: INTERIOR_SECTION_WIDTH,
      height: INTERIOR_SECTION_HEIGHT,
    }),
    cutaway: structure.presentation.cutaway,
    metallicCoreRadiusFraction: structure.metallicCoreRadiusFraction,
    outerShellThicknessKm: structure.outerShellThicknessKm,
    publishedApproximateOuterShellThicknessKm:
      structure.publishedApproximateOuterShellThicknessKm,
    qualification: structure.structureQualification,
    presentationQualification: structure.presentation.qualification,
    presentationPalette: structure.presentation.palette,
    runtimeGeometry: false,
    runtimeRasterization: false,
  }),
  hashes: Object.freeze(hashes),
});

await writeFile(
  resolve(import.meta.dirname, "../runtime/preparedAssets.mjs"),
  "// Generated by tools/prepare-assets.mjs from declared local sources.\n" +
    `export const PREPARED_MERCURY_ASSETS = Object.freeze(${JSON.stringify(prepared)});\n`,
);
console.log(`Prepared ${assetFiles.length} Mercury scene assets.`);

async function sourceRgba(sourcePath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  if (info.width !== SOURCE_WIDTH || info.height !== SOURCE_HEIGHT ||
      info.channels !== 4) {
    throw new Error(`Mercury source dimensions drifted at ${sourcePath}.`);
  }
  return data;
}

function completeEnhancedCoverage(enhanced, normal, topography) {
  const rgba = Buffer.from(enhanced);
  const rowStats = Array.from({ length: SOURCE_HEIGHT }, () => ({
    red: 0,
    green: 0,
    blue: 0,
    detail: 0,
    count: 0,
  }));
  const reliableRow = new Int32Array(SOURCE_HEIGHT);
  const previousValidColumns = new Int32Array(SOURCE_WIDTH);
  const nextValidColumns = new Int32Array(SOURCE_WIDTH);
  let filledPixelCount = 0;

  for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
    const stats = rowStats[y];
    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const offset = (y * SOURCE_WIDTH + x) * 4;
      if (isNeutralNoData(enhanced, offset)) continue;
      stats.red += enhanced[offset];
      stats.green += enhanced[offset + 1];
      stats.blue += enhanced[offset + 2];
      stats.detail += coverageDetail(normal, topography, offset);
      stats.count += 1;
    }
  }
  const reliableRows = rowStats.flatMap((stats, row) =>
    stats.count >= SOURCE_WIDTH / 2 ? [row] : []);
  if (reliableRows.length === 0) {
    throw new Error("Mercury enhanced source has no reliable latitude row.");
  }
  let reliableIndex = 0;
  for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
    while (reliableIndex + 1 < reliableRows.length &&
        Math.abs(reliableRows[reliableIndex + 1] - y) <=
          Math.abs(reliableRows[reliableIndex] - y)) {
      reliableIndex += 1;
    }
    reliableRow[y] = reliableRows[reliableIndex];
  }

  for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
    let lastValidColumn = -1;
    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const offset = (y * SOURCE_WIDTH + x) * 4;
      if (!isNeutralNoData(enhanced, offset)) lastValidColumn = x;
      previousValidColumns[x] = lastValidColumn;
    }
    lastValidColumn = -1;
    for (let x = SOURCE_WIDTH - 1; x >= 0; x -= 1) {
      const offset = (y * SOURCE_WIDTH + x) * 4;
      if (!isNeutralNoData(enhanced, offset)) lastValidColumn = x;
      nextValidColumns[x] = lastValidColumn;
    }
    const row = rowStats[reliableRow[y]];
    const meanColor = [row.red, row.green, row.blue].map((value) =>
      value / row.count);
    const meanDetail = row.detail / row.count;
    const localWeight = rowStats[y].count >= SOURCE_WIDTH / 2 ? 0.35 : 0;

    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const targetOffset = (y * SOURCE_WIDTH + x) * 4;
      if (!isNeutralNoData(enhanced, targetOffset)) continue;
      const targetDetail = coverageDetail(normal, topography, targetOffset);
      const referenceColumn = nearestValidColumn(
        x,
        previousValidColumns[x],
        nextValidColumns[x],
      );
      let referenceColor = meanColor;
      let referenceDetail = meanDetail;
      if (localWeight > 0 && referenceColumn >= 0) {
        const referenceOffset = (y * SOURCE_WIDTH + referenceColumn) * 4;
        referenceColor = meanColor.map((value, channel) =>
          value * (1 - localWeight) +
          enhanced[referenceOffset + channel] * localWeight);
        referenceDetail = meanDetail * (1 - localWeight) +
          coverageDetail(normal, topography, referenceOffset) * localWeight;
      }
      const scale = clamp(targetDetail / Math.max(1, referenceDetail), 0.45, 2.2);
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[targetOffset + channel] = Math.round(clamp(
          referenceColor[channel] * scale,
          0,
          255,
        ));
      }
      const maximum = Math.max(
        rgba[targetOffset],
        rgba[targetOffset + 1],
        rgba[targetOffset + 2],
      );
      if (maximum < 24) {
        const lift = 24 / Math.max(1, maximum);
        for (let channel = 0; channel < 3; channel += 1) {
          rgba[targetOffset + channel] = Math.round(clamp(
            rgba[targetOffset + channel] * lift,
            0,
            255,
          ));
        }
      }
      rgba[targetOffset + 3] = 255;
      filledPixelCount += 1;
    }
  }

  return Object.freeze({
    rgba,
    metadata: Object.freeze({
      model: "prepared-latitude-coherent-enhanced-chroma-with-local-bdr-or-topography-detail",
      polarModel: "prepared-annulus-mean-enhanced-tint-with-bdr-detail",
      noDataRule: "neutral source pixels with maximum channel at most 18 and channel spread at most 6",
      filledPixelCount,
      filledFraction: Number((filledPixelCount /
        (SOURCE_WIDTH * SOURCE_HEIGHT)).toFixed(8)),
      referenceSources: Object.freeze([
        "usgs-messenger-bdr-global-z3",
        "usgs-messenger-topography-z3",
      ]),
      directEnhancedColorClaim: false,
      runtimeCompletion: false,
    }),
  });
}

function nearestValidColumn(target, previous, next) {
  if (previous < 0) return next;
  if (next < 0) return previous;
  return target - previous <= next - target ? previous : next;
}

function coverageDetail(normal, topography, offset) {
  const source = isNeutralNoData(normal, offset) ? topography : normal;
  return source[offset] * 0.2126 + source[offset + 1] * 0.7152 +
    source[offset + 2] * 0.0722;
}

function isNeutralNoData(source, offset) {
  const maximum = Math.max(source[offset], source[offset + 1], source[offset + 2]);
  const minimum = Math.min(source[offset], source[offset + 1], source[offset + 2]);
  return maximum <= 18 && maximum - minimum <= 6;
}

async function writeResponsiveSurface(id, rgba) {
  const packed = packProjectiveSurfaceRaster(rgba, {
    width: SOURCE_WIDTH,
    height: SOURCE_HEIGHT,
    channels: 4,
    bandCount: SURFACE_LATITUDE_BANDS,
    gutter: SOURCE_SURFACE_GUTTER,
  });
  const source = sharp(packed.data, {
    raw: {
      width: packed.packedWidth,
      height: packed.packedHeight,
      channels: 4,
    },
  });
  await Promise.all([
    source.clone()
      .resize(
        SURFACE_WIDTH + SURFACE_GUTTER * 2,
        SURFACE_HEIGHT + SURFACE_GUTTER * 2 * SURFACE_LATITUDE_BANDS,
        { kernel: "lanczos3" },
      )
      .webp({ quality: 88, smartSubsample: true })
      .toFile(resolve(MERCURY_PUBLIC_ROOT, `mercury-surface-${id}.webp`)),
    source.clone()
      .webp({ quality: 90, smartSubsample: true })
      .toFile(resolve(MERCURY_PUBLIC_ROOT, `mercury-surface-${id}@2x.webp`)),
  ]);
}

function orientLatitudeBands(
  source,
  bandCount,
  width = SOURCE_WIDTH,
  height = SOURCE_HEIGHT,
) {
  const bandHeight = height / bandCount;
  if (!Number.isInteger(bandHeight)) {
    throw new Error("Mercury latitude texture does not match its prepared grid.");
  }
  const output = Buffer.alloc(source.length);
  const rowBytes = width * 4;
  for (let band = 0; band < bandCount; band += 1) {
    const bandStart = band * bandHeight;
    for (let row = 0; row < bandHeight; row += 1) {
      const sourceRow = bandStart + row;
      const outputRow = bandStart + bandHeight - 1 - row;
      source.copy(
        output,
        outputRow * rowBytes,
        sourceRow * rowBytes,
        (sourceRow + 1) * rowBytes,
      );
    }
  }
  return output;
}

async function writePolarAtlas(
  surfacesToProject,
  tileSize,
  fileName,
  lossless = false,
) {
  const atlas = Buffer.alloc(tileSize * surfacesToProject.length * 2 * tileSize * 4);
  for (let surfaceIndex = 0; surfaceIndex < surfacesToProject.length; surfaceIndex += 1) {
    for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
      const north = poleIndex === 0;
      const surface = surfacesToProject[surfaceIndex];
      const projected = polarTile(surface.rgba, tileSize, north);
      const tile = surface.polarCoverageFallback
        ? completeEnhancedPolarTile(
          projected,
          polarTile(surface.polarCoverageFallback, tileSize, north),
          tileSize,
        )
        : projected;
      const tileOffsetX = (surfaceIndex * 2 + poleIndex) * tileSize;
      for (let y = 0; y < tileSize; y += 1) {
        tile.copy(
          atlas,
          (y * tileSize * surfacesToProject.length * 2 + tileOffsetX) * 4,
          y * tileSize * 4,
          (y + 1) * tileSize * 4,
        );
      }
    }
  }
  await sharp(atlas, {
    raw: {
      width: tileSize * surfacesToProject.length * 2,
      height: tileSize,
      channels: 4,
    },
  }).webp(lossless
    ? { lossless: true, alphaQuality: 100 }
    : { quality: 90, alphaQuality: 100 }).toFile(resolve(
    MERCURY_PUBLIC_ROOT,
    fileName,
  ));
}

function completeEnhancedPolarTile(enhanced, fallback, tileSize) {
  const output = Buffer.from(enhanced);
  const center = (tileSize - 1) / 2;
  let enhancedRed = 0;
  let enhancedGreen = 0;
  let enhancedBlue = 0;
  let fallbackLuminance = 0;
  let sampleCount = 0;
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const radius = Math.hypot(
        (x - center) / center,
        (y - center) / center,
      );
      if (radius < 0.68 || radius > 0.86) continue;
      const offset = (y * tileSize + x) * 4;
      if (enhanced[offset + 3] === 0 || fallback[offset + 3] === 0) continue;
      enhancedRed += enhanced[offset];
      enhancedGreen += enhanced[offset + 1];
      enhancedBlue += enhanced[offset + 2];
      fallbackLuminance += pixelLuminance(fallback, offset);
      sampleCount += 1;
    }
  }
  if (sampleCount === 0) {
    throw new Error("Mercury enhanced polar coverage has no reference annulus.");
  }
  const meanEnhanced = [
    enhancedRed / sampleCount,
    enhancedGreen / sampleCount,
    enhancedBlue / sampleCount,
  ];
  const meanEnhancedLuminance = meanEnhanced[0] * 0.2126 +
    meanEnhanced[1] * 0.7152 + meanEnhanced[2] * 0.0722;
  const meanFallbackLuminance = fallbackLuminance / sampleCount;
  const luminanceScale = meanEnhancedLuminance /
    Math.max(1, meanFallbackLuminance);
  const tint = meanEnhanced.map((channel) =>
    channel / Math.max(1, meanEnhancedLuminance));

  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const radius = Math.hypot(
        (x - center) / center,
        (y - center) / center,
      );
      if (radius > 0.7) continue;
      const offset = (y * tileSize + x) * 4;
      if (fallback[offset + 3] === 0) continue;
      const targetLuminance = Math.max(
        22,
        pixelLuminance(fallback, offset) * luminanceScale,
      );
      const prepared = tint.map((channel) => Math.round(clamp(
        channel * targetLuminance,
        0,
        255,
      )));
      const enhancedWeight = smoothstep(0.42, 0.7, radius);
      for (let channel = 0; channel < 3; channel += 1) {
        output[offset + channel] = Math.round(
          prepared[channel] * (1 - enhancedWeight) +
          enhanced[offset + channel] * enhancedWeight,
        );
      }
      output[offset + 3] = fallback[offset + 3];
    }
  }
  return output;
}

function pixelLuminance(source, offset) {
  return source[offset] * 0.2126 + source[offset + 1] * 0.7152 +
    source[offset + 2] * 0.0722;
}

function polarTile(source, tileSize, north, cutaway = null) {
  const tile = Buffer.alloc(tileSize * tileSize * 4);
  const center = (tileSize - 1) / 2;
  const capLatitudeSpan = Math.PI / 16;
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const radius = Math.hypot(dx, dy);
      const targetOffset = (y * tileSize + x) * 4;
      if (radius > 1) continue;
      const longitude = Math.atan2(dx, north ? -dy : dy);
      if (cutaway && angularDistance(
        Math.atan2(dy, dx) * 180 / Math.PI,
        cutaway.centerLongitudeDegrees,
      ) <= cutaway.widthDegrees / 2) continue;
      const latitude = (north ? 1 : -1) *
        (Math.PI / 2 - radius * capLatitudeSpan);
      const sourceX = Math.round(
        ((longitude / (Math.PI * 2) + 1) % 1) * (SOURCE_WIDTH - 1),
      );
      const sourceY = Math.round(
        (0.5 - latitude / Math.PI) * (SOURCE_HEIGHT - 1),
      );
      const sourceOffset = (sourceY * SOURCE_WIDTH + sourceX) * 4;
      source.copy(tile, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return tile;
}

async function writeInteriorOuterPoleAtlas(
  source,
  tileSize,
  fileName,
  cutaway,
) {
  const width = tileSize * 2;
  const atlas = Buffer.alloc(width * tileSize * 4);
  for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
    const tile = polarTile(source, tileSize, poleIndex === 0, cutaway);
    for (let row = 0; row < tileSize; row += 1) {
      tile.copy(
        atlas,
        (row * width + poleIndex * tileSize) * 4,
        row * tileSize * 4,
        (row + 1) * tileSize * 4,
      );
    }
  }
  await sharp(atlas, {
    raw: { width, height: tileSize, channels: 4 },
  }).webp({ lossless: true, alphaQuality: 100 }).toFile(resolve(
    MERCURY_PUBLIC_ROOT,
    fileName,
  ));
}

async function writeLightingBank(pixelDensity) {
  const frameSize = LIGHT_FRAME * pixelDensity;
  const rowCount = Math.ceil(LIGHT_FRAME_COUNT / LIGHT_COLUMNS);
  const rows = [];
  const presentations = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const firstFrame = rowIndex * LIGHT_COLUMNS;
    const frameCount = Math.min(
      LIGHT_COLUMNS,
      LIGHT_FRAME_COUNT - firstFrame,
    );
    const width = frameSize * frameCount;
    const pixels = Buffer.alloc(width * frameSize * 4);
    for (let column = 0; column < frameCount; column += 1) {
      const frameIndex = firstFrame + column;
      const frame = lightingFrame(frameSize, frameIndex);
      for (let y = 0; y < frameSize; y += 1) {
        frame.copy(
          pixels,
          (y * width + column * frameSize) * 4,
          y * frameSize * 4,
          (y + 1) * frameSize * 4,
        );
      }
      presentations.push(Object.freeze({
        frameIndex,
        rowIndex,
        url: `/scenes/mercury/mercury-lighting-${pixelDensity}x-row-${
          String(rowIndex).padStart(2, "0")
        }.webp`,
        backgroundPosition:
          `${-column * LIGHT_PRESENTATION_SIZE}px 0px`,
        backgroundSize:
          `${frameCount * LIGHT_PRESENTATION_SIZE}px ` +
          `${LIGHT_PRESENTATION_SIZE}px`,
      }));
    }
    const fileName = `mercury-lighting-${pixelDensity}x-row-${
      String(rowIndex).padStart(2, "0")
    }.webp`;
    const path = resolve(MERCURY_PUBLIC_ROOT, fileName);
    await sharp(pixels, {
      raw: { width, height: frameSize, channels: 4 },
    }).webp({ lossless: true, alphaQuality: 100 }).toFile(path);
    const bytes = await readFile(path);
    rows.push(Object.freeze({
      rowIndex,
      url: `/scenes/mercury/${fileName}`,
      encoding: "lossless-webp",
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width,
      height: frameSize,
      decodedRgbaBytes: width * frameSize * 4,
      firstFrame,
      frameCount,
    }));
  }
  const defaultRow = Math.floor(DEFAULT_LIGHT_FRAME_INDEX / LIGHT_COLUMNS);
  const initialWarmRows = Object.freeze([
    Math.max(0, defaultRow - 1),
    defaultRow,
    Math.min(rowCount - 1, defaultRow + 1),
  ]);
  const initialDecodedWorkingSetBytes = initialWarmRows.reduce(
    (total, rowIndex) => total + rows[rowIndex].decodedRgbaBytes,
    0,
  );
  return Object.freeze({
    schema: "cssmercury-prepared-lighting-bank@1",
    preparedPixelDensity: pixelDensity,
    frameSize,
    presentationFrameSize: LIGHT_PRESENTATION_SIZE,
    transport: Object.freeze({
      model: "row-shard-cache",
      encoding: "lossless-webp",
      preloadBeforeMount: true,
      retainedLeafCount: 1,
      interpolation: "nearest-prepared-camera-frame",
      framesPerRow: LIGHT_COLUMNS,
      rowCount,
      defaultFrame: DEFAULT_LIGHT_FRAME_INDEX,
      defaultRow,
      initialWarmRows,
      maximumRetainedRowCount: 3,
      addressWritesOnlyOnInput: true,
      retainLastReadyPresentation: true,
      idleCallbacks: 0,
      initialDecodedWorkingSetBytes,
      maximumDecodedWorkingSetBytes: initialDecodedWorkingSetBytes,
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

async function removeObsoleteLightingAssets() {
  const files = await readdir(MERCURY_PUBLIC_ROOT);
  await Promise.all(files.filter((fileName) =>
    /^mercury-lighting(?:-default)?(?:@2x)?\.webp$/u.test(fileName) ||
    /^mercury-lighting-[12]x-row-\d+\.webp$/u.test(fileName))
    .map((fileName) => rm(resolve(MERCURY_PUBLIC_ROOT, fileName), {
      force: true,
    })));
}

function lightingFrame(size, frameIndex) {
  const pixels = Buffer.alloc(size * size * 4);
  const lightViewZ = MINIMUM_LIGHT_VIEW_Z +
    (MAXIMUM_LIGHT_VIEW_Z - MINIMUM_LIGHT_VIEW_Z) *
      frameIndex / (LIGHT_FRAME_COUNT - 1);
  const light = [Math.sqrt(Math.max(0, 1 - lightViewZ ** 2)), 0, lightViewZ];
  const center = (size - 1) / 2;
  // Extend the prepared material to the retained sphere silhouette. The
  // projective surface overlap is intentionally larger than the nominal
  // radius, so a smaller lighting disc would leave an unlit bright rim.
  const radius = size * 0.505;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) / radius;
      const ny = (y - center) / radius;
      const radialSquared = nx * nx + ny * ny;
      if (radialSquared > 1) continue;
      const nz = Math.sqrt(1 - radialSquared);
      const direct = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
      const directIllumination = smoothstep(0, 0.1, direct) * direct;
      const illumination = frameIndex === LIGHT_FRAME_COUNT - 1
        ? SHADOWLESS_FLOOD_LIMB_FLOOR +
          directIllumination * (1 - SHADOWLESS_FLOOD_LIMB_FLOOR)
        : OPENSPACE_AMBIENT_INTENSITY + directIllumination;
      const alpha = Math.round(clamp(1 - illumination, 0, 0.95) * 255);
      const offset = (y * size + x) * 4;
      pixels[offset + 3] = alpha;
    }
  }
  return pixels;
}

async function writeInteriorLayer(width, height, fileName, kind) {
  const pixels = Buffer.alloc(width * height * 4);
  const base = structure.presentation.palette.metallicCore;
  const light = normalize(OPENSPACE_WORLD_LIGHT_DIRECTION);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = (x + 0.5) / width * Math.PI * 2;
      const normal = [
        Math.cos(latitude) * Math.cos(longitude),
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
      ];
      const direct = Math.max(0,
        normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
      const illumination = 0.72 + direct * 0.28;
      const broad = Math.sin(latitude * 7 + Math.sin(longitude * 3) * 0.55) * 5;
      const grain = multiScaleNoise(x, y, kind === "core" ? 71 : 43) * 15;
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(clamp((base[0] + broad + grain) * illumination, 0, 255));
      pixels[offset + 1] = Math.round(clamp((base[1] + broad * 0.7 + grain * 0.65) * illumination, 0, 255));
      pixels[offset + 2] = Math.round(clamp((base[2] + broad * 0.45 + grain * 0.4) * illumination, 0, 255));
      pixels[offset + 3] = 255;
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, alphaQuality: 100 })
    .toFile(resolve(MERCURY_PUBLIC_ROOT, fileName));
}

async function writeInteriorCorePoleAtlas(tileSize, fileName, cutaway) {
  const width = tileSize * 2;
  const pixels = Buffer.alloc(width * tileSize * 4);
  const base = structure.presentation.palette.metallicCore;
  const light = normalize(OPENSPACE_WORLD_LIGHT_DIRECTION);
  for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
    for (let y = 0; y < tileSize; y += 1) {
      const py = (y + 0.5) / tileSize * 2 - 1;
      for (let x = 0; x < tileSize; x += 1) {
        const px = (x + 0.5) / tileSize * 2 - 1;
        const radius = Math.hypot(px, py);
        if (radius > 1) continue;
        if (angularDistance(
          Math.atan2(py, px) * 180 / Math.PI,
          cutaway.centerLongitudeDegrees,
        ) <= cutaway.widthDegrees / 2) continue;
        const pz = Math.sqrt(Math.max(0, 1 - radius * radius)) *
          (poleIndex === 0 ? 1 : -1);
        const direct = Math.max(0,
          px * light[0] + py * light[1] + pz * light[2]);
        const illumination = 0.68 + direct * 0.32;
        const grain = multiScaleNoise(x, y, poleIndex + 101) * 11;
        const offset = (y * width + poleIndex * tileSize + x) * 4;
        pixels[offset] = Math.round(clamp(
          base[0] * illumination + grain,
          0,
          255,
        ));
        pixels[offset + 1] = Math.round(clamp(
          base[1] * illumination + grain * 0.72,
          0,
          255,
        ));
        pixels[offset + 2] = Math.round(clamp(
          base[2] * illumination + grain * 0.45,
          0,
          255,
        ));
        pixels[offset + 3] = 255;
      }
    }
  }
  await sharp(pixels, {
    raw: { width, height: tileSize, channels: 4 },
  }).webp({ lossless: true, alphaQuality: 100 }).toFile(resolve(
    MERCURY_PUBLIC_ROOT,
    fileName,
  ));
}

async function writeInteriorSection(width, height, fileName, source) {
  if (width % 2 !== 0) {
    throw new Error("Mercury interior section atlas width must be even.");
  }
  const pixels = Buffer.alloc(width * height * 4);
  const coreRadius = source.metallicCoreRadiusFraction;
  const faceWidth = width / 2;
  const faceLongitudes = [
    source.presentation.cutaway.centerLongitudeDegrees -
      source.presentation.cutaway.widthDegrees / 2,
    source.presentation.cutaway.centerLongitudeDegrees +
      source.presentation.cutaway.widthDegrees / 2,
  ];
  const objectLight = normalize(OPENSPACE_WORLD_LIGHT_DIRECTION);
  const edge = 2.5 / Math.min(faceWidth, height);
  for (let faceIndex = 0; faceIndex < 2; faceIndex += 1) {
    const longitude = faceLongitudes[faceIndex] * Math.PI / 180;
    const faceNormal = [-Math.sin(longitude), Math.cos(longitude), 0];
    const faceExposure = Math.abs(
      faceNormal[0] * objectLight[0] + faceNormal[1] * objectLight[1],
    );
    const faceLight = 0.72 + faceExposure * 0.22;
    for (let y = 0; y < height; y += 1) {
      const vertical = (y + 0.5) / height * 2 - 1;
      for (let x = 0; x < faceWidth; x += 1) {
        const radialAxis = (x + 0.5) / faceWidth;
        const radial = Math.hypot(radialAxis, vertical);
        if (radial > 1 + edge) continue;
        const core = radial <= coreRadius;
        const base = core
          ? source.presentation.palette.metallicCore
          : source.presentation.palette.combinedMantleCrust;
        const grain = multiScaleNoise(
          x,
          y,
          width + height + faceIndex * 97,
        ) * (core ? 11 : 7);
        const contact = 1 - 0.24 * Math.exp(-Math.pow(
          Math.abs(radial - coreRadius) / 0.012,
          2,
        ));
        const outerRim = 0.72 + 0.28 * smoothstep(0, 0.055, 1 - radial);
        const depth = Math.sqrt(Math.max(0, 1 - radial * radial));
        const lighting = faceLight *
          (0.8 + 0.2 * depth) *
          (1 + smoothstep(0.82, 1, radial) * 0.06) *
          outerRim * contact;
        const offset = (y * width + faceIndex * faceWidth + x) * 4;
        pixels[offset] = Math.round(clamp(
          (base[0] + grain) * lighting,
          0,
          255,
        ));
        pixels[offset + 1] = Math.round(clamp(
          (base[1] + grain * 0.65) * lighting,
          0,
          255,
        ));
        pixels[offset + 2] = Math.round(clamp(
          (base[2] + grain * 0.4) * lighting,
          0,
          255,
        ));
        pixels[offset + 3] = Math.round(
          (1 - smoothstep(1 - edge, 1 + edge, radial)) * 255,
        );
      }
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, alphaQuality: 100 })
    .toFile(resolve(MERCURY_PUBLIC_ROOT, fileName));
}

async function writeLensThumbnails() {
  await Promise.all([
    ...["normal", "enhanced", "topography"].map((id) => sharp(resolve(
      MERCURY_PUBLIC_ROOT,
      `mercury-surface-${id}.webp`,
    )).extract({ left: 875, top: 363, width: 298, height: 298 })
      .resize(28, 28, { kernel: "lanczos3" })
      .webp({ quality: 90 })
      .toFile(resolve(MERCURY_PUBLIC_ROOT, `mercury-lens-${id}.webp`))),
    sharp(resolve(MERCURY_PUBLIC_ROOT, "mercury-interior-section.webp"))
      .extract({
        left: 0,
        top: 0,
        width: INTERIOR_SECTION_WIDTH / 2,
        height: INTERIOR_SECTION_HEIGHT,
      })
      .resize(28, 28, { kernel: "lanczos3" })
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(resolve(MERCURY_PUBLIC_ROOT, "mercury-lens-interior.webp")),
  ]);
}

function preparedNoise(x, y, size) {
  const value = Math.sin((x * 12.9898 + y * 78.233 + size * 0.001) * 43758.5453);
  return value - Math.floor(value);
}

function multiScaleNoise(x, y, size) {
  return (preparedNoise(x, y, size) - 0.5) * 0.56 +
    (preparedNoise(Math.floor(x / 4), Math.floor(y / 4), size + 17) - 0.5) *
      0.31 +
    (preparedNoise(Math.floor(x / 13), Math.floor(y / 13), size + 43) - 0.5) *
      0.13;
}

function shadeInteriorOuter(source) {
  const output = Buffer.alloc(source.length);
  const light = normalize(OPENSPACE_WORLD_LIGHT_DIRECTION);
  for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
    const latitude = -Math.PI / 2 + (y + 0.5) / SOURCE_HEIGHT * Math.PI;
    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const longitude = (x + 0.5) / SOURCE_WIDTH * Math.PI * 2;
      const normal = [
        Math.cos(latitude) * Math.cos(longitude),
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
      ];
      const direct = Math.max(0,
        normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
      const illumination = OPENSPACE_AMBIENT_INTENSITY +
        smoothstep(0, 0.1, direct) * direct;
      const offset = (y * SOURCE_WIDTH + x) * 4;
      output[offset] = Math.round(source[offset] * illumination);
      output[offset + 1] = Math.round(source[offset + 1] * illumination);
      output[offset + 2] = Math.round(source[offset + 2] * illumination);
      output[offset + 3] = source[offset + 3];
    }
  }
  return output;
}

async function writeInteriorOuterSurface(rgba, width, height, fileName) {
  await sharp(rgba, {
    raw: { width: SOURCE_WIDTH, height: SOURCE_HEIGHT, channels: 4 },
  }).resize(width, height, { kernel: "lanczos3" })
    .webp({ lossless: true, alphaQuality: 100 })
    .toFile(resolve(MERCURY_PUBLIC_ROOT, fileName));
}

function validPalette(palette) {
  return ["combinedMantleCrust", "metallicCore", "layerContact"].every(
    (key) => Array.isArray(palette?.[key]) && palette[key].length === 3 &&
      palette[key].every((channel) => Number.isInteger(channel) &&
        channel >= 0 && channel <= 255),
  );
}

function normalize(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(start, end, value) {
  const amount = clamp((value - start) / (end - start), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function angularDistance(left, right) {
  return Math.abs(((left - right + 540) % 360) - 180);
}
