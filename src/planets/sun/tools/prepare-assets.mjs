#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  ensureSunPreparationDirectories,
  SUN_PUBLIC_ROOT,
  SUN_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateSunSourceGroup } from "./source-manifest.mjs";

const MAP_WIDTH = 1024;
const MAP_HEIGHT = 512;
const POLAR_TILE = 256;
const OFF_LIMB_SIZE = 768;
const LIMB_SIZE = 512;
const BODY_DIAMETER = 496;
const CR2311_START = Date.parse("2026-05-12T21:56:01Z");
const CR2311_STOP = Date.parse("2026-06-09T02:57:22Z");
let continuumFramesPromise;
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const outputRoot = outputArgument
  ? resolve(outputArgument.slice("--output=".length))
  : SUN_PUBLIC_ROOT;
const [continuumSources] = await Promise.all([
  validateSunSourceGroup("continuum"),
  validateSunSourceGroup("scene"),
  validateSunSourceGroup("lenses"),
  validateSunSourceGroup("corona"),
]);
const variants = Object.freeze([
  Object.freeze({
    id: "photosphere",
    kind: "hmi-continuum-mosaic",
    mapFiles: Object.freeze(continuumSources.map(({ path }) => path)),
    observedFile: null,
    center: null,
    radius: null,
    limbMode: "continuum-darkening",
  }),
  Object.freeze({
    id: "magnetic",
    kind: "hmi-synoptic-fits",
    mapFile: "hmi/CR2311-synopMr.fits",
    observedFile: null,
    center: null,
    radius: null,
    limbMode: "rim",
  }),
  Object.freeze({
    id: "chromosphere",
    kind: "aia-synoptic-fits",
    mapFile: "sdo/synoptic/AIA0304/CR2311.fits",
    observedFile: "sdo/context/CR2311/20260527_000906_1024_0304.jpg",
    center: Object.freeze([512, 502]),
    radius: 407,
    limbMode: "rim",
  }),
  Object.freeze({
    id: "corona",
    kind: "aia-synoptic-fits",
    mapFile: "sdo/synoptic/AIA0171/CR2311.fits",
    observedFile: "sdo/context/CR2311/20260527_000710_1024_0171.jpg",
    center: Object.freeze([512, 498]),
    radius: 405,
    limbMode: "rim",
  }),
]);
if (outputArgument) await mkdir(outputRoot, { recursive: true });
else await ensureSunPreparationDirectories();

for (const variant of variants) await prepareVariant(variant);
console.log(JSON.stringify({
  schema: "csssun-prepared-global-surface-assets@1",
  variants: variants.length,
  densities: [1, 2],
  sourceRotation: 2311,
  outputRoot,
}));

async function prepareVariant(variant) {
  for (const density of [1, 2]) {
    const width = MAP_WIDTH * density;
    const height = MAP_HEIGHT * density;
    const globalMap = await loadGlobalMap(variant, width, height);
    const polarDetailSigma = variant.id === "magnetic"
      ? 1.2 * density
      : variant.id === "photosphere"
        ? 0.6 * density
        : 0.8 * density;
    const polarDetailMap = await sharp(globalMap, {
      raw: { width, height, channels: 4 },
    }).blur(polarDetailSigma).raw().toBuffer();
    stabilizeMapPoles(
      globalMap,
      width,
      height,
      180 / 16,
    );
    const oriented = orientLatitudeBands(globalMap, width, height, 4, 16);
    const suffix = density === 2 ? "@2x" : "";
    await sharp(oriented, { raw: { width, height, channels: 4 } })
      .webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(resolve(outputRoot, `sun-surface-${variant.id}${suffix}.webp`));
    const polar = createPolarSprite(
      globalMap,
      polarDetailMap,
      width,
      height,
      POLAR_TILE * density,
    );
    const polarCellSize = 64 * density;
    const polarAtlas = createPolarLeafAtlas(
      polar,
      POLAR_TILE * density,
      polarCellSize,
    );
    await sharp(polarAtlas, {
      raw: {
        width: polarCellSize * 32,
        height: polarCellSize * 3,
        channels: 4,
      },
    }).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(resolve(outputRoot, `sun-poles-${variant.id}${suffix}.webp`));
    await prepareOffLimbContext(variant, density);
    await prepareLimbMaterial(variant, globalMap, width, height, density);
    if (density === 1) {
      await sharp(globalMap, { raw: { width, height, channels: 4 } })
        .resize(64, 64, { fit: "cover", position: "centre" })
        .webp({ quality: 88, effort: 6 })
        .toFile(resolve(outputRoot, `sun-lens-${variant.id}.webp`));
    }
  }
}

