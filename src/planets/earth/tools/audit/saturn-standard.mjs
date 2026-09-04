#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { PREPARED_EARTH_SCENE } from "../../runtime/preparedScene.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Earth Saturn-standard audit accepts DPR 1 or DPR 2.");
}
const viewport = Object.freeze({ width: 1440, height: 900 });
const saturnBaselineReportPath = process.env.SATURN_BASELINE_REPORT
  ? resolve(process.env.SATURN_BASELINE_REPORT)
  : null;
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `earth-saturn-audit-${timestamp}`,
);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const browserVersion = browser.version();
const reports = [];
try {
  for (const planet of ["saturn", "earth"]) {
    reports.push(await auditPlanet(planet));
  }
} finally {
  await browser.close();
}

const contactSheet = await prepareContactSheet(reports);
const saturn = reports.find(({ planet }) => planet === "saturn");
const earth = reports.find(({ planet }) => planet === "earth");
const earthViewContactSheet = await prepareEarthViewContactSheet(earth);
const saturnRegression = saturnBaselineReportPath
  ? await compareSaturnBaseline(saturn, saturnBaselineReportPath)
  : null;
const report = {
  schema: "cssearth-saturn-standard-audit@4",
  createdAt: new Date().toISOString(),
  referencePlanet: "saturn",
  candidatePlanet: "earth",
  baseUrl,
  browser: { channel: "chrome", version: browserVersion, headless: true },
  viewport,
  deviceScaleFactor,
  earthPreparedContract: {
    retainedLeafCount: PREPARED_EARTH_SCENE.counts.retainedLeafCount,
    maximumRetainedLeafCount:
      PREPARED_EARTH_SCENE.counts.maximumRetainedLeafCount,
    cameraOrbit: PREPARED_EARTH_SCENE.camera.orbitPlayback,
    materialTransport: {
      lighting: PREPARED_EARTH_SCENE.material.lighting.transport,
      atmosphere: PREPARED_EARTH_SCENE.material.atmosphere.transport,
    },
    interiorPresentation: PREPARED_EARTH_SCENE.interior.presentationLock,
    atmosphere: {
      model: PREPARED_EARTH_SCENE.material.atmosphere.model,
      source: PREPARED_EARTH_SCENE.material.atmosphere.source,
      planetRadius: PREPARED_EARTH_SCENE.material.atmosphere.planetRadius,
      physicalRadius: PREPARED_EARTH_SCENE.material.atmosphere.physicalRadius,
      assets: PREPARED_EARTH_SCENE.material.atmosphere.defaultAssets,
    },
    embeddedMoon: false,
  },
  saturnRegression,
  captures: reports,
  contactSheet,
  earthViewContactSheet,
  sourceFingerprints: await fingerprints({
    earthSource: "src/planets/earth/SOURCE.md",
    earthScene: "src/planets/earth/runtime/preparedScene.mjs",
    earthAssets: "src/planets/earth/runtime-assets.json",
    earthClient: "src/planets/earth/runtime/client.mjs",
    earthStyles: "src/planets/earth/runtime/styles.css",
    earthLenses: "src/planets/earth/runtime/preparedLenses.mjs",
    earthSourceManifest: "src/planets/earth/source/manifest.json",
    saturnSource: "src/planets/saturn/SOURCE.md",
    saturnScene: "src/planets/saturn/runtime/preparedScene.mjs",
    saturnAssets: "src/planets/saturn/runtime-assets.json",
    saturnClient: "src/planets/saturn/runtime/client.mjs",
    saturnStyles: "src/planets/saturn/runtime/styles.css",
    saturnLenses: "src/planets/saturn/runtime/preparedLenses.mjs",
    saturnMoons: "src/planets/saturn/runtime/preparedMoons.mjs",
    saturnSourceManifest: "src/planets/saturn/source/manifest.json",
  }),
};
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

