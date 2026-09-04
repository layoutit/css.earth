import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { packProjectiveSurfaceRaster } from
  "../../../platform/projective-surface-raster.mjs";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";
import {
  ensureSaturnPreparationDirectories,
  SATURN_PUBLIC_ROOT,
  SATURN_STAGING_ROOT,
} from "./preparation-paths.mjs";

await validateSaturnSourceGroup("lenses");
await ensureSaturnPreparationDirectories();

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(objectRoot, "source/lenses");
const publicRoot = SATURN_PUBLIC_ROOT;
const stagingRoot = SATURN_STAGING_ROOT;
const modulePath = resolve(objectRoot, "runtime/preparedLenses.mjs");
const bodyWidth = 2880;
const bodyHeight = 1440;
const body2xWidth = 4096;
const body2xHeight = 2048;
const latitudeBandCount = 16;
const detailBlurSigma = 3;
const detailGain = 3;
const minimumDetailScale = 0.88;
const maximumDetailScale = 1.12;
const ringOuterKm = 140_612;
const poleTileSize = 512;
const poleAtlasWidth = 4096;
const poleAtlasHeight = 512;
const polarBoundaryLatitude = Math.PI / 2 - Math.PI / 16;
const materialModes = Object.freeze([
  "full",
  "no-shadows",
  "ringless",
  "ringless-no-shadows",
]);
const materialVariantId = (lensId, mode) =>
  mode === "full" ? lensId : `${lensId}-${mode}`;

const lensPlans = Object.freeze([
  Object.freeze({
    id: "ultraviolet",
    label: "Ultraviolet",
    shortLabel: "UV",
    filter: "F225W",
    wavelength: "225 nm",
    sourceFiles: Object.freeze([
      "hlsp_opal_hst_wfc3-uvis_saturn-2025a_f225w_v1_globalmap.fits",
      "hlsp_opal_hst_wfc3-uvis_saturn-2025b_f225w_v1_globalmap.fits",
    ]),
    detailSourceIndex: 0,
    sourceKind: "hubble-global-map",
    palette: Object.freeze([[9, 7, 28], [82, 45, 142], [226, 207, 255]]),
    ringPalette: Object.freeze([[18, 14, 39], [101, 80, 149], [205, 188, 235]]),
    ringGain: 0.62,
    materialGain: 0.72,
    ringBands: Object.freeze({ d: 0.35, c: 0.47, b: 0.715, a: 1, f: 0.9 }),
  }),
  Object.freeze({
    id: "methane",
    label: "Methane",
    shortLabel: "CH4",
    filter: "FQ889N",
    wavelength: "889 nm",
    sourceFiles: Object.freeze([
      "hlsp_opal_hst_wfc3-uvis_saturn-2025a_fq889n_v1_globalmap.fits",
      "hlsp_opal_hst_wfc3-uvis_saturn-2025b_fq889n_v1_globalmap.fits",
    ]),
    detailSourceIndex: 0,
    sourceKind: "hubble-global-map",
    palette: Object.freeze([[2, 13, 17], [16, 79, 91], [190, 241, 235]]),
    ringPalette: Object.freeze([[18, 52, 58], [105, 173, 173], [235, 255, 248]]),
    ringGain: 1.2,
    materialGain: 0.88,
    ringBands: Object.freeze({ d: 0.3, c: 0.288, b: 0.917, a: 0.905, f: 0.811 }),
  }),
  Object.freeze({
    id: "thermal",
    label: "Thermal",
    shortLabel: "IR",
    filter: "VIMS/CIRS",
    wavelength: "1.19-1000 um",
    sourceKind: "cassini-informed-thermal-model",
    sourceFiles: Object.freeze([]),
    sourceUrls: Object.freeze([
      "https://science.nasa.gov/photojournal/high-contrast-infrared-scan-of-saturn-and-its-rings/",
      "https://science.nasa.gov/mission/cassini/spacecraft/cassini-orbiter/composite-infrared-spectrometer/",
    ]),
    palette: Object.freeze([[5, 4, 10], [121, 35, 21], [255, 190, 74]]),
    ringPalette: Object.freeze([[6, 4, 10], [92, 35, 24], [232, 143, 65]]),
    ringGain: 0.9,
    materialGain: 0.84,
    ringBands: Object.freeze({ d: 0.52, c: 0.88, b: 0.66, a: 0.77, f: 0.9 }),
  }),
]);

