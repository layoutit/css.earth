import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { objectAdapter } from "../object-adapter.mts";
import { loadObjectContent } from "./load-object-content.mts";
import { OBJECTS } from "../objects.mts";
import { requireSceneLifecycle } from "../scene-contract.mts";
import { createSceneRouter } from "../scene-router.mts";
import { validateObjectPackageFiles } from "../../tools/object-package-contract.mts";

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
    selectedObjectId: "future",
    overview: false,
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
      selectedObjectId: "future",
      overview: false,
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
    await validateObjectPackageFiles(planet);
    await access(new URL(`../../src/planets/${planet.id}/prepared/object.json`, import.meta.url));
  }
});

test("keeps source-backed chart data in canonical order with Reflectance first", async () => {
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
    const { prepared: content } = await loadObjectContent(id);
    assert.deepEqual(content.charts.map(({ id: chartId }) => chartId),
      expectedChartIds, name + " chart order");
  }

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
    readFile(new URL("../components/PlanetInformationPanel.astro", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell-client.mts", import.meta.url), "utf8"),
    readFile(new URL("../planet-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../scene-router.mts", import.meta.url), "utf8"),
    readFile(new URL("../site.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(
    sharedFiles.join("\n"),
    /(?:css)?saturn|(?:css)?mars|(?:css)?venus|\/scenes\/(?:saturn|mars|venus)\//iu,
  );
});

test("keeps lens descriptions source-bound in the object model", async () => {
  const saturn = await loadObjectContent("saturn");
  const saturnPanel = saturn.object.data.controls;
  const saturnSource = await saturn.source("content");
  const descriptions = Object.fromEntries(saturnPanel.lenses.controls.map(({ id, description }) => [id, description]));
  assert.deepEqual(descriptions, Object.fromEntries(saturnSource.lenses.controls.map(({ id, description }) => [id, description])));
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
