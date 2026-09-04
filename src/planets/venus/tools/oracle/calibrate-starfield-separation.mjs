#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PNG } from "pngjs";
import sharp from "sharp";

import {
  analyzeScenePng,
  compareStarfieldFeatures,
} from "./image-analysis.mjs";

const evidenceRoot = resolve(process.argv[2] ??
  "output/playwright/venus-google-sun-proper-sweep-20260901-v12");
const googleRoot = resolve(process.argv[3] ??
  "output/playwright/venus-google-sun-proper-sweep-20260901-v6");
const sampleWidth = 240;
const sampleHeight = 152;
const fullWidth = 960;
const fullHeight = 608;
const scaleX = sampleWidth / fullWidth;
const scaleY = sampleHeight / fullHeight;
const threshold = 12;
const sigmas = Object.freeze([3, 6, 9, 12, 24]);
const baseGains = Object.freeze([0.65, 0.75, 0.85, 0.95, 1]);
const detailGains = Object.freeze([1, 1.5, 2.2, 2.6, 3, 3.5]);

const report = JSON.parse(await readFile(
  resolve(evidenceRoot, "sun-motion-mismatch-report.json"),
  "utf8",
));
const sampleIds = report.components.starfield.samples.map(({ id }) => id);
const candidates = sigmas.flatMap((sigma) => baseGains.flatMap((baseGain) =>
  detailGains.map((detailGain) => ({
    sigma,
    baseGain,
    detailGain,
    scoreSum: 0,
    f1Sum: 0,
    luminanceScoreSum: 0,
  }))));

for (const [sampleIndex, id] of sampleIds.entries()) {
  const [googleBytes, localBytes] = await Promise.all([
    readFile(resolve(googleRoot, "google/frames", `${id}.png`)),
    readFile(resolve(evidenceRoot, "local/frames", `${id}.png`)),
  ]);
  const [googleAnalysis, localAnalysis, google, local] = await Promise.all([
    Promise.resolve(analyzeScenePng(googleBytes)),
    Promise.resolve(analyzeScenePng(localBytes)),
    readRgb(googleBytes),
    readRgb(localBytes),
  ]);
  const included = inclusionMask(googleAnalysis, localAnalysis);
  const reference = luminances(google);
  const browser = luminances(local);
  const referenceMask = thresholdMask(reference, included);
  const referenceCount = countMask(referenceMask);
  const referenceMean = maskedMean(reference, included);
  const blurredBySigma = new Map();
  for (const sigma of sigmas) {
    const blurred = await sharp(local, {
      raw: { width: sampleWidth, height: sampleHeight, channels: 3 },
    }).blur(Math.max(0.3, sigma * scaleX)).raw().toBuffer();
    blurredBySigma.set(sigma, luminances(blurred));
  }
  for (const candidate of candidates) {
    const blurred = blurredBySigma.get(candidate.sigma);
    let browserCount = 0;
    let intersection = 0;
    let browserLuminanceSum = 0;
    let includedCount = 0;
    for (let index = 0; index < browser.length; index += 1) {
      if (!included[index]) continue;
      const prepared = clamp(
        blurred[index] * candidate.baseGain +
          (browser[index] - blurred[index]) * candidate.detailGain,
        0,
        255,
      );
      browserLuminanceSum += prepared;
      includedCount += 1;
      if (prepared < threshold) continue;
      browserCount += 1;
      if (referenceMask[index]) intersection += 1;
    }
    const precision = browserCount === 0 ? 0 : intersection / browserCount;
    const recall = referenceCount === 0 ? 0 : intersection / referenceCount;
    const f1 = precision + recall === 0
      ? 0
      : 2 * precision * recall / (precision + recall);
    const browserMean = browserLuminanceSum / includedCount;
    const luminanceScore = Math.min(referenceMean, browserMean) /
      Math.max(referenceMean, browserMean);
    candidate.f1Sum += f1;
    candidate.luminanceScoreSum += luminanceScore;
    candidate.scoreSum += f1 * 0.75 + luminanceScore * 0.25;
  }
  if ((sampleIndex + 1) % 20 === 0) {
    process.stderr.write(`${JSON.stringify({
      processed: sampleIndex + 1,
      total: sampleIds.length,
    })}\n`);
  }
}