const normalAssets = Object.freeze({
  surface: resolve(stagingRoot, "saturn-surface.jpg"),
  poles: resolve(publicRoot, "saturn-poles.webp"),
  rings: resolve(publicRoot, "saturn-rings.webp"),
  rings2x: resolve(publicRoot, "saturn-rings@2x.webp"),
  materials: Object.freeze(Object.fromEntries(materialModes.map((mode) => {
    const variantId = materialVariantId("normal", mode);
    return [mode, resolve(
      stagingRoot,
      variantId === "normal"
        ? "saturn-orbit-material.webp"
        : `saturn-orbit-material-${variantId}.webp`,
    )];
  }))),
  interiorMaterials: Object.freeze(Object.fromEntries(materialModes.map(
    (mode) => {
      const variantId = materialVariantId("normal", mode);
      return [mode, resolve(
        stagingRoot,
        variantId === "normal"
          ? "saturn-interior-atmosphere.webp"
          : `saturn-interior-atmosphere-${variantId}.webp`,
      )];
    },
  ))),
});
const highResolutionDetailPromise = prepareHighResolutionDetailCarrier();

const prepared = [];
await prepareThumbnail(normalAssets.surface, resolve(publicRoot, "saturn-lens-normal.webp"));
for (const plan of lensPlans) prepared.push(await prepareLens(plan));

const descriptor = Object.freeze({
  schema: "csssaturn-prepared-lenses@1",
  defaultLens: "normal",
  runtimeFilters: false,
  runtimeRasterization: false,
  controls: Object.freeze([
    Object.freeze({
      id: "normal",
      materialLens: "normal",
      label: "Normal",
      shortLabel: "RGB",
      thumbnailUrl: "/scenes/saturn/saturn-lens-normal.webp",
      surfaceUrl: "/scenes/saturn/saturn-surface-body.jpg",
      polesUrl: "/scenes/saturn/saturn-poles.webp",
      ringUrl: "/scenes/saturn/saturn-rings.webp",
      ring2xUrl: "/scenes/saturn/saturn-rings@2x.webp",
      materialUrl: "/scenes/saturn/saturn-orbit-material.webp",
      qualification: "visible-color reference",
    }),
    ...prepared,
    Object.freeze({
      id: "cross-section",
      label: "Cross section",
      shortLabel: "CUT",
      thumbnailUrl: "/scenes/saturn/saturn-view-interior.webp",
      view: "interior",
      materialLens: "normal",
      interiorMaterialUrl: "/scenes/saturn/saturn-interior-atmosphere.webp",
      qualification:
        "schematic source-backed interior using the normal visible-color material",
    }),
  ]),
  provenance: Object.freeze({
    bodyAuthority: "Hubble OPAL Cycle 32 Saturn global maps",
    bodySourceUrl: "https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-32",
    bodyDetailAuthority: "OpenSpace synchronized visible-light Saturn surface",
    ringAuthority: "Hubble WFC3 program 17843, 2025-08-29",
    ringProducts: Object.freeze(["ifcu37ccq", "ifcu37cdq", "ifcu37ceq"]),
    ringMethod:
      "broad source-derived spectral response over unchanged prepared OpenSpace radial morphology",
    fineRingQualification:
      "D, G, E and unresolved ringlets retain the visible-light morphology because the Hubble frames do not resolve a complete replacement profile",
    thermalAuthority:
      "Cassini VIMS PIA17469 infrared response and Cassini CIRS atmospheric and ring thermal measurements",
    thermalMethod:
      "prepared source-informed thermal response over the synchronized visible-light morphology; not a direct global temperature retrieval",
  }),
});
await writeFile(
  modulePath,
  `// Generated by tools/prepare-lenses.mjs.\nexport const PREPARED_SATURN_LENSES = ${JSON.stringify(descriptor)};\n`,
);
console.log(`Prepared ${prepared.length} source-backed Saturn lenses.`);