async function loadGlobalMap(variant, width, height) {
  if (variant.kind === "hmi-continuum-mosaic") {
    return prepareContinuumMosaic(variant.mapFiles, width, height);
  }
  const sourcePath = resolve(SUN_SOURCE_ROOT, variant.mapFile);
  if (variant.kind === "hmi-synoptic-fits") {
    return prepareHmiSynopticMap(await readFile(sourcePath), width, height);
  }
  if (variant.kind !== "aia-synoptic-fits") {
    throw new TypeError(`Unknown Sun global-map source: ${variant.kind}.`);
  }
  return prepareAiaSynopticMap(
    await readFile(sourcePath),
    width,
    height,
    variant.id,
  );
}

async function prepareContinuumMosaic(paths, width, height) {
  const frames = await loadContinuumFrames(paths);
  const columns = Array.from({ length: width }, (_, x) => {
    const phase = (x + 0.5) / width;
    let high = frames.findIndex((frame) => frame.phase >= phase);
    if (high < 0) high = frames.length - 1;
    let low = Math.max(0, high - 1);
    if (high === low && high < frames.length - 1) high += 1;
    const left = frames[low];
    const right = frames[high];
    const span = right.phase - left.phase;
    const rightWeight = span === 0 ? 0 : clamp(
      (phase - left.phase) / span,
      0,
      1,
    );
    return Object.freeze({
      phase,
      frames: Object.freeze([
        Object.freeze({ frame: left, weight: 1 - rightWeight }),
        Object.freeze({ frame: right, weight: rightWeight }),
      ]),
    });
  });
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const sampledLatitude = clamp(
      latitude,
      radians(-80),
      radians(80),
    );
    for (let x = 0; x < width; x += 1) {
      const color = [0, 0, 0];
      for (const { frame, weight } of columns[x].frames) {
        if (weight === 0) continue;
        const longitudeDelta = wrappedRadians(
          (columns[x].phase - frame.phase) * Math.PI * 2,
        );
        const cosLatitude = Math.cos(sampledLatitude);
        const sourceX = frame.centerX +
          Math.sin(longitudeDelta) * cosLatitude * frame.radius;
        const projectedY = Math.sin(sampledLatitude) * Math.cos(frame.b0) -
          cosLatitude * Math.cos(longitudeDelta) * Math.sin(frame.b0);
        const sourceY = frame.centerY - projectedY * frame.radius;
        const sample = sampleContinuumFrame(frame, sourceX, sourceY);
        for (let channel = 0; channel < 3; channel += 1) {
          color[channel] += sample[channel] * weight;
        }
      }
      const offset = (y * width + x) * 4;
      output[offset] = Math.round(color[0]);
      output[offset + 1] = Math.round(color[1]);
      output[offset + 2] = Math.round(color[2]);
      output[offset + 3] = 255;
    }
  }
  return output;
}

function loadContinuumFrames(paths) {
  continuumFramesPromise ??= Promise.all(paths.map(async (path) => {
    const bytes = await readFile(resolve(SUN_SOURCE_ROOT, path));
    const { data, info } = await sharp(bytes).removeAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 1024 || info.height !== 1024 || info.channels !== 3) {
      throw new Error(`Sun continuum source geometry changed: ${path}.`);
    }
    const timestamp = continuumTimestamp(path);
    const disc = detectContinuumDisc(data, info);
    const profile = continuumRadialProfile(data, info, disc);
    return Object.freeze({
      path,
      timestamp,
      phase: (timestamp - CR2311_START) / (CR2311_STOP - CR2311_START),
      b0: solarB0Radians(timestamp),
      data,
      info,
      ...disc,
      ...profile,
    });
  }));
  return continuumFramesPromise;
}

function continuumTimestamp(path) {
  const match = /\/(\d{4})(\d{2})(\d{2})_000000_1024_HMIIC\.jpg$/u.exec(path);
  if (!match) throw new Error(`Sun continuum timestamp is invalid: ${path}.`);
  return Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
}

function detectContinuumDisc(data, info) {
  const center = Math.floor(info.width / 2);
  const horizontal = brightSpan(data, info, center, true);
  const vertical = brightSpan(data, info, center, false);
  const centerX = (horizontal.first + horizontal.last) / 2;
  const centerY = (vertical.first + vertical.last) / 2;
  const radius = (
    (horizontal.last - horizontal.first + 1) / 2 +
    (vertical.last - vertical.first + 1) / 2
  ) / 2;
  if (radius < 450 || radius > 490) {
    throw new Error("Sun HMI continuum disc registration changed.");
  }
  return Object.freeze({ centerX, centerY, radius });
}

function brightSpan(data, info, fixed, horizontal) {
  let first = -1;
  let last = -1;
  const length = horizontal ? info.width : info.height;
  for (let position = 0; position < length; position += 1) {
    const x = horizontal ? position : fixed;
    const y = horizontal ? fixed : position;
    const offset = (y * info.width + x) * info.channels;
    const bright = data[offset] + data[offset + 1] + data[offset + 2] > 72;
    if (!bright) continue;
    if (first < 0) first = position;
    last = position;
  }
  if (first < 0 || last <= first) {
    throw new Error("Sun HMI continuum disc was not detected.");
  }
  return { first, last };
}

