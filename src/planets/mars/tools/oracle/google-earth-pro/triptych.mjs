import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import sharp from "sharp";

export async function createPixelmatchTriptych({
  referencePath,
  candidatePath,
  outputPath,
  threshold = 0.1,
}) {
  const [reference, candidate] = await Promise.all([
    normalizedPng(referencePath),
    normalizedPng(candidatePath),
  ]);
  if (reference.width !== candidate.width ||
      reference.height !== candidate.height) {
    throw new Error(
      `INVALID unpaired dimensions: reference ${reference.width}x${reference.height}; candidate ${candidate.width}x${candidate.height}.`,
    );
  }

  const { width, height } = reference;
  const pixelmatchOutput = new PNG({ width, height });
  const absoluteOutput = new PNG({ width, height });
  const changedPixels = pixelmatch(
    reference.data,
    candidate.data,
    pixelmatchOutput.data,
    width,
    height,
    { threshold, includeAA: true },
  );
  let absoluteRgbTotal = 0;
  for (let index = 0; index < absoluteOutput.data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(
        reference.data[index + channel] - candidate.data[index + channel],
      );
      absoluteOutput.data[index + channel] = delta;
      absoluteRgbTotal += delta;
    }
    absoluteOutput.data[index + 3] = 255;
  }

  const stem = outputStem(outputPath);
  const normalizedReferencePath = `${stem}-native.png`;
  const normalizedCandidatePath = `${stem}-browser.png`;
  const pixelmatchPath = `${stem}-pixelmatch.png`;
  const absolutePath = `${stem}-absolute.png`;
  await mkdir(dirname(outputPath), { recursive: true });
  const referenceBytes = PNG.sync.write(reference);
  const candidateBytes = PNG.sync.write(candidate);
  const pixelmatchBytes = PNG.sync.write(pixelmatchOutput);
  const absoluteBytes = PNG.sync.write(absoluteOutput);
  await Promise.all([
    writeFile(normalizedReferencePath, referenceBytes),
    writeFile(normalizedCandidatePath, candidateBytes),
    writeFile(pixelmatchPath, pixelmatchBytes),
    writeFile(absolutePath, absoluteBytes),
  ]);

  const separator = 4;
  await sharp({
    create: {
      width: width * 3 + separator * 2,
      height,
      channels: 4,
      background: "#000000",
    },
  }).composite([
    { input: referenceBytes, left: 0, top: 0 },
    { input: candidateBytes, left: width + separator, top: 0 },
    {
      input: pixelmatchBytes,
      left: (width + separator) * 2,
      top: 0,
    },
  ]).png().toFile(outputPath);

  const triptychBytes = await readFile(outputPath);
  const totalPixels = width * height;
  return Object.freeze({
    schema: "cssmars-native-browser-pixelmatch-triptych@1",
    qualification: "PIXEL_PAIRED_IDENTICAL_DIMENSIONS",
    panelOrder: Object.freeze(["native", "browser", "pixelmatch"]),
    width,
    height,
    threshold,
    changedPixels,
    changedPixelRatio: changedPixels / totalPixels,
    meanAbsoluteRgbDelta: absoluteRgbTotal / (totalPixels * 3),
    paths: Object.freeze({
      native: normalizedReferencePath,
      browser: normalizedCandidatePath,
      pixelmatch: pixelmatchPath,
      absolute: absolutePath,
      triptych: outputPath,
    }),
    sha256: Object.freeze({
      native: sha256(referenceBytes),
      browser: sha256(candidateBytes),
      pixelmatch: sha256(pixelmatchBytes),
      absolute: sha256(absoluteBytes),
      triptych: sha256(triptychBytes),
    }),
  });
}

async function normalizedPng(path) {
  const bytes = await sharp(path)
    .rotate()
    .toColorspace("srgb")
    .ensureAlpha()
    .png()
    .toBuffer();
  return PNG.sync.read(bytes);
}

function outputStem(path) {
  const extension = extname(path);
  return resolve(dirname(path), basename(path, extension));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [referencePath, candidatePath, outputPath] = process.argv.slice(2);
  if (!referencePath || !candidatePath || !outputPath) {
    throw new Error(
      "Usage: node triptych.mjs <native-image> <browser-image> <output.png>",
    );
  }
  const result = await createPixelmatchTriptych({
    referencePath: resolve(referencePath),
    candidatePath: resolve(candidatePath),
    outputPath: resolve(outputPath),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