async function prepareLens(plan) {
  const surfacePath = resolve(publicRoot, `saturn-surface-${plan.id}.webp`);
  const surface2xPath = resolve(publicRoot, `saturn-surface-${plan.id}@2x.webp`);
  const preparedSurface = plan.sourceKind === "cassini-informed-thermal-model"
    ? await prepareThermalSurface(plan)
    : await prepareHubbleSurface(plan);
  const bodyData = preparedSurface.data;
  await Promise.all([
    writeProjectiveSurface(
      preparedSurface,
      body2xWidth / 2,
      body2xHeight / 2,
      surfacePath,
    ),
    writeProjectiveSurface(
      preparedSurface,
      body2xWidth,
      body2xHeight,
      surface2xPath,
    ),
  ]);

  const body = { data: bodyData, info: preparedSurface.info };
  const polesPath = resolve(publicRoot, `saturn-poles-${plan.id}.webp`);
  await preparePolarAtlas(body, plan, polesPath);

  const ringPath = resolve(publicRoot, `saturn-rings-${plan.id}.webp`);
  const ring2xPath = resolve(publicRoot, `saturn-rings-${plan.id}@2x.webp`);
  await Promise.all([
    prepareRing(normalAssets.rings, ringPath, plan),
    prepareRing(normalAssets.rings2x, ring2xPath, plan),
  ]);

  const materialPaths = Object.freeze(Object.fromEntries(materialModes.map(
    (mode) => {
      const variantId = materialVariantId(plan.id, mode);
      return [mode, Object.freeze({
        exterior: resolve(
          stagingRoot,
          `saturn-orbit-material-${variantId}.webp`,
        ),
        interior: resolve(
          stagingRoot,
          `saturn-interior-atmosphere-${variantId}.webp`,
        ),
      })];
    },
  )));
  await Promise.all(materialModes.flatMap((mode) => [
    prepareMaterial(
      normalAssets.materials[mode],
      materialPaths[mode].exterior,
      plan,
    ),
    prepareMaterial(
      normalAssets.interiorMaterials[mode],
      materialPaths[mode].interior,
      plan,
    ),
  ]));
  const thumbnailPath = resolve(publicRoot, `saturn-lens-${plan.id}.webp`);
  await prepareThumbnail(surfacePath, thumbnailPath);
  const assets = await Promise.all([
    surfacePath,
    surface2xPath,
    polesPath,
    ringPath,
    ring2xPath,
    ...materialModes.flatMap((mode) => [
      materialPaths[mode].exterior,
      materialPaths[mode].interior,
    ]),
    thumbnailPath,
  ].map((assetPath) => readFile(assetPath)));
  return Object.freeze({
    id: plan.id,
    materialLens: plan.id,
    label: plan.label,
    shortLabel: plan.shortLabel,
    filter: plan.filter,
    wavelength: plan.wavelength,
    thumbnailUrl: `/scenes/saturn/saturn-lens-${plan.id}.webp`,
    surfaceUrl: `/scenes/saturn/saturn-surface-${plan.id}.webp`,
    surface2xUrl: `/scenes/saturn/saturn-surface-${plan.id}@2x.webp`,
    polesUrl: `/scenes/saturn/saturn-poles-${plan.id}.webp`,
    ringUrl: `/scenes/saturn/saturn-rings-${plan.id}.webp`,
    ring2xUrl: `/scenes/saturn/saturn-rings-${plan.id}@2x.webp`,
    materialVariant: plan.id,
    materialPreparationFile: `saturn-orbit-material-${plan.id}.webp`,
    interiorMaterialPreparationFile:
      `saturn-interior-atmosphere-${plan.id}.webp`,
    materialModes,
    falseColorPalette: plan.palette,
    materialGain: plan.materialGain,
    sourceModel: plan.sourceKind,
    falseColor: true,
    qualification: plan.sourceKind === "hubble-global-map"
      ? `${plan.filter} single-band Hubble data shown with a declared false-color palette`
      : "Cassini VIMS/CIRS-informed thermal false color over prepared high-resolution morphology; not a direct global temperature retrieval",
    detailPreparation: plan.sourceKind === "hubble-global-map"
      ? "intact rotation A, lossless DPR surfaces, bounded visible-detail pansharpening"
      : "prepared Cassini-informed cloud-window and latitude response over lossless DPR morphology",
    detailCarrierUrl: "/scenes/saturn/saturn-surface.jpg",
    maximumDetailScale: plan.sourceKind === "hubble-global-map"
      ? maximumDetailScale
      : 1,
    sourceFiles: Object.freeze(plan.sourceKind === "hubble-global-map"
      ? [plan.sourceFiles[plan.detailSourceIndex]]
      : []),
    sourceUrls: Object.freeze(plan.sourceUrls ?? []),
    assetSha256: Object.freeze({
      surface: digest(assets[0]),
      surface2x: digest(assets[1]),
      poles: digest(assets[2]),
      rings: digest(assets[3]),
      rings2x: digest(assets[4]),
      material: digest(assets[5]),
      interiorMaterial: digest(assets[6]),
      materialNoShadows: digest(assets[7]),
      interiorMaterialNoShadows: digest(assets[8]),
      materialRingless: digest(assets[9]),
      interiorMaterialRingless: digest(assets[10]),
      materialRinglessNoShadows: digest(assets[11]),
      interiorMaterialRinglessNoShadows: digest(assets[12]),
      thumbnail: digest(assets[13]),
    }),
  });
}

