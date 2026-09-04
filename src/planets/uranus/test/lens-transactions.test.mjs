import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { bindUranusLensControls } from "../runtime/client.mjs";
import { PREPARED_URANUS_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_URANUS_RUNTIME_SCENE } from "../runtime/preparedSceneRuntime.mjs";
import { createSceneLifetime } from "../../../platform/scene-lifetime.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const otherIds = PREPARED_URANUS_LENSES.controls.map(({ id }) => id).filter((id) => id !== "normal");
const [a, b] = otherIds;

const clientSource = await readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8");
const mountStart = clientSource.indexOf("function mountPreparedScene(");
const mountEnd = clientSource.indexOf("\nfunction ", mountStart + 1);
for (const phase of ["before-camera", "owned-camera", "replacement-camera"]) {
  test(`Uranus partial scene cleanup preserves presentation ownership: ${phase}`, () => {
    const lifetime = createSceneLifetime();
    const stage = { dataset: { lens: "previous-owner" }, replaceChildren(node) { node.parentNode = this; } };
    const nodes = [];
    const stop = new Error("injected construction failure");
    const element = () => {
      if (phase === "before-camera") throw stop;
      const node = { parentNode: null, style: { setProperty() {} }, appendChild() {}, remove() { this.parentNode = null; } };
      nodes.push(node);
      return node;
    };
    const mount = new Function("PREPARED_URANUS_RUNTIME_SCENE", "element", "mesh", "textureLeaf",
      "mountRetainedCubicSky", "PREPARED_URANUS_STARFIELD", "CANONICAL_PREPARED_IMAGE_DENSITY",
      `${clientSource.slice(mountStart, mountEnd)}; return mountPreparedScene;`)(
      { schema: "cssuranus-prepared-runtime-scene@1", camera: {}, preparedRingSource: {},
        bodyBands: [], fixedMaterialPlane: {} }, element, element, element,
      () => { throw stop; }, {}, 2);
    assert.throws(() => mount(stage, {}, lifetime), (error) => error === stop);
    assert.equal(stage.dataset.lens, phase === "before-camera" ? "previous-owner" : "normal");
    if (phase === "replacement-camera") {
      nodes[0].parentNode = null;
      stage.dataset.lens = "replacement-owner";
    }
    assert.deepEqual(lifetime.destroy(), []);
    assert.equal(stage.dataset.lens, phase === "before-camera" ? "previous-owner"
      : phase === "replacement-camera" ? "replacement-owner" : undefined);
  });
}

test("Uranus guards actual nested material publication and keeps current busy state", async () => {
  const f = fixture();
  try {
    const first = f.controls.select(a);
    await tick();
    const second = f.controls.select(b);
    await tick();
    f.preparations[0].resolve(f.preparations[0].result);
    assert.equal(await first, false);
    assert.equal(f.root.busy, "true");
    assert.equal(f.stage.dataset.lens, "normal");
    assert.equal(f.materialWrites.length, 0);
    f.preparations[1].resolve(f.preparations[1].result);
    assert.equal(await second, true);
    assert.equal(f.stage.dataset.lens, b);
    assert.deepEqual(f.materialWrites, [PREPARED_URANUS_RUNTIME_SCENE.assets.materialViewBank[b]["2"].rows]);
    assert.equal(f.preparations[0].commits, 0);
    assert.equal(f.preparations[0].discards, 1);
    assert.equal(f.preparations[1].commits, 1);
    assert.equal(f.root.busy, "false");
  } finally { f.restore(); }
});

test("Uranus late stale surface decode cannot acquire a newer material preparation", async () => {
  const aUrls = new Set([
    ...Object.values(PREPARED_URANUS_RUNTIME_SCENE.assets.surfaces[a]["2"]),
    PREPARED_URANUS_RUNTIME_SCENE.assets.fixedMaterial[a]["2"],
    PREPARED_URANUS_RUNTIME_SCENE.assets.shadowlessMaterial[a]["2"],
  ]);
  let finishSurface;
  const surface = new Promise((resolve) => { finishSurface = resolve; });
  const f = fixture({ decode: (url) => aUrls.has(url) ? surface : Promise.resolve({}) });
  try {
    const first = f.controls.select(a);
    await tick();
    const second = f.controls.select(b);
    await tick();
    assert.equal(f.preparations.length, 1);
    finishSurface({});
    assert.equal(await first, false);
    assert.equal(f.preparations.length, 1, "stale A must not retire B's preparation");
    f.preparations[0].resolve(f.preparations[0].result);
    assert.equal(await second, true);
    assert.equal(f.stage.dataset.lens, b);
  } finally { f.restore(); }
});

test("Uranus current failure restores committed controls and destruction blocks late publication", async () => {
  const f = fixture();
  try {
    const first = f.controls.select(a);
    const rejected = assert.rejects(first, /decode failed/u);
    await tick();
    f.preparations[0].reject(new Error("decode failed"));
    await rejected;
    assert.equal(f.controls.state().id, "normal");
    assert.equal(f.controls.state().ready, true);
    assert.equal(f.root.busy, "false");
    assert.deepEqual(f.errors, []);
    const retry = f.controls.select(a);
    await tick();
    f.lifetime.destroy();
    assert.equal(await retry, false);
    f.root.busy = "replacement-owned";
    f.preparations[1].resolve(f.preparations[1].result);
    await tick();
    assert.equal(f.root.busy, "replacement-owned");
    assert.equal(f.materialWrites.length, 0);
    assert.equal(f.preparations[1].commits, 0);
  } finally { f.restore(); }
});

function fixture({ decode = () => Promise.resolve({}) } = {}) {
  const originals = new Map(["document", "HTMLElement"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  class Element {
    classList = { toggle() {}, remove() {} };
    setAttribute(name, value) { if (name === "aria-busy") this.busy = value; }
  }
  const buttons = PREPARED_URANUS_LENSES.controls.map(({ id }) => ({
    value: id, pressed: id === "normal", addEventListener() {},
    setAttribute(name, value) { if (name === "aria-pressed") this.pressed = value === "true"; },
  }));
  const root = new Element();
  globalThis.HTMLElement = Element;
  globalThis.document = { querySelector: () => root, querySelectorAll: () => buttons };
  const stage = { dataset: { lens: "normal" } };
  const materialWrites = [];
  const preparations = [];
  const errors = [];
  const lifetime = createSceneLifetime();
  const controls = bindUranusLensControls({
    stage, lifetime, decode,
    surfaceRoots: [{ style: { setProperty() {} } }],
    onError(error) { errors.push(error); lifetime.destroy(); },
    cameraControls: { stats: () => ({ activeMaterialRow: 4 }), setMaterialRows(rows) { materialWrites.push(rows); } },
    prepareMaterialRows(rows) {
      const entry = { rows, commits: 0, discards: 0 };
      entry.result = { commit() { entry.commits += 1; }, discard() { entry.discards += 1; } };
      entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
      preparations.push(entry);
      return entry.promise;
    },
  });
  return { controls, stage, root, materialWrites, preparations, errors, lifetime,
    restore() {
      lifetime.destroy();
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}
