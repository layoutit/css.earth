// Derived from the retired static lane's synoptic-emission.mts by moving the per-variant closure into a factory that
// returns finished RGBA maps and plates instead of writing files:
//   - the retired module's file writes are gone: the generic raster lane (packages/bake/src/raster/surfaces.ts) packs,
//     encodes and names every output;
//   - the retired polar sprite, 32-segment band atlas and proxy blend are not here: the generic lane samples its own
//     polar sprite (packages/objects/src/baking/polar.ts) from the stabilized map (stabilizeMapPoles below) and closes
//     each pole with one flat cap.
// The photosphere is the JSOC HMI continuum mosaic (hmi-continuum.mts). The Fourier polar boundary continuation,
// off-limb registration and rim plate are the retired lane's.
import type { RasterInfo } from "./raster.mts";
import type { FitsMapRecipe } from "./fits-map.mts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { prepareFitsMap } from "./fits-map.mts";
import { createHmiContinuum, type HmiContinuumSource } from "./hmi-continuum.mts";

type PolarBoundaryModel = readonly {mean: number; modes: readonly {cosine: number; sine: number}[]}[];
export interface FitsSource { kind: "fits-map"; fits: FitsMapRecipe; }
export type OffLimbObservation = null | { observedFile: string; center: readonly [number, number]; radius: number };
export interface SynopticRecipe {
  source: HmiContinuumSource | FitsSource;
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
  const continua = new Map<string, ReturnType<typeof createHmiContinuum>>();
  const continuumOf = (source: HmiContinuumSource) => {
    const key = JSON.stringify(source);
    let continuum = continua.get(key);
    if (!continuum) continua.set(key, continuum = createHmiContinuum(sourceDirectory, source));
    return continuum;
  };

  async function interpret(recipe: SynopticRecipe, input: string, width: number, height: number, density: number): Promise<InterpretedSynoptic> {
    const globalMap = recipe.source.kind === "hmi-continuum-mosaic"
      ? await continuumOf(recipe.source).map(width, height)
      : prepareFitsMap(await readFile(input), width, height, recipe.source.fits);
    if (recipe.polarStabilization) stabilizeMapPoles(globalMap, width, height, 180 / recipe.polarStabilization.latitudeSegments);
    const offLimb = await prepareOffLimbContext(recipe.offLimb, density);
    const limb = await prepareLimbMaterial(recipe, globalMap, width, height, density);
    return { data: globalMap, info: { width, height, channels: 4 }, plates: { offLimb, limb } };
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
      if (recipe.source.kind !== "hmi-continuum-mosaic") throw new TypeError("Continuum limb darkening needs the HMI continuum mosaic.");
      return prepareContinuumLimbMaterial(recipe.source, density);
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

  /** A black plate that darkens the rim by the limb darkening JSOC removed from the frames, capped at 36%. */
  async function prepareContinuumLimbMaterial(source: HmiContinuumSource, density: number): Promise<Plate> {
    const size = LIMB_SIZE * density;
    const output = Buffer.alloc(size * size * 4);
    const profile = await continuumOf(source).limbProfile();
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
            profile[left]!,
            profile[right]!,
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