for (const capture of reports) {
  if (capture.externalRequests.length > 0) {
    throw new Error(`${capture.planet} made external requests.`);
  }
  if (capture.browserProblems.length > 0) {
    throw new Error(
      `${capture.planet} browser problems: ${capture.browserProblems.join("; ")}`,
    );
  }
  if (!capture.runtime.stableDomIdentity) {
    throw new Error(`${capture.planet} changed retained DOM identity.`);
  }
  if (capture.runtime.canvasCount !== 0 || capture.runtime.sceneSvgCount !== 0) {
    throw new Error(`${capture.planet} mounted a prohibited scene renderer.`);
  }
}
if (earth.runtime.embeddedMoonElementCount !== 0) {
  throw new Error("Earth mounted an embedded Moon despite the object boundary.");
}
if (earth.runtime.renderRootCount !== 1) {
  throw new Error("Earth does not have exactly one object render root.");
}
if (!earth.atmosphere) {
  throw new Error("Earth atmosphere isolation evidence is missing.");
}
if (earth.atmosphere.changedPixelPercent < 0.05 ||
    earth.atmosphere.changedPixelPercentOfMaterialBounds > 60 ||
    earth.atmosphere.meanPositiveDelta.red > 12 ||
    earth.atmosphere.meanPositiveDelta.blue <=
      earth.atmosphere.meanPositiveDelta.green ||
    earth.atmosphere.meanPositiveDelta.green <=
      earth.atmosphere.meanPositiveDelta.red ||
    earth.atmosphere.meanPositiveDelta.blue -
      earth.atmosphere.meanPositiveDelta.red < 8) {
  throw new Error(
    "Earth atmosphere is not a restrained blue Rayleigh limb: " +
    JSON.stringify(earth.atmosphere),
  );
}
if (Math.abs(
  earthPreparedAtmosphereRatio() -
    PREPARED_EARTH_SCENE.material.atmosphere.source.outerRadiusRatio,
) > 1e-12 || earthPreparedAtmosphereRatio() > 1.012) {
  throw new Error("Earth atmosphere exceeds its checked 70 km shell.");
}
if (!earth.runtime.atmosphereBackgroundImage.includes("@2x.webp")) {
  throw new Error("Earth atmosphere did not select the canonical density.");
}
if (earth.runtime.normalSurfaceBackgroundImage.includes("@2x.webp") ||
    earth.runtime.normalPolesBackgroundImage.includes("@2x.webp")) {
  throw new Error("Earth normal lens did not use its canonical URLs.");
}
const crossSectionDefault = earth.earthViews.find(({ lens, name }) =>
  lens === "cross-section" && name === "default");
const crossSectionMaximum = earth.earthViews.find(({ lens, name }) =>
  lens === "cross-section" && name === "maximum-pitch");
if (earth.earthViews.length !== 12 ||
    !crossSectionDefault?.interiorCoverage ||
    !crossSectionMaximum?.interiorCoverage ||
    crossSectionMaximum.interiorCoverage.warmPixelCount <
      crossSectionDefault.interiorCoverage.warmPixelCount * 0.55 ||
    crossSectionMaximum.state.cutawayRootCount !== 1 ||
    crossSectionMaximum.state.retainedSceneLeaves !==
      PREPARED_EARTH_SCENE.counts.maximumRetainedLeafCount) {
  throw new Error(
    "Earth lens and pitch matrix is incomplete or the pole-on cutaway collapsed: " +
    JSON.stringify({ crossSectionDefault, crossSectionMaximum }),
  );
}
if (earth.runtime.cameraStats.owner !== "shared-retained-cubic-sky-orbit" ||
    earth.runtime.cameraStats.cameraModel !== "accumulated-matrix3d" ||
    earth.runtime.cameraStats.runtimeGeometryPreparation !== false) {
  throw new Error(
    "Earth camera left the shared retained cubic-sky contract: " +
    JSON.stringify(earth.runtime.cameraStats),
  );
}
for (const cache of Object.values(earth.runtime.materialCaches)) {
  if (cache.model !== "row-shard-cache" ||
      cache.retainedRowCount > cache.maximumRetainedRowCount ||
      cache.maximumRetainedRowCount !== 3) {
    throw new Error(`Earth material row cache is unbounded: ${JSON.stringify(cache)}`);
  }
}
if (saturnRegression && !saturnRegression.exact) {
  throw new Error(
    `Saturn visual regression changed: ${JSON.stringify(saturnRegression)}`,
  );
}
if (earth.maximumCompositorLayer.width >
      saturn.maximumCompositorLayer.width ||
    earth.maximumCompositorLayer.height >
      saturn.maximumCompositorLayer.height ||
    earth.maximumCompositorLayer.area > saturn.maximumCompositorLayer.area) {
  throw new Error(
    "Earth exceeds the near-viewport Saturn audit compositor budget: " +
    JSON.stringify({
      earth: earth.maximumCompositorLayer,
      saturn: saturn.maximumCompositorLayer,
    }),
  );
}

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  contactSheet: resolve(outputRoot, contactSheet.file),
  earthViewContactSheet: resolve(outputRoot, earthViewContactSheet.file),
  report: resolve(outputRoot, "report.json"),
}, null, 2));

