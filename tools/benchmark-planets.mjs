import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { chromium } from "playwright";

import {
  countTags,
  RETAINED_SCENE_LEAF_TAGS,
  selectorForTags,
  TRANSFORM_GROUP_TAGS,
} from "./benchmark-dom-evidence.mjs";

const execFileAsync = promisify(execFile);
const ALL_PLANET_IDS = Object.freeze([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
]);
const PLANET_IDS = selectedPlanetIds(
  process.env.CSS_EARTH_BENCH_PLANETS,
);
const CHROME_EXECUTABLE =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = Object.freeze({ width: 1280, height: 900 });
const DENSITIES = Object.freeze([1, 2]);
const ROUNDS = positiveInteger(
  process.env.CSS_EARTH_BENCH_ROUNDS,
  3,
);
const IDLE_MILLISECONDS = positiveInteger(
  process.env.CSS_EARTH_BENCH_IDLE_MS,
  4_000,
);
const mode = process.argv[2];
const baseUrl = normalizedBaseUrl(process.argv[3]);
const outputRoot = resolve(process.argv[4] ?? `output/playwright/eight-planet-${mode}`);
const profileRoot = resolve(process.argv[5] ?? process.cwd());

if (!new Set(["baseline", "candidate"]).has(mode)) {
  throw new Error(
    "Usage: node tools/benchmark-planets.mjs <baseline|candidate> " +
    "<base-url> <output-dir> [profile-root]",
  );
}

await mkdir(outputRoot, { recursive: true });
const profiles = new Map();
for (const id of PLANET_IDS) profiles.set(id, await loadProfile(id));

const fingerprint = await sourceFingerprint(profileRoot);
const visualCaptures = [];
const samples = [];
const browser = await launchBrowser({ gpu: true });
try {
  for (const id of PLANET_IDS) {
    const profile = profiles.get(id);
    for (const density of DENSITIES) {
      assertNoOpenContexts(browser);
      visualCaptures.push(await captureVisual({
        browser,
        id,
        profile,
        density,
      }));
      assertNoOpenContexts(browser);
    }
  }

  const browserSession = await browser.newBrowserCDPSession();
  try {
    for (let round = 0; round < ROUNDS; round += 1) {
      const ids = round % 2 === 0 ? PLANET_IDS : [...PLANET_IDS].reverse();
      for (const id of ids) {
        process.stderr.write(`${mode} ${id} round ${round + 1}/${ROUNDS}\n`);
        assertNoOpenContexts(browser);
        samples.push(await measurePlanet({
          browser,
          browserSession,
          id,
          profile: profiles.get(id),
          round,
        }));
        assertNoOpenContexts(browser);
      }
    }
  } finally {
    await browserSession.detach();
  }
} finally {
  await browser.close();
}

const planets = PLANET_IDS.map((id) => {
  const selected = samples.filter((sample) => sample.id === id);
  const visuals = visualCaptures.filter((capture) => capture.id === id);
  return Object.freeze({
    id,
    valid: selected.every(({ errors, stableDomIdentity }) =>
      errors.length === 0 && stableDomIdentity === true) &&
      visuals.every(({ errors, stableDomIdentity }) =>
        errors.length === 0 && stableDomIdentity === true),
    dom: selected[0]?.dom ?? visuals[0]?.dom ?? null,
    animationCount: selected[0]?.animationCount ?? null,
    runningAnimationCount: selected[0]?.runningAnimationCount ?? null,
    layerCount: median(selected.map(({ layerCount }) => layerCount)),
    idle: summarizeWindows(selected.map(({ idle }) => idle)),
    interaction: summarizeWindows(selected.map(({ interaction }) => interaction)),
    visualCaptures: visuals,
    errors: [...new Set([
      ...selected.flatMap(({ errors }) => errors),
      ...visuals.flatMap(({ errors }) => errors),
    ])],
  });
});

