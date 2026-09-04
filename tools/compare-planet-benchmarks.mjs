import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const EXPECTED_SCHEMA = "cssearth-eight-planet-benchmark@3";
const PIXELMATCH_THRESHOLD = 0.1;
const MAXIMUM_CHANGED_PIXEL_RATIO = 0.001;
const baselinePath = requiredPath(process.argv[2], "baseline report");
const candidatePath = requiredPath(process.argv[3], "candidate report");
const outputRoot = resolve(process.argv[4] ??
  "output/playwright/eight-planet-comparison");
const payloadPath = process.argv[5] ? resolve(process.argv[5]) : null;

const [baseline, candidate, payload] = await Promise.all([
  readReport(baselinePath),
  readReport(candidatePath),
  payloadPath ? readReport(payloadPath) : null,
]);
validatePair(baseline, candidate);
validatePayload(payload, baseline);
await mkdir(resolve(outputRoot, "diffs"), { recursive: true });

const planets = [];
for (const baselinePlanet of baseline.planets) {
  const candidatePlanet = candidate.planets.find(({ id }) =>
    id === baselinePlanet.id);
  const payloadPlanet = payload?.planets.find(({ id }) =>
    id === baselinePlanet.id) ?? null;
  const failures = [];
  if (!baselinePlanet.valid) failures.push("baseline benchmark is invalid");
  if (!candidatePlanet?.valid) failures.push("candidate benchmark is invalid");

  const domMatch = candidatePlanet
    ? equalJson(baselinePlanet.dom, candidatePlanet.dom)
    : false;
  if (!domMatch) failures.push("retained DOM or mesh signature changed");

  const visuals = [];
  for (const baselineVisual of baselinePlanet.visualCaptures) {
    const candidateVisual = candidatePlanet?.visualCaptures.find((visual) =>
      visual.density === baselineVisual.density &&
      visual.state === baselineVisual.state);
    if (!candidateVisual) {
      failures.push(
        `missing candidate visual DPR ${baselineVisual.density} ${baselineVisual.state}`,
      );
      continue;
    }
    const result = await compareVisuals(
      baselineVisual,
      candidateVisual,
      resolve(
        outputRoot,
        "diffs",
        `${baselinePlanet.id}-dpr${baselineVisual.density}-${baselineVisual.state}.png`,
      ),
    );
    visuals.push(result);
    if (!result.cameraMatch) {
      failures.push(
        `camera mismatch at DPR ${baselineVisual.density} ${baselineVisual.state}`,
      );
    }
    if (!result.domMatch) {
      failures.push(
        `visual-capture DOM mismatch at DPR ${baselineVisual.density} ${baselineVisual.state}`,
      );
    }
    if (!result.dimensionsMatch ||
        result.changedPixelRatio > MAXIMUM_CHANGED_PIXEL_RATIO) {
      failures.push(
        `Pixelmatch mismatch at DPR ${baselineVisual.density} ` +
        `${baselineVisual.state}: ${result.changedPixels} changed pixels ` +
        `(${result.changedPixelRatio} ratio)`,
      );
    }
  }

  planets.push(Object.freeze({
    id: baselinePlanet.id,
    valid: failures.length === 0,
    sameDomAndMesh: domMatch,
    visuals,
    performance: Object.freeze({
      idleCpuTotal: comparison(
        baselinePlanet.idle.medianCpuTotal,
        candidatePlanet?.idle.medianCpuTotal,
      ),
      interactionCpuTotal: comparison(
        baselinePlanet.interaction.medianCpuTotal,
        candidatePlanet?.interaction.medianCpuTotal,
      ),
      idleCpuByType: compareRecords(
        baselinePlanet.idle.medianCpuByType,
        candidatePlanet?.idle.medianCpuByType,
      ),
      interactionCpuByType: compareRecords(
        baselinePlanet.interaction.medianCpuByType,
        candidatePlanet?.interaction.medianCpuByType,
      ),
      layers: comparison(
        baselinePlanet.layerCount,
        candidatePlanet?.layerCount,
      ),
      animations: comparison(
        baselinePlanet.animationCount,
        candidatePlanet?.animationCount,
      ),
      runningAnimations: comparison(
        baselinePlanet.runningAnimationCount,
        candidatePlanet?.runningAnimationCount,
      ),
    }),
    payload: payloadPlanet?.bodyBytes ?? null,
    failures,
  }));
}