async function writeProjectiveSurface(source, width, height, outputPath) {
  const resized = await sharp(source.data, { raw: source.info })
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const packed = packProjectiveSurfaceRaster(resized.data, {
    width,
    height,
    channels: resized.info.channels,
    bandCount: latitudeBandCount,
    gutter: height / latitudeBandCount / 4,
  });
  await sharp(packed.data, { raw: {
    width: packed.packedWidth,
    height: packed.packedHeight,
    channels: resized.info.channels,
  } })
    .webp({ lossless: true, effort: 6 })
    .toFile(outputPath);
}

async function prepareHubbleSurface(plan) {
  const maps = await Promise.all(plan.sourceFiles.map(async (filename) =>
    readFitsPrimary(await readFile(resolve(sourceRoot, filename)))));
  if (maps.some(({ width, height }) => width !== 1800 || height !== 900)) {
    throw new Error(`${plan.id} Hubble map dimensions changed.`);
  }
  const detailMap = selectHighResolutionMap(maps, plan.detailSourceIndex);
  maskPreparedRingOcclusion(detailMap);
  fillMissingColumns(detailMap.values, detailMap.coverage, detailMap.width, detailMap.height);
  const [low, high] = finitePercentiles(detailMap.values, 0.01, 0.995);
  const sourceRgba = falseColorMap(detailMap, plan.palette, low, high);
  const spectralSurface = await sharp(sourceRgba, {
    raw: { width: detailMap.width, height: detailMap.height, channels: 4 },
  }).resize(bodyWidth, bodyHeight, { kernel: sharp.kernel.lanczos3 })
    .raw().toBuffer({ resolveWithObject: true });
  const highResolutionDetail = await highResolutionDetailPromise;
  return Object.freeze({
    data: applyHighResolutionDetail(spectralSurface.data, highResolutionDetail),
    info: spectralSurface.info,
  });
}

