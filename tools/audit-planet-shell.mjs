import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";

import { OBJECTS } from "../site/objects.mjs";
import { loadPlanetBrowserProfile } from "../site/test/load-browser-profile.mjs";

const mode = process.argv[2];
const options = parseOptions(process.argv.slice(3));
const outputRoot = resolve(options.output ?? "output/planet-shell-260830-002");
const baseUrl = options["base-url"] ?? "http://127.0.0.1:4210";
const referenceName = options.reference ?? "baseline";
const threshold = numberOption(options.threshold, 0.1);
const widths = Object.freeze([390, 680, 800, 1024, 1200]);
const densities = Object.freeze([1, 2]);
const implementedPlanets = OBJECTS;
const planets = Object.freeze(implementedPlanets.map(({ id }) => id));
const profiles = new Map(await Promise.all(implementedPlanets.map(async (planet) =>
  [planet.id, await loadPlanetBrowserProfile(planet)])));
const shellFiles = Object.freeze(await collectFiles([
  "site",
  "src/platform",
  ...planets.map((id) => `src/planets/${id}`),
  "tools",
  "AGENTS.md",
  "README.md",
  "package.json",
]));

if (mode === "baseline") {
  await capture("baseline");
} else if (mode === "capture") {
  await capture(options.name ?? "candidate");
} else if (mode === "compare") {
  await capture("candidate");
  const report = await compare(
    options.planet ?? implementedPlanets[0].id,
    options.scope ?? profiles.get(implementedPlanets[0].id).audit.finalScope,
    "candidate",
    referenceName,
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.totalChangedPixels !== 0 || report.failures.length > 0) process.exitCode = 1;
} else if (mode === "responsive") {
  await capture("candidate");
  const report = await responsiveReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length > 0) process.exitCode = 1;
} else if (mode === "final") {
  await capture("final");
  const report = await finalReport();
  console.log(JSON.stringify(report, null, 2));
  if (report.totalChangedPixels !== 0 || report.failures.length > 0) process.exitCode = 1;
} else {
  throw new TypeError(
    "Usage: node tools/audit-planet-shell.mjs " +
    "<baseline|capture|compare|responsive|final> [--planet=<implemented-id>] " +
    "[--scope=outer] [--reference=baseline] [--threshold=0.1] " +
    "[--base-url=http://127.0.0.1:4210]",
  );
}

