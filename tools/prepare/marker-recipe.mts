import { safeRelativePath } from '../../src/platform/source-path.mts';
import { sha256 } from '@cssearth/core/node';
import { isArray } from '@cssearth/core';
/** A pin identifies bytes git does not hold; a marker image authored in this repository carries none. */
export interface MarkerSource { path: string; origin: string; credit: string; license: string; raster?: { kind: string }; width?: number; height?: number; }
/** Fields an object's marker recipe may add to its source: decoding hints its manifest record does not carry. */
export const MARKER_SOURCE_HINTS = ['raster'] as const;
export type MarkerOperation =
  | { type: "linear"; multiplier: number; offset: number }
  | { type: "rotate" | "ensure-alpha" | "png" }
  | { type: "trim"; threshold: number }
  | { type: "extract"; left: number; top: number; width: number; height: number }
  | { type: "resize"; width: string; height: string; kernel: "lanczos3"; fit?: "cover"; position?: "centre" }
  | { type: "missing-coverage"; kind: string; southConnected: boolean; northConnected?: boolean }
  | { type: "ellipse-mask"; cx: number; cy: number; rx: number; ry: number; shading?: { ambient: number; diffuse: number } }
  /** A 2:1 equirectangular map seen as a globe from far away, centred on the map point at these fractions of its width
   * (longitude) and height (latitude). Outside the disc is transparent. */
  | { type: "orthographic"; centerX: number; centerY: number };
export interface MarkerDescriptor { presentation?: unknown; schema: string; objectId: string; owner: string; source: MarkerSource; operations: readonly MarkerOperation[]; context?: { pixels: number }; }
import { readFile } from "node:fs/promises";

import sharp, { type Sharp } from "sharp";
import { blackFillCoverage, paintMissingCoverage } from "../../src/platform/prepare-missing-coverage.mts";

const SHA256 = /^[0-9a-f]{64}$/u;
const OBJECT_ID = /^[a-z][a-z0-9-]*$/u;
const OPERATION_TYPES = new Set([
  "orthographic",
  "linear",
  "rotate",
  "trim",
  "extract",
  "resize",
  "ensure-alpha",
  "missing-coverage",
  "ellipse-mask",
  "png",
]);

export function validateMarkerDescriptor(input: unknown): MarkerDescriptor {
  const descriptor = input as MarkerDescriptor;
  if (!descriptor || typeof descriptor !== "object" || isArray(descriptor) ||
      descriptor.schema !== "cssearth-navigation-marker@2" ||
      !OBJECT_ID.test(descriptor.objectId ?? "") ||
      !new Set(["object", "navigation"]).has(descriptor.owner) ||
      !isArray(descriptor.operations) || descriptor.operations.length === 0) {
    throw new TypeError("Navigation marker descriptor is invalid.");
  }
  validateMarkerSource(descriptor.source);
  if (descriptor.context !== undefined && (!Number.isSafeInteger(descriptor.context?.pixels) || descriptor.context.pixels < 32)) {
    throw new TypeError("Resolved marker size must be a positive image size of at least 32 pixels.");
  }
  if (descriptor.owner === "object" && !httpOrigin(descriptor.source.origin)) {
    throw new TypeError("Object marker source must have an HTTP(S) origin.");
  }
  for (const operation of descriptor.operations) validateOperation(operation);
  if (descriptor.operations.at(-1)?.type !== "png") {
    throw new TypeError("Navigation marker recipe must end with png.");
  }
  return descriptor;
}

export function validateMarkerSource(source: MarkerSource) {
  if (!source || typeof source !== "object" || isArray(source) ||
      !safeRelativePath(source.path) ||
      !nonEmpty(source.origin) || !nonEmpty(source.credit) ||
      !nonEmpty(source.license)) {
    throw new TypeError("Navigation marker source is invalid.");
  }
  return source;
}

function httpOrigin(value: string) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}

export async function validateMarkerSourceBytes(source: MarkerSource, sourcePath: string) {
  validateMarkerSource(source);
  return readFile(sourcePath);
}

