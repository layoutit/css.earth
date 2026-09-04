import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const CHROME_EXECUTABLE =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = localBaseUrl(process.argv[2]);
const outputRoot = resolve(
  process.argv[3] ?? "output/playwright/mars-payload",
);
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_EXECUTABLE,
  args: ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"],
});
const captures = [];
try {
  for (const deviceScaleFactor of [1, 2]) {
    captures.push(await measureDensity(browser, deviceScaleFactor));
  }
} finally {
  await browser.close();
}

const report = Object.freeze({
  schema: "cssmars-cold-production-payload@1",
  capturedAt: new Date().toISOString(),
  baseUrl,
  viewport: Object.freeze({ width: 1280, height: 900 }),
  captures,
});
await mkdir(outputRoot, { recursive: true });
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

async function measureDensity(browserInstance, deviceScaleFactor) {
  const context = await browserInstance.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor,
    reducedMotion: "no-preference",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  const origin = new URL(baseUrl).origin;
  const responses = [];
  page.on("response", (response) => {
    if (new URL(response.url()).origin === origin) responses.push(response);
  });
  try {
    const documentResponse = await page.goto(`${baseUrl}mars/`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    if (!documentResponse?.ok()) {
      throw new Error(`Mars returned ${documentResponse?.status() ?? "no response"}.`);
    }
    await page.waitForFunction(() =>
      document.documentElement.dataset.ready === "true", null, {
      timeout: 120_000,
    });
    await page.waitForTimeout(500);
    const unique = new Map(responses.map((response) => [response.url(), response]));
    const resources = [];
    for (const response of unique.values()) {
      resources.push(Object.freeze({
        url: response.url(),
        status: response.status(),
        type: response.request().resourceType(),
        bodyBytes: (await response.body()).byteLength,
      }));
    }
    resources.sort((left, right) => left.url.localeCompare(right.url));
    const bodyBytesByType = Object.freeze(Object.fromEntries(
      [...new Set(resources.map(({ type }) => type))].map((type) => [
        type,
        resources.filter((resource) => resource.type === type)
          .reduce((total, resource) => total + resource.bodyBytes, 0),
      ]),
    ));
    return Object.freeze({
      deviceScaleFactor,
      responseCount: resources.length,
      bodyBytes: resources.reduce((total, resource) =>
        total + resource.bodyBytes, 0),
      coldAssetBytes: bodyBytesByType.image ?? 0,
      bodyBytesByType,
      resources,
    });
  } finally {
    await session.detach();
    await context.close();
  }
}

function localBaseUrl(value) {
  if (!value) {
    throw new Error("Usage: node measure-payload.mjs <local-base-url> [output-dir]");
  }
  const url = new URL(value);
  if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname)) {
    throw new Error("Mars payload measurement requires a local base URL.");
  }
  return `${url.origin}/`;
}
