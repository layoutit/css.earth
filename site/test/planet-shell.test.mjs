import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { objectAdapter } from "../object-adapter.mjs";
import { OBJECTS } from "../objects.mjs";
import { requireSceneLifecycle } from "../scene-contract.mjs";
import { createSceneRouter } from "../scene-router.mjs";

test("keeps every implemented scene in one object registry", () => {
  assert.deepEqual(OBJECTS.map(({ id }) => id), [
    "sun",
    "mercury",
    "venus",
    "earth",
    "moon",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
  ]);
  assert.deepEqual(
    objectAdapter.routes(),
    OBJECTS.map(({ route }) => route),
  );
});

test("loads every object through the single adapter", async () => {
  for (const objectRecord of OBJECTS) {
    assert.equal(typeof await objectAdapter.load(objectRecord.id), "function");
  }
  await assert.rejects(
    objectAdapter.load("future"),
    /Unknown cssEarth object: future/,
  );
  await assert.rejects(
    objectAdapter.load("future", [{
      id: "future",
      loadScene: async () => null,
    }]),
    /must return a mount function/,
  );
});

test("rejects incomplete scene lifecycle wiring", () => {
  assert.throws(
    () => requireSceneLifecycle({ pause() {}, resume() {}, destroy() {} }, "future"),
    /must provide ready, pause, resume, and destroy/,
  );
  const lifecycle = {
    ready: Promise.resolve(),
    pause() {},
    resume() {},
    destroy() {},
  };
  assert.equal(requireSceneLifecycle(lifecycle, "future"), lifecycle);
});

test("shared router owns minimal adapter shell lifecycle", async () => {
  const documentTarget = createFakeDocument();
  const windowTarget = new EventTarget();
  const stage = { ariaBusy: "true" };
  const mounts = [];
  const shellMounts = [];
  let setMotion;
  const router = createSceneRouter({
    stage,
    objectId: "future",
    documentTarget,
    windowTarget,
    mountShell: ({ motionEnabled, onMotionChange }) => {
      const calls = { destroy: 0 };
      shellMounts.push(calls);
      assert.equal(motionEnabled, shellMounts.length > 1);
      setMotion = onMotionChange;
      return { destroy() { calls.destroy += 1; } };
    },
    loadObject: async () => () => {
      const calls = { destroy: 0, pause: 0, resume: 0 };
      mounts.push(calls);
      return {
        ready: Promise.resolve(),
        destroy() { calls.destroy += 1; },
        pause() { calls.pause += 1; },
        resume() { calls.resume += 1; },
      };
    },
  });

  assert.equal(documentTarget.documentElement.dataset.ready, "loading");
  assert.equal(documentTarget.body.classList.contains("loading"), true);
  assert.equal(stage.ariaBusy, "true");
  await router.settled;
  assert.deepEqual(router.state(), {
    activeObjectId: "future",
    error: null,
    lifecycle: "paused",
    mountedObjectCount: 1,
    ready: true,
  });
  assert.equal(documentTarget.documentElement.dataset.ready, "true");
  assert.equal(documentTarget.body.classList.contains("ready"), true);
  assert.equal(documentTarget.body.classList.contains("paused"), true);
  assert.equal(stage.ariaBusy, "false");
  assert.equal(shellMounts.length, 1);
  assert.equal(mounts[0].pause, 1);

  setMotion(true);
  assert.equal(router.state().lifecycle, "mounted");
  assert.equal(documentTarget.body.classList.contains("paused"), false);
  assert.equal(mounts[0].resume, 1);

  documentTarget.hidden = true;
  documentTarget.dispatchEvent(new Event("visibilitychange"));
  documentTarget.dispatchEvent(new Event("visibilitychange"));
  assert.equal(router.state().lifecycle, "paused");
  assert.equal(documentTarget.body.classList.contains("paused"), true);
  assert.equal(mounts[0].pause, 2);
  documentTarget.hidden = false;
  documentTarget.dispatchEvent(new Event("visibilitychange"));
  documentTarget.dispatchEvent(new Event("visibilitychange"));
  assert.equal(router.state().lifecycle, "mounted");
  assert.equal(mounts[0].resume, 2);

  windowTarget.dispatchEvent(new Event("pagehide"));
  windowTarget.dispatchEvent(new Event("pagehide"));
  assert.equal(router.state().lifecycle, "destroyed");
  assert.equal(mounts[0].destroy, 1);
  assert.equal(shellMounts[0].destroy, 1);
  assert.equal("ready" in documentTarget.documentElement.dataset, false);
  const restore = new Event("pageshow");
  Object.defineProperty(restore, "persisted", { value: true });
  windowTarget.dispatchEvent(restore);
  windowTarget.dispatchEvent(restore);
  await router.settled;
  assert.equal(router.state().lifecycle, "mounted");
  assert.equal(mounts.length, 2);
  assert.equal(shellMounts.length, 2);
});

test("shared router publishes a minimal adapter error", async () => {
  const documentTarget = createFakeDocument();
  const windowTarget = new EventTarget();
  const stage = { ariaBusy: "true" };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const router = createSceneRouter({
      stage,
      objectId: "future",
      documentTarget,
      windowTarget,
      mountShell: () => ({ destroy() {} }),
      loadObject: async () => () => ({
        ready: Promise.reject(new Error("prepared scene failed")),
        destroy() {},
        pause() {},
        resume() {},
      }),
    });
    await router.settled;
    assert.equal(router.state().lifecycle, "error");
    assert.equal(router.state().error, "prepared scene failed");
    assert.equal(documentTarget.documentElement.dataset.ready, "error");
    assert.equal(documentTarget.body.classList.contains("error"), true);
    assert.equal(stage.ariaBusy, "false");
  } finally {
    console.error = originalConsoleError;
  }
});

test("shared router contains synchronous shell bootstrap failure", async () => {
  const documentTarget = createFakeDocument();
  const windowTarget = new EventTarget();
  const stage = { ariaBusy: "true" };
  let adapterLoads = 0;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const router = createSceneRouter({
      stage,
      objectId: "future",
      documentTarget,
      windowTarget,
      mountShell: () => { throw new Error("shell failed"); },
      loadObject: async () => {
        adapterLoads += 1;
        return () => null;
      },
    });
    await router.settled;
    assert.deepEqual(router.state(), {
      activeObjectId: "future",
      error: "shell failed",
      lifecycle: "error",
      mountedObjectCount: 0,
      ready: false,
    });
    assert.equal(adapterLoads, 0);
    assert.equal(documentTarget.documentElement.dataset.ready, "error");
    assert.equal(stage.ariaBusy, "false");
  } finally {
    console.error = originalConsoleError;
  }
});

