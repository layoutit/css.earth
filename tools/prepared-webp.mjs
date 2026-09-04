import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rename, stat, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import cwebpPath from "cwebp-bin";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
export const PREPARED_Q75_WEBP_ENCODING = "webp-q75-alpha-q100";

export async function optimizePreparedLosslessWebp(inputPath) {
  return optimizeCandidate(inputPath, ["-lossless", "-z", "9"],
    assertSameVisiblePixels, null);
}

export async function optimizePreparedQ75Webp(inputPath) {
  return optimizeCandidate(inputPath, ["-q", "75", "-m", "6", "-alpha_q", "100"],
    assertSameAlpha, PREPARED_Q75_WEBP_ENCODING);
}

async function optimizeCandidate(inputPath, argumentsBeforeInput, validate, encoding) {
  const candidatePath = `${inputPath}.${randomUUID()}.candidate.webp`;
  const originalSize = (await stat(inputPath)).size;
  try {
    await execFileAsync(cwebpPath, [
      "-quiet",
      ...argumentsBeforeInput,
      inputPath,
      "-o",
      candidatePath,
    ]);
    await validate(inputPath, candidatePath);
    const candidateSize = (await stat(candidatePath)).size;
    if (candidateSize >= originalSize) {
      return Object.freeze({
        path: inputPath,
        ...(encoding ? { encoding: "unchanged" } : {}),
        originalSize,
        optimizedSize: originalSize,
        savedBytes: 0,
      });
    }
    await rename(candidatePath, inputPath);
    return Object.freeze({
      path: inputPath,
      ...(encoding ? { encoding } : {}),
      originalSize,
      optimizedSize: candidateSize,
      savedBytes: originalSize - candidateSize,
    });
  } finally {
    await unlink(candidatePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function assertSameVisiblePixels(originalPath, candidatePath) {
  const [original, candidate] = await Promise.all([
    decodeRgba(originalPath),
    decodeRgba(candidatePath),
  ]);
  assertSameDimensions(originalPath, original, candidate, "Lossless WebP");
  for (let offset = 0; offset < original.data.length; offset += 4) {
    const originalAlpha = original.data[offset + 3];
    const candidateAlpha = candidate.data[offset + 3];
    if (originalAlpha !== candidateAlpha) {
      throw new Error(
        `Lossless WebP alpha changed for ${originalPath} at pixel ${offset / 4}.`,
      );
    }
    if (originalAlpha === 0) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      if (original.data[offset + channel] !== candidate.data[offset + channel]) {
        throw new Error(
          `Lossless WebP visible RGB changed for ${originalPath} at pixel ` +
          `${offset / 4}, channel ${channel}.`,
        );
      }
    }
  }
}

async function assertSameAlpha(originalPath, candidatePath) {
  const [original, candidate] = await Promise.all([
    decodeRgba(originalPath),
    decodeRgba(candidatePath),
  ]);
  assertSameDimensions(originalPath, original, candidate, "Q75 WebP");
  for (let offset = 3; offset < original.data.length; offset += 4) {
    if (original.data[offset] !== candidate.data[offset]) {
      throw new Error(
        `Q75 WebP alpha changed for ${originalPath} at pixel ` +
        `${Math.floor(offset / 4)}.`,
      );
    }
  }
}

function assertSameDimensions(inputPath, original, candidate, label) {
  if (original.width === candidate.width && original.height === candidate.height) {
    return;
  }
  throw new Error(
    `${label} dimensions changed for ${inputPath}: ` +
    `${original.width}x${original.height} -> ` +
    `${candidate.width}x${candidate.height}.`,
  );
}

async function decodeRgba(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) {
    throw new Error(`Expected four decoded channels for ${inputPath}.`);
  }
  return { data, width: info.width, height: info.height };
}
