import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const baselineRoot = resolve(
  process.argv[3] ?? "output/mercury-260830-001/baseline/saturn",
);
const outputRoot = resolve(
  process.argv[4] ?? "output/mercury-saturn-regression",
);
const widths = [390, 680, 800, 1024, 1200];
const densities = [1, 2];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const comparisons = [];

try {
  await mkdir(resolve(outputRoot, "candidate"), { recursive: true });
  await mkdir(resolve(outputRoot, "diffs"), { recursive: true });
  for (const density of densities) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        deviceScaleFactor: density,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const problems = [];
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          problems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
      await page.goto(new URL("/saturn/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      await page.waitForFunction(() =>
        document.documentElement.dataset.ready === "true" &&
        window.__saturn?.ready === true, null, { timeout: 120_000 });
      await page.evaluate(() => {
        window.__saturn.pause();
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      await page.addStyleTag({ content: `
        body > *:not(.planet-stage):not(script) {
          visibility: hidden !important;
        }
        .planet-stage {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          transform: none !important;
        }
      ` });
      await page.evaluate(() => new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done))));
      const fileName = `scene-${width}-dpr${density}.png`;
      const candidatePath = resolve(outputRoot, "candidate", fileName);
      await page.locator(".planet-stage").screenshot({ path: candidatePath });
      assert.deepEqual(problems, []);
      comparisons.push(await comparePng(
        resolve(baselineRoot, fileName),
        candidatePath,
        resolve(outputRoot, "diffs", fileName),
        width,
        density,
      ));
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const report = {
  schema: "cssmercury-saturn-isolated-scene-regression@1",
  baselineRoot,
  route: "/saturn/",
  widths,
  densities,
  threshold: 0.1,
  comparisons,
  totalChangedPixels: comparisons.reduce(
    (sum, comparison) => sum + comparison.changedPixels,
    0,
  ),
};
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
assert.equal(report.totalChangedPixels, 0);

async function comparePng(
  baselinePath,
  candidatePath,
  diffPath,
  width,
  density,
) {
  const baseline = PNG.sync.read(await readFile(baselinePath));
  const candidate = PNG.sync.read(await readFile(candidatePath));
  assert.equal(candidate.width, baseline.width);
  assert.equal(candidate.height, baseline.height);
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const changedPixels = pixelmatch(
    baseline.data,
    candidate.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: 0.1 },
  );
  await writeFile(diffPath, PNG.sync.write(diff));
  return {
    width,
    density,
    changedPixels,
    totalPixels: baseline.width * baseline.height,
  };
}