async function auditPlanet(planet) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const browserProblems = [];
  const externalRequests = [];
  let layers = [];
  await cdp.send("LayerTree.enable");
  await cdp.send("Performance.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserProblems.push(`pageerror: ${error.message}`);
  });
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });
  try {
    const response = await page.goto(new URL(`/${planet}/`, baseUrl).href, {
      waitUntil: "networkidle",
    });
    if (response?.status() !== 200) {
      throw new Error(`${planet} returned ${response?.status() ?? "no response"}.`);
    }
    await page.waitForFunction((planetId) =>
      window.__cssEarth?.ready === true &&
      window[`__${planetId}`]?.ready === true &&
      document.documentElement.dataset.ready === "true", planet, {
      timeout: 120_000,
    });
    await page.evaluate((planetId) => {
      window[`__${planetId}`].pause();
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    }, planet);
    await settle(page);
    const defaultCamera = await page.evaluate((planetId) => {
      const { controlPitch, zoom } = window[`__${planetId}`].camera.state();
      return { controlPitch, zoom };
    }, planet);
    const shellFile = `${planet}-shell.png`;
    await page.screenshot({ path: resolve(outputRoot, shellFile) });
    const isolation = await page.addStyleTag({ content: `
      body > *:not(.planet-stage):not(script) {
        visibility: hidden !important;
      }
    ` });
    const states = [
      ["default", defaultCamera.controlPitch],
      ["minimum-pitch", 0],
      ["maximum-pitch", 89],
    ];
    const scenes = [];
    for (const [name, controlPitch] of states) {
      await page.evaluate(({ planetId, controlPitch, zoom }) => {
        window[`__${planetId}`].camera.setState({ controlPitch, zoom });
      }, { planetId: planet, controlPitch, zoom: defaultCamera.zoom });
      await settle(page);
      const file = `${planet}-${name}.png`;
      await page.screenshot({ path: resolve(outputRoot, file) });
      scenes.push({
        name,
        controlPitch,
        file,
        sha256: await sha256(resolve(outputRoot, file)),
      });
    }
    await page.evaluate(({ planetId, camera }) => {
      window[`__${planetId}`].camera.setState(camera);
    }, { planetId: planet, camera: defaultCamera });
    await settle(page);
    let earthViews = null;
    let atmosphere = null;
    let referenceViews = null;
    if (planet === "earth") {
      earthViews = [];
      for (const lens of [
        "normal",
        "topography",
        "night-lights",
        "cross-section",
      ]) {
        const selected = await page.evaluate((id) =>
          window.__earth.lenses.select(id), lens);
        if (!selected) throw new Error(`Earth lens did not select: ${lens}.`);
        for (const [name, controlPitch] of states) {
          await page.evaluate(({ controlPitch, zoom }) => {
            window.__earth.camera.setState({ controlPitch, zoom });
          }, { controlPitch, zoom: defaultCamera.zoom });
          await settleEarthMaterials(page);
          const file = `earth-${lens}-${name}.png`;
          await page.screenshot({ path: resolve(outputRoot, file) });
          earthViews.push({
            lens,
            name,
            controlPitch,
            file,
            sha256: await sha256(resolve(outputRoot, file)),
            interiorCoverage: lens === "cross-section"
              ? await analyzeInteriorCapture(file)
              : null,
            state: await page.evaluate(() => ({
              lens: document.querySelector(".planet-stage")?.dataset.lens ?? null,
              view: document.querySelector(".planet-stage")?.dataset.view ?? null,
              retainedSceneLeaves: document.querySelector(".planet-stage")
                ?.querySelectorAll("b, s, u").length ?? 0,
              cutawayLeaves: document.querySelectorAll(".earth-cutaway s").length,
              cutawayRootCount: document.querySelectorAll(".earth-cutaway").length,
              cutawayPresentationTransform: (() => {
                const element = document.querySelector(
                  ".earth-cutaway-presentation",
                );
                return element ? getComputedStyle(element).transform : null;
              })(),
            })),
          });
        }
      }
      await page.evaluate(({ camera }) => {
        window.__earth.lenses.select("normal");
        window.__earth.camera.setState(camera);
      }, { camera: defaultCamera });
      await settle(page);
      const atmosphereOnFile = "earth-atmosphere-on.png";
      const atmosphereOffFile = "earth-atmosphere-off.png";
      await page.evaluate(() => document.querySelector(".planet-stage")
        ?.classList.remove("earth-hide-atmosphere"));
      await settle(page);
      const atmosphereBounds = await page.evaluate(() => {
        const element = document.querySelector(".earth-atmosphere-material");
        if (!(element instanceof HTMLElement)) {
          throw new Error("Earth atmosphere material is missing.");
        }
        const bounds = element.getBoundingClientRect();
        return {
          width: bounds.width,
          height: bounds.height,
          devicePixelRatio,
        };
      });
      await page.screenshot({ path: resolve(outputRoot, atmosphereOnFile) });
      await page.evaluate(() => document.querySelector(".planet-stage")
        ?.classList.add("earth-hide-atmosphere"));
      await settle(page);
      await page.screenshot({ path: resolve(outputRoot, atmosphereOffFile) });
      await page.evaluate(() => document.querySelector(".planet-stage")
        ?.classList.remove("earth-hide-atmosphere"));
      await settle(page);
      atmosphere = await compareAtmosphereCaptures({
        onFile: atmosphereOnFile,
        offFile: atmosphereOffFile,
        atmosphereBounds,
      });
    }
    if (planet === "saturn") {
      const selected = await page.evaluate(() =>
        window.__saturn.lenses.select("cross-section"));
      if (!selected) throw new Error("Saturn cross-section did not select.");
      referenceViews = [];
      for (const [name, controlPitch] of [
        ["minimum", 0],
        ["default", defaultCamera.controlPitch],
        ["maximum", 89],
      ]) {
        await page.evaluate(({ controlPitch, zoom }) => {
          window.__saturn.camera.setState({ controlPitch, zoom });
        }, { controlPitch, zoom: defaultCamera.zoom });
        await settle(page);
        const file = `saturn-cross-section-${name}.png`;
        await page.screenshot({ path: resolve(outputRoot, file) });
        referenceViews.push({
          name,
          controlPitch,
          file,
          sha256: await sha256(resolve(outputRoot, file)),
        });
      }
      await page.evaluate(({ camera }) => {
        window.__saturn.camera.setState(camera);
      }, { camera: defaultCamera });
      await settle(page);
    }
    await isolation.evaluate((element) => element.remove());
    const runtime = await page.evaluate((planetId) => {
      const api = window[`__${planetId}`];
      const resources = performance.getEntriesByType("resource")
        .filter(({ name }) => name.includes(`/scenes/${planetId}/`));
      return {
        activeObjectId: window.__cssEarth.activeObjectId,
        mountedObjectCount: window.__cssEarth.mountedObjectCount,
        retainedLeafCount: api.dom.retainedLeafCount,
        mountedLeafCount: document.querySelector(".planet-stage")
          .querySelectorAll("b, s, u").length,
        stableDomIdentity: api.assertStableDomIdentity(),
        stageElementCount: document.querySelector(".planet-stage")
          .querySelectorAll("*").length,
        canvasCount: document.querySelectorAll(".planet-stage canvas").length,
        sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
        selectedPreparedDensity:
          api.renderStats.textureStats.selectedPreparedDensity,
        retainedInteractiveImageCount:
          api.renderStats.textureStats.retainedInteractiveImageCount,
        totalAnimationCount: document.getAnimations().length,
        runningAnimationCount: document.getAnimations()
          .filter(({ playState }) => playState === "running").length,
        resourceCount: resources.length,
        transferBytes: resources.reduce(
          (sum, resource) => sum + resource.transferSize,
          0,
        ),
        embeddedMoonElementCount: planetId === "earth"
          ? document.querySelectorAll('[class*="earth-moon"]').length
          : null,
        atmosphereBackgroundImage: planetId === "earth"
          ? getComputedStyle(document.querySelector(
            ".earth-atmosphere-material",
          )).backgroundImage
          : null,
        normalSurfaceBackgroundImage: planetId === "earth"
          ? getComputedStyle(document.querySelector(
            ".earth-body:not(.earth-body-polar) > s",
          ), "::before").backgroundImage
          : null,
        normalPolesBackgroundImage: planetId === "earth"
          ? getComputedStyle(document.querySelector(
            ".earth-body-polar > s",
          )).backgroundImage
          : null,
        cameraStats: planetId === "earth" ? api.camera.stats() : null,
        materialCaches: planetId === "earth" ? {
          lighting: api.renderStats.textureStats.materialCaches.lighting(),
          atmosphere: api.renderStats.textureStats.materialCaches.atmosphere(),
        } : null,
        renderRootCount: document.querySelectorAll(
          ".planet-stage > .planet-render-root",
        ).length,
      };
    }, planet);
    const metrics = Object.fromEntries(
      (await cdp.send("Performance.getMetrics")).metrics.map(
        ({ name, value }) => [name, value],
      ),
    );
    const maximumCompositorLayer = layers.reduce((maximum, layer) => {
      const area = (layer.width ?? 0) * (layer.height ?? 0);
      return area > maximum.area
        ? { area, width: layer.width ?? 0, height: layer.height ?? 0 }
        : maximum;
    }, { area: 0, width: 0, height: 0 });
    return {
      planet,
      shell: {
        file: shellFile,
        sha256: await sha256(resolve(outputRoot, shellFile)),
      },
      scenes,
      earthViews,
      atmosphere,
      referenceViews,
      runtime,
      performance: {
        jsHeapUsedBytes: metrics.JSHeapUsedSize,
        domNodeCount: metrics.Nodes,
        layoutCount: metrics.LayoutCount,
        styleRecalcCount: metrics.RecalcStyleCount,
      },
      maximumCompositorLayer,
      externalRequests,
      browserProblems,
    };
  } finally {
    await context.close();
  }
}