async function prepareThermalSurface(plan) {
  const detail = await highResolutionDetailPromise;
  const { width, height } = detail.source.info;
  const output = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const latitude = (0.5 - (row + 0.5) / height) * Math.PI;
    const polarEmission = Math.pow(Math.abs(Math.sin(latitude)), 5);
    for (let column = 0; column < width; column += 1) {
      const offset = (row * width + column) * 4;
      const sourceLuminance = luminance(detail.source.data, offset);
      const localLuminance = luminance(detail.blurred, offset);
      const broadCloudWindow = 1 - localLuminance / 255;
      const fineCloudWindow = clamp01(
        0.5 + (localLuminance - sourceLuminance) / 44,
      );
      const longitude = (column + 0.5) / width * Math.PI * 2;
      const bandStructure = Math.sin(
        latitude * 34 + Math.sin(longitude * 3) * 0.42,
      ) * 0.035;
      const intensity = clamp01(
        0.12 + broadCloudWindow * 0.46 + fineCloudWindow * 0.3 +
        polarEmission * 0.1 + bandStructure,
      );
      const color = samplePalette(plan.palette, Math.pow(intensity, 0.84));
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
      output[offset + 3] = detail.source.data[offset + 3];
    }
  }
  return Object.freeze({
    data: output,
    info: Object.freeze({ width, height, channels: 4 }),
  });
}

function readFitsPrimary(bytes) {
  let offset = 0;
  const header = new Map();
  while (offset + 80 <= bytes.length) {
    const card = bytes.subarray(offset, offset + 80).toString("ascii");
    offset += 80;
    const key = card.slice(0, 8).trim();
    if (key === "END") break;
    if (card.slice(8, 10) !== "= ") continue;
    header.set(key, card.slice(10).split("/")[0].trim().replace(/^'|'$/g, ""));
  }
  offset = Math.ceil(offset / 2880) * 2880;
  const bitpix = Number(header.get("BITPIX"));
  const width = Number(header.get("NAXIS1"));
  const height = Number(header.get("NAXIS2"));
  if (bitpix !== -32 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
    throw new Error("Hubble OPAL FITS primary image schema changed.");
  }
  const values = new Float32Array(width * height);
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, values.length * 4);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = view.getFloat32(index * 4, false);
  }
  return { width, height, values };
}

function selectHighResolutionMap(maps, sourceIndex) {
  const source = maps[sourceIndex];
  if (!source) throw new RangeError(`Missing Hubble detail source ${sourceIndex}.`);
  const values = new Float32Array(source.values);
  const coverage = new Uint8Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value) && value > 0.001) coverage[index] = 1;
  }
  return { width: source.width, height: source.height, values, coverage };
}

async function prepareHighResolutionDetailCarrier() {
  const source = await sharp(normalAssets.surface).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  if (source.info.width !== bodyWidth || source.info.height !== bodyHeight) {
    throw new Error("OpenSpace Saturn detail-carrier dimensions changed.");
  }
  const blurred = await sharp(normalAssets.surface).blur(detailBlurSigma)
    .ensureAlpha().raw().toBuffer();
  return Object.freeze({ source, blurred });
}

function applyHighResolutionDetail(spectral, detail) {
  const output = Buffer.from(spectral);
  for (let offset = 0; offset < output.length; offset += 4) {
    const detailLuminance = luminance(detail.source.data, offset);
    const localLuminance = luminance(detail.blurred, offset);
    const scale = Math.max(minimumDetailScale, Math.min(
      maximumDetailScale,
      1 + (detailLuminance - localLuminance) /
        Math.max(12, localLuminance) * detailGain,
    ));
    for (let channel = 0; channel < 3; channel += 1) {
      output[offset + channel] = Math.round(Math.max(
        0,
        Math.min(255, output[offset + channel] * scale),
      ));
    }
  }
  return output;
}

