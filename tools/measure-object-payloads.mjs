import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const OBJECT_IDS = Object.freeze([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
]);
const CHROME_EXECUTABLE =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = Object.freeze({ width: 1280, height: 900 });
const baselineUrl = localBaseUrl(process.argv[2], "baseline URL");
const candidateUrl = localBaseUrl(process.argv[3], "candidate URL");
const outputRoot = resolve(process.argv[4] ??
  "output/playwright/eight-object-payloads");

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_EXECUTABLE,
  args: ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"],
});
const planets = [];
try {
  for (const id of OBJECT_IDS) {
    const baseline = await measureRoute(browser, baselineUrl, id);
    const candidate = await measureRoute(browser, candidateUrl, id);
    planets.push(Object.freeze({
      id,
      baseline,
      candidate,
      bodyBytes: comparison(baseline.bodyBytes, candidate.bodyBytes),
      responseCount: comparison(
        baseline.responseCount,
        candidate.responseCount,
      ),
    }));
  }
} finally {
  await browser.close();
}

const report = Object.freeze({
  schema: "cssearth-eight-object-payload@1",
  capturedAt: new Date().toISOString(),
  baselineUrl,
  candidateUrl,
  viewport: VIEWPORT,
  browserLifecycle: Object.freeze({ launches: 1, maxConcurrentContexts: 1 }),
  planets,
});
await mkdir(outputRoot, { recursive: true });
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify({
  outputRoot,
  planets: planets.map(({ id, bodyBytes, responseCount }) => ({
    id,
    baselineBytes: bodyBytes.baseline,
    candidateBytes: bodyBytes.candidate,
    differenceBytes: bodyBytes.difference,
    percent: bodyBytes.percent,
    baselineResponses: responseCount.baseline,
    candidateResponses: responseCount.candidate,
  })),
}, null, 2)}\n`);

async function measureRoute(browser, baseUrl, id) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const origin = new URL(baseUrl).origin;
  const responses = [];
  page.on("response", (response) => {
    if (new URL(response.url()).origin === origin) responses.push(response);
  });
  try {
    const documentResponse = await page.goto(`${baseUrl}${id}/`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    if (!documentResponse?.ok()) {
      throw new Error(`${id} returned ${documentResponse?.status() ?? "no response"}.`);
    }
    await page.waitForFunction(() =>
      document.documentElement.dataset.ready === "true", null, {
      timeout: 120_000,
    });
    await page.waitForTimeout(500);
    const unique = new Map();
    for (const response of responses) unique.set(response.url(), response);
    const resources = [];
    for (const response of unique.values()) {
      let bytes;
      try {
        bytes = (await response.body()).byteLength;
      } catch (error) {
        throw new Error(`Could not read ${response.url()}: ${error.message}`, {
          cause: error,
        });
      }
      resources.push(Object.freeze({
        url: response.url(),
        status: response.status(),
        type: response.request().resourceType(),
        bodyBytes: bytes,
      }));
    }
    resources.sort((left, right) => left.url.localeCompare(right.url));
    const bytesByType = Object.create(null);
    for (const resource of resources) {
      bytesByType[resource.type] =
        (bytesByType[resource.type] ?? 0) + resource.bodyBytes;
    }
    return Object.freeze({
      bodyBytes: resources.reduce((sum, resource) =>
        sum + resource.bodyBytes, 0),
      responseCount: resources.length,
      bytesByType: Object.freeze(bytesByType),
      resources,
    });
  } finally {
    await context.close();
  }
}

function comparison(baseline, candidate) {
  const difference = candidate - baseline;
  return Object.freeze({
    baseline,
    candidate,
    difference,
    percent: baseline === 0
      ? null
      : Number(((difference / baseline) * 100).toFixed(4)),
  });
}

function localBaseUrl(value, label) {
  if (!value) {
    throw new Error(
      "Usage: node tools/measure-object-payloads.mjs " +
      "<baseline-url> <candidate-url> [output-dir]",
    );
  }
  const url = new URL(value);
  if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname)) {
    throw new Error(`${label} must be local.`);
  }
  return `${url.origin}/`;
}