export async function readMarkerImage(source: MarkerSource, sourcePath: string) {
  const bytes = await validateMarkerSourceBytes(source, sourcePath);
  if (!source.raster) return sharp(bytes);
  if (typeof source.width !== "number" || typeof source.height !== "number" || !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height) || source.width < 1 || source.height < 1) throw new TypeError("Marker source raster dimensions are invalid.");
  const {readObservation} = await import('../objects/terrestrial-layers/observation-raster.mts');
  const {rgb, missing} = await readObservation('/', {...source, path: sourcePath}, source.raster, source.width, source.height);
  const info = {width: source.width, height: source.height, channels: 3 as const};
  return sharp(paintMissingCoverage(rgb, info, missing), {raw: info});
}

/** Orthographic view of an equirectangular map: each disc pixel samples the map (bilinear, wrapping in longitude). The
 * map is first reduced to four texels per output pixel across the disc's width, which the sampling then averages down. */
async function orthographic(image: Sharp, { centerX, centerY }: { centerX: number; centerY: number }, tileSize: number) {
  const { width: sourceWidth = 0, height: sourceHeight = 0 } = await image.metadata();
  if (!sourceWidth || Math.abs(sourceWidth / sourceHeight - 2) > 0.01) throw new TypeError("Navigation marker orthographic source is not a 2:1 map.");
  const mapWidth = Math.min(sourceWidth, 8 * tileSize), mapHeight = mapWidth / 2;
  const { data: map } = await image.resize({ width: mapWidth, height: mapHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(tileSize * tileSize * 4);
  const lon0 = (centerX - 0.5) * 2 * Math.PI, lat0 = (0.5 - centerY) * Math.PI;
  const texel = (x: number, y: number, channel: number) =>
    map[((Math.min(mapHeight - 1, Math.max(0, y)) * mapWidth) + ((x % mapWidth) + mapWidth) % mapWidth) * 4 + channel]!;
  for (let py = 0; py < tileSize; py++) for (let px = 0; px < tileSize; px++) {
    const u = (px + 0.5) / tileSize * 2 - 1, v = 1 - (py + 0.5) / tileSize * 2, rho = Math.hypot(u, v);
    if (rho > 1) continue;
    const c = Math.asin(rho), sinC = Math.sin(c), cosC = Math.cos(c);
    const lat = rho === 0 ? lat0 : Math.asin(cosC * Math.sin(lat0) + v * sinC * Math.cos(lat0) / rho);
    const lon = rho === 0 ? lon0 : lon0 + Math.atan2(u * sinC, rho * cosC * Math.cos(lat0) - v * sinC * Math.sin(lat0));
    const sx = (lon / (2 * Math.PI) + 0.5) * mapWidth - 0.5, sy = (0.5 - lat / Math.PI) * mapHeight - 0.5;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, at = (py * tileSize + px) * 4;
    for (let channel = 0; channel < 3; channel++) {
      out[at + channel] = Math.round(
        (texel(x0, y0, channel) * (1 - fx) + texel(x0 + 1, y0, channel) * fx) * (1 - fy) +
        (texel(x0, y0 + 1, channel) * (1 - fx) + texel(x0 + 1, y0 + 1, channel) * fx) * fy);
    }
    out[at + 3] = 255;
  }
  return sharp(out, { raw: { width: tileSize, height: tileSize, channels: 4 } });
}

export async function renderMarker(descriptor: MarkerDescriptor, { sourcePath, tileSize }: { sourcePath: string; tileSize: number }) {
  validateMarkerDescriptor(descriptor);
  if (!Number.isSafeInteger(tileSize) || tileSize <= 0) {
    throw new TypeError("Navigation marker tile size is invalid.");
  }
  let image = await readMarkerImage(descriptor.source, sourcePath);
  for (const operation of descriptor.operations) {
    if (operation.type === "missing-coverage") {
      const { data, info } = await image.removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
      const missing = blackFillCoverage(data, info, operation);
      image = sharp(paintMissingCoverage(data, info, missing), { raw: info });
    } else if (operation.type === "linear") image = image.linear(operation.multiplier, operation.offset);
    else if (operation.type === "rotate") image = image.rotate();
    else if (operation.type === "trim") {
      image = image.trim({ threshold: operation.threshold });
    } else if (operation.type === "extract") {
      image = image.extract({
        left: operation.left,
        top: operation.top,
        width: operation.width,
        height: operation.height,
      });
    } else if (operation.type === "resize") {
      image = image.resize({
        width: tileSize,
        height: tileSize,
        ...(operation.fit ? { fit: operation.fit } : {}),
        ...(operation.position ? { position: operation.position } : {}),
        kernel: sharp.kernel[operation.kernel],
      });
    } else if (operation.type === "orthographic") image = await orthographic(image, operation, tileSize);
    else if (operation.type === "ensure-alpha") image = image.ensureAlpha();
    else if (operation.type === "ellipse-mask") {
      if (operation.shading) {
        // Prepare full-phase curvature in the same footprint as the silhouette.
        const { data, info } = await image.toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
          const dx = ((x + 0.5) / info.width - operation.cx) / operation.rx;
          const dy = ((y + 0.5) / info.height - operation.cy) / operation.ry;
          const light = operation.shading.ambient + operation.shading.diffuse * Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
          for (let channel = 0; channel < 3; channel++) data[(y * info.width + x) * info.channels + channel] *= light;
        }
        image = sharp(data, { raw: info });
      }
      const mask = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}">` +
        `<ellipse cx="${tileSize * operation.cx}" cy="${tileSize * operation.cy}" ` +
        `rx="${tileSize * operation.rx}" ry="${tileSize * operation.ry}" fill="white"/>` +
        "</svg>",
      );
      image = image.composite([{ input: mask, blend: "dest-in" }]);
    } else if (operation.type === "png") image = image.png();
  }
  return image.toBuffer();
}