function continuumRadialProfile(data, info, { centerX, centerY, radius }) {
  const sums = new Float64Array(256 * 3);
  const counts = new Uint32Array(256);
  const minimumX = Math.max(0, Math.floor(centerX - radius));
  const maximumX = Math.min(info.width - 1, Math.ceil(centerX + radius));
  const minimumY = Math.max(0, Math.floor(centerY - radius));
  const maximumY = Math.min(info.height - 1, Math.ceil(centerY + radius));
  for (let y = minimumY; y <= maximumY; y += 2) {
    for (let x = minimumX; x <= maximumX; x += 2) {
      const normalizedRadius = Math.hypot(x - centerX, y - centerY) / radius;
      if (normalizedRadius >= 0.995) continue;
      const offset = (y * info.width + x) * info.channels;
      const luminance = data[offset] * 0.2126 +
        data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
      if (luminance <= 10) continue;
      const bin = Math.min(255, Math.floor(normalizedRadius * 256));
      for (let channel = 0; channel < 3; channel += 1) {
        sums[bin * 3 + channel] += data[offset + channel];
      }
      counts[bin] += 1;
    }
  }
  const rawRadialMeans = Array.from({ length: 256 }, (_, index) =>
    [0, 1, 2].map((channel) => counts[index] === 0
      ? 0
      : sums[index * 3 + channel] / counts[index]));
  const radialMeans = rawRadialMeans.map((values, index) => {
    const totals = [0, 0, 0];
    let count = 0;
    for (let sampleIndex = Math.max(0, index - 6);
      sampleIndex <= Math.min(255, index + 6);
      sampleIndex += 1) {
      if (rawRadialMeans[sampleIndex].every((value) => value <= 0)) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        totals[channel] += rawRadialMeans[sampleIndex][channel];
      }
      count += 1;
    }
    return count === 0
      ? values
      : totals.map((total) => total / count);
  });
  const centerRows = radialMeans.slice(0, 26).filter((values) =>
    values.some((value) => value > 0));
  const centerMean = [0, 1, 2].map((channel) =>
    centerRows.reduce((sum, values) => sum + values[channel], 0) /
      centerRows.length);
  return Object.freeze({ radialMeans: Object.freeze(radialMeans), centerMean });
}

function sampleContinuumFrame(frame, x, y) {
  const x0 = clamp(Math.floor(x), 0, frame.info.width - 1);
  const y0 = clamp(Math.floor(y), 0, frame.info.height - 1);
  const x1 = clamp(x0 + 1, 0, frame.info.width - 1);
  const y1 = clamp(y0 + 1, 0, frame.info.height - 1);
  const xAmount = x - Math.floor(x);
  const yAmount = y - Math.floor(y);
  const normalizedRadius = clamp(
    Math.hypot(x - frame.centerX, y - frame.centerY) / frame.radius,
    0,
    0.99,
  );
  const profilePosition = normalizedRadius * 255;
  const profile0 = frame.radialMeans[Math.floor(profilePosition)] || frame.centerMean;
  const profile1 = frame.radialMeans[Math.ceil(profilePosition)] || profile0;
  return [0, 1, 2].map((channel) => {
    const profile = mix(
      profile0[channel],
      profile1[channel],
      profilePosition - Math.floor(profilePosition),
    );
    const gain = Math.min(
      6,
      frame.centerMean[channel] / Math.max(1, profile),
    );
    const top = mix(
      continuumChannel(frame, x0, y0, channel),
      continuumChannel(frame, x1, y0, channel),
      xAmount,
    );
    const bottom = mix(
      continuumChannel(frame, x0, y1, channel),
      continuumChannel(frame, x1, y1, channel),
      xAmount,
    );
    return clamp(mix(top, bottom, yAmount) * gain, 0, 255);
  });
}

function continuumChannel(frame, x, y, channel) {
  return frame.data[(y * frame.info.width + x) * frame.info.channels + channel];
}

function stabilizeMapPoles(data, width, height, latitudeSpanDegrees) {
  const boundaryLatitude = (90 - latitudeSpanDegrees) * Math.PI / 180;
  const boundaryCosine = Math.cos(boundaryLatitude);
  const models = Object.freeze({
    north: preparePolarBoundaryModel(
      data,
      width,
      height,
      true,
      boundaryLatitude,
    ),
    south: preparePolarBoundaryModel(
      data,
      width,
      height,
      false,
      boundaryLatitude,
    ),
  });
  for (let y = 0; y < height; y += 1) {
    const latitudeDegrees = 90 - (y + 0.5) / height * 180;
    const distanceFromPole = 90 - Math.abs(latitudeDegrees);
    if (distanceFromPole >= latitudeSpanDegrees) continue;
    const radial = Math.min(
      1,
      Math.cos(Math.abs(latitudeDegrees) * Math.PI / 180) / boundaryCosine,
    );
    const model = models[latitudeDegrees >= 0 ? "north" : "south"];
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const longitude = (x + 0.5) / width * Math.PI * 2;
      const sample = samplePolarBoundaryModel(model, longitude, radial);
      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.round(sample[channel]);
      }
    }
  }
}

