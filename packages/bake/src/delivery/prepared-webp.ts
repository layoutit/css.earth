import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rename, stat, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import cwebpExecutable from "cwebp-bin";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
if (typeof cwebpExecutable !== "string") throw new TypeError("cwebp-bin must expose its executable path.");
const cwebpPath: string = cwebpExecutable;
type DecodedRgba = Awaited<ReturnType<typeof decodeRgba>>;
export const PREPARED_Q75_WEBP_ENCODING = "webp-q75-alpha-q100";

export async function optimizePreparedLosslessWebp(inputPath: string) {
  return optimizeCandidate(inputPath, ["-lossless", "-z", "9", "-exact"],
    assertSameRgba, null);
}

// Terminal display encoding may discard RGB only where alpha is zero. Do not
// use this policy for rasters that a later preparer decodes or interpolates.
export async function optimizePreparedDisplayLosslessWebp(inputPath: string) {
  return optimizeCandidate(inputPath, ["-lossless", "-z", "9"],
    assertSameVisiblePixels, null);
}

export async function optimizePreparedQ75Webp(inputPath: string) {
  return optimizeCandidate(inputPath, ["-q", "75", "-m", "6", "-alpha_q", "100"],
    assertSameAlpha, PREPARED_Q75_WEBP_ENCODING);
}

async function optimizeCandidate(inputPath: string, argumentsBeforeInput: readonly string[], validate: (originalPath: string, candidatePath: string) => Promise<void>, encoding: string | null) {
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

async function assertSameRgba(originalPath: string, candidatePath: string) {
  const [original, candidate] = await Promise.all([
    decodeRgba(originalPath),
    decodeRgba(candidatePath),
  ]);
  assertSameDimensions(originalPath, original, candidate, "Lossless WebP");
  // Offline consumers may interpolate unassociated RGBA or use RGB beneath
  // transparent texels. Lossless transport must preserve all four channels.
  for (let offset = 0; offset < original.data.length; offset += 1) {
    if (original.data[offset] !== candidate.data[offset]) {
      throw new Error(
        `Lossless WebP RGBA changed for ${originalPath} at pixel ` +
        `${Math.floor(offset / 4)}, channel ${offset % 4}.`,
      );
    }
  }
}

async function assertSameVisiblePixels(originalPath: string, candidatePath: string) {
  const [original, candidate] = await Promise.all([
    decodeRgba(originalPath),
    decodeRgba(candidatePath),
  ]);
  assertSameDimensions(originalPath, original, candidate, "Display-lossless WebP");
  for (let offset = 0; offset < original.data.length; offset += 4) {
    const alpha = original.data[offset + 3];
    if (alpha !== candidate.data[offset + 3]) {
      throw new Error(
        `Display-lossless WebP alpha changed for ${originalPath} at pixel ${offset / 4}.`,
      );
    }
    if (alpha === 0) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      if (original.data[offset + channel] !== candidate.data[offset + channel]) {
        throw new Error(
          `Display-lossless WebP visible RGB changed for ${originalPath} at pixel ` +
          `${offset / 4}, channel ${channel}.`,
        );
      }
    }
  }
}

async function assertSameAlpha(originalPath: string, candidatePath: string) {
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

function assertSameDimensions(inputPath: string, original: DecodedRgba, candidate: DecodedRgba, label: string) {
  if (original.width === candidate.width && original.height === candidate.height) {
    return;
  }
  throw new Error(
    `${label} dimensions changed for ${inputPath}: ` +
    `${original.width}x${original.height} -> ` +
    `${candidate.width}x${candidate.height}.`,
  );
}

async function decodeRgba(inputPath: string) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) {
    throw new Error(`Expected four decoded channels for ${inputPath}.`);
  }
  return { data, width: info.width, height: info.height };
}
