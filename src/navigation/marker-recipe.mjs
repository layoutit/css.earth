import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { posix, win32 } from "node:path";

import sharp from "sharp";

const SHA256 = /^[0-9a-f]{64}$/u;
const PLANET_ID = /^[a-z][a-z0-9-]*$/u;
const OPERATION_TYPES = new Set([
  "rotate",
  "trim",
  "extract",
  "resize",
  "ensure-alpha",
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

export async function renderMarker(descriptor, { sourcePath, tileSize }) {
  validateMarkerDescriptor(descriptor);
  if (!Number.isSafeInteger(tileSize) || tileSize <= 0) {
    throw new TypeError("Navigation marker tile size is invalid.");
  }
  let image = sharp(await validateMarkerSourceBytes(descriptor.source, sourcePath));
  for (const operation of descriptor.operations) {
    if (operation.type === "rotate") image = image.rotate();
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
  if (operation.type === "trim" &&
      (!Number.isFinite(operation.threshold) || operation.threshold < 0)) {
    throw new TypeError("Navigation marker trim is invalid.");
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
}

function safeRelativePath(value) {
  return nonEmpty(value) && !value.includes("\\") && !value.includes("\0") &&
    !posix.isAbsolute(value) && !win32.isAbsolute(value) &&
    posix.normalize(value) === value && value !== "." && !value.startsWith("../");
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}