function solarB0Radians(timestamp) {
  const julianDate = timestamp / 86_400_000 + 2_440_587.5;
  const days = julianDate - 2_451_545;
  const meanLongitude = radians(moduloNumber(280.460 + 0.9856474 * days, 360));
  const meanAnomaly = radians(moduloNumber(357.528 + 0.9856003 * days, 360));
  const eclipticLongitude = meanLongitude + radians(
    1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(meanAnomaly * 2),
  );
  const ascendingNode = radians(
    73.6667 + 1.3958333 * (julianDate - 2_396_758) / 36_525,
  );
  return Math.asin(
    Math.sin(eclipticLongitude - ascendingNode) * Math.sin(radians(7.25)),
  );
}

function wrappedRadians(value) {
  let wrapped = value;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

function moduloNumber(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function mix(left, right, amount) {
  return left + (right - left) * amount;
}

function prepareHmiSynopticMap(bytes, width, height) {
  const fits = readFitsPrimary(bytes);
  if (fits.bitpix !== -32 || fits.width !== 720 || fits.height !== 360) {
    throw new Error("Sun HMI synoptic FITS geometry changed.");
  }
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const sourceY = clamp(
      Math.round((Math.sin(latitude) + 1) / 2 * (fits.height - 1)),
      0,
      fits.height - 1,
    );
    for (let x = 0; x < width; x += 1) {
      const sourceX = modulo(
        Math.round((1 - (x + 0.5) / width) * fits.width),
        fits.width,
      );
      const value = nearestValidSignedValue(fits, sourceX, sourceY);
      const color = hmiFalseColour(value);
      const offset = (y * width + x) * 4;
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
      output[offset + 3] = 255;
    }
  }
  return output;
}

function nearestValidSignedValue(fits, x, y) {
  const direct = fits.values[y * fits.width + x];
  if (Number.isFinite(direct)) return direct;
  for (let distance = 1; distance <= 64; distance += 1) {
    for (const candidateY of [y - distance, y + distance]) {
      if (candidateY < 0 || candidateY >= fits.height) continue;
      const candidate = fits.values[candidateY * fits.width + x];
      if (Number.isFinite(candidate)) return candidate;
    }
  }
  return 0;
}

function prepareAiaSynopticMap(bytes, width, height, variantId) {
  const fits = readFitsPrimary(bytes);
  if (fits.bitpix !== -64 || fits.width !== 3600 || fits.height !== 1080) {
    throw new Error(`Sun AIA synoptic FITS geometry changed for ${variantId}.`);
  }
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = clamp(
      Math.round((1 - (y + 0.5) / height) * fits.height),
      0,
      fits.height - 1,
    );
    for (let x = 0; x < width; x += 1) {
      const sourceX = modulo(
        Math.round((x + 0.5) / width * fits.width),
        fits.width,
      );
      const value = nearestValidPositiveValue(fits, sourceX, sourceY);
      const color = aiaFalseColour(value, variantId);
      const offset = (y * width + x) * 4;
      output[offset] = color[0];
      output[offset + 1] = color[1];
      output[offset + 2] = color[2];
      output[offset + 3] = 255;
    }
  }
  return output;
}

function readFitsPrimary(bytes) {
  let endCard = -1;
  const header = {};
  for (let offset = 0; offset + 80 <= bytes.length; offset += 80) {
    const card = bytes.toString("ascii", offset, offset + 80);
    const key = card.slice(0, 8).trim();
    if (key === "END") {
      endCard = offset + 80;
      break;
    }
    if (card[8] !== "=") continue;
    header[key] = card.slice(10).split("/")[0].trim();
  }
  if (endCard < 0) throw new Error("Sun HMI FITS header has no END card.");
  const bitpix = Number(header.BITPIX);
  const width = Number(header.NAXIS1);
  const height = Number(header.NAXIS2);
  const dataOffset = Math.ceil(endCard / 2880) * 2880;
  const bytesPerValue = Math.abs(bitpix) / 8;
  if (![4, 8].includes(bytesPerValue)) {
    throw new Error(`Sun FITS BITPIX ${bitpix} is unsupported.`);
  }
  const values = new Float64Array(width * height);
  for (let index = 0; index < values.length; index += 1) {
    const offset = dataOffset + index * bytesPerValue;
    values[index] = bitpix === -32
      ? bytes.readFloatBE(offset)
      : bytes.readDoubleBE(offset);
  }
  return { bitpix, width, height, values };
}

