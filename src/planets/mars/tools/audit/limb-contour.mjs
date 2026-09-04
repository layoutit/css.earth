import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import { PNG } from "pngjs";

import { prepareMarsProjectedSilhouette } from "../prepare-atmosphere.mjs";
import {
  MARS_LIMB_CONTOUR_THRESHOLDS,
  measureMarsLimbContour,
} from "./limb-contour-metric.mjs";

const CHROME_EXECUTABLE =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = Object.freeze({ width: 1280, height: 900 });
const DENSITIES = Object.freeze([1, 2]);
const PITCHES = Object.freeze([0, 18, 65]);
const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:4210/mars/");
const outputRoot = resolve(
  process.argv[3] ?? "output/playwright/mars-limb-contour",
);
const expectation = process.argv[4] ?? "report";
if (!new Set(["report", "defect", "smooth"]).has(expectation)) {
  throw new Error("Expected mode report, defect, or smooth.");
}

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_EXECUTABLE,
  args: ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"],
});
const samples = [];
try {
  for (const density of DENSITIES) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: density,
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.goto(baseUrl.href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__mars?.ready === true);
    await page.evaluate(() => window.__mars.pause());
    for (const pitch of PITCHES) {
      await page.evaluate(({ pitch }) => {
        window.__mars.setView({ pitch, zoom: 0.8 });
        for (const animation of document.getAnimations()) animation.pause();
      }, { pitch });
      await page.waitForFunction(
        ({ pitch }) => window.__mars?.view().pitch === pitch,
        { pitch },
      );
      await page.waitForTimeout(250);
      const geometry = await page.evaluate(() => {
        const leaf = document.querySelector(".mars-material-plane > s");
        const rect = leaf.getBoundingClientRect();
        return {
          materialRect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          backgroundImage: getComputedStyle(leaf).backgroundImage,
        };
      });
      const margin = 16;
      const clip = {
        x: Math.max(0, geometry.materialRect.x - margin),
        y: Math.max(0, geometry.materialRect.y - margin),
        width: Math.min(
          VIEWPORT.width,
          geometry.materialRect.x + geometry.materialRect.width + margin,
        ) - Math.max(0, geometry.materialRect.x - margin),
        height: Math.min(
          VIEWPORT.height,
          geometry.materialRect.y + geometry.materialRect.height + margin,
        ) - Math.max(0, geometry.materialRect.y - margin),
      };
      const captures = {};
      for (const mode of ["composite", "body", "material"]) {
        await installCaptureMode(page, mode);
        const path = resolve(
          outputRoot,
          `dpr${density}-pitch-${pitch}-${mode}.png`,
        );
        await page.screenshot({ path, clip, omitBackground: true });
        captures[mode] = path;
      }
      await installCaptureMode(page, "composite");
      const composite = PNG.sync.read(await import("node:fs/promises").then(
        ({ readFile }) => readFile(captures.composite),
      ));
      const actualVisibility = Uint8Array.from(
        { length: composite.width * composite.height },
        (_, index) => {
          const offset = index * 4;
          return Math.round(Math.max(
            composite.data[offset],
            composite.data[offset + 1],
            composite.data[offset + 2],
          ) * composite.data[offset + 3] / 255);
        },
      );
      const expected = prepareMarsProjectedSilhouette(pitch, density);
      const expectedRect = {
        x: (geometry.materialRect.x - clip.x) * density,
        y: (geometry.materialRect.y - clip.y) * density,
        width: geometry.materialRect.width * density,
        height: geometry.materialRect.height * density,
      };
      const measurement = measureMarsLimbContour({
        actualAlpha: actualVisibility,
        actualWidth: composite.width,
        actualHeight: composite.height,
        expectedCoverage: expected.coverage,
        expectedWidth: 512 * density,
        expectedHeight: 512 * density,
        expectedRect,
      });
      const control = measureMarsLimbContour({
        actualAlpha: expected.coverage,
        actualWidth: 512 * density,
        actualHeight: 512 * density,
        expectedCoverage: expected.coverage,
        expectedWidth: 512 * density,
        expectedHeight: 512 * density,
        expectedRect: {
          x: 0,
          y: 0,
          width: 512 * density,
          height: 512 * density,
        },
      });
      const diffPath = resolve(
        outputRoot,
        `dpr${density}-pitch-${pitch}-absolute-diff.png`,
      );
      await writeContourDiff(
        diffPath,
        composite,
        measurement.outward,
        measurement.inward,
      );
      samples.push(Object.freeze({
        density,
        pitch,
        backgroundImage: geometry.backgroundImage,
        materialRect: geometry.materialRect,
        clip,
        captures,
        diffPath,
        measurement: reportableMeasurement(measurement),
        smoothControl: reportableMeasurement(control),
      }));
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const report = Object.freeze({
  schema: "cssmars-limb-contour-audit@1",
  capturedAt: new Date().toISOString(),
  browser: "Google Chrome",
  baseUrl: baseUrl.href,
  viewport: VIEWPORT,
  densities: DENSITIES,
  pitches: PITCHES,
  thresholds: MARS_LIMB_CONTOUR_THRESHOLDS,
  allSmooth: samples.every(({ measurement }) => measurement.passes),
  allControlsSmooth: samples.every(({ smoothControl }) => smoothControl.passes),
  samples,
});
await writeFile(resolve(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (!report.allControlsSmooth) {
  throw new Error("The prepared smooth control failed the limb metric.");
}
if (expectation === "defect" && report.allSmooth) {
  throw new Error("Expected the current Mars limb defect, but every sample passed.");
}
if (expectation === "smooth" && !report.allSmooth) {
  throw new Error("Mars limb contour is outside the accepted prepared silhouette.");
}

async function installCaptureMode(page, mode) {
  await page.evaluate((mode) => {
    document.querySelector("#mars-limb-audit-style")?.remove();
    const style = document.createElement("style");
    style.id = "mars-limb-audit-style";
    const shared = `
      html, body, .mars-stage { background: transparent !important; }
      .mars-moon-orbit { visibility: hidden !important; }
    `;
    const specific = mode === "body"
      ? ".mars-material { visibility: hidden !important; }"
      : mode === "material"
        ? ".mars-stage > .polycss-camera { visibility: hidden !important; }"
        : "";
    style.textContent = shared + specific;
    document.head.appendChild(style);
  }, mode);
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}

async function writeContourDiff(path, source, outward, inward) {
  const diff = new PNG({ width: source.width, height: source.height });
  for (let index = 0; index < outward.length; index += 1) {
    const offset = index * 4;
    if (outward[index] !== 0) {
      diff.data[offset] = 255;
      diff.data[offset + 3] = outward[index];
    } else if (inward[index] !== 0) {
      diff.data[offset + 1] = 220;
      diff.data[offset + 2] = 255;
      diff.data[offset + 3] = inward[index];
    }
  }
  await writeFile(path, PNG.sync.write(diff));
}

function reportableMeasurement(measurement) {
  return Object.freeze({
    actualPixelCount: measurement.actualPixelCount,
    expectedPixelCount: measurement.expectedPixelCount,
    outwardPixelCount: measurement.outwardPixelCount,
    inwardPixelCount: measurement.inwardPixelCount,
    maximumOutwardCssPixels: measurement.maximumOutwardCssPixels,
    maximumInwardCssPixels: measurement.maximumInwardCssPixels,
    maximumAbsoluteCssPixels: measurement.maximumAbsoluteCssPixels,
    maximumAcceptedAbsoluteCssPixels:
      measurement.maximumAcceptedAbsoluteCssPixels,
    rmsCssPixels: measurement.rmsCssPixels,
    passes: measurement.passes,
  });
}