const ranked = candidates.map((candidate) => Object.freeze({
  sigmaFullResolutionPixels: candidate.sigma,
  baseGain: candidate.baseGain,
  detailGain: candidate.detailGain,
  score: candidate.scoreSum / sampleIds.length,
  featureF1: candidate.f1Sum / sampleIds.length,
  luminanceScore: candidate.luminanceScoreSum / sampleIds.length,
})).sort((left, right) => right.score - left.score);
const verificationCandidates = deduplicateCandidates([
  ...ranked.slice(0, 5),
  ranked.find(({ baseGain, detailGain }) => baseGain === 1 && detailGain === 1),
]);
const verified = await Promise.all(verificationCandidates.map(verifyCandidate));
verified.sort((left, right) => right.score - left.score);

process.stdout.write(`${JSON.stringify({
  schema: "cssvenus-starfield-multiscale-calibration@1",
  qualification: "SCREEN_SPACE_PROXY_FOR_PREPARE_TIME_SOURCE_SEPARATION",
  evidenceRoot,
  googleRoot,
  sampleCount: sampleIds.length,
  sampleSize: { width: sampleWidth, height: sampleHeight },
  threshold,
  metric: "exact-pixel bright-feature F1 plus background luminance ratio",
  baseline: ranked.find(({ baseGain, detailGain }) =>
    baseGain === 1 && detailGain === 1),
  best: ranked[0],
  top: ranked.slice(0, 20),
  fullResolutionVerification: {
    metric: "repository bright-feature F1 with one-pixel tolerance and luminance ratio",
    best: verified[0],
    candidates: verified,
  },
}, null, 2)}\n`);

async function verifyCandidate(candidate) {
  let scoreSum = 0;
  let featureF1Sum = 0;
  let luminanceScoreSum = 0;
  for (const [sampleIndex, id] of sampleIds.entries()) {
    const [googleBytes, localBytes] = await Promise.all([
      readFile(resolve(googleRoot, "google/frames", `${id}.png`)),
      readFile(resolve(evidenceRoot, "local/frames", `${id}.png`)),
    ]);
    const [googleAnalysis, localAnalysis] = [
      analyzeScenePng(googleBytes),
      analyzeScenePng(localBytes),
    ];
    const transformed = await transformFullResolution(
      localBytes,
      googleAnalysis,
      localAnalysis,
      candidate,
    );
    const comparison = compareStarfieldFeatures(
      googleBytes,
      transformed,
      googleAnalysis,
      analyzeScenePng(transformed),
    );
    scoreSum += comparison.score;
    featureF1Sum += comparison.featureF1;
    luminanceScoreSum += comparison.luminanceScore;
    if ((sampleIndex + 1) % 40 === 0) {
      process.stderr.write(`${JSON.stringify({
        verifying: candidate,
        processed: sampleIndex + 1,
        total: sampleIds.length,
      })}\n`);
    }
  }
  return Object.freeze({
    ...candidate,
    score: scoreSum / sampleIds.length,
    scorePercent: scoreSum / sampleIds.length * 100,
    featureF1: featureF1Sum / sampleIds.length,
    luminanceScore: luminanceScoreSum / sampleIds.length,
  });
}