function luminance(data, offset) {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 +
    data[offset + 2] * 0.0722;
}

function maskPreparedRingOcclusion(map) {
  const firstRow = 429;
  const lastRow = 449;
  for (let y = firstRow; y <= lastRow; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      map.coverage[y * map.width + x] = 0;
    }
  }
}

function fillMissingColumns(values, coverage, width, height) {
  for (let x = 0; x < width; x += 1) {
    const validRows = [];
    for (let y = 0; y < height; y += 1) {
      if (coverage[y * width + x]) validRows.push(y);
    }
    if (validRows.length === 0) continue;
    let cursor = 0;
    for (let y = 0; y < height; y += 1) {
      const index = y * width + x;
      if (coverage[index]) continue;
      while (cursor < validRows.length && validRows[cursor] < y) cursor += 1;
      const upper = validRows[Math.min(cursor, validRows.length - 1)];
      const lower = validRows[Math.max(0, cursor - 1)];
      const lowerValue = values[lower * width + x];
      const upperValue = values[upper * width + x];
      const span = upper - lower;
      const mix = span > 0 ? (y - lower) / span : 0;
      values[index] = lowerValue + (upperValue - lowerValue) * mix;
      coverage[index] = 2;
    }
  }
}

function finitePercentiles(values, lowQuantile, highQuantile) {
  const sample = [];
  const step = Math.max(1, Math.floor(values.length / 250_000));
  for (let index = 0; index < values.length; index += step) {
    if (Number.isFinite(values[index]) && values[index] > 0) sample.push(values[index]);
  }
  sample.sort((left, right) => left - right);
  if (sample.length === 0) throw new Error("Hubble OPAL map has no finite samples.");
  return [sample[Math.floor((sample.length - 1) * lowQuantile)],
    sample[Math.floor((sample.length - 1) * highQuantile)]];
}

function falseColorMap(map, palette, low, high) {
  const output = Buffer.alloc(map.values.length * 4);
  for (let index = 0; index < map.values.length; index += 1) {
    const normalized = Math.pow(clamp01((map.values[index] - low) / (high - low)), 0.82);
    const color = samplePalette(palette, normalized);
    const offset = index * 4;
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
    output[offset + 3] = 255;
  }
  return output;
}

