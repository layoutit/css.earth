import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { objectAdapter } from "../object-adapter.mts";
import { loadObjectContent } from "./load-object-content.mts";
import { SCENE_OBJECTS } from "../objects.mts";
import { parsePreparedText } from "../object-text.mts";
import { requireSceneLifecycle } from "../scene-contract.mts";
import type { RouterOptions } from '../scene-router.mts';
import type { ShellOptions } from '../planet-shell-client.mts';
import type { BrowserWindow } from '../browser-types.mts';
import { required } from './navigation-test-values.mts';
import { requireArray, requireRecord, requireString } from '../../tools/sources/source-values.mts';
import { createSceneRouter } from "../scene-router.mts";
import { validateObjectPackageFiles } from "../../tools/contract/object-package-contract.mts";

test("keeps every implemented scene in one object registry", () => {
  assert.deepEqual(
    objectAdapter.routes(),
    SCENE_OBJECTS.map(({ route }) => route),
  );
});

test("loads every object through the single adapter", async () => {
  for (const objectRecord of SCENE_OBJECTS) {
    assert.equal(typeof await objectAdapter.load(objectRecord.id), "function");
  }
  await assert.rejects(
    objectAdapter.load("future"),
    /Unknown cssEarth object: future/,
  );
  await assert.rejects(
    Reflect.apply(objectAdapter.load, objectAdapter, ["future", undefined, [{ id: "future", loadScene: async () => null }]]),
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
  const mounts: { destroy: number; pause: number; resume: number }[] = [];
  const shellMounts: { destroy: number }[] = [];
  let setMotion: ShellOptions["onMotionChange"];
  const router = createMinimalRouter({
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

  required(setMotion)(true);
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
    const router = createMinimalRouter({
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
    const router = createMinimalRouter({
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
  let releaseAdapter: (() => void) | undefined;
  const adapterPending = new Promise<void>((resolve) => { releaseAdapter = resolve; });
  const router = createMinimalRouter({
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
  required(releaseAdapter)();
  await router.settled;
  assert.equal(calls.shellDestroy, 1);
  assert.equal(calls.mount, 0);
  assert.equal(router.state().lifecycle, "destroyed");
  assert.equal("ready" in documentTarget.documentElement.dataset, false);
});

test("keeps implemented routes backed by object-owned files", async () => {
  for (const planet of SCENE_OBJECTS) {
    await validateObjectPackageFiles(planet);
    await access(new URL(`../../src/objects/${planet.id}/prepared/object.json`, import.meta.url));
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
  ] as const;

  for (const [id, name, expectedChartIds] of panels) {
    const { prepared: content } = await loadObjectContent(id);
    assert.deepEqual(requireArray(content.charts, 'prepared charts').map(chart => requireString(requireRecord(chart, 'chart').id, 'chart id')),
      expectedChartIds, name + " chart order");
  }

  const mercury = requireRecord(JSON.parse(await readFile(
    new URL("../../src/objects/mercury/prepared/content.json", import.meta.url),
    "utf8",
  )), "Mercury content");
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

test("publishes dataset text beside the controls, never inside the object model", async () => {
  const saturn = await loadObjectContent("saturn");
  const controls = requireRecord(requireRecord(saturn.object.data, 'Saturn prepared body').controls, 'Saturn controls');
  const lenses = requireArray(requireRecord(controls.lenses, 'Saturn lenses').controls, 'Saturn lens controls').map(value => requireRecord(value, 'lens'));
  assert.ok(lenses.every(lens => ['title', 'detail', 'summary', 'description'].every(key => !Object.hasOwn(lens, key))));
  const text = parsePreparedText(JSON.parse(await readFile(new URL("../../src/objects/saturn/prepared/text.json", import.meta.url), "utf8")), "saturn");
  assert.deepEqual(Object.keys(text.datasets), lenses.map(lens => requireString(lens.id, 'lens id')));
});

function createFakeDocument() {
  const dataset: Record<string, string> = {};
  return Object.assign(new EventTarget(), { hidden: false, querySelector: (_selector: string) => null, documentElement: { dataset },
    body: { classList: createFakeClassList() } });
}

function createFakeClassList() {
  const values = new Set<string>();
  return {
    add(...tokens: string[]) {
      for (const token of tokens) values.add(token);
    },
    contains(token: string) {
      return values.has(token);
    },
    remove(...tokens: string[]) {
      for (const token of tokens) values.delete(token);
    },
  };
}

type MinimalRouterOptions = Omit<RouterOptions, 'stage' | 'documentTarget' | 'windowTarget' | 'mountShell' | 'loadObject'> & {
  stage: { ariaBusy: string }; documentTarget: ReturnType<typeof createFakeDocument>; windowTarget: EventTarget;
  mountShell(options: ShellOptions): { destroy(): void }; loadObject(): Promise<() => unknown>;
};
function createMinimalRouter(options: MinimalRouterOptions) {
  // These tests deliberately exercise the router's minimal lifecycle boundary,
  // including malformed loaders. Native EventTarget dispatch and publication
  // properties are real; unused shell/navigation capabilities stay absent.
  return createSceneRouter({ ...options, stage: options.stage as HTMLElement,
    documentTarget: options.documentTarget as unknown as Document, windowTarget: options.windowTarget as BrowserWindow,
    mountShell: options.mountShell as NonNullable<RouterOptions['mountShell']>,
    loadObject: options.loadObject as NonNullable<RouterOptions['loadObject']> });
}