async function compareAtmosphereCaptures({
  onFile,
  offFile,
  atmosphereBounds,
}) {
  const on = await sharp(resolve(outputRoot, onFile))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const off = await sharp(resolve(outputRoot, offFile))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (on.info.width !== off.info.width || on.info.height !== off.info.height ||
      on.info.channels !== 3 || off.info.channels !== 3) {
    throw new Error("Earth atmosphere capture dimensions do not match.");
  }
  const amplified = Buffer.alloc(on.data.length);
  let changedPixelCount = 0;
  const positiveDeltaSums = [0, 0, 0];
  for (let offset = 0; offset < on.data.length; offset += 3) {
    const deltas = [0, 1, 2].map((channel) =>
      on.data[offset + channel] - off.data[offset + channel]);
    const absolute = deltas.map(Math.abs);
    if (Math.max(...absolute) >= 3) {
      changedPixelCount += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        positiveDeltaSums[channel] += Math.max(0, deltas[channel]);
      }
    }
    for (let channel = 0; channel < 3; channel += 1) {
      amplified[offset + channel] = Math.min(255, absolute[channel] * 6);
    }
  }
  const pixelCount = on.info.width * on.info.height;
  const materialPixelCount = atmosphereBounds.width *
    atmosphereBounds.height * atmosphereBounds.devicePixelRatio ** 2;
  const diffFile = "earth-atmosphere-absolute-diff.png";
  await sharp(amplified, {
    raw: {
      width: on.info.width,
      height: on.info.height,
      channels: 3,
    },
  }).png().toFile(resolve(outputRoot, diffFile));
  const [red, green, blue] = positiveDeltaSums.map((sum) =>
    changedPixelCount === 0 ? 0 : sum / changedPixelCount);
  return {
    on: { file: onFile, sha256: await sha256(resolve(outputRoot, onFile)) },
    off: { file: offFile, sha256: await sha256(resolve(outputRoot, offFile)) },
    absoluteDiff: {
      file: diffFile,
      amplification: 6,
      sha256: await sha256(resolve(outputRoot, diffFile)),
    },
    comparisonThreshold: 3,
    changedPixelCount,
    changedPixelPercent: changedPixelCount / pixelCount * 100,
    changedPixelPercentOfMaterialBounds:
      changedPixelCount / materialPixelCount * 100,
    materialBounds: atmosphereBounds,
    meanPositiveDelta: { red, green, blue },
  };
}