async function capture(name) {
  const root = resolve(outputRoot, name);
  await mkdir(root, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const captures = [];
  try {
    for (const density of densities) {
      for (const width of widths) {
        for (const planetRecord of implementedPlanets) {
          const planet = planetRecord.id;
          const profile = profiles.get(planet);
          const context = await browser.newContext({
            viewport: { width, height: 800 },
            deviceScaleFactor: density,
            reducedMotion: "reduce",
          });
          const page = await context.newPage();
          const problems = [];
          page.on("console", (message) => {
            if (message.type() === "error" || message.type() === "warning") {
              problems.push(`${message.type()}: ${message.text()}`);
            }
          });
          page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
          await page.goto(new URL(planetRecord.route, baseUrl).href, {
            waitUntil: "networkidle",
          });
          await page.waitForFunction(() =>
            document.documentElement.dataset.ready === "true", null, {
              timeout: 120_000,
            });
          await profile.waitForRuntime(page);
          await profile.pause(page);
          await page.evaluate(() => {
            for (const animation of document.getAnimations()) {
              animation.pause();
              animation.currentTime = 0;
            }
          });
          await page.evaluate(() => new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done))));

          const planetRoot = resolve(root, planet);
          await mkdir(planetRoot, { recursive: true });
          const suffix = `${width}-dpr${density}.png`;
          const files = {};
          files.full = `full-${suffix}`;
          await page.screenshot({ path: resolve(planetRoot, files.full), fullPage: true });
          files.scene = `scene-${suffix}`;
          const sceneIsolation = await page.addStyleTag({ content: `
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
          await page.locator(".planet-stage").screenshot({
            path: resolve(planetRoot, files.scene),
          });
          await sceneIsolation.evaluate((element) => element.remove());
          await page.evaluate(() => new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done))));
          const header = page.locator("body > header");
          const headerVisible = await header.isVisible();
          if (headerVisible) {
            files.shell = `shell-${suffix}`;
            await header.screenshot({ path: resolve(planetRoot, files.shell) });
            const wordmark = page.locator(wordmarkSelector());
            files.wordmark = `wordmark-${suffix}`;
            await wordmark.screenshot({ path: resolve(planetRoot, files.wordmark) });
            const wordmarkIsolation = await page.addStyleTag({ content: `
              body { background: #000 !important; }
              body > *:not(header):not(script) { visibility: hidden !important; }
              .planet-wordmark { background: #000 !important; isolation: isolate; }
            ` });
            files.wordmarkIsolated = `wordmark-isolated-${suffix}`;
            await wordmark.screenshot({
              path: resolve(planetRoot, files.wordmarkIsolated),
            });
            await wordmarkIsolation.evaluate((element) => element.remove());
          }
          const evidence = await page.evaluate(({ planetId, roleSelectors }) => {
            const headerElement = document.querySelector("body > header");
            const styleProperties = [
              "display", "position", "zIndex", "top", "right", "bottom", "left",
              "width", "height", "maxHeight", "margin", "padding", "border",
              "borderLeftWidth", "borderLeftColor", "color", "backgroundColor",
              "fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight",
              "opacity", "overflowX", "overflowY", "pointerEvents", "touchAction",
              "transform", "translate", "alignItems", "gap",
            ];
            const styles = {};
            const roles = {};
            for (const [role, selector] of Object.entries(roleSelectors)) {
              const element = document.querySelector(selector);
              if (!element) {
                styles[role] = null;
                roles[role] = null;
                continue;
              }
              const computed = getComputedStyle(element);
              styles[role] = Object.fromEntries(
                styleProperties.map((property) => [property, computed[property]]),
              );
              roles[role] = {
                tag: element.tagName.toLowerCase(),
                classes: [...element.classList].filter((name) =>
                  name.startsWith("planet-")),
                path: shellPath(element),
              };
            }
            return {
              planet: planetId,
              shellOuterHtml: headerElement?.outerHTML ?? null,
              shellElementCount: headerElement?.querySelectorAll("*").length ?? 0,
              bodyElementCount: document.querySelectorAll("*").length,
              roles,
              styles,
              variableContent: {
                facts: document.querySelectorAll(".planet-facts > li").length,
                lenses: document.querySelectorAll('button[name="lens"]').length,
                settings: document.querySelectorAll(
                  ".planet-settings :is(button, input)",
                ).length,
              },
              compatibilityClasses: [...document.querySelectorAll(
                ".planet-header *, .planet-header, .planet-actions, .planet-attribution, .planet-heart",
              )].flatMap((element) => [...element.classList]).filter((name) =>
                name.startsWith(`${planetId}-`)),
              responsive: {
                headerDisplay: headerElement ? getComputedStyle(headerElement).display : null,
                bodyOverflowX: getComputedStyle(document.body).overflowX,
                bodyOverflowY: getComputedStyle(document.body).overflowY,
                bodyScrollWidth: document.body.scrollWidth,
                viewportWidth: innerWidth,
                bodyScrollHeight: document.body.scrollHeight,
                viewportHeight: innerHeight,
              },
            };

            function shellPath(element) {
              const parts = [];
              for (let current = element;
                current && current !== document.body;
                current = current.parentElement) {
                const generic = [...current.classList].filter((name) =>
                  name.startsWith("planet-"));
                parts.push(`${current.tagName.toLowerCase()}${generic.length > 0
                  ? `.${generic.join(".")}`
                  : ""}`);
              }
              return parts.reverse().join(" > ");
            }
          }, { planetId: planet, roleSelectors: selectorsFor() });
          captures.push({ planet, width, density, files, problems, evidence });
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  const source = await sourceFingerprint();
  await writeFile(resolve(root, "source.sha256"), `${source.join("\n")}\n`);
  const manifest = {
    schema: "cssearth-planet-shell-audit@1",
    name,
    baseUrl,
    viewportHeight: 800,
    widths,
    densities,
    knownDefects: [],
    captures,
  };
  await writeFile(resolve(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const problems = captures.flatMap((entry) => entry.problems);
  if (problems.length > 0) throw new Error(`Browser problems: ${problems.join("; ")}`);
  console.log(`Captured ${captures.length} shell states in ${root}.`);
  return manifest;
}

async function compare(
  planet,
  scope,
  candidateName = "candidate",
  comparisonReferenceName = "baseline",
) {
  if (!profiles.has(planet)) throw new RangeError(`Unknown planet: ${planet}.`);
  const baseline = await readManifest(comparisonReferenceName);
  const sceneBaseline = comparisonReferenceName === "baseline"
    ? await readOptionalManifest("scene-baseline")
    : null;
  const candidate = await readManifest(candidateName);
  const comparisons = [];
  const failures = [];
  for (const current of candidate.captures.filter((entry) => entry.planet === planet)) {
    const types = comparisonTypes(planet, scope, current.width);
    for (const type of types) {
      const referenceManifest = type === "scene" && sceneBaseline
        ? sceneBaseline
        : baseline;
      const reference = findCapture(referenceManifest, current);
      if (!reference.files[type] || !current.files[type]) {
        failures.push(`${planet} ${current.width} DPR${current.density} lacks ${type}`);
        continue;
      }
      comparisons.push(await compareImages(
        resolve(outputRoot,
          type === "scene" && sceneBaseline
            ? "scene-baseline"
            : comparisonReferenceName,
          planet, reference.files[type]),
        resolve(outputRoot, candidateName, planet, current.files[type]),
        `${planet}-${type}-${current.width}-dpr${current.density}`,
        candidateName,
      ));
    }
  }
  return reportFor({ planet, scope, comparisons, failures });
}

async function responsiveReport(candidateName = "candidate") {
  const manifest = await readManifest(candidateName);
  const failures = [];
  for (const entry of manifest.captures) {
    const { responsive } = entry.evidence;
    if (responsive.headerDisplay === "none") {
      failures.push(`${entry.planet} header hidden at ${entry.width} DPR${entry.density}`);
    }
    if (responsive.bodyScrollWidth > responsive.viewportWidth) {
      failures.push(`${entry.planet} horizontal overflow at ${entry.width} DPR${entry.density}`);
    }
    if (entry.width <= 680 && responsive.bodyOverflowY === "hidden") {
      failures.push(`${entry.planet} mobile body cannot scroll at ${entry.width} DPR${entry.density}`);
    }
  }
  return { candidateName, failures };
}

async function finalReport() {
  const planetReports = [];
  for (const planet of implementedPlanets) {
    planetReports.push(await compare(
      planet.id,
      profiles.get(planet.id).audit.finalScope,
      "final",
      referenceName,
    ));
  }
  const responsive = await responsiveReport("final");
  const sharedShell = await sharedShellReport("final", referenceName);
  return {
    referenceName,
    threshold,
    totalChangedPixels: planetReports.reduce(
      (sum, report) => sum + report.totalChangedPixels, 0,
    ) + sharedShell.totalChangedPixels,
    failures: [
      ...planetReports.flatMap(({ failures }) => failures),
      ...responsive.failures,
      ...sharedShell.failures,
    ],
    planets: Object.fromEntries(planetReports.map((report) =>
      [report.planet, report])),
    responsive,
    sharedShell,
  };
}

async function sharedShellReport(candidateName, comparisonReferenceName) {
  const manifest = await readManifest(candidateName);
  const baseline = await readManifest(comparisonReferenceName);
  const failures = [];
  const comparisons = [];
  const imageComparisons = [];
  const contentDependentStyles = new Set(["width", "height", "maxHeight"]);
  for (const current of manifest.captures) {
    const reference = findCapture(baseline, current);
    const domGrowth = current.evidence.shellElementCount -
      reference.evidence.shellElementCount;
    if (domGrowth > 0) {
      failures.push(
        `${current.planet} shell grew by ${domGrowth} elements at ` +
        `${current.width} DPR${current.density}`,
      );
    }
    if (current.evidence.compatibilityClasses.length > 0) {
      failures.push(
        `${current.planet} has planet-prefixed compatibility classes at ` +
        `${current.width} DPR${current.density}`,
      );
    }
  }

  const referenceId = implementedPlanets[0].id;
  const references = manifest.captures.filter(({ planet }) => planet === referenceId);
  for (const reference of references) {
    for (const planet of implementedPlanets.slice(1)) {
      const current = manifest.captures.find((entry) =>
        entry.planet === planet.id && entry.width === reference.width &&
        entry.density === reference.density);
      const id = `${referenceId}-${planet.id}-${reference.width}-dpr${reference.density}`;
      if (!current) {
        failures.push(`Shared shell comparison is missing: ${id}`);
        continue;
      }
      const rolesMatch = JSON.stringify(reference.evidence.roles) ===
        JSON.stringify(current.evidence.roles);
      const stylesMatch = JSON.stringify(stableStyles(reference.evidence.styles)) ===
        JSON.stringify(stableStyles(current.evidence.styles));
      comparisons.push({
        id,
        rolesMatch,
        stylesMatch,
        variableContent: Object.fromEntries([
          [referenceId, reference.evidence.variableContent],
          [planet.id, current.evidence.variableContent],
        ]),
      });
      if (!rolesMatch) failures.push(`Shared DOM roles differ at ${id}`);
      if (!stylesMatch) failures.push(`Shared computed styles differ at ${id}`);
      if (!reference.files.wordmarkIsolated || !current.files.wordmarkIsolated) {
        failures.push(`Shared wordmark comparison is missing: ${id}`);
        continue;
      }
      imageComparisons.push(await compareImages(
        resolve(outputRoot, candidateName, referenceId,
          reference.files.wordmarkIsolated),
        resolve(outputRoot, candidateName, planet.id,
          current.files.wordmarkIsolated),
        `shared-wordmark-${id}`,
        candidateName,
      ));
    }
  }
  return {
    candidateName,
    excludedComputedValues: [
      "stage: object-owned input behavior",
      "attribution.right: resolved from planet-specific credit width",
      "width, height, maxHeight: resolved from planet-specific content",
    ],
    comparisons,
    imageComparisons,
    totalChangedPixels: imageComparisons.reduce(
      (sum, entry) => sum + entry.changedPixels, 0,
    ),
    failures,
  };

  function stableStyles(styles) {
    return Object.fromEntries(Object.entries(styles)
      .filter(([role]) => role !== "stage")
      .map(([role, values]) => [
        role,
        values && Object.fromEntries(Object.entries(values).filter(([property]) =>
          !contentDependentStyles.has(property) &&
          !(role === "attribution" && property === "right"))),
      ]));
  }
}

function comparisonTypes(planet, scope, width) {
  if (scope === "scene" || scope === "shared") return ["scene"];
  if (!profiles.get(planet).audit.fullComparisonWidths.includes(width)) {
    return ["scene"];
  }
  if (scope === "outer") return ["full", "scene", "shell", "wordmark"];
  if (scope === "panel" || scope === "final") return ["full", "scene", "shell", "wordmark"];
  return ["scene"];
}

async function compareImages(leftPath, rightPath, id, candidateName) {
  const [leftBytes, rightBytes] = await Promise.all([readFile(leftPath), readFile(rightPath)]);
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  if (left.width !== right.width || left.height !== right.height) {
    return { id, changedPixels: Number.POSITIVE_INFINITY, dimensionsMatch: false };
  }
  const diff = new PNG({ width: left.width, height: left.height });
  const changedPixels = pixelmatch(
    left.data, right.data, diff.data, left.width, left.height,
    { threshold, includeAA: true },
  );
  const diffRoot = resolve(outputRoot, candidateName, "diffs");
  await mkdir(diffRoot, { recursive: true });
  await writeFile(resolve(diffRoot, `${id}.png`), PNG.sync.write(diff));
  return {
    id,
    changedPixels,
    totalPixels: left.width * left.height,
    dimensionsMatch: true,
  };
}

function reportFor({ planet, scope, comparisons, failures }) {
  return {
    planet,
    scope,
    threshold,
    totalChangedPixels: comparisons.reduce(
      (sum, entry) => sum + entry.changedPixels, 0,
    ),
    comparisons,
    failures,
  };
}

async function readManifest(name) {
  return JSON.parse(await readFile(resolve(outputRoot, name, "manifest.json"), "utf8"));
}

async function readOptionalManifest(name) {
  try {
    return await readManifest(name);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function findCapture(manifest, target) {
  const match = manifest.captures.find((entry) =>
    entry.planet === target.planet && entry.width === target.width &&
    entry.density === target.density);
  if (!match) throw new Error(`Missing baseline ${target.planet} ${target.width} DPR${target.density}.`);
  return match;
}

function wordmarkSelector() {
  return ".planet-wordmark";
}

function selectorsFor() {
  return {
    header: ".planet-header",
    wordmark: ".planet-wordmark",
    search: ".planet-search",
    selectedPanel: ".planet-selected-panel",
    title: ".planet-title",
    introduction: ".planet-introduction",
    facts: ".planet-facts-panel",
    charts: ".planet-chart-panel",
    lenses: ".planet-lenses",
    settings: ".planet-settings-panel",
    summary: ".planet-panel-summary",
    actions: ".planet-actions",
    attribution: ".planet-attribution",
    heart: ".planet-heart",
    stage: ".planet-stage",
  };
}

async function sourceFingerprint() {
  const rows = [];
  for (const file of shellFiles) {
    const bytes = await readFile(resolve(file));
    rows.push(`${createHash("sha256").update(bytes).digest("hex")}  ${file}`);
  }
  return rows;
}

async function collectFiles(paths) {
  const files = [];
  for (const path of paths) await visit(path);
  return files.sort();

  async function visit(path) {
    const entries = await readdir(resolve(path), { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOTDIR") return null;
      throw error;
    });
    if (entries === null) {
      files.push(path);
      return;
    }
    for (const entry of entries) {
      await visit(`${path}/${entry.name}`);
    }
  }
}

function parseOptions(args) {
  return Object.fromEntries(args.map((argument) => {
    if (!argument.startsWith("--")) throw new TypeError(`Unexpected argument: ${argument}.`);
    const [key, ...rest] = argument.slice(2).split("=");
    return [key, rest.length > 0 ? rest.join("=") : true];
  }));
}

function numberOption(value, fallback) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RangeError(`Invalid threshold: ${value}.`);
  }
  return number;
}
