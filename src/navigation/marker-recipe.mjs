import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix, win32 } from "node:path";

import sharp from "sharp";
import { blackFillCoverage, paintMissingCoverage } from "../platform/prepare-missing-coverage.mjs";

const SHA256 = /^[0-9a-f]{64}$/u;
const PLANET_ID = /^[a-z][a-z0-9-]*$/u;
const OPERATION_TYPES = new Set([
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

export function validateMarkerDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor) ||
      descriptor.schema !== "cssearth-navigation-marker@1" ||
      !PLANET_ID.test(descriptor.planetId ?? "") ||
      !new Set(["object", "navigation"]).has(descriptor.owner) ||
      !Array.isArray(descriptor.operations) || descriptor.operations.length === 0) {
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
  if (descriptor.operations.at(-1).type !== "png") {
    throw new TypeError("Navigation marker recipe must end with png.");
  }
  return descriptor;
}

export function validateMarkerSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source) ||
      !safeRelativePath(source.path) ||
      !Number.isSafeInteger(source.expectedBytes) || source.expectedBytes <= 0 ||
      !SHA256.test(source.expectedSha256 ?? "") ||
      !nonEmpty(source.origin) || !nonEmpty(source.credit) ||
      !nonEmpty(source.license)) {
    throw new TypeError("Navigation marker source is invalid.");
  }
  return source;
}

function httpOrigin(value) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}

export async function validateMarkerSourceBytes(source, sourcePath) {
  validateMarkerSource(source);
  const bytes = await readFile(sourcePath);
  if (bytes.byteLength !== source.expectedBytes) {
    throw new Error(`Navigation marker source size drifted: ${source.path}.`);
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== source.expectedSha256) {
    throw new Error(`Navigation marker source hash drifted: ${source.path}.`);
  }
  return bytes;
}

export async function readMarkerImage(source, sourcePath) {
  const bytes = await validateMarkerSourceBytes(source, sourcePath);
  if (!source.raster) return sharp(bytes);
  const {readObservation} = await import('../../tools/objects/terrestrial-layers/solid-raster.mjs');
  const {rgb, missing} = await readObservation('/', {...source, path: sourcePath}, source.raster, source.width, source.height);
  const info = {width: source.width, height: source.height, channels: 3};
  return sharp(paintMissingCoverage(rgb, info, missing), {raw: info});
}

export async function renderMarker(descriptor, { sourcePath, tileSize }) {
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
    } else if (operation.type === "ensure-alpha") image = image.ensureAlpha();
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

function validateOperation(operation) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation) ||
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

function safeRelativePath(value) {
  return nonEmpty(value) && !value.includes("\\") && !value.includes("\0") &&
    !posix.isAbsolute(value) && !win32.isAbsolute(value) &&
    posix.normalize(value) === value && value !== "." && !value.startsWith("../");
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}