function aiaFalseColour(value, variantId) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const range = variantId === "chromosphere"
    ? [0.3, 30]
    : [18, 1100];
  const normalized = safeValue === 0 ? 0 : clamp(
    (Math.log(safeValue) - Math.log(range[0])) /
      (Math.log(range[1]) - Math.log(range[0])),
    0,
    1,
  );
  const palette = variantId === "chromosphere"
    ? [[19, 0, 0], [205, 23, 0], [255, 224, 92]]
    : [[11, 8, 0], [210, 133, 0], [255, 248, 176]];
  return paletteSample(palette, normalized);
}

function paletteSample(palette, value) {
  const scaled = value * (palette.length - 1);
  const left = Math.min(palette.length - 2, Math.floor(scaled));
  const progress = scaled - left;
  return palette[left].map((channel, index) => Math.round(
    channel + (palette[left + 1][index] - channel) * progress,
  ));
}

function hmiFalseColour(value) {
  const neutral = [95, 32, 11];
  if (!Number.isFinite(value)) return neutral;
  const signed = clamp(
    Math.asinh(value / 8) / Math.asinh(250 / 8),
    -1,
    1,
  );
  if (signed < 0) {
    return interpolateColour(neutral, [28, 95, 190], -signed);
  }
  return interpolateColour(neutral, [255, 224, 110], signed);
}

function nearestValidPositiveValue(fits, x, y) {
  const direct = fits.values[y * fits.width + x];
  if (Number.isFinite(direct) && direct > 0) return direct;
  for (let distance = 1; distance <= 128; distance += 1) {
    for (const candidateY of [y - distance, y + distance]) {
      if (candidateY < 0 || candidateY >= fits.height) continue;
      const candidate = fits.values[candidateY * fits.width + x];
      if (Number.isFinite(candidate) && candidate > 0) return candidate;
    }
  }
  return 0;
}

function interpolateColour(from, to, progress) {
  return from.map((channel, index) => Math.round(
    channel + (to[index] - channel) * progress,
  ));
}

function orientLatitudeBands(source, width, height, channels, bandCount) {
  const bandHeight = height / bandCount;
  if (!Number.isInteger(bandHeight)) {
    throw new Error("Sun texture does not match its prepared latitude grid.");
  }
  const output = Buffer.alloc(source.length);
  const rowBytes = width * channels;
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

function createPolarSprite(map, detailMap, width, height, tileSize) {
  const output = Buffer.alloc(tileSize * tileSize * 2 * 4);
  const supersampling = 2;
  const samplesPerPixel = supersampling ** 2;
  const boundaryLatitude = Math.PI / 2 - Math.PI / 16;
  const boundaryCosine = Math.cos(boundaryLatitude);
  const visibleBoundaryRadius = 1 / 1.035;
  for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
    const north = poleIndex === 0;
    const boundaryModel = preparePolarBoundaryModel(
      map,
      width,
      height,
      north,
      boundaryLatitude,
    );
    const proxyModel = preparePolarProxyModel(
      detailMap,
      width,
      height,
      north,
      boundaryModel,
    );
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const channels = [0, 0, 0, 0];
        let coverage = 0;
        for (let sampleY = 0; sampleY < supersampling; sampleY += 1) {
          for (let sampleX = 0; sampleX < supersampling; sampleX += 1) {
            const px = (
              x + (sampleX + 0.5) / supersampling
            ) / tileSize * 2 - 1;
            const py = (
              y + (sampleY + 0.5) / supersampling
            ) / tileSize * 2 - 1;
            const radial = Math.hypot(px, py);
            if (radial > 1) continue;
            const projectedRadial = Math.min(
              1,
              radial / visibleBoundaryRadius,
            );
            const latitudeMagnitude = Math.acos(
              Math.min(1, projectedRadial * boundaryCosine),
            );
            const latitude = north ? latitudeMagnitude : -latitudeMagnitude;
            let longitude = Math.atan2(py, px);
            if (longitude < 0) longitude += Math.PI * 2;
            const sourceX = longitude / (Math.PI * 2) * width - 0.5;
            const sourceY = (
              Math.PI / 2 - latitude
            ) / Math.PI * height - 0.5;
            const sample = samplePolarMap(
              map,
              width,
              height,
              sourceX,
              sourceY,
              projectedRadial,
              longitude,
              boundaryModel,
              proxyModel,
              px,
              py,
            );
            for (let channel = 0; channel < 3; channel += 1) {
              channels[channel] += sample[channel];
            }
            channels[3] += sample[3];
            coverage += 1;
          }
        }
        if (coverage === 0) continue;
        const to = (y * tileSize * 2 + poleIndex * tileSize + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          output[to + channel] = Math.round(channels[channel] / coverage);
        }
        output[to + 3] = Math.round(channels[3] / samplesPerPixel);
      }
    }
  }
  return output;
}

