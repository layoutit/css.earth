import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { sha256 } from '@cssearth/core/node';
import { comparePngBuffers, writeAbsoluteDiff, writeTriptych, opaqueBlackPng, setRgb, insideSunNeighborhood } from "./image-pixels.mts";
import { shadowShapeMask } from "./scene-illumination.mts";
import type { Dimensions, Analysis, Silhouette, Sun, VisibleSun, IndependentCapture } from "./analysis-types.mts";

export async function writeIndependentCaptures({ referenceBytes, browserBytes, referenceAnalysis, browserAnalysis, outputRoot }: { referenceBytes: Buffer; browserBytes: Buffer; referenceAnalysis: Analysis; browserAnalysis: Analysis; outputRoot: string }) {
  const reference = PNG.sync.read(referenceBytes);
  const browser = PNG.sync.read(browserBytes);
  if (reference.width !== browser.width || reference.height !== browser.height) {
    throw new Error("Independent capture inputs must use identical dimensions.");
  }
  const sharedSilhouettes = Object.freeze([
    referenceAnalysis.silhouette,
    browserAnalysis.silhouette,
  ]);
  const sharedSuns = Object.freeze([
    referenceAnalysis.sun,
    browserAnalysis.sun,
  ].filter((sun) => sun.visible));
  const captures = Object.freeze({
    starfield: Object.freeze({
      basis: "source-background-outside-shared-silhouette-and-sun-union",
      reference: renderStarfield(reference, sharedSilhouettes, sharedSuns),
      browser: renderStarfield(browser, sharedSilhouettes, sharedSuns),
    }),
    sun: Object.freeze({
      basis: "source-pixels-inside-detected-sun-neighborhood",
      reference: renderSun(reference, referenceAnalysis.sun, sharedSilhouettes),
      browser: renderSun(browser, browserAnalysis.sun, sharedSilhouettes),
    }),
  });
  const result: Record<string, IndependentCapture> = {};
  for (const [id, capture] of Object.entries(captures)) {
    const referencePath = resolve(outputRoot, `${id}-google.png`);
    const browserPath = resolve(outputRoot, `${id}-browser.png`);
    const absoluteDiffPath = resolve(outputRoot, `${id}-absolute.png`);
    const triptychPath = resolve(
      outputRoot,
      `${id}-google-browser-absolute.png`,
    );
    const [referencePng, browserPng] = [
      PNG.sync.write(capture.reference),
      PNG.sync.write(capture.browser),
    ];
    await Promise.all([
      writeFile(referencePath, referencePng),
      writeFile(browserPath, browserPng),
    ]);
    const comparison = comparePngBuffers(referencePng, browserPng);
    const absoluteDiff = await writeAbsoluteDiff(
      referencePath,
      browserPath,
      absoluteDiffPath,
    );
    const triptych = await writeTriptych(
      referencePath,
      browserPath,
      absoluteDiffPath,
      triptychPath,
    );
    result[id] = Object.freeze({
      basis: capture.basis,
      changedPixelRatio: comparison.changedPixelRatio,
      reference: Object.freeze({
        path: referencePath,
        sha256: sha256(referencePng),
      }),
      browser: Object.freeze({
        path: browserPath,
        sha256: sha256(browserPng),
      }),
      absoluteDiff: Object.freeze({
        path: absoluteDiffPath,
        sha256: absoluteDiff.sha256,
      }),
      triptych: Object.freeze({
        path: triptychPath,
        sha256: triptych.sha256,
      }),
    });
  }
  return Object.freeze(result);
}

export function renderSilhouette({ width, height }: Dimensions, silhouette: Silhouette) {
  const output = opaqueBlackPng(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (x - silhouette.center.x) / silhouette.radiusX;
      const normalizedY = (y - silhouette.center.y) / silhouette.radiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
        setRgb(output, x, y, 255, 255, 255);
      }
    }
  }
  return output;
}

export function renderStarfield(source: PNG, silhouettes: readonly Silhouette[], suns: readonly VisibleSun[]) {
  const output = PNG.sync.read(PNG.sync.write(source));
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      if (silhouettes.some((silhouette) => {
        const normalizedX = (x - silhouette.center.x) /
          (silhouette.radiusX * 1.12);
        const normalizedY = (y - silhouette.center.y) /
          (silhouette.radiusY * 1.12);
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
      }) || suns.some((sun) => insideSunNeighborhood(x, y, sun))) {
        setRgb(output, x, y, 0, 0, 0);
      }
    }
  }
  return output;
}

export function renderSun(source: PNG, sun: Sun, silhouettes: readonly Silhouette[]) {
  const output = opaqueBlackPng(source.width, source.height);
  if (!sun.visible) return output;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (!insideSunNeighborhood(x, y, sun) || silhouettes.some((silhouette) => {
        const normalizedX = (x - silhouette.center.x) /
          (silhouette.radiusX * 1.01);
        const normalizedY = (y - silhouette.center.y) /
          (silhouette.radiusY * 1.01);
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
      })) {
        continue;
      }
      const index = (y * source.width + x) * 4;
      setRgb(output, x, y, source.data[index], source.data[index + 1],
        source.data[index + 2]);
    }
  }
  return output;
}

export function renderShadowShape(source: PNG, analysis: Analysis) {
  const shape = shadowShapeMask(source, analysis);
  const output = opaqueBlackPng(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (shape.mask[y * source.width + x]) {
        setRgb(output, x, y, 255, 255, 255);
      }
    }
  }
  return output;
}

export function renderIlluminationProfile({ width, height }: Dimensions, analysis: Analysis) {
  const output = opaqueBlackPng(width, height);
  const { center, radiusX, radiusY } = analysis.silhouette;
  const direction = analysis.terminator.lightDirection;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (x - center.x) / radiusX;
      const normalizedY = (y - center.y) / radiusY;
      if (Math.hypot(normalizedX, normalizedY) > 0.94) continue;
      const along = normalizedX * direction.x + normalizedY * direction.y;
      const bin = Math.max(0, Math.min(
        analysis.illumination.meanLuminance.length - 1,
        Math.floor((along + 0.94) / 1.88 *
          analysis.illumination.meanLuminance.length),
      ));
      const level = Math.round(analysis.illumination.meanLuminance[bin]);
      setRgb(output, x, y, level, level, level);
    }
  }
  return output;
}
