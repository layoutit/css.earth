import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile } from "node:fs/promises";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import sharp from "sharp";
import type { VisibleSun } from "./analysis-types.mts";



export function comparePngBuffers(leftBytes: Buffer, rightBytes: Buffer, { pixelmatchThreshold = 0.1 }: { pixelmatchThreshold?: number } = {}) {
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(
      `PNG dimensions differ: ${left.width}x${left.height} and ` +
      `${right.width}x${right.height}.`,
    );
  }
  const diff = new PNG({ width: left.width, height: left.height });
  const changedPixels = pixelmatch(
    left.data,
    right.data,
    diff.data,
    left.width,
    left.height,
    { threshold: pixelmatchThreshold, includeAA: true },
  );
  const totalPixels = left.width * left.height;
  return Object.freeze({
    width: left.width,
    height: left.height,
    changedPixels,
    totalPixels,
    changedPixelRatio: changedPixels / totalPixels,
    pixelmatchDiff: PNG.sync.write(diff),
  });
}

export async function writeAbsoluteDiff(leftPath: string, rightPath: string, outputPath: string) {
  const [leftBytes, rightBytes] = await Promise.all([
    readFile(leftPath),
    readFile(rightPath),
  ]);
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error("Cannot create an absolute diff for unequal dimensions.");
  }
  const output = new PNG({ width: left.width, height: left.height });
  for (let index = 0; index < output.data.length; index += 4) {
    output.data[index] = Math.abs(left.data[index] - right.data[index]);
    output.data[index + 1] = Math.abs(
      left.data[index + 1] - right.data[index + 1],
    );
    output.data[index + 2] = Math.abs(
      left.data[index + 2] - right.data[index + 2],
    );
    output.data[index + 3] = 255;
  }
  const bytes = PNG.sync.write(output);
  await writeFile(outputPath, bytes);
  return Object.freeze({
    bytes,
    width: output.width,
    height: output.height,
    sha256: sha256(bytes),
  });
}

export async function writeTriptych(referencePath: string, browserPath: string, absoluteDiffPath: string, outputPath: string) {
  const images = await Promise.all(
    [referencePath, browserPath, absoluteDiffPath].map(async (path) => ({
      path,
      metadata: await sharp(path).metadata(),
    })),
  );
  const width = images[0].metadata.width;
  const height = images[0].metadata.height;
  if (!width || !height || images.some(({ metadata }) =>
    metadata.width !== width || metadata.height !== height)) {
    throw new Error("Triptych inputs must have identical non-zero dimensions.");
  }
  await sharp({
    create: {
      width: width * 3,
      height,
      channels: 3,
      background: "#000000",
    },
  }).composite([
    { input: referencePath, left: 0, top: 0 },
    { input: browserPath, left: width, top: 0 },
    { input: absoluteDiffPath, left: width * 2, top: 0 },
  ]).png().toFile(outputPath);
  const bytes = await readFile(outputPath);
  return Object.freeze({
    width: width * 3,
    height,
    sha256: sha256(bytes),
  });
}

export function opaqueBlackPng(width: number, height: number) {
  const output = new PNG({ width, height });
  for (let index = 3; index < output.data.length; index += 4) {
    output.data[index] = 255;
  }
  return output;
}

export function setRgb(png: PNG, x: number, y: number, red: number, green: number, blue: number) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const index = (y * png.width + x) * 4;
  png.data[index] = red;
  png.data[index + 1] = green;
  png.data[index + 2] = blue;
  png.data[index + 3] = 255;
}

export function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function maximumChannelDelta(left: Uint8Array, right: Uint8Array, index: number) {
  return Math.max(
    Math.abs(left[index] - right[index]),
    Math.abs(left[index + 1] - right[index + 1]),
    Math.abs(left[index + 2] - right[index + 2]),
  );
}

export function relativeLuminance(data: Uint8Array, index: number) {
  return data[index] * 0.2126 +
    data[index + 1] * 0.7152 +
    data[index + 2] * 0.0722;
}

export function hasNeighbor(mask: Uint8Array, width: number, height: number, x: number, y: number) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const candidateX = x + offsetX;
      const candidateY = y + offsetY;
      if (candidateX < 0 || candidateX >= width ||
          candidateY < 0 || candidateY >= height) continue;
      if (mask[candidateY * width + candidateX]) return true;
    }
  }
  return false;
}

export function insideSunNeighborhood(x: number, y: number, sun: VisibleSun) {
  const padding = 64;
  return x >= sun.bounds.minimumX - padding &&
    x <= sun.bounds.maximumX + padding &&
    y >= sun.bounds.minimumY - padding &&
    y <= sun.bounds.maximumY + padding;
}