function createPolarLeafAtlas(polar, tileSize, cellSize) {
  const atlasWidth = cellSize * 32;
  const atlasHeight = cellSize * 3;
  const output = Buffer.alloc(atlasWidth * atlasHeight * 4);
  const boundaryLatitude = Math.PI / 2 - Math.PI / 16;
  const innerLatitude = 89 * Math.PI / 180;
  const visibleBoundaryRadius = 1 / 1.035;
  for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
    const north = poleIndex === 0;
    const sourceOffsetX = poleIndex * tileSize;
    for (let segmentIndex = 0; segmentIndex < 32; segmentIndex += 1) {
      for (let y = 0; y < cellSize; y += 1) {
        const v = (y + 0.5) / cellSize;
        const latitude = north
          ? mix(boundaryLatitude, innerLatitude, v)
          : mix(innerLatitude, boundaryLatitude, v);
        const radial = Math.cos(latitude) / Math.cos(boundaryLatitude) *
          visibleBoundaryRadius;
        for (let x = 0; x < cellSize; x += 1) {
          const longitude = (
            segmentIndex + (x + 0.5) / cellSize
          ) / 32 * Math.PI * 2;
          const sourceX = sourceOffsetX + tileSize * (
            0.5 + Math.cos(longitude) * radial * 0.5
          );
          const sourceY = tileSize * (
            0.5 + Math.sin(longitude) * radial * 0.5 * (north ? 1 : -1)
          );
          const sample = sampleClampedBilinearRgba(
            polar,
            tileSize * 2,
            tileSize,
            sourceX - 0.5,
            sourceY - 0.5,
          );
          const to = (
            (poleIndex * cellSize + y) * atlasWidth +
            segmentIndex * cellSize + x
          ) * 4;
          for (let channel = 0; channel < 3; channel += 1) {
            output[to + channel] = Math.round(sample[channel]);
          }
          output[to + 3] = 255;
        }
      }
    }
    const centerOffsetX = poleIndex * cellSize;
    const centerRadial = Math.cos(innerLatitude) /
      Math.cos(boundaryLatitude) * visibleBoundaryRadius * 1.05;
    for (let y = 0; y < cellSize; y += 1) {
      for (let x = 0; x < cellSize; x += 1) {
        const unitX = (x + 0.5) / cellSize * 2 - 1;
        const unitY = (y + 0.5) / cellSize * 2 - 1;
        const sourceX = sourceOffsetX + tileSize * (
          0.5 + unitX * centerRadial * 0.5
        );
        const sourceY = tileSize * (
          0.5 + unitY * centerRadial * 0.5 * (north ? 1 : -1)
        );
        const sample = sampleClampedBilinearRgba(
          polar,
          tileSize * 2,
          tileSize,
          sourceX - 0.5,
          sourceY - 0.5,
        );
        const to = (
          (cellSize * 2 + y) * atlasWidth + centerOffsetX + x
        ) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          output[to + channel] = Math.round(sample[channel]);
        }
        output[to + 3] = 255;
      }
    }
  }
  return output;
}

function samplePolarMap(
  map,
  width,
  height,
  sourceX,
  sourceY,
  radial,
  longitude,
  boundaryModel,
  proxyModel,
  unitX,
  unitY,
) {
  const direct = sampleWrappedBilinearRgba(
    map,
    width,
    height,
    sourceX,
    sourceY,
  );
  const continuation = samplePolarBoundaryModel(
    boundaryModel,
    longitude,
    radial,
  );
  const directAmount = smootherStep(0.76, 0.96, radial);
  const continued = direct.map((value, channel) => mix(
    continuation[channel],
    value,
    directAmount,
  ));
  const proxy = samplePolarProxy(proxyModel, unitX, unitY);
  const proxyAmount = 0.8 * (
    1 - smootherStep(0.25, 0.98, radial)
  );
  return continued.map((value, channel) => mix(
    value,
    proxy[channel],
    proxyAmount,
  ));
}

function preparePolarProxyModel(
  map,
  width,
  height,
  north,
  boundaryModel,
) {
  const model = {
    map,
    width,
    height,
    centerX: width * 0.5,
    centerY: north ? height * 0.08 : height * 0.92,
    radiusX: width * 0.06,
    radiusY: height * 0.06,
  };
  const proxyTotals = [0, 0, 0];
  const boundaryTotals = [0, 0, 0];
  const sampleCount = 256;
  const comparisonRadius = 0.72;
  for (let index = 0; index < sampleCount; index += 1) {
    const longitude = (index + 0.5) / sampleCount * Math.PI * 2;
    const unitX = Math.cos(longitude) * comparisonRadius;
    const unitY = Math.sin(longitude) * comparisonRadius;
    const proxy = samplePolarProxy(model, unitX, unitY, false);
    const boundary = samplePolarBoundaryModel(
      boundaryModel,
      longitude,
      comparisonRadius,
    );
    for (let channel = 0; channel < 3; channel += 1) {
      proxyTotals[channel] += proxy[channel];
      boundaryTotals[channel] += boundary[channel];
    }
  }
  return Object.freeze({
    ...model,
    gains: Object.freeze(proxyTotals.map((total, channel) => clamp(
      boundaryTotals[channel] / Math.max(1, total),
      0.65,
      1.45,
    ))),
  });
}