async function analyzeInteriorCapture(file) {
  const image = await sharp(resolve(outputRoot, file))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let warmPixelCount = 0;
  for (let offset = 0; offset < image.data.length; offset += 3) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    if (red >= 96 && red > green * 1.05 && green > blue * 1.04) {
      warmPixelCount += 1;
    }
  }
  return {
    model: "warm-interior-pixel-coverage",
    predicate: "red>=96, red>green*1.05, green>blue*1.04",
    warmPixelCount,
    totalPixelCount: image.info.width * image.info.height,
  };
}

function earthPreparedAtmosphereRatio() {
  const atmosphere = PREPARED_EARTH_SCENE.material.atmosphere;
  return atmosphere.physicalRadius / atmosphere.planetRadius;
}

async function compareSaturnBaseline(current, reportPath) {
  const baseline = JSON.parse(await readFile(reportPath, "utf8"));
  if (baseline.viewport?.width !== viewport.width ||
      baseline.viewport?.height !== viewport.height ||
      baseline.deviceScaleFactor !== deviceScaleFactor) {
    throw new Error("Saturn baseline viewport or DPR does not match this audit.");
  }
  const reference = (baseline.captures ?? baseline.reports)
    ?.find(({ planet }) => planet === "saturn");
  if (!reference) throw new Error("Saturn baseline capture is missing.");
  const baselineScenes = reference.scenes ?? reference.states;
  const currentScenes = reference.scenes
    ? current.scenes
    : current.referenceViews;
  const comparisons = [
    ...(reference.shell ? [{
      name: "shell",
      baseline: reference.shell.sha256,
      current: current.shell.sha256,
    }] : []),
    ...currentScenes.map((scene) => {
      const baselineScene = baselineScenes.find(({ name }) =>
        name === scene.name);
      if (!baselineScene) {
        throw new Error(`Saturn baseline state is missing: ${scene.name}.`);
      }
      return {
        name: scene.name,
        baseline: baselineScene.sha256 ?? null,
        current: scene.sha256,
      };
    }),
  ];
  for (const comparison of comparisons) {
    if (comparison.baseline) continue;
    const baselineState = baselineScenes.find(({ name }) =>
      name === comparison.name);
    comparison.baseline = await sha256(resolve(
      dirname(reportPath),
      baselineState.file,
    ));
  }
  const baselineDefault = baselineScenes.find(({ name }) => name === "default");
  const currentDefault = currentScenes.find(({ name }) => name === "default");
  const diffFile = "saturn-default-absolute-diff.png";
  await sharp(resolve(dirname(reportPath), baselineDefault.file))
    .composite([{
      input: resolve(outputRoot, currentDefault.file),
      blend: "difference",
    }])
    .png()
    .toFile(resolve(outputRoot, diffFile));
  const diffStats = await sharp(resolve(outputRoot, diffFile)).stats();
  const maximumChannelDifference = Math.max(...diffStats.channels.slice(0, 3).map(
    ({ max }) => max,
  ));
  return {
    baselineReport: reportPath,
    exact: comparisons.every(({ baseline, current: currentHash }) =>
      baseline === currentHash) && maximumChannelDifference === 0,
    comparisons,
    absoluteDiff: {
      file: diffFile,
      sha256: await sha256(resolve(outputRoot, diffFile)),
      maximumChannelDifference,
    },
  };
}