test("shared router cancels a pending adapter before publication", async () => {
  const documentTarget = createFakeDocument();
  const windowTarget = new EventTarget();
  const stage = { ariaBusy: "true" };
  const calls = { shellDestroy: 0, mount: 0 };
  let releaseAdapter;
  const adapterPending = new Promise((resolve) => { releaseAdapter = resolve; });
  const router = createSceneRouter({
    stage,
    objectId: "future",
    documentTarget,
    windowTarget,
    mountShell: () => ({ destroy() { calls.shellDestroy += 1; } }),
    loadObject: async () => {
      await adapterPending;
      return () => {
        calls.mount += 1;
        return {
          ready: Promise.resolve(),
          pause() {},
          resume() {},
          destroy() {},
        };
      };
    },
  });

  windowTarget.dispatchEvent(new Event("pagehide"));
  releaseAdapter();
  await router.settled;
  assert.equal(calls.shellDestroy, 1);
  assert.equal(calls.mount, 0);
  assert.equal(router.state().lifecycle, "destroyed");
  assert.equal("ready" in documentTarget.documentElement.dataset, false);
});

test("keeps implemented routes backed by object-owned files", async () => {
  for (const planet of OBJECTS) {
    const owned = [
      `../../src/planets/${planet.id}/SOURCE.md`,
      `../../src/planets/${planet.id}/NOTICE.md`,
      `../../src/planets/${planet.id}/site`,
      `../../src/planets/${planet.id}/test`,
      `../../src/planets/${planet.id}/tools`,
      `../pages/${planet.id}.astro`,
    ];
    await Promise.all(owned.map((relativePath) =>
      access(new URL(relativePath, import.meta.url))));
  }
});