function samplePolarProxy(model, unitX, unitY, applyGains = true) {
  const sample = sampleWrappedBilinearRgba(
    model.map,
    model.width,
    model.height,
    model.centerX + unitX * model.radiusX,
    model.centerY + unitY * model.radiusY,
  );
  if (!applyGains || !model.gains) return sample;
  return sample.map((value, channel) => channel === 3
    ? 255
    : clamp(value * model.gains[channel], 0, 255));
}

function preparePolarBoundaryModel(
  map,
  width,
  height,
  north,
  boundaryLatitude,
) {
  const sampleCount = 256;
  const modeCount = 32;
  const latitude = north ? boundaryLatitude : -boundaryLatitude;
  const sourceY = (Math.PI / 2 - latitude) / Math.PI * height - 0.5;
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const longitude = (index + 0.5) / sampleCount * Math.PI * 2;
    return sampleWrappedBilinearRgba(
      map,
      width,
      height,
      longitude / (Math.PI * 2) * width - 0.5,
      sourceY,
    );
  });
  return Object.freeze(Array.from({ length: 4 }, (_, channel) => {
    const mean = samples.reduce((sum, sample) => sum + sample[channel], 0) /
      sampleCount;
    const modes = Array.from({ length: modeCount }, (_, modeIndex) => {
      const mode = modeIndex + 1;
      let cosine = 0;
      let sine = 0;
      for (let index = 0; index < sampleCount; index += 1) {
        const longitude = (index + 0.5) / sampleCount * Math.PI * 2;
        cosine += samples[index][channel] * Math.cos(mode * longitude);
        sine += samples[index][channel] * Math.sin(mode * longitude);
      }
      return Object.freeze({
        cosine: cosine * 2 / sampleCount,
        sine: sine * 2 / sampleCount,
      });
    });
    return Object.freeze({ mean, modes: Object.freeze(modes) });
  }));
}

function samplePolarBoundaryModel(model, longitude, radial) {
  return model.map(({ mean, modes }, channel) => {
    if (channel === 3) return 255;
    let value = mean;
    for (let index = 0; index < modes.length; index += 1) {
      const mode = index + 1;
      const attenuation = radial ** mode;
      value += attenuation * (
        modes[index].cosine * Math.cos(mode * longitude) +
        modes[index].sine * Math.sin(mode * longitude)
      );
    }
    return clamp(value, 0, 255);
  });
}

function sampleWrappedBilinearRgba(map, width, height, sourceX, sourceY) {
  const y = clamp(sourceY, 0, height - 1);
  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = Math.min(height - 1, y0 + 1);
  const xAmount = sourceX - x0;
  const yAmount = y - y0;
  return [0, 1, 2, 3].map((channel) => {
    const top = mix(
      map[(y0 * width + modulo(x0, width)) * 4 + channel],
      map[(y0 * width + modulo(x1, width)) * 4 + channel],
      xAmount,
    );
    const bottom = mix(
      map[(y1 * width + modulo(x0, width)) * 4 + channel],
      map[(y1 * width + modulo(x1, width)) * 4 + channel],
      xAmount,
    );
    return mix(top, bottom, yAmount);
  });
}