async function preparePolarAtlas(body, plan, outputPath) {
  const existing = await sharp(normalAssets.poles).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const output = colorizeRgba(existing.data, plan.palette, 0.82);
  for (const pole of ["north", "south"]) {
    for (const inner of [false, true]) {
      const tile = pole === "north" ? (inner ? 4 : 0) : (inner ? 5 : 1);
      const radialScale = inner ? 1.05 / 1.035 : 1;
      for (let y = 0; y < poleTileSize; y += 1) {
        for (let x = 0; x < poleTileSize; x += 1) {
          const unitX = (x + 0.5) / poleTileSize * 2 - 1;
          const unitY = (y + 0.5) / poleTileSize * 2 - 1;
          const radius = Math.hypot(unitX, unitY);
          const offset = (y * poleAtlasWidth + tile * poleTileSize + x) * 4;
          if (radius > 1) {
            output[offset + 3] = 0;
            continue;
          }
          const projectedRadius = Math.min(1, radius * radialScale);
          const latitudeMagnitude = Math.acos(Math.min(
            1,
            projectedRadius * Math.cos(polarBoundaryLatitude),
          ));
          const latitude = pole === "north" ? latitudeMagnitude : -latitudeMagnitude;
          let longitude = Math.atan2(unitY, unitX);
          if (longitude < 0) longitude += Math.PI * 2;
          const sampleX = longitude / (Math.PI * 2) * body.info.width;
          const sampleY = (Math.PI / 2 - latitude) / Math.PI * body.info.height;
          const color = bilinearSample(body.data, body.info.width, body.info.height, sampleX, sampleY);
          output[offset] = color[0];
          output[offset + 1] = color[1];
          output[offset + 2] = color[2];
          output[offset + 3] = 255;
        }
      }
    }
  }
  await sharp(output, {
    raw: { width: poleAtlasWidth, height: poleAtlasHeight, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputPath);
}

async function prepareRing(inputPath, outputPath, plan) {
  const source = await sharp(inputPath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(source.data.length);
  const center = (source.info.width - 1) / 2;
  for (let y = 0; y < source.info.height; y += 1) {
    for (let x = 0; x < source.info.width; x += 1) {
      const offset = (y * source.info.width + x) * 4;
      const alpha = source.data[offset + 3];
      output[offset + 3] = alpha;
      if (alpha === 0) continue;
      const radiusKm = Math.hypot(x - center, y - center) / center * ringOuterKm;
      const bandGain = ringBandGain(radiusKm, plan.ringBands);
      const luminance = (source.data[offset] * 0.2126 +
        source.data[offset + 1] * 0.7152 + source.data[offset + 2] * 0.0722) / 255;
      const intensity = clamp01(Math.pow(luminance, 0.82) * bandGain * plan.ringGain);
      const color = samplePalette(plan.ringPalette, intensity);
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
    }
  }
  await sharp(output, { raw: source.info })
    .webp({ quality: 96, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(outputPath);
}

async function prepareMaterial(inputPath, outputPath, plan) {
  const source = await sharp(inputPath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const output = colorizeRgba(source.data, plan.palette, plan.materialGain);
  await sharp(output, { raw: source.info })
    .webp({ quality: 96, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(outputPath);
}

async function prepareThumbnail(inputPath, outputPath) {
  const metadata = await sharp(inputPath).metadata();
  const width = Math.min(metadata.width, Math.round(metadata.width * 0.34));
  const height = Math.min(metadata.height, Math.round(metadata.height * 0.28));
  const left = Math.round((metadata.width - width) * 0.5);
  const top = Math.round((metadata.height - height) * 0.46);
  await sharp(inputPath).extract({ left, top, width, height })
    .resize(112, 64, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 92, effort: 6 }).toFile(outputPath);
}

function colorizeRgba(source, palette, gain) {
  const output = Buffer.alloc(source.length);
  for (let offset = 0; offset < source.length; offset += 4) {
    const luminance = (source[offset] * 0.2126 + source[offset + 1] * 0.7152 +
      source[offset + 2] * 0.0722) / 255;
    const color = samplePalette(palette, clamp01(Math.pow(luminance, 0.82) * gain));
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
    output[offset + 3] = source[offset + 3];
  }
  return output;
}

function samplePalette(palette, value) {
  const segment = value < 0.5 ? 0 : 1;
  const mix = value < 0.5 ? value * 2 : (value - 0.5) * 2;
  return [0, 1, 2].map((channel) => Math.round(
    palette[segment][channel] +
      (palette[segment + 1][channel] - palette[segment][channel]) * mix,
  ));
}

function bilinearSample(data, width, height, x, y) {
  const x0 = ((Math.floor(x) % width) + width) % width;
  const x1 = (x0 + 1) % width;
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  return [0, 1, 2].map((channel) => {
    const top = data[(y0 * width + x0) * 4 + channel] * (1 - fx) +
      data[(y0 * width + x1) * 4 + channel] * fx;
    const bottom = data[(y1 * width + x0) * 4 + channel] * (1 - fx) +
      data[(y1 * width + x1) * 4 + channel] * fx;
    return Math.round(top * (1 - fy) + bottom * fy);
  });
}

function ringBandGain(radiusKm, bands) {
  if (radiusKm < 74_500) return bands.d;
  if (radiusKm < 91_975) return bands.c;
  if (radiusKm < 117_500) return bands.b;
  if (radiusKm < 122_050) return (bands.b + bands.a) / 2;
  if (radiusKm < 136_770) return bands.a;
  return bands.f;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
