import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { objectAdapter } from "../object-adapter.mjs";
import { OBJECTS } from "../objects.mjs";
import { requireSceneLifecycle } from "../scene-contract.mjs";
import { createSceneRouter } from "../scene-router.mjs";

test("keeps every implemented scene in one object registry", () => {
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
    const owned = planet.id === "mercury" || planet.id === "venus"
      ? [
        `../../src/planets/${planet.id}/SOURCE.md`,
        `../../src/planets/${planet.id}/NOTICE.md`,
        `../../src/planets/${planet.id}/object.json`,
        `../pages/${planet.id}.astro`,
      ]
      : [
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

test("renders source-backed charts in one canonical switcher with Reflectance first", async () => {
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
    if (id === "mercury" || id === "venus") {
      const content = JSON.parse(await readFile(
        new URL(`../../src/planets/${id}/prepared/content.json`, import.meta.url),
        "utf8",
      ));
      assert.deepEqual(content.charts.map(({ id: chartId }) => chartId), expectedChartIds, `${name} chart order`);
      continue;
    }
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
  assert.match(shell, /const defaultChart = orderedCharts\.find\(\(chart\) => chart\.id === "reflectance"\)/u);
  assert.match(shell, /class="planet-chart-switcher"[\s\S]*?data-active-chart=\{defaultChart\.id\}/u);
  assert.doesNotMatch(shell, /class="planet-chart-panel"|open=\{chart\.open\}|open=\{gallery\.open\}/u);

  const mercury = JSON.parse(await readFile(
    new URL("../../src/planets/mercury/prepared/content.json", import.meta.url),
    "utf8",
  ));
  assert.doesNotMatch(JSON.stringify(mercury.charts), /temperature-pressure|mercury-no-atmosphere-profile/u);
});

test("keeps the shared shell planet-neutral", async () => {
  const sharedFiles = await Promise.all([
    readFile(new URL("../layouts/PlanetLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/ExplorerRail.astro", import.meta.url), "utf8"),
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

test("keeps the desktop scene full-width behind the floating shell", async () => {
  const [styles, layoutStyles] = await Promise.all([
    readFile(new URL("../site.css", import.meta.url), "utf8"),
    readFile(new URL("../shell-layout.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    styles,
    /\.planet-stage > \.planet-render-root\s*\{[\s\S]*?transform-origin:\s*50% 50%;/u,
  );
  assert.doesNotMatch(styles, /translate:\s*175px/u);
  assert.match(layoutStyles, /\.planet-stage\s*\{[^}]*inset-inline-start:\s*0;/u);
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

test("keeps concise lens descriptions in the object model without secondary row copy", async () => {
  const [shell, { objectControls: saturnPanel }, { objectControls: saturnSource }] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    import("../../src/planets/saturn/site/control-content.mjs"),
    import("../../src/planets/saturn/site/control-content.source.mjs"),
  ]);
  assert.doesNotMatch(shell, /planet-lenses-introduction|Explore this object in new ways/u);
  assert.doesNotMatch(shell, /planet-lens-description|\{lens\.description\}<\/span>/u);
  const descriptions = Object.fromEntries(saturnPanel.lenses.controls.map(({ id, description }) => [id, description]));
  assert.deepEqual(descriptions, Object.fromEntries(saturnSource.lenses.controls.map(({ id, description }) => [id, description])));
  assert.equal(descriptions.normal, "Visible color");
  assert.equal(descriptions.ultraviolet, "Hubble at 225 nm");
  assert.equal(descriptions.thermal, "Cassini infrared");
});

test("places a scalable Surface Lens browser after the retained chart switcher", async () => {
  const [shell, client, styles, siteStyles] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell-client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../site.css", import.meta.url), "utf8"),
  ]);
  const factsheetIndex = shell.indexOf('class="planet-factsheet-section"');
  const chartsIndex = shell.indexOf('class="planet-chart-switcher"');
  const lensesIndex = shell.indexOf('class="planet-lenses"');
  assert.ok(factsheetIndex >= 0 && factsheetIndex < chartsIndex && chartsIndex < lensesIndex);
  assert.match(shell, /class="planet-chart-switcher-controls"[\s\S]*?data-chart-step="-1"[\s\S]*?data-chart-step="1"/u);
  assert.doesNotMatch(shell, /planet-chart-current-icon|planet-chart-icon|data-chart-icon/u);
  assert.match(shell, /orderedCharts\.map\(\(chart\) => \([\s\S]*?class="planet-chart-slide"[\s\S]*?hidden=\{chart\.id !== defaultChart\.id\}/u);
  assert.match(client, /createChartSwitcherController[\s\S]*?activeIndex = \(index \+ slides\.length\) % slides\.length/u);
  assert.match(client, /slide\.hidden = slide\.dataset\.chartId !== activeId/u);
  assert.match(shell, /class="planet-panel-summary planet-lens-browser-header"[\s\S]*?<h2 class="planet-panel-heading">\{lenses\.title\.label\}<\/h2>[\s\S]*?class="planet-lens-search"[\s\S]*?aria-label="Search surface lenses"[\s\S]*?class="planet-lens-search-icon"><SearchIcon \/>/u);
  assert.doesNotMatch(shell, /planet-lens-count|data-lens-count/u);
  assert.doesNotMatch(shell, /data-panel-icon="lenses"|PREPARED_SHELL_ICONS\.lenses\.src/u);
  assert.match(
    styles,
    /\.planet-information-panel > :is\([\s\S]*?\.planet-lenses,[\s\S]*?\):has\(~ :is\([\s\S]*?\.planet-lenses,[\s\S]*?\)\)\s*\{[^}]*border-bottom:\s*1px solid rgb\(0 0 0 \/ 50%\);/u,
  );
  assert.match(styles, /\.planet-observation-controls\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*0;[\s\S]*?max-height:\s*202px;[\s\S]*?overflow-y:\s*auto;[\s\S]*?scrollbar-width:\s*thin;/u);
  assert.match(styles, /\.planet-observation-control\s*\{[\s\S]*?grid-template-columns:\s*18px minmax\(0, 1fr\);[\s\S]*?width:\s*100%;[\s\S]*?height:\s*30px;/u);
  assert.match(siteStyles, /--shell-text:\s*#dfdfdf;[\s\S]*?--shell-text-secondary:\s*#b8bbc4;[\s\S]*?--shell-text-muted:\s*#7f8187;/u);
  const layoutStyles = await readFile(new URL("../shell-layout.css", import.meta.url), "utf8");
  assert.match(layoutStyles, /\.planet-sidebar\s*\{[^}]*--shell-text-secondary:\s*#a9acb5;/u);
  assert.match(styles, /\.planet-observation-control\s*\{[\s\S]*?opacity:\s*0\.62;[\s\S]*?transition:\s*opacity 120ms ease;/u);
  assert.match(styles, /\.planet-observation-control\[aria-pressed="true"\]\s*\{[\s\S]*?opacity:\s*1;/u);
  assert.doesNotMatch(styles, /rgb\(255 255 255 \/ 75%\)/u);
  assert.doesNotMatch(styles, /rgb\(255 255 255 \/ 45%\)/u);
  assert.match(styles, /\.planet-lens-icon\s*\{[\s\S]*?width:\s*18px;[\s\S]*?height:\s*18px;/u);
  assert.match(styles, /\.planet-lens-label\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?font:\s*400 0\.9375rem\/20px var\(--shell-ui-font\);/u);
  assert.match(shell, /class="planet-lens-icon"[^>]*width="18" height="18"/u);
  assert.doesNotMatch(styles, /planet-lens-copy|planet-lens-description/u);
  assert.match(styles, /\.planet-lens-search\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?text-align:\s*right;/u);
  assert.match(styles, /\.planet-lens-search-icon \.search-icon\s*\{[\s\S]*?width:\s*100%;[\s\S]*?stroke:\s*currentColor;/u);
  assert.match(shell, /lenses\.controls\.map\(\(lens\)[\s\S]*?class="planet-observation-option" data-lens-option[\s\S]*?aria-pressed=\{lens\.id === lenses\.defaultLens[\s\S]*?<\/nav>[\s\S]*?<\/details>\}/u);
  assert.match(shell, /aria-expanded=\{lens\.legend[\s\S]*?aria-controls=\{lens\.legend \? `\$\{objectId\}-\$\{lens\.id\}-legend` : undefined\}/u);
  assert.match(shell, /lenses\.controls\.map\(\(lens\) => \([\s\S]*?class="planet-observation-option"[\s\S]*?class="planet-observation-control"[\s\S]*?lens\.legend && <section[\s\S]*?class="planet-lens-legend-panel"[\s\S]*?data-lens-legend=\{lens\.id\}[\s\S]*?lens\.legend\.kind === "scale"[\s\S]*?class="planet-lens-legend-scale-row"[\s\S]*?class="planet-lens-legend-labels"[\s\S]*?lens\.legend\.kind === "categories"[\s\S]*?class="planet-lens-legend-categories"[\s\S]*?class="planet-lens-legend-swatch"/u);
  assert.match(styles, /\.planet-lens-legend-panel\s*\{[\s\S]*?width:\s*100%;[\s\S]*?padding:\s*2px 0 8px;[\s\S]*?background:\s*transparent;/u);
  assert.match(styles, /\.planet-lens-legend-scale-row\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?height:\s*24px;/u);
  assert.match(shell, /lens\.legend\.src \|\| lens\.legend\.colors[\s\S]*?class="planet-lens-legend-scale planet-lens-legend-segments"[\s\S]*?lens\.legend\.colors\?\.map/u);
  assert.match(styles, /\.planet-lens-legend-segments\s*\{[\s\S]*?display:\s*flex;[\s\S]*?overflow:\s*hidden;/u);
  assert.match(styles, /\.planet-lens-legend-segment\s*\{[\s\S]*?background:\s*var\(--planet-lens-legend-color\);/u);
  assert.match(styles, /\.planet-lens-legend-categories li\s*\{[\s\S]*?grid-template-columns:\s*8px max-content minmax\(8px, 1fr\) max-content;[\s\S]*?height:\s*24px;/u);
  assert.match(client, /const legends = \[\.\.\.root\.querySelectorAll\("\[data-lens-legend\]"\)\][\s\S]*?const renderLegend = \(\) => \{[\s\S]*?legend\.hidden = !expanded;[\s\S]*?button\.ariaExpanded = String\(expanded\);[\s\S]*?new windowTarget\.MutationObserver\(renderLegend\)/u);
  assert.match(client, /createLensBrowserController\(drawer, windowTarget, lifetime\)[\s\S]*?empty\.hidden = visible !== 0/u);
  assert.match(client, /search\.addEventListener\("click", \(event\) => \{[\s\S]*?event\.stopPropagation\(\)/u);
  assert.match(client, /button\.addEventListener\("click", \(event\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?render\(activeIndex/u);
  assert.match(layoutStyles, /\.planet-sidebar\s*\{[^}]*overflow:\s*hidden auto;/u);
  assert.doesNotMatch(client, /createLayersController|layersOpen/u);
});

test("keeps the introduction below the title and previews four facts in a collapsed-by-default panel", async () => {
  const [shell, styles] = await Promise.all([
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    shell,
    /class="planet-selected-panel"[\s\S]*?class="planet-title"[\s\S]*?class="planet-introduction"[\s\S]*?<\/section>\s*<details[\s\S]*?id=\{`\$\{objectId\}-factsheet-panel`\}[\s\S]*?class="planet-factsheet-section"[\s\S]*?<summary class="planet-factsheet-header planet-panel-summary">[\s\S]*?>Factsheet<\/h2>[\s\S]*?class="planet-panel-icon"[\s\S]*?data-panel-icon="facts"[\s\S]*?PREPARED_SHELL_ICONS\.facts\.src[\s\S]*?<\/summary>\s*\{hasFacts && <div class="planet-factsheet-body">[\s\S]*?class="planet-facts"[\s\S]*?class="planet-primary-facts"[\s\S]*?initialFacts\.map\(\(fact\)[\s\S]*?class="planet-facts-overflow"[\s\S]*?View more[\s\S]*?class="planet-additional-facts"[\s\S]*?remainingFacts\.map\(\(fact\)[\s\S]*?<\/div>\}\s*<\/details>/u,
  );
  assert.doesNotMatch(shell, /class="planet-factsheet-section"[^>]*\sopen/u);
  assert.match(shell, /const factsheetPreviewCount = 4;/u);
  assert.match(shell, /const initialFacts = allFacts\.slice\(0, factsheetPreviewCount\);/u);
  assert.match(shell, /const remainingFacts = allFacts\.slice\(factsheetPreviewCount\);/u);
  assert.match(shell, /class="planet-facts-toggle"[\s\S]*?View more[\s\S]*?View less/u);
  assert.doesNotMatch(shell, /planet-learn-more|learnMoreUrl|Learn more/u);
  assert.doesNotMatch(shell, /PREPARED_SHELL_TITLES\.facts/u);
  assert.match(shell, /PREPARED_SHELL_ICONS\.facts/u);
  assert.doesNotMatch(shell, /planet-information-cross|Close .* information/u);
  assert.doesNotMatch(styles, /planet-information-cross/u);
  assert.match(shell, /import \{ orderFacts \} from "\.\.\/fact-order\.mjs";/u);
  assert.match(shell, /const allFacts = orderFacts\(facts, moreFacts\);/u);
  assert.match(
    shell,
    /initialFacts\.map\(\(fact\) => \([\s\S]*?<li data-fact-id=\{fact\.id\}>[\s\S]*?remainingFacts\.map\(\(fact\) => \([\s\S]*?<li data-fact-id=\{fact\.id\}>/u,
  );
  assert.match(styles, /\.planet-facts-overflow\[open\] > \.planet-additional-facts\s*\{[^}]*grid-row:\s*1;/u);
  assert.match(styles, /\.planet-facts-overflow\[open\] > \.planet-facts-toggle\s*\{[^}]*grid-row:\s*2;/u);
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
    "facts",
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
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-panel-icon\s*\{[\s\S]*?flex-basis:\s*16px;[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/u,
  );
  assert.match(shell, /class="planet-chart-label"[\s\S]*?data-chart-label=\{chart\.id\}[\s\S]*?\{chart\.title\.label\}/u);
  assert.match(shell, /<h2 class="planet-panel-heading">\{lenses\.title\.label\}<\/h2>/u);
  assert.match(
    shell,
    /class="planet-panel-heading">\{PREPARED_SHELL_TITLES\.resources\.label\}<\/h2>[\s\S]*?class="planet-panel-icon"[\s\S]*?data-panel-icon="resources"[\s\S]*?PREPARED_SHELL_ICONS\.resources\.src/u,
  );
  assert.doesNotMatch(shell, /class="planet-panel-title"|title-(?:factsheet|reflectance-spectrum|thermal-profile|surface-lens|sources-resources)\.svg/u);
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-panel-heading\s*\{[\s\S]*?font:\s*400 0\.8125rem\/18px var\(--shell-ui-font\);[\s\S]*?text-transform:\s*uppercase;[\s\S]*?transform:\s*translateY\(1\.5px\);/u,
  );
  assert.match(
    styles,
    /\.planet-facts\s*\{[\s\S]*?margin:\s*8px 0 0;[\s\S]*?font-family:\s*var\(--shell-ui-font\);[\s\S]*?font-size:\s*0\.875rem;[\s\S]*?line-height:\s*20px;[\s\S]*?@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-facts li\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, max-content\) minmax\(8px, 1fr\) max-content;[\s\S]*?align-items:\s*baseline;[\s\S]*?gap:\s*8px;[\s\S]*?\.planet-facts li::before\s*\{[\s\S]*?border-bottom:\s*1px dotted rgb\(255 255 255 \/ 12%\);[\s\S]*?\.planet-fact-label\s*\{[\s\S]*?color:\s*var\(--shell-text-muted\);[\s\S]*?opacity:\s*1;[\s\S]*?\.planet-fact-value\s*\{[\s\S]*?grid-column:\s*3;[\s\S]*?font:\s*inherit;/u,
  );
  for (const className of ["planet-chart", "planet-gallery", "planet-settings"]) {
    assert.match(styles, new RegExp(`\\.${className}\\s*\\{[^}]*margin:\\s*8px 0 0;`, "u"));
  }
  assert.doesNotMatch(styles, /planet-factsheet-icon|Apple Symbols|Segoe UI Symbol/u);
  assert.doesNotMatch(styles, /planet-factsheet-(?:disclosure|summary|show|hide|content)/u);
  assert.match(styles, /\.planet-factsheet-section\s*\{[\s\S]*?margin-top:\s*0;[\s\S]*?padding-bottom:\s*0;[\s\S]*?\.planet-factsheet-section\[open\]\s*\{[\s\S]*?padding-bottom:\s*16px;/u);
  assert.match(styles, /\.planet-information-panel > \.planet-factsheet-section\s*\{[^}]*padding-block-start:\s*0;/u);
  assert.doesNotMatch(styles, /\.planet-factsheet-section::before/u);
  assert.match(styles, /\.planet-factsheet-section > \.planet-factsheet-header\s*\{[^}]*align-items:\s*center;[^}]*height:\s*45px;[^}]*min-height:\s*45px;[^}]*padding:\s*0;/u);
  assert.doesNotMatch(styles, /\.planet-factsheet-body > \.planet-introduction/u);
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
  assert.match(client, /addEventListener\("chartchange", schedule/u);
});

test("keeps the shared sidebar content and controls intact", async () => {
  const [layout, header, wordmark, shell, navigation, client, styles, siteStyles, navigationStyles, mapsStyles] = await Promise.all([
    readFile(new URL("../layouts/PlanetLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/ExplorerRail.astro", import.meta.url), "utf8"),
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
    /class="explorer-shell-wordmark"[\s\S]*?<CssEarthWordmark \/>[\s\S]*?<ExplorerRail objectId=\{objectRecord\.id\} \/>[\s\S]*?<PlanetaryScale activeObjectId=\{objectRecord\.id\} \/>[\s\S]*?<slot name="planet-ui" \/>/u,
  );
  assert.match(layout, /import CssEarthWordmark from "\.\.\/components\/CssEarthWordmark\.astro";/u);
  assert.match(layout, /import PlanetaryScale from "\.\.\/components\/PlanetaryScale\.astro";/u);
  assert.doesNotMatch(shell, /PlanetHeader|planet-topbar|planet-wordmark|planet-actions/u);
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
  assert.doesNotMatch(shell, /PlanetNavigationMarker|activePlanetIndex/u);
  assert.match(
    shell,
    /class="planet-title-row">\s*<h1 class="planet-title"[\s\S]*?<\/h1>[\s\S]*?class="planet-system-tag planet-title-tag"[\s\S]*?>\{activeObject\.systemName\}<\/button>[\s\S]*?class="planet-classification-tag planet-title-tag"[\s\S]*?>\{classificationLabel\}<\/button>[\s\S]*?<\/div>/u,
  );
  assert.match(shell, /import \{ PLANET_SEARCH_OBJECTS, objectClassificationLabel \} from "\.\.\/planet-search-objects\.mjs";/u);
  assert.match(
    shell,
    /const planetCount = PLANET_SEARCH_OBJECTS\.length;/u,
  );
  assert.match(
    shell,
    /placeholder=\{destinations\?\.searchLabel \?\? `Search objects \(\$\{planetCount\}\)`\}/u,
  );
  assert.doesNotMatch(header, /planetary-search-desktop|Search objects/u);
  assert.doesNotMatch(wordmark, /__CSSEARTH_VERSION__|versionLabel|planet-wordmark-version/u);
  assert.doesNotMatch(wordmark, /planet-wordmark-tagline|Explore the cosmos/u);
  assert.doesNotMatch(header, /Explore the cosmos|planet-github|planet-motion-action|planet-shadows-action/u);
  assert.doesNotMatch(header, /planet-actions/u);
  assert.doesNotMatch(header, />GitHub<|Download|Share|planet-download|planet-share|navigator\.share|navigator\.clipboard/u);
  assert.doesNotMatch(
    navigation,
    /planetary-search-mobile|scale-sun-marker/u,
  );
  assert.doesNotMatch(navigation, /requireObject\("sun"\)|scale-sun|href=\{sun\.route\}/u);
  assert.doesNotMatch(navigationStyles, /planetary-search-desktop/u);
  assert.match(navigationStyles, /\.scale-stops\s*\{[^}]*position:\s*relative;[^}]*height:\s*64px;/u);
  assert.match(navigationStyles, /\.scale-planet\s*\{[^}]*left:\s*var\(--planet-offset\);/u);
  assert.doesNotMatch(navigationStyles, /\.scale-sun|sun-marker(?:@2x)?\.webp/u);
  assert.match(navigationStyles, /\.scale-label\s*\{[^}]*opacity:\s*\.72;[^}]*white-space:\s*nowrap;/u);
  assert.match(navigationStyles, /\.scale-stop\[aria-current="page"\] \.scale-label\s*\{[^}]*opacity:\s*1;/u);
  assert.match(
    styles,
    /\.planet-information-panel\s*\{[\s\S]*?padding:\s*12px 0;[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*8px;[\s\S]*?background:\s*var\(--explorer-panel-background\);/u,
  );
  assert.match(
    styles,
    /\.planet-title\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?height:\s*30\.13px;/u,
  );
  assert.match(
    styles,
    /\.planet-title-row\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*min-height:\s*30\.13px;/u,
  );
  assert.doesNotMatch(styles, /\.planet-title-row \.planet-navigation-marker/u);
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
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-introduction\s*\{[\s\S]*?margin-top:\s*8px;[\s\S]*?padding:\s*0 29px 0 0;[\s\S]*?font-size:\s*1rem;[\s\S]*?text-wrap:\s*balance;/u,
  );
  assert.doesNotMatch(
    styles,
    /\.planet-introduction\s*\{[^}]*letter-spacing:\s*-/u,
  );
  assert.doesNotMatch(styles, /planet-learn-more/u);
  assert.match(
    mapsStyles,
    /\.planet-sidebar-search-card\s*\{[^}]*height:\s*var\(--explorer-search-height\);/u,
  );
  assert.match(shell, /class="planet-sidebar-search-icon"[\s\S]*?<SearchIcon \/>[\s\S]*?class="planet-sidebar-search"/u);
  assert.match(
    mapsStyles,
    /\.planet-sidebar-search\s*\{[^}]*padding:\s*12px 52px 12px 48px;[^}]*box-shadow:\s*none;/u,
  );
  assert.doesNotMatch(styles, /\.planet-sidebar-search:focus-visible/u);
  assert.match(
    mapsStyles,
    /\.planet-sidebar-search:focus-visible\s*\{[^}]*outline:\s*0;[^}]*box-shadow:\s*inset 0 0 0 1px rgb\(181 216 250 \/ 55%\);/u,
  );
  assert.match(
    styles,
    /\.planet-panel-summary:focus-visible\s*\{[^}]*outline:\s*0;/u,
  );
  assert.match(styles, /\.planet-drawer-content\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/u);
  assert.doesNotMatch(styles, /border-top:\s*1px solid/u);
  assert.match(
    styles,
    /\.planet-information-panel > :is\([\s\S]*?\.planet-chart-switcher[\s\S]*?\):has\(~ :is\([\s\S]*?\.planet-chart-switcher[\s\S]*?\)\)\s*\{[^}]*border-bottom:\s*1px solid rgb\(0 0 0 \/ 50%\);/u,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*821px\) and \(orientation:\s*landscape\)[\s\S]*?\.planet-information-panel\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*none;[\s\S]*?padding:\s*12px 0 0;[\s\S]*?overflow:\s*hidden;[\s\S]*?border-radius:\s*8px;[\s\S]*?background:\s*var\(--explorer-panel-background\);[\s\S]*?box-shadow:\s*none;/u,
  );
  assert.doesNotMatch(styles, /planet-header-actions|planet-settings-marker/u);
  assert.doesNotMatch(styles, /content:\s*"⚙︎"/u);
  assert.match(
    shell,
    /id=\{`\$\{objectId\}-resources`\}[\s\S]*?<section[\s\S]*?id=\{`\$\{objectId\}-settings`\}[\s\S]*?class="planet-settings-panel explorer-settings-panel"[\s\S]*?hidden[\s\S]*?<h2[^>]*>\{PREPARED_SHELL_TITLES\.settings\.label\}[\s\S]*?class="planet-motion-setting"[\s\S]*?name="motion"[\s\S]*?class="planet-setting-text">Motion[\s\S]*?class="planet-setting-switch" aria-hidden="true"[\s\S]*?remainingSettings\.map[\s\S]*?<\/section>[\s\S]*?<\/aside>/u,
  );
  assert.match(shell, /planet-motion-setting-control[\s\S]*?planet-speed-setting-control[\s\S]*?class="planet-speed-setting"[\s\S]*?type="range"[\s\S]*?name=\{speedSetting\.name\}[\s\S]*?min="0"[\s\S]*?max="4"[\s\S]*?step="1"[\s\S]*?disabled[\s\S]*?shadowSetting[\s\S]*?planet-sky-contrast-setting-control/u);
  assert.doesNotMatch(shell, /planet-speed-value/u);
  assert.match(
    shell,
    /class="planet-sky-contrast-setting"[\s\S]*?name="skyContrast"[\s\S]*?class="planet-setting-text">High contrast[\s\S]*?class="planet-setting-switch" aria-hidden="true"/u,
  );
  assert.doesNotMatch(shell, /planet-setting-description|planet-setting-state-(?:on|off|auto)/u);
  assert.doesNotMatch(shell, /planet-settings-sidebar|planet-settings-close|class="planet-settings-panel"\s+open/u);
  assert.doesNotMatch(shell, /planet-setting-icon|planet-setting-copy/u);
  assert.doesNotMatch(shell, /planet-camera-settings|planet-camera-coordinates|planet-camera-copy|>Camera<\/h3>/u);
  assert.match(
    client,
    /createSettingsController\([\s\S]*?\.planet-motion-setting[\s\S]*?\.planet-speed-setting\[type="range"\]\[name="speed"\][\s\S]*?HTMLInputElement[\s\S]*?motionOn = motionEnabled === true[\s\S]*?speed\.disabled = !motionOn[\s\S]*?motion\.addEventListener\("change"[\s\S]*?onMotionChange\(motionOn\)/u,
  );
  assert.match(
    client,
    /\.planet-sky-contrast-setting[\s\S]*?highContrastSky = false[\s\S]*?body\.dataset\.skyContrast = highContrastSky[\s\S]*?"high"[\s\S]*?"standard"[\s\S]*?skyContrast\.addEventListener\("change"/u,
  );
  assert.match(
    styles,
    /\.planet-cubic-sky-face\s*\{[\s\S]*?background-image:\s*var\(--planet-cubic-sky-standard-image\);[\s\S]*?body\[data-sky-contrast="high"\] \.planet-cubic-sky-face\s*\{[\s\S]*?background-image:\s*var\(--planet-cubic-sky-high-contrast-image\);/u,
  );
  assert.doesNotMatch(client, /\.planet-settings-action|renderPanel/u);
  assert.doesNotMatch(client, /panel\.scrollIntoView/u);
  assert.doesNotMatch(client, /planet-settings-sidebar|planet-settings-close|settingsOpen/u);
  assert.match(
    styles,
    /\.planet-settings\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*2px;[\s\S]*?font:\s*400 13px\/1\.4 var\(--shell-ui-font\);[\s\S]*?\.planet-setting-control\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, max-content\) minmax\(8px, 1fr\) max-content;[\s\S]*?align-items:\s*baseline;[\s\S]*?gap:\s*8px;[\s\S]*?\.planet-setting-control::before\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?border-bottom:\s*1px dotted rgb\(255 255 255 \/ 12%\);[\s\S]*?\.planet-settings-panel\s*\{[\s\S]*?display:\s*block;/u,
  );
  assert.doesNotMatch(styles, /planet-settings-close|planet-setting-control:first-child/u);
  assert.doesNotMatch(styles, /planet-settings-sidebar/u);
  assert.doesNotMatch(mapsStyles, /planet-settings-flyout/u);
  assert.doesNotMatch(styles, /planet-settings-gear/u);
  assert.doesNotMatch(styles, /planet-download-marker|planet-share-marker/u);
  assert.doesNotMatch(styles + client + siteStyles, /planet-sidebar-toggle|data-sidebar-collapsed/u);
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
    /class="planet-sidebar-search-card"[\s\S]*?class="planet-sidebar-search-icon"[\s\S]*?<SearchIcon \/>[\s\S]*?class="planet-sidebar-search"[\s\S]*?class="planet-sidebar-view-all"[\s\S]*?aria-label="View all objects"[\s\S]*?>×<\/button>[\s\S]*?<\/div>[\s\S]*?class="planet-drawer-content"[\s\S]*?class="planet-object-browser maps-object-results"[\s\S]*?hidden[\s\S]*?<PlanetObjectResults activeObjectId=\{objectId\} \/>[\s\S]*?class="planet-information-panel"/u,
  );
  assert.doesNotMatch(shell, /planet-sidebar-search-submit/u);
  assert.doesNotMatch(shell, /CssEarthWordmark|planet-sidebar-wordmark/u);
  assert.match(results, /PLANET_SEARCH_OBJECTS\.map\(\(object\)/u);
  assert.match(results, /aria-current=\{object\.id === activeObjectId \? "page" : undefined\}/u);
  assert.match(results, /<PlanetNavigationMarker[\s\S]*?planetId=\{object\.id\}/u);
  assert.doesNotMatch(shell, /OBJECTS\.map|planet-object-marker|planet-object-browser-title/u);
  assert.match(
    client,
    /createObjectBrowserController\([\s\S]*?\.planet-sidebar-search-card[\s\S]*?\.planet-sidebar-view-all[\s\S]*?\.planet-object-browser[\s\S]*?let selectedSearchValue = search\.value;[\s\S]*?if \(query\.length === 0\)[\s\S]*?item\.hidden = true;[\s\S]*?empty\.hidden = true;[\s\S]*?browser\.hidden = true;[\s\S]*?return;[\s\S]*?browser\.hidden = false;[\s\S]*?item\.dataset\.objectName[\s\S]*?if \(next && resetQuery\) search\.value = "";[\s\S]*?if \(!next\) search\.value = currentSearchValue;[\s\S]*?trigger\.ariaLabel = next[\s\S]*?`Show \$\{selectedSearchValue\} information`[\s\S]*?trigger\.textContent = "×";[\s\S]*?trigger\.addEventListener\("click"[\s\S]*?render\(true, \{ resetQuery: true \}\)[\s\S]*?search\.addEventListener\("input"[\s\S]*?search\.addEventListener\("focus", \(\) => search\.select\(\)[\s\S]*?search\.addEventListener\("keydown"[\s\S]*?event\.key !== "Escape"[\s\S]*?documentTarget\.addEventListener\("pointerdown"[\s\S]*?searchCard\.contains\(event\.target\)[\s\S]*?search\.blur\(\)/u,
  );
  assert.match(mapsStyles, /\.planet-sidebar-view-all\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/u);
  assert.doesNotMatch(mapsStyles, /planet-sidebar-search-submit/u);
  assert.doesNotMatch(styles, /\.planet-object-browser-title|\.planet-object-marker|\.planet-object-link\s*\{[\s\S]*?height:\s*40px;/u);
  assert.match(mapsStyles, /\.planet-sidebar \.maps-object-results\s*\{[\s\S]*?display:\s*block;[\s\S]*?padding:\s*6px 12px 6px var\(--explorer-card-padding-left, 20px\);[\s\S]*?background:\s*var\(--explorer-panel-background\);[\s\S]*?\.planet-sidebar \.maps-object-results \.planet-object-link\s*\{[\s\S]*?height:\s*34px;/u);
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
    /\{hasResources && <footer[\s\S]*?class="planet-attribution-footer"[\s\S]*?resources\.map\(\(resource, index\)[\s\S]*?index > 0 && <span class="planet-attribution-separator" aria-hidden="true">·<\/span>[\s\S]*?class="planet-attribution-link"[\s\S]*?href=\{resource\.href\}[\s\S]*?title=\{resource\.description\}[\s\S]*?class="planet-attribution-role">\{resource\.role\}[\s\S]*?class="planet-attribution-source">\{resource\.label\}[\s\S]*?<\/footer>\}/u,
  );
  assert.doesNotMatch(shell, /middot| · |·\s*<\/footer>/u);
  const footer = shell.match(/\{hasResources && <footer[\s\S]*?<\/footer>\}/u)?.[0];
  assert.ok(footer);
  assert.doesNotMatch(footer, /planet-attribution-developed|Developed by|github\.com\/layoutit|LayoutitStudio\/polycss/u);
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