test("renders source-backed charts in canonical order with shell-owned collapsed defaults", async () => {
  const panels = [
    ["mercury", "Mercury", [
      "reflectance", "photometric-phase",
    ]],
    ["venus", "Venus", [
      "reflectance", "photometric-phase", "temperature-pressure",
    ]],
    ["earth", "Earth", [
      "reflectance", "photometric-phase", "temperature-pressure",
    ]],
    ["mars", "Mars", [
      "reflectance", "photometric-phase", "temperature-pressure",
    ]],
    ["jupiter", "Jupiter", [
      "reflectance", "photometric-phase", "temperature-pressure",
    ]],
    ["saturn", "Saturn", [
      "reflectance", "photometric-phase", "temperature-pressure",
    ]],
    ["uranus", "Uranus", [
      "reflectance", "photometric-phase", "temperature-pressure",
    ]],
    ["neptune", "Neptune", [
      "reflectance", "photometric-phase", "temperature-pressure",
    ]],
  ];

  for (const [id, name, expectedChartIds] of panels) {
    const panel = await readFile(
      new URL(`../../src/planets/${id}/site/${name}Panel.astro`, import.meta.url),
      "utf8",
    );
    const chartBlock = panel.match(/const charts = \[([\s\S]*?)\n\];/u)?.[1];
    assert.ok(chartBlock, `${name} must declare its applicable charts.`);
    const chartIds = [...chartBlock.matchAll(/id:\s*"([^"]+)"/gu)]
      .map(([, chartId]) => chartId);
    assert.deepEqual(
      chartIds,
      expectedChartIds,
      `${name} chart order`,
    );
  }

  const shell = await readFile(
    new URL("../components/PlanetShell.astro", import.meta.url),
    "utf8",
  );
  assert.match(shell, /class="planet-lenses" open>/u);
  assert.doesNotMatch(shell, /open=\{chart\.open\}|open=\{gallery\.open\}/u);

  const mercury = await readFile(
    new URL("../../src/planets/mercury/site/MercuryPanel.astro", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    mercury,
    /id:\s*"temperature-pressure"|mercury-no-atmosphere-profile/u,
  );
});

test("keeps the shared shell planet-neutral", async () => {
  const sharedFiles = await Promise.all([
    readFile(new URL("../layouts/PlanetLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetHeader.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell-client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../scene-router.mjs", import.meta.url), "utf8"),
    readFile(new URL("../site.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(
    sharedFiles.join("\n"),
    /(?:css)?saturn|(?:css)?mars|(?:css)?venus|\/scenes\/(?:saturn|mars|venus)\//iu,
  );
});

test("offsets the desktop scene around the sidebar", async () => {
  const styles = await readFile(new URL("../site.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /\.planet-stage > \.planet-render-root\s*\{[\s\S]*?transform-origin:\s*50% 50%;/u,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*961px\) and \(orientation:\s*landscape\)\s*\{[\s\S]*?\.planet-stage > \.planet-render-root\s*\{[\s\S]*?translate:\s*175px 0;/u,
  );
});

test("renders optional source media through one planet-neutral panel contract", async () => {
  const [shell, styles] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /galleries\?: Gallery\[\]/u);
  assert.match(shell, /galleries\.map\(\(gallery\)/u);
  assert.match(shell, /class="planet-gallery-panel"/u);
  assert.match(shell, /loading="lazy"/u);
  assert.match(shell, /href=\{item\.sourceUrl\}/u);
  assert.match(styles, /\.planet-gallery-image\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*auto;/u);
});

test("renders concise per-lens descriptions without a general introduction", async () => {
  const [shell, saturnPanel] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/planets/saturn/site/SaturnPanel.astro", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(shell, /planet-lenses-introduction|Explore this object in new ways/u);
  assert.match(shell, /class="planet-lens-description">\{lens\.description\}<\/span>/u);
  assert.match(saturnPanel, /normal:\s*"Visible color"/u);
  assert.match(saturnPanel, /ultraviolet:\s*"Hubble at 225 nm"/u);
  assert.match(saturnPanel, /thermal:\s*"Cassini infrared"/u);
});

test("places the thumbnail lens panel after Factsheet and before the charts", async () => {
  const [shell, client, styles, siteStyles] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell-client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../site.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    shell,
    /class="planet-selected-panel">[\s\S]*?id=\{`\$\{objectId\}-factsheet`\}[\s\S]*?<\/section>\s*\{hasLenses && lenses && <details id=\{`\$\{objectId\}-lenses`\} class="planet-lenses" open>[\s\S]*?class="planet-layers-menu"[\s\S]*?lenses\.controls\.map\(\(lens\)[\s\S]*?class="planet-observation-control"[\s\S]*?aria-pressed=\{lens\.id === lenses\.defaultLens[\s\S]*?class="planet-lens-icon" src=\{lens\.thumbnailUrl\}[\s\S]*?class="planet-lens-label">\{lens\.label\}[\s\S]*?class="planet-lens-description">\{lens\.description\}[\s\S]*?<\/details>\}\s*\{orderedCharts\.map\(\(chart\)[\s\S]*?<\/details>\s*\)\)\}\s*\{galleries\.map\(\(gallery\)/u,
  );
  assert.doesNotMatch(shell, /planet-lenses-card|planet-layers-trigger|planet-layers-thumbnail|planet-layers-caption|planet-layers-glyph/u);
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?:is\([\s\S]*?\.planet-lenses,[\s\S]*?\)::before\s*\{[\s\S]*?right:\s*-12px;[\s\S]*?left:\s*-18px;[\s\S]*?height:\s*2px;/u,
  );
  assert.match(styles, /\.planet-layers-menu \.planet-observation-controls\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*2px;[\s\S]*?margin:\s*2px 0 0;[\s\S]*?padding:\s*0;/u);
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-observation-controls:has\(> \.planet-observation-option:nth-child\(5\)\)\s*\{[\s\S]*?max-height:\s*166px;[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;[\s\S]*?scrollbar-width:\s*thin;/u,
  );
  assert.doesNotMatch(styles, /\.planet-layers-menu \.planet-observation-controls\s*\{[^}]*(?:height|overflow|scrollbar-width):/u);
  assert.match(styles, /\.planet-layers-menu \.planet-observation-control\s*\{[\s\S]*?grid-template-columns:\s*36px minmax\(0, 1fr\);[\s\S]*?width:\s*100%;[\s\S]*?height:\s*40px;/u);
  assert.match(siteStyles, /--shell-text:\s*#dfdfdf;[\s\S]*?--shell-text-secondary:\s*#b8bbc4;[\s\S]*?--shell-text-muted:\s*#7f8187;/u);
  assert.match(styles, /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-sidebar\s*\{[\s\S]*?--shell-text-secondary:\s*#a9acb5;/u);
  assert.match(styles, /\.planet-layers-menu \.planet-observation-control\s*\{[\s\S]*?color:\s*var\(--shell-text-secondary\);[\s\S]*?opacity:\s*1;[\s\S]*?transition:\s*opacity 120ms ease;/u);
  assert.match(styles, /\.planet-layers-menu \.planet-observation-control\[aria-pressed="true"\]\s*\{[\s\S]*?opacity:\s*1;/u);
  assert.doesNotMatch(styles, /rgb\(255 255 255 \/ 75%\)/u);
  assert.doesNotMatch(styles, /rgb\(255 255 255 \/ 45%\)/u);
  assert.match(styles, /\.planet-layers-menu \.planet-lens-icon\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;[\s\S]*?border:\s*1px solid rgb\(255 255 255 \/ 8%\);[\s\S]*?border-radius:\s*2px;[\s\S]*?box-shadow:\s*none;/u);
  assert.match(styles, /\.planet-layers-menu \.planet-lens-label\s*\{[\s\S]*?color:\s*var\(--shell-text-muted\);[\s\S]*?font:\s*400 0\.875rem\/20px var\(--shell-ui-font\);[\s\S]*?opacity:\s*1;[\s\S]*?text-overflow:\s*ellipsis;/u);
  assert.match(styles, /\.planet-layers-menu \.planet-lens-description\s*\{[\s\S]*?color:\s*var\(--shell-text-muted\);[\s\S]*?font:\s*400 0\.8125rem\/17px var\(--shell-ui-font\);[\s\S]*?opacity:\s*1;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/u);
  assert.match(styles, /\.planet-observation-control\[aria-pressed="true"\][\s\S]*?\.planet-lens-label\s*\{[\s\S]*?color:\s*var\(--shell-text\);[\s\S]*?opacity:\s*1;/u);
  assert.match(styles, /\.planet-observation-control\[aria-pressed="true"\][\s\S]*?\.planet-lens-description\s*\{[\s\S]*?color:\s*var\(--shell-text-secondary\);[\s\S]*?opacity:\s*1;/u);
  assert.doesNotMatch(shell, /planet-lens-scrollbar/u);
  assert.doesNotMatch(styles, /planet-lens-scrollbar/u);
  assert.doesNotMatch(client, /createLensScrollbarController|lensScrollbar/u);
  assert.match(styles, /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-sidebar\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 127px\);[\s\S]*?overflow-y:\s*auto;/u);
  assert.doesNotMatch(client, /createLayersController|MutationObserver|layersOpen/u);
});

test("shows every fact through an inline disclosure after the introduction", async () => {
  const [shell, styles] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    shell,
    /class="planet-selected-panel"[\s\S]*?class="planet-title"[\s\S]*?class="planet-introduction"[\s\S]*?class="planet-factsheet-disclosure"[\s\S]*?class="planet-factsheet-summary"[\s\S]*?Show factsheet[\s\S]*?Hide factsheet[\s\S]*?class="planet-facts"[\s\S]*?class="planet-primary-facts"[\s\S]*?allFacts\.map\(\(fact\)[\s\S]*?<\/section>/u,
  );
  assert.doesNotMatch(shell, /planet-learn-more|learnMoreUrl|Learn more/u);
  assert.doesNotMatch(shell, /class="planet-factsheet-disclosure"\s+open/u);
  assert.doesNotMatch(
    shell,
    /PREPARED_SHELL_TITLES\.facts|PREPARED_SHELL_ICONS\.facts/u,
  );
  assert.doesNotMatch(shell, /planet-information-cross|Close .* information/u);
  assert.doesNotMatch(styles, /planet-information-cross/u);
  assert.match(shell, /const allFacts = \[\.\.\.facts, \.\.\.moreFacts\];/u);
  assert.match(
    shell,
    /allFacts\.map\(\(fact\) => \([\s\S]*?<li title=\{fact\.title\}>[\s\S]*?class="planet-fact-label">\{fact\.label\}[\s\S]*?class="planet-fact-value">\{fact\.value\}/u,
  );
  assert.doesNotMatch(shell, /visibleFacts|hiddenFacts|hasHiddenFacts|planet-more-facts|Show more|Show less/u);
  assert.doesNotMatch(styles, /planet-more-facts/u);
  assert.match(
    shell,
    /import \{ PREPARED_SHELL_TITLES \} from "\.\.\/prepared-shell-titles\.mjs";/u,
  );
  assert.match(
    shell,
    /import \{ PREPARED_SHELL_ICONS \} from "\.\.\/prepared-shell-icons\.mjs";/u,
  );
  assert.doesNotMatch(shell, /planet-panel-symbol|chartGlyphs|◉|∿|↕|◎|§/u);
  for (const iconKey of [
    "reflectance",
    "temperaturePressure",
    "photometricPhase",
    "lenses",
    "resources",
  ]) {
    assert.match(shell, new RegExp(`PREPARED_SHELL_ICONS\\.${iconKey}`, "u"));
  }
  assert.match(
    styles,
    /\.planet-panel-icon\s*\{[\s\S]*?flex:\s*0 0 20px;[\s\S]*?width:\s*20px;[\s\S]*?height:\s*20px;[\s\S]*?margin-left:\s*auto;/u,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-panel-icon\s*\{[\s\S]*?flex-basis:\s*12px;[\s\S]*?width:\s*12px;[\s\S]*?height:\s*12px;/u,
  );
  assert.match(
    shell,
    /class="planet-panel-heading">\{chart\.title\.label\}<\/h2>[\s\S]*?chartIcons\[chart\.id\][\s\S]*?class="planet-panel-icon"/u,
  );
  assert.match(
    shell,
    /class="planet-panel-heading">\{lenses\.title\.label\}<\/h2>[\s\S]*?class="planet-panel-icon"[\s\S]*?PREPARED_SHELL_ICONS\.lenses\.src/u,
  );
  assert.match(
    shell,
    /class="planet-panel-heading">\{PREPARED_SHELL_TITLES\.resources\.label\}<\/h2>[\s\S]*?class="planet-panel-icon"[\s\S]*?PREPARED_SHELL_ICONS\.resources\.src/u,
  );
  assert.doesNotMatch(shell, /class="planet-panel-title"|title-(?:factsheet|reflectance-spectrum|thermal-profile|surface-lens|sources-resources)\.svg/u);
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-panel-heading\s*\{[\s\S]*?font:\s*400 0\.8125rem\/18px var\(--shell-ui-font\);[\s\S]*?text-transform:\s*uppercase;[\s\S]*?transform:\s*translateY\(1\.5px\);/u,
  );
  assert.match(
    styles,
    /\.planet-facts\s*\{[\s\S]*?margin:\s*8px 0 0;[\s\S]*?font-family:\s*var\(--shell-ui-font\);[\s\S]*?font-size:\s*0\.875rem;[\s\S]*?line-height:\s*1\.4;[\s\S]*?@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-facts li\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, max-content\) minmax\(8px, 1fr\) max-content;[\s\S]*?align-items:\s*baseline;[\s\S]*?gap:\s*8px;[\s\S]*?\.planet-facts li::before\s*\{[\s\S]*?border-bottom:\s*1px solid rgb\(255 255 255 \/ 5%\);[\s\S]*?\.planet-fact-label\s*\{[\s\S]*?color:\s*var\(--shell-text-muted\);[\s\S]*?opacity:\s*1;[\s\S]*?\.planet-fact-value\s*\{[\s\S]*?grid-column:\s*3;[\s\S]*?font:\s*13px\/1\.4 var\(--shell-ui-font\);/u,
  );
  for (const className of ["planet-chart", "planet-gallery", "planet-settings"]) {
    assert.match(styles, new RegExp(`\\.${className}\\s*\\{[^}]*margin:\\s*8px 0 0;`, "u"));
  }
  assert.match(styles, /\.planet-panel-toggle\s*\{[\s\S]*?margin-left:\s*auto;/u);
  assert.match(
    styles,
    /\.planet-factsheet-disclosure\s*\{[\s\S]*?margin:\s*8px 0 0;[\s\S]*?padding:\s*0 0 16px;[\s\S]*?\.planet-factsheet-summary\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?font:\s*400 0\.875rem\/20px var\(--shell-ui-font\);[\s\S]*?text-decoration:\s*underline;/u,
  );
  assert.doesNotMatch(styles, /\.planet-factsheet-disclosure::before/u);
});

test("aligns prepared charts to device pixels after layout", async () => {
  const client = await readFile(
    new URL("../planet-shell-client.mjs", import.meta.url),
    "utf8",
  );
  assert.match(client, /createChartPixelAlignmentController/u);
  assert.match(client, /devicePixelRatio/u);
  assert.match(client, /Math\.round\(top \* density\) \/ density/u);
  assert.match(client, /chart\.style\.setProperty\("translate"/u);
});

test("places desktop search and the collapse control around the sidebar", async () => {
  const [layout, header, wordmark, shell, navigation, client, styles, siteStyles, navigationStyles, mapsStyles] = await Promise.all([
    readFile(new URL("../layouts/PlanetLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetHeader.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/CssEarthWordmark.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetaryScale.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell-client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../site.css", import.meta.url), "utf8"),
    readFile(new URL("../planetary-scale.css", import.meta.url), "utf8"),
    readFile(new URL("../maps-shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    layout,
    /<PlanetHeader objectId=\{objectRecord\.id\} \/>[\s\S]*?<slot name="planet-ui" \/>/u,
  );
  assert.doesNotMatch(shell, /PlanetHeader|PlanetaryScale|planet-topbar|planet-wordmark|planet-actions/u);
  assert.match(shell, /<aside id=\{`\$\{objectId\}-sidebar`\} class="planet-sidebar"/u);
  assert.doesNotMatch(shell, /class="planet-search"/u);
  assert.match(
    shell,
    /<aside id=\{`\$\{objectId\}-sidebar`\} class="planet-sidebar"[\s\S]*?class="planet-sidebar-search"[\s\S]*?class="planet-drawer-content"[\s\S]*?class="planet-information-panel">[\s\S]*?class="planet-selected-panel"/u,
  );
  assert.doesNotMatch(
    shell,
    /class="planet-information-panel">[\s\S]*?class="planet-sidebar-search"/u,
  );
  assert.match(
    shell,
    /class="planet-title-svg"[\s\S]*?viewBox=\{title\.renderViewBox\}[\s\S]*?width=\{title\.renderWidth\}[\s\S]*?height=\{title\.renderHeight\}[\s\S]*?transform=\{title\.renderPathOffsetY === 0/u,
  );
  assert.match(shell, /import PlanetNavigationMarker from "\.\/PlanetNavigationMarker\.astro";/u);
  assert.match(shell, /const activePlanetIndex = PLANET_SEARCH_OBJECTS\.findIndex\(\(object\) => object\.id === objectId\);/u);
  assert.match(
    shell,
    /class="planet-title-row">[\s\S]*?<h1 class="planet-title"[\s\S]*?<PlanetNavigationMarker[\s\S]*?planetId=\{activeObject\.id\}[\s\S]*?color=\{activeObject\.color\}[\s\S]*?index=\{activePlanetIndex\}[\s\S]*?count=\{planetCount\}[\s\S]*?scale=\{2\}/u,
  );
  assert.match(shell, /import \{ PLANET_SEARCH_OBJECTS \} from "\.\.\/planet-search-objects\.mjs";/u);
  assert.match(
    shell,
    /const planetCount = PLANET_SEARCH_OBJECTS\.length;/u,
  );
  assert.match(
    shell,
    /placeholder=\{`Search objects \(\$\{planetCount\}\)`\}/u,
  );
  assert.match(
    header,
    /<header class="planet-topbar">[\s\S]*?class="planet-header-rail">[\s\S]*?<CssEarthWordmark \/>[\s\S]*?class="planet-header-action planet-sidebar-toggle"[\s\S]*?aria-controls=\{`\$\{objectId\}-sidebar`\}[\s\S]*?class="planet-action-marker planet-blackhole-marker"[\s\S]*?class="planet-action-marker planet-supernova-marker"[\s\S]*?class="planet-sidebar-collapse-label">Collapse<\/span>[\s\S]*?class="planet-sidebar-expand-label">Expand<\/span>[\s\S]*?<\/button>[\s\S]*?<PlanetaryScale activeObjectId=\{objectId\} \/>[\s\S]*?<\/header>/u,
  );
  assert.match(header, /planet-sidebar-collapse-label[\s\S]*?planet-sidebar-expand-label/u);
  assert.match(header, /import PlanetaryScale from "\.\/PlanetaryScale\.astro";/u);
  assert.doesNotMatch(header, /planetary-search-desktop|Search objects/u);
  assert.match(
    wordmark,
    /declare const __CSSEARTH_VERSION__:\s*string;[\s\S]*?const versionLabel = `Version \$\{__CSSEARTH_VERSION__\}`;[\s\S]*?class="planet-wordmark-version">\{versionLabel\}<\/span>/u,
  );
  assert.match(
    mapsStyles,
    /\.maps-brand-button \.planet-wordmark-svg\s*\{[\s\S]*?position:\s*relative;[\s\S]*?top:\s*-3px;[\s\S]*?transform:\s*none;[\s\S]*?\.planet-header-rail > \.planet-sidebar-toggle \.planet-blackhole-marker\s*\{[\s\S]*?top:\s*-1px;/u,
  );
  assert.doesNotMatch(wordmark, /planet-wordmark-tagline|Explore the cosmos/u);
  assert.doesNotMatch(header, /Explore the cosmos|planet-github|planet-motion-action|planet-shadows-action/u);
  assert.match(
    header,
    /class="planet-header-actions">[\s\S]*?class="planet-header-action planet-settings-action"[\s\S]*?aria-controls=\{`\$\{objectId\}-settings`\}[\s\S]*?aria-expanded="false"[\s\S]*?class="planet-action-marker planet-settings-marker"[\s\S]*?<span>Settings<\/span>/u,
  );
  assert.doesNotMatch(header, /planet-actions/u);
  assert.doesNotMatch(header, />GitHub<|Download|Share|planet-download|planet-share|navigator\.share|navigator\.clipboard/u);
  assert.doesNotMatch(
    navigation,
    /planetary-search-mobile|scale-sun|scale-sun-marker/u,
  );
  assert.match(
    navigation,
    /MOBILE_VIEWPORT_QUERY[\s\S]*?class="scale-stops"[\s\S]*?matchMedia\(mobileViewportQuery\)/u,
  );
  assert.match(
    navigationStyles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)\s*\{[\s\S]*?\.planetary-navigation\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*10px;[\s\S]*?left:\s*calc\(50% \+ 146px\);[\s\S]*?flex:\s*0 0 auto;[\s\S]*?width:\s*min\(1024px, calc\(100vw - 440px\)\);[\s\S]*?max-width:\s*1024px;[\s\S]*?transform:\s*translateX\(-50%\);[\s\S]*?\.planetary-navigation > \.planetary-scale\s*\{[\s\S]*?display:\s*flex;[\s\S]*?column-gap:\s*16px;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?padding-right:\s*6%;[\s\S]*?transform:\s*none;[\s\S]*?\.scale-stops\s*\{[\s\S]*?flex:\s*1 1 0;/u,
  );
  assert.doesNotMatch(navigationStyles, /planetary-search-desktop/u);
  assert.match(navigationStyles, /\.scale-planet\s*\{[\s\S]*?left:\s*var\(--planet-offset\);/u);
  assert.match(
    navigationStyles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planetary-navigation > \.planetary-scale\s*\{[\s\S]*?--planet-track-leading-gap:\s*0px;[\s\S]*?\.planetary-scale::before\s*\{[\s\S]*?display:\s*none;[\s\S]*?\.scale-stops\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?margin-left:\s*0;[\s\S]*?\.scale-stops::before\s*\{[\s\S]*?inset:\s*29px 0 auto 6%;[\s\S]*?height:\s*1px;[\s\S]*?background:\s*rgb\(223 223 223 \/ 16%\);[\s\S]*?\.scale-planet\.active \.scale-name,[\s\S]*?\.scale-stop:hover \.scale-name,[\s\S]*?\.scale-stop:focus-visible \.scale-name\s*\{[\s\S]*?text-decoration:\s*underline;[\s\S]*?text-underline-offset:\s*3px;[\s\S]*?\.scale-stop:hover \.scale-label,[\s\S]*?\.scale-stop:focus-visible \.scale-label\s*\{[\s\S]*?opacity:\s*0\.9;/u,
  );
  assert.doesNotMatch(navigationStyles, /\.scale-sun/u);
  assert.match(
    navigationStyles,
    /@media \(min-width:\s*821px\) and \(max-width:\s*1159px\) and \(orientation:\s*landscape\)[\s\S]*?\.planetary-navigation\s*\{[\s\S]*?display:\s*none;/u,
  );
  assert.doesNotMatch(
    navigationStyles,
    /\.scale-planet:not\(\.active\) \.scale-label\s*\{[\s\S]*?display:\s*none;/u,
  );
  assert.doesNotMatch(
    navigationStyles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\) and \(max-width:\s*1279px\)[\s\S]*?\.planetary-navigation\s*\{[\s\S]*?(?:position:\s*relative|left:\s*auto|transform:\s*none)/u,
  );
  assert.match(navigationStyles, /\.scale-label\s*\{[\s\S]*?min-width:\s*max-content;/u);
  assert.match(
    styles,
    /\.planet-information-panel\s*\{[\s\S]*?padding:\s*12px 16px;[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*8px;[\s\S]*?background:\s*#151515;/u,
  );
  assert.match(
    styles,
    /\.planet-title\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?height:\s*30\.13px;/u,
  );
  assert.match(
    styles,
    /\.planet-title-row\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*10px;[\s\S]*?\.planet-title-row \.planet-navigation-marker\s*\{[\s\S]*?width:\s*var\(--planet-size\);[\s\S]*?height:\s*30\.13px;[\s\S]*?\.planet-title-row \.planet-navigation-marker > i\s*\{[\s\S]*?top:\s*auto;[\s\S]*?bottom:\s*4\.875px;[\s\S]*?left:\s*0;[\s\S]*?transform:\s*none;[\s\S]*?\.planet-title-row \.planet-navigation-marker\.ringed::before\s*\{[\s\S]*?content:\s*none;/u,
  );
  assert.doesNotMatch(
    styles,
    /\.planet-title-svg\s*\{[\s\S]*?(?:width|height):\s*69\.3(?:2)?px;/u,
  );
  assert.match(
    styles,
    /\.planet-introduction\s*\{[\s\S]*?padding:\s*0 8px 0 0;[\s\S]*?font-family:\s*var\(--shell-ui-font\);[\s\S]*?font-size:\s*1rem;[\s\S]*?line-height:\s*1\.4;/u,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-introduction\s*\{[\s\S]*?margin-top:\s*4px;[\s\S]*?padding:\s*0 29px 0 0;[\s\S]*?font-size:\s*1rem;[\s\S]*?text-wrap:\s*balance;/u,
  );
  assert.doesNotMatch(
    styles,
    /\.planet-introduction\s*\{[^}]*letter-spacing:\s*-/u,
  );
  assert.doesNotMatch(styles, /planet-learn-more/u);
  assert.match(
    styles,
    /\.planet-sidebar-search-card\s*\{[\s\S]*?display:\s*block;[\s\S]*?flex:\s*0 0 44px;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*44px;[\s\S]*?\.planet-sidebar-search\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*44px;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*11px 76px 13px 32px;[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*4px;[\s\S]*?background-color:\s*#151515;[\s\S]*?background-position:\s*10px calc\(50% - 1px\);[\s\S]*?font:\s*400 0\.9375rem\/20px var\(--shell-ui-font\);/u,
  );
  assert.doesNotMatch(styles, /\.planet-sidebar-search:focus-visible/u);
  assert.match(
    styles,
    /\.planet-sidebar-search:focus\s*\{\s*background-color:\s*#222;/u,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)\s*\{[\s\S]*?body\[data-object-shell\]\s*\{[\s\S]*?grid-template-rows:\s*67px minmax\(0, 1fr\);[\s\S]*?gap:\s*10px;[\s\S]*?padding:\s*10px;[\s\S]*?\.planet-sidebar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-self:\s*start;[\s\S]*?grid-row:\s*2;[\s\S]*?gap:\s*10px;[\s\S]*?max-height:\s*calc\(100dvh - 127px\);[\s\S]*?\.planet-topbar\s*\{[\s\S]*?position:\s*relative;[\s\S]*?display:\s*flex;[\s\S]*?grid-row:\s*1;[\s\S]*?gap:\s*16px;[\s\S]*?\.planet-header-rail\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*0 0 332px;[\s\S]*?\.planet-wordmark\s*\{[\s\S]*?display:\s*grid;[\s\S]*?flex:\s*0 0 156px;[\s\S]*?grid-template-rows:\s*40px 17px;[\s\S]*?height:\s*57px;[\s\S]*?\.planet-wordmark-version\s*\{[\s\S]*?top:\s*2px;[\s\S]*?display:\s*block;[\s\S]*?align-self:\s*start;[\s\S]*?color:\s*var\(--shell-text\);[\s\S]*?font:\s*14px\/1\.2 var\(--shell-ui-font\);[\s\S]*?opacity:\s*0\.53;[\s\S]*?\.planet-drawer-content\s*\{[\s\S]*?position:\s*relative;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?flex:\s*0 0 auto;[\s\S]*?gap:\s*10px;/u,
  );
  assert.doesNotMatch(styles, /border-top:\s*1px solid/u);
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?:is\([\s\S]*?\.planet-chart-panel[\s\S]*?\)::before\s*\{[\s\S]*?height:\s*2px;[\s\S]*?background:\s*rgb\(0 0 0 \/ 50%\);/u,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-information-panel\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*none;[\s\S]*?padding:\s*12px 12px 0 18px;[\s\S]*?overflow:\s*hidden;[\s\S]*?border-radius:\s*4px;[\s\S]*?background:\s*#151515;[\s\S]*?box-shadow:\s*none;/u,
  );
  assert.match(
    styles,
    /\.planet-header-actions\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*10px;[\s\S]*?right:\s*20px;[\s\S]*?\.planet-settings-action \.planet-action-marker\s*\{[\s\S]*?left:\s*6px;[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;[\s\S]*?background-size:\s*36px 36px;[\s\S]*?\.planet-header-action\.planet-settings-action span\s*\{[\s\S]*?top:\s*42px;[\s\S]*?\.planet-settings-marker\s*\{[\s\S]*?settings-marker@2x\.webp/u,
  );
  assert.doesNotMatch(styles, /content:\s*"⚙︎"/u);
  assert.match(
    shell,
    /id=\{`\$\{objectId\}-resources`\}[\s\S]*?id=\{`\$\{objectId\}-settings`\}[\s\S]*?class="planet-settings-panel planet-settings-flyout"[\s\S]*?class="planet-panel-summary"[\s\S]*?class="planet-panel-heading">\{settings\.title\.label\}[\s\S]*?class="planet-panel-icon planet-settings-gear"[\s\S]*?aria-hidden="true">⚙︎<\/span>[\s\S]*?class="planet-motion-setting"[\s\S]*?name="motion"[\s\S]*?class="planet-setting-text">Motion[\s\S]*?class="planet-setting-description"[\s\S]*?planet-setting-state-on[\s\S]*?planet-setting-state-off[\s\S]*?planet-setting-state-auto[\s\S]*?settings\.controls\.map/u,
  );
  assert.match(
    shell,
    /class="planet-sky-contrast-setting"[\s\S]*?name="skyContrast"[\s\S]*?class="planet-setting-text">High contrast[\s\S]*?planet-setting-state-on[\s\S]*?planet-setting-state-off/u,
  );
  assert.doesNotMatch(shell, /planet-settings-sidebar|planet-settings-close|class="planet-settings-panel"\s+open/u);
  assert.doesNotMatch(shell, /planet-setting-icon|planet-setting-copy/u);
  assert.match(
    client,
    /createSettingsController\([\s\S]*?\.planet-settings-panel[\s\S]*?\.planet-motion-setting[\s\S]*?HTMLDetailsElement[\s\S]*?motionOn = motionEnabled === true[\s\S]*?motion\.addEventListener\("change"[\s\S]*?onMotionChange\(motionOn\)/u,
  );
  assert.match(
    client,
    /\.planet-sky-contrast-setting[\s\S]*?highContrastSky = false[\s\S]*?body\.dataset\.skyContrast = highContrastSky[\s\S]*?"high"[\s\S]*?"standard"[\s\S]*?skyContrast\.addEventListener\("change"/u,
  );
  assert.match(
    styles,
    /\.planet-cubic-sky-face\s*\{[\s\S]*?background-image:\s*var\(--planet-cubic-sky-standard-image\);[\s\S]*?body\[data-sky-contrast="high"\] \.planet-cubic-sky-face\s*\{[\s\S]*?background-image:\s*var\(--planet-cubic-sky-high-contrast-image\);/u,
  );
  assert.match(
    client,
    /\.planet-settings-action[\s\S]*?HTMLButtonElement[\s\S]*?action\.addEventListener\("click"[\s\S]*?panel\.open = !panel\.open[\s\S]*?panel\.addEventListener\("toggle", renderPanel/u,
  );
  assert.doesNotMatch(client, /panel\.scrollIntoView/u);
  assert.doesNotMatch(client, /planet-settings-sidebar|planet-settings-close|settingsOpen/u);
  assert.match(
    styles,
    /\.planet-settings\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*2px;[\s\S]*?font:\s*400 13px\/1\.4 var\(--shell-ui-font\);[\s\S]*?\.planet-setting-control\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, max-content\) minmax\(8px, 1fr\) max-content;[\s\S]*?align-items:\s*baseline;[\s\S]*?gap:\s*8px;[\s\S]*?\.planet-setting-description\s*\{[\s\S]*?grid-column:\s*3;[\s\S]*?font:\s*13px\/1\.4 var\(--shell-ui-font\);[\s\S]*?\.planet-setting-control::before\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?border-bottom:\s*1px dotted rgb\(255 255 255 \/ 12%\);[\s\S]*?\.planet-settings-panel\s*\{[\s\S]*?display:\s*block;/u,
  );
  assert.doesNotMatch(styles, /planet-settings-close|planet-setting-control:first-child/u);
  assert.doesNotMatch(styles, /planet-settings-sidebar/u);
  assert.match(
    mapsStyles,
    /body\[data-object-shell\] \.planet-sidebar \.planet-settings-flyout:not\(\[open\]\)[\s\S]*?display:\s*none;[\s\S]*?body\[data-object-shell\] \.planet-sidebar \.planet-settings-flyout\[open\][\s\S]*?position:\s*fixed;[\s\S]*?top:\s*81px;[\s\S]*?right:\s*20px;[\s\S]*?width:\s*240px;[\s\S]*?padding:\s*15px 18px;[\s\S]*?background:\s*#151515;/u,
  );
  assert.match(
    mapsStyles,
    /\.planet-settings-flyout > \.planet-panel-summary\s*\{[\s\S]*?display:\s*none;[\s\S]*?\.planet-settings-flyout > \.planet-settings\s*\{[\s\S]*?gap:\s*0;[\s\S]*?margin-top:\s*0;[\s\S]*?font:\s*400 14px\/1\.3 var\(--shell-ui-font\);/u,
  );
  assert.match(
    styles,
    /\.planet-settings-gear\s*\{[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;[\s\S]*?font-family:\s*Arial, Helvetica, sans-serif;[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*400;/u,
  );
  assert.doesNotMatch(styles, /planet-download-marker|planet-share-marker/u);
  assert.match(
    styles,
    /\.planet-sidebar-toggle\s*\{[\s\S]*?margin-left:\s*auto;[\s\S]*?\.planet-header-action\.planet-sidebar-toggle span\s*\{[\s\S]*?right:\s*0;[\s\S]*?left:\s*auto;[\s\S]*?transform:\s*none;[\s\S]*?text-align:\s*right;[\s\S]*?\.planet-blackhole-marker\s*\{[\s\S]*?blackhole-marker@2x\.png[\s\S]*?\.planet-supernova-marker\s*\{[\s\S]*?display:\s*none;[\s\S]*?supernova-marker@2x\.png[\s\S]*?body\[data-sidebar-collapsed="true"\] \.planet-blackhole-marker\s*\{[\s\S]*?display:\s*none;[\s\S]*?body\[data-sidebar-collapsed="true"\] \.planet-supernova-marker\s*\{[\s\S]*?display:\s*block;[\s\S]*?body\[data-sidebar-collapsed="true"\] \.planet-sidebar\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*0;[\s\S]*?body\[data-sidebar-collapsed="true"\] :is\([\s\S]*?\.planet-information-panel[\s\S]*?\)\s*\{[\s\S]*?display:\s*none;/u,
  );
  assert.match(
    client,
    /createSidebarController\(documentTarget, windowTarget\)[\s\S]*?\.planet-sidebar-toggle[\s\S]*?body\.dataset\.sidebarCollapsed[\s\S]*?toggle\.ariaExpanded = String\(!next\)[\s\S]*?Expand information sidebar[\s\S]*?Collapse information sidebar/u,
  );
  assert.match(
    siteStyles,
    /@media \(min-width:\s*961px\) and \(orientation:\s*landscape\)[\s\S]*?body\[data-sidebar-collapsed="true"\] \.planet-stage > \.planet-render-root\s*\{[\s\S]*?translate:\s*0 0;/u,
  );
  assert.match(
    siteStyles,
    /\.planet-stage\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*0;/u,
  );
  assert.doesNotMatch(siteStyles, /data-settings-open/u);
});

test("switches the desktop sidebar to the one shared planet list", async () => {
  const [shell, results, client, styles, mapsStyles] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetObjectResults.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell-client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../maps-shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    shell,
    /class="planet-sidebar-search-card"[\s\S]*?class="planet-sidebar-search"[\s\S]*?Search objects[\s\S]*?class="planet-sidebar-view-all"[\s\S]*?aria-label="View all objects"[\s\S]*?>×<\/button>[\s\S]*?class="planet-object-browser maps-object-results"[\s\S]*?aria-label="Objects"[\s\S]*?hidden[\s\S]*?<PlanetObjectResults activeObjectId=\{objectId\} \/>/u,
  );
  assert.match(results, /PLANET_SEARCH_OBJECTS\.map\(\(object, index\)/u);
  assert.match(results, /aria-current=\{object\.id === activeObjectId \? "page" : undefined\}/u);
  assert.match(results, /<PlanetNavigationMarker[\s\S]*?planetId=\{object\.id\}/u);
  assert.doesNotMatch(shell, /OBJECTS\.map|planet-object-marker|planet-object-browser-title/u);
  assert.match(
    client,
    /createObjectBrowserController\([\s\S]*?\.planet-sidebar-search-card[\s\S]*?\.planet-sidebar-view-all[\s\S]*?\.planet-object-browser[\s\S]*?const selectedSearchValue = search\.value;[\s\S]*?if \(query\.length === 0\)[\s\S]*?item\.hidden = true;[\s\S]*?empty\.hidden = true;[\s\S]*?browser\.hidden = true;[\s\S]*?return;[\s\S]*?browser\.hidden = false;[\s\S]*?item\.dataset\.objectName[\s\S]*?if \(next && resetQuery\) search\.value = "";[\s\S]*?if \(!next\) search\.value = selectedSearchValue;[\s\S]*?trigger\.ariaLabel = next[\s\S]*?`Show \$\{selectedSearchValue\} information`[\s\S]*?trigger\.textContent = "×";[\s\S]*?trigger\.addEventListener\("click"[\s\S]*?render\(true, \{ resetQuery: true \}\)[\s\S]*?search\.addEventListener\("input"[\s\S]*?search\.addEventListener\("focus", \(\) => search\.select\(\)[\s\S]*?search\.addEventListener\("keydown"[\s\S]*?event\.key !== "Escape"[\s\S]*?documentTarget\.addEventListener\("pointerdown"[\s\S]*?searchCard\.contains\(event\.target\)[\s\S]*?search\.blur\(\)/u,
  );
  assert.match(styles, /\.planet-sidebar-view-all\s*\{[\s\S]*?right:\s*12px;[\s\S]*?height:\s*44px;[\s\S]*?font:\s*400 0\.8125rem\/20px var\(--shell-ui-font\);[\s\S]*?text-decoration:\s*none;/u);
  assert.doesNotMatch(styles, /\.planet-object-browser-title|\.planet-object-marker|\.planet-object-link\s*\{[\s\S]*?height:\s*40px;/u);
  assert.match(mapsStyles, /\.planet-sidebar \.maps-object-results\s*\{[\s\S]*?display:\s*block;[\s\S]*?padding:\s*6px 12px 6px 20px;[\s\S]*?background:\s*#151515;[\s\S]*?\.planet-sidebar \.maps-object-results \.planet-object-link\s*\{[\s\S]*?height:\s*34px;/u);
  assert.match(
    styles,
    /body\[data-sidebar-collapsed="true"\] :is\([\s\S]*?\.planet-sidebar-search-card,[\s\S]*?\.planet-information-panel,[\s\S]*?\.planet-object-browser[\s\S]*?\)\s*\{\s*display:\s*none;/u,
  );
});

test("keeps the navigation free of the former clock readout", async () => {
  const navigation = await readFile(
    new URL("../components/PlanetaryScale.astro", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(navigation, /planetary-time|data-current-part|scheduleTime/u);
});

test("renders a Google Maps-style desktop source footer without changing the mobile panel", async () => {
  const [shell, styles] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    shell,
    /\{hasResources && <details id=\{`\$\{objectId\}-resources`\} class="planet-resources-panel">[\s\S]*?PREPARED_SHELL_TITLES\.resources[\s\S]*?class="planet-resources-links">[\s\S]*?resources\.map\(\(resource\)[\s\S]*?class="planet-resource-row"[\s\S]*?class="planet-resource-description">\{resource\.description\}[\s\S]*?class="planet-resource-label">\{resource\.label\}[\s\S]*?<\/details>\}/u,
  );
  assert.match(
    shell,
    /\{hasResources && <footer[\s\S]*?class="planet-attribution-footer"[\s\S]*?resources\.map\(\(resource, index\)[\s\S]*?index > 0 && <span class="planet-attribution-separator" aria-hidden="true">·<\/span>[\s\S]*?class="planet-attribution-link"[\s\S]*?href=\{resource\.href\}[\s\S]*?title=\{resource\.description\}[\s\S]*?class="planet-attribution-role">\{resource\.role\}[\s\S]*?class="planet-attribution-source">\{resource\.label\}[\s\S]*?class="planet-attribution-separator" aria-hidden="true">·<\/span>[\s\S]*?class="planet-attribution-developed">[\s\S]*?Developed by[\s\S]*?>layoutit<\/a> with <a[\s\S]*?>PolyCSS<\/a>[\s\S]*?<\/footer>\}/u,
  );
  assert.doesNotMatch(shell, /middot| · |·\s*<\/footer>/u);
  assert.match(
    styles,
    /\.planet-attribution-footer\s*\{\s*display:\s*none;[\s\S]*?@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-resources-panel\s*\{\s*display:\s*none;[\s\S]*?\.planet-attribution-footer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?justify-content:\s*flex-end;[\s\S]*?gap:\s*2px 8px;[\s\S]*?max-width:\s*calc\(100vw - 358px\);[\s\S]*?padding:\s*0 8px 0 4px;[\s\S]*?background:\s*#000;[\s\S]*?font:\s*12px\/1\.4 var\(--shell-ui-font\);[\s\S]*?\.planet-attribution-link\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?gap:\s*3px;[\s\S]*?\.planet-attribution-source\s*\{[\s\S]*?text-decoration:\s*underline;[\s\S]*?\.planet-attribution-role\s*\{[\s\S]*?text-transform:\s*capitalize;[\s\S]*?\.planet-attribution-separator\s*\{[\s\S]*?color:\s*rgb\(255 255 255 \/ 38%\);/u,
  );
  assert.doesNotMatch(shell, /planet-attribution-credit|>Scene data</u);
});

function createFakeDocument() {
  const target = new EventTarget();
  target.hidden = false;
  target.documentElement = { dataset: {} };
  target.body = { classList: createFakeClassList() };
  return target;
}

function createFakeClassList() {
  const values = new Set();
  return {
    add(...tokens) {
      for (const token of tokens) values.add(token);
    },
    contains(token) {
      return values.has(token);
    },
    remove(...tokens) {
      for (const token of tokens) values.delete(token);
    },
  };
}