async function prepareContactSheet(captures) {
  const cellWidth = 720;
  const cellHeight = 450;
  const labelHeight = 34;
  const rows = ["default", "minimum-pitch", "maximum-pitch"];
  const columns = ["saturn", "earth"];
  const composites = [];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      const capture = captures.find(({ planet }) => planet === columns[column]);
      const scene = capture.scenes.find(({ name }) => name === rows[row]);
      const image = await sharp(resolve(outputRoot, scene.file))
        .resize(cellWidth, cellHeight, { fit: "fill" })
        .toBuffer();
      composites.push({
        input: image,
        left: column * cellWidth,
        top: row * (cellHeight + labelHeight) + labelHeight,
      });
      composites.push({
        input: Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}">
          <rect width="100%" height="100%" fill="#111"/>
          <text x="16" y="23" fill="#ddd" font-family="monospace" font-size="16">
            ${columns[column].toUpperCase()} · ${rows[row].replace("-", " ")}
          </text>
        </svg>`),
        left: column * cellWidth,
        top: row * (cellHeight + labelHeight),
      });
    }
  }
  const file = "saturn-earth-contact-sheet.png";
  await sharp({
    create: {
      width: cellWidth * columns.length,
      height: (cellHeight + labelHeight) * rows.length,
      channels: 3,
      background: "#000",
    },
  }).composite(composites).png().toFile(resolve(outputRoot, file));
  return {
    file,
    columns,
    rows,
    sha256: await sha256(resolve(outputRoot, file)),
  };
}

async function prepareEarthViewContactSheet(earthCapture) {
  const cellWidth = 360;
  const cellHeight = 225;
  const labelHeight = 24;
  const rows = ["default", "minimum-pitch", "maximum-pitch"];
  const columns = ["normal", "topography", "night-lights", "cross-section"];
  const composites = [];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      const view = earthCapture.earthViews.find(({ lens, name }) =>
        lens === columns[column] && name === rows[row]);
      if (!view) {
        throw new Error(
          `Earth view contact sheet is missing ${columns[column]} ${rows[row]}.`,
        );
      }
      composites.push({
        input: await sharp(resolve(outputRoot, view.file))
          .resize(cellWidth, cellHeight, { fit: "fill" })
          .toBuffer(),
        left: column * cellWidth,
        top: row * (cellHeight + labelHeight) + labelHeight,
      });
      composites.push({
        input: Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}">
          <rect width="100%" height="100%" fill="#111"/>
          <text x="10" y="17" fill="#ddd" font-family="monospace" font-size="12">
            ${columns[column].toUpperCase()} · ${rows[row].replace("-", " ")}
          </text>
        </svg>`),
        left: column * cellWidth,
        top: row * (cellHeight + labelHeight),
      });
    }
  }
  const file = "earth-lens-pitch-contact-sheet.png";
  await sharp({
    create: {
      width: cellWidth * columns.length,
      height: (cellHeight + labelHeight) * rows.length,
      channels: 3,
      background: "#000",
    },
  }).composite(composites).png().toFile(resolve(outputRoot, file));
  return {
    file,
    columns,
    rows,
    sha256: await sha256(resolve(outputRoot, file)),
  };
}

async function fingerprints(files) {
  return Object.fromEntries(await Promise.all(
    Object.entries(files).map(async ([name, path]) => [name, {
      path,
      sha256: await sha256(resolve(path)),
    }]),
  ));
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}

async function settleEarthMaterials(page) {
  await settle(page);
  await page.waitForFunction(() => {
    const caches = window.__earth?.renderStats?.textureStats?.materialCaches;
    if (!caches) return false;
    return [caches.lighting(), caches.atmosphere()].every((cache) =>
      cache.pendingRowCount === 0 && cache.appliedRow === cache.desiredRow);
  }, null, { timeout: 10_000 });
  await settle(page);
}