function sampleClampedBilinearRgba(map, width, height, sourceX, sourceY) {
  const x = clamp(sourceX, 0, width - 1);
  const y = clamp(sourceY, 0, height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const xAmount = x - x0;
  const yAmount = y - y0;
  return [0, 1, 2, 3].map((channel) => mix(
    mix(
      map[(y0 * width + x0) * 4 + channel],
      map[(y0 * width + x1) * 4 + channel],
      xAmount,
    ),
    mix(
      map[(y1 * width + x0) * 4 + channel],
      map[(y1 * width + x1) * 4 + channel],
      xAmount,
    ),
    yAmount,
  ));
}

function smootherStep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

async function prepareOffLimbContext(variant, density) {
  const size = OFF_LIMB_SIZE * density;
  if (variant.observedFile === null) {
    const suffix = density === 2 ? "@2x" : "";
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).webp({ lossless: true, effort: 6 })
      .toFile(resolve(outputRoot, `sun-corona-${variant.id}${suffix}.webp`));
    return;
  }
  const sourcePath = resolve(SUN_SOURCE_ROOT, variant.observedFile);
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== 1024 || info.height !== 1024 || info.channels !== 4) {
    throw new Error(`Sun off-limb source geometry changed: ${variant.id}.`);
  }
  const maximumSourceRadius = Math.min(
    variant.center[0],
    info.width - variant.center[0],
    variant.center[1],
    info.height - variant.center[1],
  );
  for (let offset = 0; offset < data.length; offset += 4) {
    const pixel = offset / 4;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    if (y >= info.height - 28) {
      data[offset + 3] = 0;
      continue;
    }
    const radial = Math.hypot(
      x + 0.5 - variant.center[0],
      y + 0.5 - variant.center[1],
    );
    const outsideDisc = smootherStep(
      variant.radius * 0.985,
      variant.radius * 1.01,
      radial,
    );
    const outerEdge = smootherStep(
      0,
      36,
      maximumSourceRadius - radial,
    );
    const light = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    data[offset + 3] = clamp(
      Math.round((light - 8) / 72 * 255 * outsideDisc * outerEdge),
      0,
      255,
    );
  }
  const registeredSize = Math.round(
    info.width * (BODY_DIAMETER / 2 * density) / variant.radius,
  );
  const registered = await sharp(data, { raw: info })
    .resize(registeredSize, registeredSize, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const left = Math.round(size / 2 - variant.center[0] / info.width * registeredSize);
  const top = Math.round(size / 2 - variant.center[1] / info.height * registeredSize);
  const suffix = density === 2 ? "@2x" : "";
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: registered, left, top }])
    .webp({ quality: 90, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(resolve(outputRoot, `sun-corona-${variant.id}${suffix}.webp`));
}

async function prepareLimbMaterial(variant, map, mapWidth, mapHeight, density) {
  if (variant.limbMode === "continuum-darkening") {
    await prepareContinuumLimbMaterial(
      variant,
      map,
      mapWidth,
      mapHeight,
      density,
    );
    return;
  }
  const size = LIMB_SIZE * density;
  const output = Buffer.alloc(size * size * 4);
  const representative = representativeMapColor(map, mapWidth, mapHeight);
  const center = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radial = Math.hypot(x + 0.5 - center, y + 0.5 - center) / center;
      const inner = smootherStep(0.965, 0.985, radial);
      const outer = smootherStep(0, 0.012, 1.002 - radial);
      const alpha = inner * outer * 0.68;
      const offset = (y * size + x) * 4;
      output[offset] = representative[0];
      output[offset + 1] = representative[1];
      output[offset + 2] = representative[2];
      output[offset + 3] = Math.round(alpha * 255);
    }
  }
  const suffix = density === 2 ? "@2x" : "";
  await sharp(output, { raw: { width: size, height: size, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(resolve(outputRoot, `sun-limb-${variant.id}${suffix}.webp`));
}

async function prepareContinuumLimbMaterial(
  variant,
  map,
  mapWidth,
  mapHeight,
  density,
) {
  const size = LIMB_SIZE * density;
  const output = Buffer.alloc(size * size * 4);
  const representative = representativeMapColor(map, mapWidth, mapHeight);
  const frames = await loadContinuumFrames(variant.mapFiles);
  const profile = Array.from({ length: 256 }, (_, index) => {
    const values = frames.map((frame) => {
      const radial = frame.radialMeans[index] || frame.centerMean;
      const radialLuminance = radial[0] * 0.2126 +
        radial[1] * 0.7152 + radial[2] * 0.0722;
      const centerLuminance = frame.centerMean[0] * 0.2126 +
        frame.centerMean[1] * 0.7152 + frame.centerMean[2] * 0.0722;
      return radialLuminance / centerLuminance;
    });
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  const center = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radial = Math.hypot(x + 0.5 - center, y + 0.5 - center) / center;
      const offset = (y * size + x) * 4;
      if (radial <= 1) {
        const profilePosition = clamp(radial * 255, 0, 255);
        const left = Math.floor(profilePosition);
        const right = Math.ceil(profilePosition);
        const observed = mix(
          profile[left],
          profile[right],
          profilePosition - left,
        );
        const alpha = clamp(1 - observed, 0, 0.36) *
          smootherStep(0.52, 0.985, radial);
        output[offset] = 0;
        output[offset + 1] = 0;
        output[offset + 2] = 0;
        output[offset + 3] = Math.round(alpha * 255);
      }
    }
  }
  const suffix = density === 2 ? "@2x" : "";
  await sharp(output, { raw: { width: size, height: size, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(resolve(outputRoot, `sun-limb-${variant.id}${suffix}.webp`));
}

function representativeMapColor(map, width, height) {
  const totals = [0, 0, 0];
  let count = 0;
  for (let y = Math.floor(height * 0.25); y < Math.ceil(height * 0.75); y += 8) {
    for (let x = 0; x < width; x += 8) {
      const offset = (y * width + x) * 4;
      totals[0] += map[offset];
      totals[1] += map[offset + 1];
      totals[2] += map[offset + 2];
      count += 1;
    }
  }
  return totals.map((total) => Math.round(total / count));
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