async function transformFullResolution(
  localBytes,
  referenceAnalysis,
  browserAnalysis,
  candidate,
) {
  const png = PNG.sync.read(localBytes);
  const blurred = await sharp(localBytes).removeAlpha()
    .blur(candidate.sigmaFullResolutionPixels)
    .raw().toBuffer();
  const output = PNG.sync.read(PNG.sync.write(png));
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (excludedPixel(x, y, referenceAnalysis, browserAnalysis)) continue;
      const pixelIndex = y * png.width + x;
      const offset = pixelIndex * 4;
      const blurredOffset = pixelIndex * 3;
      const luminance = 0.2126 * png.data[offset] +
        0.7152 * png.data[offset + 1] + 0.0722 * png.data[offset + 2];
      const blurredLuminance = 0.2126 * blurred[blurredOffset] +
        0.7152 * blurred[blurredOffset + 1] +
        0.0722 * blurred[blurredOffset + 2];
      const prepared = clamp(
        blurredLuminance * candidate.baseGain +
          (luminance - blurredLuminance) * candidate.detailGain,
        0,
        255,
      );
      const gain = luminance <= 1e-9 ? 0 : prepared / luminance;
      for (let channel = 0; channel < 3; channel += 1) {
        output.data[offset + channel] = Math.round(clamp(
          png.data[offset + channel] * gain,
          0,
          255,
        ));
      }
    }
  }
  return PNG.sync.write(output);
}

function excludedPixel(x, y, referenceAnalysis, browserAnalysis) {
  const insidePlanet = [referenceAnalysis.silhouette, browserAnalysis.silhouette]
    .some((silhouette) => {
      const normalizedX = (x - silhouette.center.x) /
        (silhouette.radiusX * 1.12);
      const normalizedY = (y - silhouette.center.y) /
        (silhouette.radiusY * 1.12);
      return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
    });
  if (insidePlanet) return true;
  return [referenceAnalysis.sun, browserAnalysis.sun]
    .filter(({ visible }) => visible)
    .some((sun) => x >= sun.bounds.minimumX - 48 &&
      x <= sun.bounds.maximumX + 48 &&
      y >= sun.bounds.minimumY - 48 &&
      y <= sun.bounds.maximumY + 48);
}

function deduplicateCandidates(values) {
  const seen = new Set();
  return values.filter((candidate) => {
    const key = `${candidate.sigmaFullResolutionPixels}:${candidate.baseGain}:` +
      candidate.detailGain;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readRgb(bytes) {
  return sharp(bytes).resize(sampleWidth, sampleHeight, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  }).removeAlpha().raw().toBuffer();
}

function luminances(rgb) {
  const output = new Float32Array(sampleWidth * sampleHeight);
  for (let index = 0; index < output.length; index += 1) {
    const offset = index * 3;
    output[index] = 0.2126 * rgb[offset] + 0.7152 * rgb[offset + 1] +
      0.0722 * rgb[offset + 2];
  }
  return output;
}

function inclusionMask(referenceAnalysis, browserAnalysis) {
  const output = new Uint8Array(sampleWidth * sampleHeight);
  const silhouettes = [referenceAnalysis.silhouette, browserAnalysis.silhouette];
  const suns = [referenceAnalysis.sun, browserAnalysis.sun]
    .filter(({ visible }) => visible);
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const fullX = (x + 0.5) / scaleX - 0.5;
      const fullY = (y + 0.5) / scaleY - 0.5;
      const insidePlanet = silhouettes.some((silhouette) => {
        const normalizedX = (fullX - silhouette.center.x) /
          (silhouette.radiusX * 1.12);
        const normalizedY = (fullY - silhouette.center.y) /
          (silhouette.radiusY * 1.12);
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
      });
      const insideSun = suns.some((sun) => fullX >= sun.bounds.minimumX - 48 &&
        fullX <= sun.bounds.maximumX + 48 &&
        fullY >= sun.bounds.minimumY - 48 &&
        fullY <= sun.bounds.maximumY + 48);
      if (!insidePlanet && !insideSun) output[y * sampleWidth + x] = 1;
    }
  }
  return output;
}

function thresholdMask(values, included) {
  const output = new Uint8Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    if (included[index] && values[index] >= threshold) output[index] = 1;
  }
  return output;
}

function countMask(mask) {
  let count = 0;
  for (const value of mask) count += value;
  return count;
}

function maskedMean(values, included) {
  let sum = 0;
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (!included[index]) continue;
    sum += values[index];
    count += 1;
  }
  return sum / count;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
