// Derived from the retired static lane's synoptic-emission.mts by moving the per-variant closure into a factory that
// returns finished RGBA maps and plates instead of writing files:
//   - the retired module's file writes are gone: the generic raster lane (src/preparation/raster/surfaces.ts) packs,
//     encodes and names every output;
//   - the retired polar sprite, 32-segment band atlas and proxy blend are not here: the generic lane samples its own
//     polar sprite (packages/objects/src/baking/polar.ts) from the stabilized map (stabilizeMapPoles below) and closes
//     each pole with one flat cap. The blurred low-latitude "proxy" texture blended into the cap centre is dropped: it
//     was a display embellishment, not an observation.
// Everything else (continuum disc detection, radial limb normalization, B0, Carrington-phase blending, the Fourier
// polar boundary continuation, off-limb registration, rim and continuum-darkening limb plates) is verbatim.
import type { RasterInfo } from "./raster.mts";
import type { FitsMapRecipe } from "./fits.mts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { prepareFitsMap } from "./fits.mts";

interface ContinuumDisc { centerX: number; centerY: number; radius: number; }
interface ContinuumFrame extends ContinuumDisc {
  path: string; timestamp: number; phase: number; b0: number; data: Buffer; info: RasterInfo;
  radialMeans: readonly (readonly number[])[]; centerMean: readonly number[];
}
type PolarBoundaryModel = readonly {mean: number; modes: readonly {cosine: number; sine: number}[]}[];
export interface SolarContinuum { start: string; stop: string; maximumLatitudeDegrees: number; minimumDiscRadius: number; maximumDiscRadius: number; discBrightnessThreshold: number; solarPoleTiltDegrees: number; }
export interface ContinuumSource { kind: "continuum-disc-mosaic"; mapFiles: readonly string[]; continuum: SolarContinuum; }
export interface FitsSource { kind: "fits-map"; fits: FitsMapRecipe; }
export type OffLimbObservation = null | { observedFile: string; center: readonly [number, number]; radius: number };
export interface SynopticRecipe {
  source: ContinuumSource | FitsSource;
  /** Replace the rows inside one latitude band of each pole with the Fourier continuation of the band boundary. */
  polarStabilization?: { latitudeSegments: number; polarDetailSigma: number };
  limb: { mode: "continuum-darkening" | "rim" };
  offLimb: OffLimbObservation;
}
export interface EmissionSizes { offLimbSize: number; limbSize: number; bodyDiameter: number; }
export interface Plate { data: Buffer; size: number; lossless: boolean; }
export interface InterpretedSynoptic { data: Buffer; info: RasterInfo; plates: { offLimb: Plate; limb: Plate }; }