const report = Object.freeze({
  schema: "cssearth-eight-planet-benchmark@3",
  capturedAt: new Date().toISOString(),
  mode,
  baseUrl,
  profileRoot,
  outputRoot,
  viewport: VIEWPORT,
  densities: DENSITIES,
  rounds: ROUNDS,
  idleMilliseconds: IDLE_MILLISECONDS,
  visualScope: "retained-render-roots-with-shell-ui-hidden",
  browserLifecycle: Object.freeze({
    launches: 1,
    maxConcurrentContexts: 1,
  }),
  fingerprint,
  planets,
  samples,
});
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify({
  mode,
  outputRoot,
  planets: planets.map(({ id, valid, dom, idle, interaction, errors }) => ({
    id,
    valid,
    nodes: dom?.nodeCount ?? null,
    leaves: dom?.meshLeafCount ?? null,
    idleCpu: idle.medianCpuTotal,
    interactionCpu: interaction.medianCpuTotal,
    errors,
  })),
}, null, 2)}\n`);
if (planets.some(({ valid }) => !valid)) process.exitCode = 1;

async function loadProfile(id) {
  const url = pathToFileURL(resolve(
    profileRoot,
    "src",
    "planets",
    id,
    "test",
    "browser-profile.mjs",
  ));
  const { browserProfile } = await import(`${url.href}?benchmark=${Date.now()}`);
  if (browserProfile?.id !== id ||
      typeof browserProfile.waitForRuntime !== "function" ||
      typeof browserProfile.pause !== "function" ||
      typeof browserProfile.camera !== "function" ||
      typeof browserProfile.setCamera !== "function" ||
      typeof browserProfile.bounds !== "function" ||
      typeof browserProfile.stable !== "function" ||
      typeof browserProfile.inputSelector !== "string") {
    throw new TypeError(`${id} browser profile is incomplete.`);
  }
  return browserProfile;
}

async function captureVisual({ browser, id, profile, density }) {
  const errors = [];
  let context = null;
  try {
    context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: density,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    bindErrors(page, errors);
    await openPlanet(page, id, profile);
    await profile.pause(page);
    const bounds = await profile.bounds(page);
    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    await freezeInfiniteAnimations(page);
    await settlePaint(page);
    const camera = await profile.camera(page);
    const stableDomIdentity = await profile.stable(page);
    const dom = await domEvidence(page);
    await hideNonRenderUi(page);
    await settlePaint(page);
    const file = resolve(outputRoot, id, `dpr${density}-default.png`);
    await mkdir(resolve(outputRoot, id), { recursive: true });
    const clip = await page.locator(".planet-stage").boundingBox();
    if (!clip) throw new Error(`${id} stage has no screenshot bounds.`);
    await page.screenshot({ path: file, clip });
    const screenshotBytes = await readFile(file);
    return Object.freeze({
      id,
      density,
      state: "default",
      camera,
      dom,
      stableDomIdentity,
      screenshot: file,
      screenshotSha256: sha256(screenshotBytes),
      errors,
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
    return Object.freeze({
      id,
      density,
      state: "default",
      camera: null,
      dom: null,
      stableDomIdentity: false,
      screenshot: null,
      screenshotSha256: null,
      errors,
    });
  } finally {
    await context?.close();
  }
}

async function measurePlanet({ browser, browserSession, id, profile, round }) {
  const errors = [];
  let context = null;
  try {
    context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    bindErrors(page, errors);
    const pageSession = await context.newCDPSession(page);
    await Promise.all([
      pageSession.send("LayerTree.enable"),
      pageSession.send("Performance.enable"),
    ]);
    let layers = [];
    pageSession.on("LayerTree.layerTreeDidChange", ({ layers: nextLayers }) => {
      layers = nextLayers;
    });
    await openPlanet(page, id, profile);
    await page.waitForTimeout(1_000);
    const stableDomIdentity = await profile.stable(page);
    const dom = await domEvidence(page);
    const animationState = await page.evaluate(() => ({
      animationCount: document.getAnimations().length,
      runningAnimationCount: document.getAnimations().filter(
        ({ playState }) => playState === "running",
      ).length,
    }));
    const idle = await measureWindow(
      browserSession,
      pageSession,
      async () => page.waitForTimeout(IDLE_MILLISECONDS),
    );
    const interaction = await measureWindow(
      browserSession,
      pageSession,
      async () => exerciseOrbit(page, profile),
    );
    return Object.freeze({
      id,
      round,
      stableDomIdentity,
      dom,
      ...animationState,
      layerCount: layers.length,
      idle,
      interaction,
      errors,
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
    return Object.freeze({
      id,
      round,
      stableDomIdentity: false,
      dom: null,
      animationCount: null,
      runningAnimationCount: null,
      layerCount: null,
      idle: null,
      interaction: null,
      errors,
    });
  } finally {
    await context?.close();
  }
}

async function openPlanet(page, id, profile) {
  await page.goto(`${baseUrl}${id}/`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await profile.waitForRuntime(page);
  await page.waitForFunction(() =>
    document.documentElement.dataset.ready === "true", null, {
    timeout: 120_000,
  });
}

async function exerciseOrbit(page, profile) {
  const input = page.locator(profile.inputSelector).first();
  const box = await input.boundingBox();
  if (!box || box.width < 2 || box.height < 2) {
    throw new Error(`${profile.id} input surface has no usable bounds.`);
  }
  const x = box.x + box.width * 0.62;
  const middle = box.y + box.height * 0.5;
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.mouse.move(x, middle);
    await page.mouse.down();
    await page.mouse.move(x, box.y + box.height * 0.24, { steps: 40 });
    await page.mouse.move(x, box.y + box.height * 0.70, { steps: 40 });
    await page.mouse.up();
  }
  await page.mouse.move(x, middle);
  await page.mouse.wheel(0, -280);
  await page.mouse.wheel(0, 160);
  await page.waitForTimeout(750);
}

async function measureWindow(browserSession, pageSession, action) {
  const [beforeProcesses, beforeMetrics] = await Promise.all([
    browserSession.send("SystemInfo.getProcessInfo"),
    pageSession.send("Performance.getMetrics"),
  ]);
  const startedAt = performance.now();
  await action();
  const durationSeconds = (performance.now() - startedAt) / 1_000;
  const [afterProcesses, afterMetrics] = await Promise.all([
    browserSession.send("SystemInfo.getProcessInfo"),
    pageSession.send("Performance.getMetrics"),
  ]);
  const beforeById = new Map(beforeProcesses.processInfo.map((process) =>
    [process.id, process]));
  const cpuByType = Object.create(null);
  let cpuTotal = 0;
  for (const process of afterProcesses.processInfo) {
    const initial = beforeById.get(process.id)?.cpuTime ?? process.cpuTime;
    const percent = Math.max(0, process.cpuTime - initial) /
      durationSeconds * 100;
    cpuTotal += percent;
    cpuByType[process.type] = (cpuByType[process.type] ?? 0) + percent;
  }
  const beforeByName = metricMap(beforeMetrics);
  const metrics = Object.fromEntries([
    "TaskDuration",
    "ScriptDuration",
    "LayoutDuration",
    "RecalcStyleDuration",
    "JSHeapUsedSize",
    "Nodes",
    "LayoutCount",
    "RecalcStyleCount",
  ].map((name) => [
    name,
    Number(((metricMap(afterMetrics).get(name) ?? 0) -
      (beforeByName.get(name) ?? 0)).toFixed(6)),
  ]));
  return Object.freeze({
    durationSeconds: Number(durationSeconds.toFixed(3)),
    cpuTotal: Number(cpuTotal.toFixed(3)),
    cpuByType: Object.freeze(Object.fromEntries(Object.entries(cpuByType).map(
      ([type, percent]) => [type, Number(percent.toFixed(3))],
    ))),
    metrics: Object.freeze(metrics),
  });
}

async function domEvidence(page) {
  const leafSelector = selectorForTags(RETAINED_SCENE_LEAF_TAGS);
  const transformGroupSelector = selectorForTags(TRANSFORM_GROUP_TAGS);
  const evidence = await page.locator(".planet-stage").evaluate((stage, selectors) => {
    const elements = [stage, ...stage.querySelectorAll("*")];
    const tagCounts = Object.create(null);
    for (const element of elements) {
      const tag = element.tagName.toLowerCase();
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
    const signature = elements.map((element) => {
      const classes = [...element.classList].sort().join(".");
      const parentIndex = element === stage
        ? -1
        : elements.indexOf(element.parentElement);
      return `${parentIndex}:${element.tagName.toLowerCase()}:${classes}`;
    }).join("\n");
    const leaves = [...stage.querySelectorAll(selectors.leaves)];
    const meshSignature = leaves.map((element) =>
      `${element.tagName.toLowerCase()}:${[...element.classList].sort().join(".")}`
    ).join("\n");
    return {
      nodeCount: stage.querySelectorAll("*").length + 1,
      meshLeafCount: leaves.length,
      transformGroupCount: stage.querySelectorAll(selectors.transformGroups).length,
      tagCounts,
      signature,
      meshSignature,
    };
  }, { leaves: leafSelector, transformGroups: transformGroupSelector });
  return Object.freeze({
    nodeCount: evidence.nodeCount,
    meshLeafCount: countTags(evidence.tagCounts, RETAINED_SCENE_LEAF_TAGS),
    transformGroupCount: evidence.transformGroupCount,
    tagCounts: Object.freeze(evidence.tagCounts),
    structureSha256: sha256(evidence.signature),
    meshSha256: sha256(evidence.meshSignature),
  });
}

async function freezeInfiniteAnimations(page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      const timing = animation.effect?.getTiming();
      if (timing?.iterations === Infinity) animation.currentTime = 0;
    }
  });
}

async function settlePaint(page) {
  await page.evaluate(() => new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.waitForTimeout(250);
}

async function hideNonRenderUi(page) {
  await page.locator(".planet-stage").evaluate((stage) => {
    let retainedPathNode = stage;
    while (retainedPathNode.parentElement) {
      for (const sibling of retainedPathNode.parentElement.children) {
        if (sibling !== retainedPathNode) {
          sibling.style.setProperty("visibility", "hidden", "important");
        }
      }
      retainedPathNode = retainedPathNode.parentElement;
    }
  });
}

function bindErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
}

function launchBrowser({ gpu }) {
  return chromium.launch({
    headless: true,
    executablePath: CHROME_EXECUTABLE,
    args: gpu
      ? ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"]
      : ["--disable-gpu"],
  });
}

function assertNoOpenContexts(browser) {
  const count = browser.contexts().length;
  if (count !== 0) {
    throw new Error(
      `Benchmark context leak: expected 0 open contexts, received ${count}.`,
    );
  }
}

async function sourceFingerprint(root) {
  const [head, status] = await Promise.all([
    git(root, ["rev-parse", "HEAD"]),
    git(root, ["status", "--porcelain=v1", "-uall"]),
  ]);
  const files = [
    "package.json",
    "site/objects.mjs",
    "site/object-adapter.mjs",
    "site/scene-contract.mjs",
    "site/runtime-policy.mjs",
    ...PLANET_IDS.flatMap((id) => [
      `src/planets/${id}/runtime/client.mjs`,
      `src/planets/${id}/runtime-assets.json`,
      `src/planets/${id}/source/manifest.json`,
      `src/planets/${id}/test/browser-profile.mjs`,
    ]),
  ];
  const hashes = {};
  for (const file of files) {
    try {
      hashes[file] = sha256(await readFile(resolve(root, file)));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      hashes[file] = null;
    }
  }
  return Object.freeze({
    root,
    head: head.trim(),
    dirtyEntryCount: status.length === 0 ? 0 : status.trimEnd().split("\n").length,
    statusSha256: sha256(status),
    status,
    fileHashes: Object.freeze(hashes),
  });
}

async function git(cwd, args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

function metricMap(result) {
  return new Map(result.metrics.map(({ name, value }) => [name, value]));
}

function summarizeWindows(windows) {
  const selected = windows.filter(Boolean);
  const types = new Set(selected.flatMap(({ cpuByType }) =>
    Object.keys(cpuByType)));
  const metricNames = new Set(selected.flatMap(({ metrics }) =>
    Object.keys(metrics)));
  return Object.freeze({
    samples: selected.length,
    medianCpuTotal: median(selected.map(({ cpuTotal }) => cpuTotal)),
    medianCpuByType: Object.freeze(Object.fromEntries([...types].map((type) => [
      type,
      median(selected.map(({ cpuByType }) => cpuByType[type] ?? 0)),
    ]))),
    medianMetrics: Object.freeze(Object.fromEntries([...metricNames].map((name) => [
      name,
      median(selected.map(({ metrics }) => metrics[name] ?? 0)),
    ]))),
  });
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedBaseUrl(value) {
  if (!value) throw new Error("A base URL is required.");
  const url = new URL(value);
  if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname)) {
    throw new Error("Planet benchmarks require a local base URL.");
  }
  return `${url.origin}/`;
}

function positiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${value}.`);
  }
  return parsed;
}

function selectedPlanetIds(value) {
  if (value === undefined || value.trim() === "") return ALL_PLANET_IDS;
  const ids = value.split(",").map((id) => id.trim()).filter(Boolean);
  const unknown = ids.filter((id) => !ALL_PLANET_IDS.includes(id));
  if (ids.length === 0 || unknown.length > 0 || new Set(ids).size !== ids.length) {
    throw new Error(`Invalid planet benchmark selection: ${value}.`);
  }
  return Object.freeze(ids);
}