const report = Object.freeze({
  schema: "cssearth-eight-planet-comparison@1",
  comparedAt: new Date().toISOString(),
  pixelmatch: Object.freeze({
    threshold: PIXELMATCH_THRESHOLD,
    includeAA: true,
    maximumChangedPixelRatio: MAXIMUM_CHANGED_PIXEL_RATIO,
  }),
  baselineReport: baselinePath,
  candidateReport: candidatePath,
  payloadReport: payloadPath,
  valid: planets.every(({ valid }) => valid),
  planets,
});
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify({
  valid: report.valid,
  outputRoot,
  pixelmatch: report.pixelmatch,
  planets: planets.map(({ id, valid, sameDomAndMesh, visuals, performance, payload, failures }) => ({
    id,
    valid,
    sameDomAndMesh,
    changedPixels: visuals.reduce((sum, visual) =>
      sum + visual.changedPixels, 0),
    idleCpuPercent: performance.idleCpuTotal.percent,
    interactionCpuPercent: performance.interactionCpuTotal.percent,
    payloadPercent: payload?.percent ?? null,
    failures,
  })),
}, null, 2)}\n`);
if (!report.valid) process.exitCode = 1;

async function compareVisuals(baselineVisual, candidateVisual, diffPath) {
  const cameraMatch = equalJson(baselineVisual.camera, candidateVisual.camera);
  const domMatch = equalJson(baselineVisual.dom, candidateVisual.dom);
  const [baselineBytes, candidateBytes] = await Promise.all([
    readFile(baselineVisual.screenshot),
    readFile(candidateVisual.screenshot),
  ]);
  const left = PNG.sync.read(baselineBytes);
  const right = PNG.sync.read(candidateBytes);
  if (left.width !== right.width || left.height !== right.height) {
    return Object.freeze({
      density: baselineVisual.density,
      state: baselineVisual.state,
      cameraMatch,
      domMatch,
      dimensionsMatch: false,
      width: null,
      height: null,
      changedPixels: Number.POSITIVE_INFINITY,
      changedPixelRatio: Number.POSITIVE_INFINITY,
      diff: null,
    });
  }
  const diff = new PNG({ width: left.width, height: left.height });
  const changedPixels = pixelmatch(
    left.data,
    right.data,
    diff.data,
    left.width,
    left.height,
    { threshold: PIXELMATCH_THRESHOLD, includeAA: true },
  );
  await writeFile(diffPath, PNG.sync.write(diff));
  return Object.freeze({
    density: baselineVisual.density,
    state: baselineVisual.state,
    cameraMatch,
    domMatch,
    dimensionsMatch: true,
    width: left.width,
    height: left.height,
    changedPixels,
    changedPixelRatio: Number(
      (changedPixels / (left.width * left.height)).toFixed(9),
    ),
    diff: diffPath,
  });
}

function validatePair(baseline, candidate) {
  if (baseline.schema !== EXPECTED_SCHEMA || candidate.schema !== EXPECTED_SCHEMA) {
    throw new Error(
      `Both reports must use ${EXPECTED_SCHEMA}; old benchmark runs are invalid.`,
    );
  }
  if (baseline.mode !== "baseline" || candidate.mode !== "candidate") {
    throw new Error("Expected baseline and candidate report modes.");
  }
  for (const report of [baseline, candidate]) {
    if (report.browserLifecycle?.launches !== 1 ||
        report.browserLifecycle?.maxConcurrentContexts !== 1) {
      throw new Error(`${report.mode} did not use the single-browser lifecycle.`);
    }
  }
  const comparable = [
    "viewport",
    "densities",
    "rounds",
    "idleMilliseconds",
    "visualScope",
  ];
  for (const key of comparable) {
    if (!equalJson(baseline[key], candidate[key])) {
      throw new Error(`Benchmark configuration mismatch: ${key}.`);
    }
  }
  const baselineIds = baseline.planets.map(({ id }) => id);
  const candidateIds = candidate.planets.map(({ id }) => id);
  if (!equalJson(baselineIds, candidateIds)) {
    throw new Error("Benchmark object selection or ordering does not match.");
  }
}

function validatePayload(payload, baseline) {
  if (!payload) return;
  if (payload.schema !== "cssearth-eight-object-payload@1" ||
      payload.browserLifecycle?.launches !== 1 ||
      payload.browserLifecycle?.maxConcurrentContexts !== 1) {
    throw new Error("Payload report did not use the controlled lifecycle.");
  }
  const payloadIds = payload.planets.map(({ id }) => id);
  const baselineIds = baseline.planets.map(({ id }) => id);
  if (!equalJson(payloadIds, baselineIds)) {
    throw new Error("Payload report object selection or ordering does not match.");
  }
}

function compareRecords(baseline = {}, candidate = {}) {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);
  return Object.freeze(Object.fromEntries([...keys].sort().map((key) => [
    key,
    comparison(baseline[key] ?? 0, candidate[key] ?? 0),
  ])));
}

function comparison(baseline, candidate) {
  const difference = candidate === undefined || candidate === null
    ? null
    : Number((candidate - baseline).toFixed(6));
  const percent = difference === null || baseline === 0
    ? null
    : Number(((difference / baseline) * 100).toFixed(4));
  return Object.freeze({ baseline, candidate: candidate ?? null, difference, percent });
}

async function readReport(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requiredPath(value, label) {
  if (!value) {
    throw new Error(
      "Usage: node tools/compare-planet-benchmarks.mjs " +
      "<baseline-report> <candidate-report> [output-dir] [payload-report]",
    );
  }
  return resolve(value);
}