function validateOperation(operation: MarkerOperation) {
  if (!operation || typeof operation !== "object" || isArray(operation) ||
      !OPERATION_TYPES.has(operation.type)) {
    throw new TypeError("Navigation marker operation is invalid.");
  }
  if (operation.type === "linear" && (!Number.isFinite(operation.multiplier) || operation.multiplier <= 0 || !Number.isFinite(operation.offset))) {
    throw new TypeError("Navigation marker display stretch is invalid.");
  }
  if (operation.type === "trim" &&
      (!Number.isFinite(operation.threshold) || operation.threshold < 0)) {
    throw new TypeError("Navigation marker trim is invalid.");
  }
  if (operation.type === "missing-coverage" &&
      (operation.kind !== "black-fill" || typeof operation.southConnected !== "boolean")) {
    throw new TypeError("Navigation marker coverage is invalid.");
  }
  if (operation.type === "extract" &&
      ![operation.left, operation.top, operation.width, operation.height]
        .every((value) => Number.isSafeInteger(value) && value >= 0) ||
      operation.type === "extract" && (operation.width === 0 || operation.height === 0)) {
    throw new TypeError("Navigation marker extract is invalid.");
  }
  if (operation.type === "resize" &&
      (operation.width !== "tile" || operation.height !== "tile" ||
       !new Set(["lanczos3"]).has(operation.kernel) ||
       operation.fit && operation.fit !== "cover" ||
       operation.position && operation.position !== "centre")) {
    throw new TypeError("Navigation marker resize is invalid.");
  }
  if (operation.type === "orthographic" &&
      ![operation.centerX, operation.centerY].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new TypeError("Navigation marker orthographic centre is invalid.");
  }
  if (operation.type === "ellipse-mask" &&
      ![operation.cx, operation.cy, operation.rx, operation.ry]
        .every((value) => Number.isFinite(value) && value > 0 && value <= 1)) {
    throw new TypeError("Navigation marker mask is invalid.");
  }
  if (operation.type === "ellipse-mask" && operation.shading !== undefined &&
      (!Number.isFinite(operation.shading?.ambient) || !Number.isFinite(operation.shading?.diffuse) ||
       operation.shading.ambient < 0 || operation.shading.diffuse < 0 ||
       operation.shading.ambient + operation.shading.diffuse > 1)) {
    throw new TypeError("Navigation marker curvature shading is invalid.");
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