/** One interpreter per object: continuum frames decode once and serve both densities and the limb plate. */
export function createSolarSynopticInterpreter({ sourceDirectory, emission }: { sourceDirectory: string; emission: EmissionSizes }) {
  const { offLimbSize: OFF_LIMB_SIZE, limbSize: LIMB_SIZE, bodyDiameter: BODY_DIAMETER } = emission;
  const continuumFrames = new Map<string, Promise<readonly ContinuumFrame[]>>();
  let continuum: SolarContinuum, START = 0, STOP = 0;

  async function interpret(recipe: SynopticRecipe, input: string, width: number, height: number, density: number): Promise<InterpretedSynoptic> {
    if (recipe.source.kind === "continuum-disc-mosaic") { continuum = recipe.source.continuum; START = Date.parse(continuum.start); STOP = Date.parse(continuum.stop); }
    const globalMap = recipe.source.kind === "continuum-disc-mosaic"
      ? await prepareContinuumMosaic(recipe.source.mapFiles, width, height)
      : prepareFitsMap(await readFile(input), width, height, recipe.source.fits);
    if (recipe.polarStabilization) stabilizeMapPoles(globalMap, width, height, 180 / recipe.polarStabilization.latitudeSegments);
    const offLimb = await prepareOffLimbContext(recipe.offLimb, density);
    const limb = await prepareLimbMaterial(recipe, globalMap, width, height, density);
    return { data: globalMap, info: { width, height, channels: 4 }, plates: { offLimb, limb } };
  }
  async function prepareContinuumMosaic(paths: readonly string[], width: number, height: number) {
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
        radians(-continuum.maximumLatitudeDegrees),
        radians(continuum.maximumLatitudeDegrees),
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

  function loadContinuumFrames(paths: readonly string[]) {
    const key = paths.join("\n");
    let frames = continuumFrames.get(key);
    frames ??= Promise.all(paths.map(async (path) => {
      const bytes = await readFile(resolve(sourceDirectory, path));
      const { data, info } = await sharp(bytes).removeAlpha().raw()
        .toBuffer({ resolveWithObject: true });
      if (info.width !== 1024 || info.height !== 1024 || info.channels !== 3) {
        throw new Error(`Observed surface continuum source geometry changed: ${path}.`);
      }
      const timestamp = continuumTimestamp(path);
      const disc = detectContinuumDisc(data, info);
      const profile = continuumRadialProfile(data, info, disc);
      return Object.freeze({
        path,
        timestamp,
        phase: (timestamp - START) / (STOP - START),
        b0: solarB0Radians(timestamp),
        data,
        info,
        ...disc,
        ...profile,
      });
    }));
    continuumFrames.set(key, frames);
    return frames;
  }

  function continuumTimestamp(path: string) {
    const match = /\/(\d{4})(\d{2})(\d{2})_000000_1024_HMIIC\.jpg$/u.exec(path);
    if (!match) throw new Error(`Observed surface continuum timestamp is invalid: ${path}.`);
    return Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  }

  function detectContinuumDisc(data: Uint8Array, info: RasterInfo) {
    const center = Math.floor(info.width / 2);
    const horizontal = brightSpan(data, info, center, true);
    const vertical = brightSpan(data, info, center, false);
    const centerX = (horizontal.first + horizontal.last) / 2;
    const centerY = (vertical.first + vertical.last) / 2;
    const radius = (
      (horizontal.last - horizontal.first + 1) / 2 +
      (vertical.last - vertical.first + 1) / 2
    ) / 2;
    if (radius < continuum.minimumDiscRadius || radius > continuum.maximumDiscRadius) {
      throw new Error("Observed surface HMI continuum disc registration changed.");
    }
    return Object.freeze({ centerX, centerY, radius });
  }

  function brightSpan(data: Uint8Array, info: RasterInfo, fixed: number, horizontal: boolean) {
    let first = -1;
    let last = -1;
    const length = horizontal ? info.width : info.height;
    for (let position = 0; position < length; position += 1) {
      const x = horizontal ? position : fixed;
      const y = horizontal ? fixed : position;
      const offset = (y * info.width + x) * info.channels;
      const bright = data[offset] + data[offset + 1] + data[offset + 2] > continuum.discBrightnessThreshold;
      if (!bright) continue;
      if (first < 0) first = position;
      last = position;
    }
    if (first < 0 || last <= first) {
      throw new Error("Observed surface HMI continuum disc was not detected.");
    }
    return { first, last };
  }

  function continuumRadialProfile(data: Uint8Array, info: RasterInfo, { centerX, centerY, radius }: ContinuumDisc) {
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

  function sampleContinuumFrame(frame: ContinuumFrame, x: number, y: number) {
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

  function continuumChannel(frame: ContinuumFrame, x: number, y: number, channel: number) {
    return frame.data[(y * frame.info.width + x) * frame.info.channels + channel];
  }

  function stabilizeMapPoles(data: Uint8Array, width: number, height: number, latitudeSpanDegrees: number) {
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

  function solarB0Radians(timestamp: number) {
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
      Math.sin(eclipticLongitude - ascendingNode) * Math.sin(radians(continuum.solarPoleTiltDegrees)),
    );
  }

  function wrappedRadians(value: number) {
    let wrapped = value;
    while (wrapped > Math.PI) wrapped -= Math.PI * 2;
    while (wrapped < -Math.PI) wrapped += Math.PI * 2;
    return wrapped;
  }

  function moduloNumber(value: number, divisor: number) {
    return ((value % divisor) + divisor) % divisor;
  }

  function radians(degrees: number) {
    return degrees * Math.PI / 180;
  }

  function mix(left: number, right: number, amount: number) {
    return left + (right - left) * amount;
  }

  function preparePolarBoundaryModel(map: Uint8Array, width: number, height: number, north: boolean, boundaryLatitude: number) {
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

  function samplePolarBoundaryModel(model: PolarBoundaryModel, longitude: number, radial: number) {
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

  function sampleWrappedBilinearRgba(map: Uint8Array, width: number, height: number, sourceX: number, sourceY: number) {
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

  function smootherStep(edge0: number, edge1: number, value: number) {
    const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
  }

  async function prepareOffLimbContext(variant: OffLimbObservation, density: number): Promise<Plate> {
    const size = OFF_LIMB_SIZE * density;
    if (variant === null) return { data: Buffer.alloc(size * size * 4), size, lossless: true };
    const sourcePath = resolve(sourceDirectory, variant.observedFile);
    const { data, info } = await sharp(sourcePath).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 1024 || info.height !== 1024 || info.channels !== 4) {
      throw new Error(`Observed surface off-limb source geometry changed: ${variant.observedFile}.`);
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
    const composed = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: registered, left, top }]).raw().toBuffer();
    return { data: composed, size, lossless: false };
  }

  async function prepareLimbMaterial(recipe: SynopticRecipe, map: Uint8Array, mapWidth: number, mapHeight: number, density: number): Promise<Plate> {
    if (recipe.limb.mode === "continuum-darkening") {
      if (recipe.source.kind !== "continuum-disc-mosaic") throw new TypeError("Continuum limb darkening needs the continuum mosaic source.");
      return prepareContinuumLimbMaterial(recipe.source, map, mapWidth, mapHeight, density);
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
    return { data: output, size, lossless: true };
  }

  async function prepareContinuumLimbMaterial(variant: ContinuumSource, map: Uint8Array, mapWidth: number, mapHeight: number, density: number): Promise<Plate> {
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
    return { data: output, size, lossless: true };
  }

  function representativeMapColor(map: Uint8Array, width: number, height: number) {
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

  function modulo(value: number, divisor: number) {
    return ((value % divisor) + divisor) % divisor;
  }

  function clamp(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
  }
  return { interpret };
}
