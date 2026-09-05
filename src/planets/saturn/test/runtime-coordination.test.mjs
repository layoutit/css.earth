import assert from "node:assert/strict";
import test from "node:test";
import { createSceneLifetime } from "../../../platform/scene-lifetime.mjs";
import {
  createPreparedRowCache,
  createSaturnFeatureControls,
  createSaturnLensControls,
  mountSaturnClient,
  ownSaturnPresentationCleanup,
} from "../runtime/client.mjs";
import {
  createLensControls as createNeptuneLensControls,
  createPreparedOrbitMaterialCache,
  mountNeptuneClient,
  prepareCurrentNeptuneMaterial,
  ownNeptunePresentationCleanup,
} from "../../neptune/runtime/client.mjs";
import { PREPARED_SATURN_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_NEPTUNE_LENSES } from "../../neptune/runtime/preparedLenses.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function until(predicate) {
  for (let count = 0; count < 100; count += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail("Expected async preparation was not reached.");
}

class Element extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.attributes = new Map();
    this.style = {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; },
    };
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
    this.children = [];
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelectorAll() { return this.children; }
}
class Button extends Element {}
class Input extends Element {}

function environment(t, controls = PREPARED_SATURN_LENSES.controls) {
  const previous = new Map();
  const lensRoot = new Element();
  lensRoot.children = controls.map(({ id }) => Object.assign(new Button(), { value: id }));
  const settingsRoot = new Element();
  const rings = new Input();
  const shadows = new Input();
  const speed = new Input();
  settingsRoot.querySelector = (selector) => selector.includes('"rings"') ? rings
    : selector.includes('"shadows"') ? shadows : speed;
  const stage = new Element();
  const inputSurface = new Element();
  const document = new EventTarget();
  document.readyState = "complete";
  document.querySelector = (selector) => selector === ".planet-lenses" ? lensRoot
    : selector === ".planet-settings" ? settingsRoot : inputSurface;
  const images = [];
  let imageBehavior = () => Promise.resolve();
  class FakeImage {
    constructor() { this.src = ""; this.naturalWidth = 32; this.naturalHeight = 32; images.push(this); }
    decode() { this.selectedUrl = this.src; return imageBehavior(this); }
    removeAttribute(name) { if (name === "src") this.src = ""; }
  }
  for (const [name, value] of Object.entries({
    document, HTMLElement: Element, HTMLButtonElement: Button, HTMLInputElement: Input,
    HTMLImageElement: FakeImage, Image: FakeImage,
  })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { stage, lensRoot, settingsRoot, rings, shadows, speed, document, images,
    imageBehavior: (behavior) => { imageBehavior = behavior; } };
}

async function saturnFixture(t) {
  const env = environment(t);
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  ownSaturnPresentationCleanup(env.stage, { parentNode: env.stage }, lifetime);
  const errors = [];
  const onError = (error) => { errors.push(error); lifetime.destroy(); };
  const features = createSaturnFeatureControls({ stage: env.stage, lifetime, onError });
  const controls = createSaturnLensControls({ stage: env.stage, lifetime, onError, featureControls: features });
  const prepared = [];
  const commits = [];
  let prepare = () => Promise.resolve();
  let failCommit = false;
  let retireCommit = false;
  const camera = {
    async preparePresentation(snapshot) { prepared.push(snapshot); await prepare(snapshot); return snapshot; },
    validatePresentation() {},
    commitPresentation(snapshot) {
      if (failCommit) throw new Error("Commit failed.");
      if (retireCommit) { onError(new Error("Camera retired during publication.")); return; }
      commits.push(snapshot);
      env.stage.style.material = `${snapshot.lensId}:${snapshot.interior}:${snapshot.rings}:${snapshot.shadows}`;
    },
    releaseUnused() {},
  };
  await controls.bindRuntime({ camera, viewBank: { mountInterior() {} } });
  features.bindRuntime({ playback: { setSpeed() {} } });
  return { ...env, lifetime, features, controls, errors, prepared, commits,
    prepare: (callback) => { prepare = callback; }, failCommit: () => { failCommit = true; },
    retireCommit: () => { retireCommit = true; } };
}

test("Saturn settings remain disabled until its initial presentation is committed", async (t) => {
  const f = environment(t);
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  const features = createSaturnFeatureControls({ stage: f.stage, lifetime, onError: assert.fail });
  const controls = createSaturnLensControls({ stage: f.stage, lifetime, onError: assert.fail, featureControls: features });
  const pending = deferred();
  const prepared = [];
  const committed = [];
  const binding = controls.bindRuntime({
    camera: {
      async preparePresentation(snapshot) { prepared.push(snapshot); await pending.promise; return snapshot; },
      validatePresentation() {},
      commitPresentation(snapshot) { committed.push(snapshot); },
      releaseUnused() {},
    },
    viewBank: { mountInterior() {} },
  });
  await until(() => prepared.length === 1);
  assert.equal(f.rings.disabled, true);
  assert.equal(f.shadows.disabled, true);
  f.rings.checked = false;
  f.rings.dispatchEvent(new Event("change"));
  f.shadows.checked = true;
  f.shadows.dispatchEvent(new Event("change"));
  pending.resolve();
  assert.equal(await binding, true);
  features.bindRuntime({ playback: { setSpeed() {} } });
  assert.equal(f.rings.disabled, false);
  assert.equal(f.shadows.disabled, false);
  assert.equal(f.rings.checked, true);
  assert.equal(f.shadows.checked, false);
  assert.equal(committed.length, 1);
  assert.deepEqual(features.state(), { rings: true, shadows: false });
  lifetime.destroy();
  assert.equal(f.rings.disabled, true);
  assert.equal(f.shadows.disabled, true);
  features.bindRuntime({ playback: { setSpeed: assert.fail } });
});

test("Saturn synchronous settings projection failure reaches the fatal-error owner", async (t) => {
  const f = await saturnFixture(t);
  let checked = true;
  Object.defineProperty(f.rings, "checked", {
    get: () => checked,
    set(value) { checked = value; throw new Error("Settings projection failed."); },
  });
  f.rings.dispatchEvent(new Event("change"));
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0].message, /Settings projection failed/);
  assert.equal(f.lifetime.disposed, true);
  assert.equal(f.controls.state().ready, false);
  assert.equal(f.rings.disabled, true);
  assert.equal(f.commits.length, 1);
});

test("Saturn rings and interior preserve the newest pending material intent", async (t) => {
  const f = await saturnFixture(t);
  const methane = deferred();
  f.prepare((snapshot) => snapshot.lensId === "methane" && snapshot.rings ? methane.promise : Promise.resolve());
  const old = f.controls.select("methane");
  await until(() => f.prepared.some(({ lensId }) => lensId === "methane"));
  assert.equal(f.stage.style.material, "normal:false:true:false");
  f.rings.checked = false;
  f.rings.dispatchEvent(new Event("change"));
  await until(() => f.commits.at(-1).lensId === "methane");
  assert.equal(f.stage.style.material, "methane:false:false:false");
  assert.equal(f.lensRoot.classList.contains("is-loading"), false);
  assert.equal(f.settingsRoot.classList.contains("is-loading"), false);
  methane.resolve();
  assert.equal(await old, false);
  const interior = PREPARED_SATURN_LENSES.controls.find(({ view }) => view === "interior").id;
  assert.equal(await f.controls.select(interior), true);
  assert.deepEqual(f.controls.state(), { id: "methane", interior: true, ready: true });
  assert.equal(f.lensRoot.children.find(({ value }) => value === "methane").getAttribute("aria-pressed"), "true");
  assert.equal(f.lensRoot.children.find(({ value }) => value === interior).getAttribute("aria-pressed"), "true");
  assert.equal(f.stage.style.material, "methane:true:false:false");
  assert.deepEqual(f.errors, []);
});

test("Saturn current failure resets desired state before an unrelated toggle", async (t) => {
  const f = await saturnFixture(t);
  f.prepare((snapshot) => snapshot.lensId === "methane" ? Promise.reject(new Error("Decode failed.")) : Promise.resolve());
  await assert.rejects(f.controls.select("methane"), /Decode failed/);
  assert.equal(f.controls.state().id, "normal");
  assert.equal(f.stage.style.material, "normal:false:true:false");
  const attempts = f.prepared.filter(({ lensId }) => lensId === "methane").length;
  f.shadows.checked = true;
  f.shadows.dispatchEvent(new Event("change"));
  await until(() => f.commits.at(-1).shadows);
  assert.equal(f.stage.style.material, "normal:false:true:true");
  assert.equal(f.prepared.filter(({ lensId }) => lensId === "methane").length, attempts);
  f.prepare(() => Promise.resolve());
  assert.equal(await f.controls.select("methane"), true);
  assert.equal(f.stage.style.material, "methane:false:true:true");
  assert.deepEqual(f.errors, []);
});

test("Saturn repeated interior toggle uses desired state while preparation is pending", async (t) => {
  const f = await saturnFixture(t);
  const pending = deferred();
  const interior = PREPARED_SATURN_LENSES.controls.find(({ view }) => view === "interior").id;
  f.prepare((snapshot) => snapshot.interior ? pending.promise : Promise.resolve());
  const old = f.controls.select(interior);
  await until(() => f.prepared.length === 2);
  assert.equal(await f.controls.select(interior), true);
  pending.resolve();
  assert.equal(await old, false);
  assert.equal(f.controls.state().interior, false);
  assert.equal(f.stage.dataset.view, undefined);
  assert.equal(f.lensRoot.children.find(({ value }) => value === interior).getAttribute("aria-pressed"), "false");
});

test("Saturn fatal commit disposes controls without projecting a success", async (t) => {
  const f = await saturnFixture(t);
  f.failCommit();
  await assert.rejects(f.controls.select("thermal"), /Commit failed/);
  assert.equal(f.lifetime.disposed, true);
  assert.equal(f.errors.length, 1);
  assert.equal(f.commits.length, 1);
  assert.equal(f.controls.state().ready, false);
  assert.equal(f.stage.dataset.lens, undefined);
  assert.equal(f.settingsRoot.classList.contains("is-loading"), false);
});

test("Saturn camera fatal retirement stops the synchronous commit tail", async (t) => {
  const f = await saturnFixture(t);
  f.retireCommit();
  assert.equal(await f.controls.select("thermal"), false);
  assert.equal(f.lifetime.disposed, true);
  assert.equal(f.errors.length, 1);
  assert.equal(f.controls.state().id, "normal");
  assert.equal(f.stage.dataset.lens, undefined);
  assert.equal(f.stage.dataset.view, undefined);
  assert.equal(f.commits.length, 1);
});

test("Saturn stale rejection cannot overwrite newer lens or coupled settings", async (t) => {
  const f = await saturnFixture(t);
  const pending = deferred();
  f.prepare(({ lensId }) => lensId === "methane" ? pending.promise : Promise.resolve());
  const stale = f.controls.select("methane");
  await until(() => f.prepared.length === 2);
  await f.controls.select("thermal");
  pending.reject(new Error("Old failure."));
  assert.equal(await stale, false);
  assert.equal(f.controls.state().id, "thermal");
  f.rings.checked = false;
  f.rings.dispatchEvent(new Event("change"));
  await until(() => !f.commits.at(-1).rings);
  assert.equal(f.stage.style.material, "thermal:false:false:false");
  assert.deepEqual(f.errors, []);
});

test("Saturn group failure releases decoded and pending siblings and retries", async (t) => {
  const f = await saturnFixture(t);
  const failed = deferred();
  const late = deferred();
  let first = true;
  f.imageBehavior((image) => {
    if (!first) return Promise.resolve();
    if (image.src.includes("poles-methane")) return failed.promise;
    if (image.src.includes("rings-methane")) return late.promise;
    return Promise.resolve();
  });
  const selection = f.controls.select("methane");
  const observed = assert.rejects(selection, /Prepared image did not decode/);
  await until(() => f.images.length >= 3);
  failed.reject(new Error("Corrupt pole image."));
  await observed;
  const retired = [...f.images];
  assert.ok(retired.every(({ src }) => src === ""));
  first = false;
  assert.equal(await f.controls.select("methane"), true);
  late.reject(new Error("Retired ring request."));
  await Promise.resolve();
  assert.equal(f.controls.state().id, "methane");
  assert.ok(f.images.filter((image) => !retired.includes(image)).every(({ src }) => src !== ""));
});

test("Saturn disposal settles pending selection without native completion", async (t) => {
  const f = await saturnFixture(t);
  const pending = deferred();
  f.prepare(() => pending.promise);
  const result = f.controls.select("thermal");
  await until(() => f.prepared.length === 2);
  f.lifetime.destroy();
  assert.equal(await result, false);
  assert.equal(f.commits.length, 1);
  assert.ok(f.images.every(({ src }) => src === ""));
  pending.reject(new Error("Disposed native failure."));
  await Promise.resolve();
  assert.deepEqual(f.errors, []);
});

test("Saturn destroyed document wait settles readiness and performs no allocation", async (t) => {
  const f = environment(t);
  f.document.readyState = "loading";
  const mount = mountSaturnClient(f.stage, { onError: assert.fail });
  mount.destroy();
  await mount.ready;
  f.document.dispatchEvent(new Event("DOMContentLoaded"));
  await Promise.resolve();
  assert.equal(f.images.length, 0);
});

for (const [id, controls, mount] of [
  ["Saturn", PREPARED_SATURN_LENSES.controls, mountSaturnClient],
  ["Neptune", PREPARED_NEPTUNE_LENSES.controls, mountNeptuneClient],
]) {
  test(`${id} live startup failure rejects ready and releases every partial image`, async (t) => {
    const f = environment(t, controls);
    f.imageBehavior(() => Promise.reject(new Error("Startup decoding failed.")));
    const instance = mount(f.stage, { onError: assert.fail });
    await assert.rejects(instance.ready, /Prepared image did not decode/);
    assert.ok(f.images.length > 0);
    assert.ok(f.images.every(({ src }) => src === ""));
    instance.destroy();
  });

  test(`${id} startup cleanup continues after one warm image release throws`, async (t) => {
    const f = environment(t, controls);
    const pending = deferred();
    f.imageBehavior(() => pending.promise);
    const instance = mount(f.stage, { onError: assert.fail });
    await until(() => f.images.length > 10);
    const broken = f.images.find(({ selectedUrl }) => selectedUrl.includes(id === "Saturn"
      ? "saturn-surface-body.jpg" : "neptune-rings"));
    assert.ok(broken);
    broken.removeAttribute = () => { throw new Error("Image release failed."); };
    assert.throws(() => instance.destroy(), /cleanup failed/);
    await instance.ready;
    assert.ok(f.images.filter((image) => image !== broken).every(({ src }) => src === ""));
    assert.ok(f.lensRoot.children.every(({ disabled }) => disabled));
    pending.reject(new Error("Late startup failure."));
    await Promise.resolve();
    instance.destroy();
  });
}

test("Saturn cleanup retires every lens group after one group release throws", async (t) => {
  const f = await saturnFixture(t);
  const pending = deferred();
  f.prepare(() => pending.promise);
  const first = f.controls.select("methane");
  await until(() => f.prepared.length === 2);
  const second = f.controls.select("thermal");
  await until(() => f.prepared.length === 3);
  const broken = f.images[0];
  broken.removeAttribute = () => { throw new Error("Group release failed."); };
  assert.equal(f.lifetime.destroy().length, 1);
  assert.equal(await first, false);
  assert.equal(await second, false);
  assert.ok(f.images.slice(1).every(({ src }) => src === ""));
  assert.equal(f.stage.dataset.lens, undefined);
  assert.equal(f.rings.disabled, true);
  pending.reject(new Error("Retired material preparation."));
  await Promise.resolve();
  assert.deepEqual(f.lifetime.destroy(), []);
});

test("Neptune cleanup retires every lens group after one group release throws", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  const controls = createNeptuneLensControls({ stage: f.stage, lifetime, onError: assert.fail });
  await Promise.all(PREPARED_NEPTUNE_LENSES.controls.slice(0, 2).map(({ id }) => controls.prepare(id)));
  f.images[0].removeAttribute = () => { throw new Error("Group release failed."); };
  assert.equal(lifetime.destroy().length, 1);
  assert.ok(f.images.slice(1).every(({ src }) => src === ""));
  assert.equal(f.stage.dataset.lens, undefined);
  assert.deepEqual(lifetime.destroy(), []);
});

function atlasPlan() {
  const variants = Object.fromEntries(["normal", "methane"].map((id) => [id, {
    runtimeAtlas: { assetUrl: `/${id}.webp` },
    presentations: [{ rowIndex: 0, assetUrl: `/${id}.webp` }],
    defaultPresentation: { assetUrl: `/${id}.webp` },
  }]));
  return { label: "test atlas", plan: {}, variants, defaultVariant: "normal" };
}

test("Saturn atlas release/reacquire guards late rejection and keeps one active atlas", async (t) => {
  const f = environment(t);
  const requests = [];
  f.imageBehavior(() => { const item = deferred(); requests.push(item); return item.promise; });
  const cache = createPreparedRowCache(atlasPlan());
  t.after(() => cache.destroy());
  const old = cache.prepareVariant("methane");
  assert.equal(f.images.length, 1);
  cache.releaseVariant("methane");
  assert.equal(f.images[0].src, "");
  const current = cache.prepareVariant("methane");
  requests[1].resolve();
  await current;
  requests[0].reject(new Error("Retired."));
  await old;
  assert.equal(cache.isPrepared("methane"), true);
  cache.defaultPresentation("methane");
  assert.equal(cache.stats().retainedAtlasCount, 1);
  cache.destroy();
  assert.ok(f.images.every(({ src }) => src === ""));
  await cache.prepareVariant("normal");
  assert.equal(f.images.length, 2);
});

test("Saturn atlas cleanup clears every resident and pending variant after release failure", async (t) => {
  const f = environment(t);
  const cache = createPreparedRowCache(atlasPlan());
  await cache.prepareInitial();
  const pending = deferred();
  f.imageBehavior(() => pending.promise);
  const warming = cache.prepareVariant("methane");
  f.images[0].removeAttribute = () => { throw new Error("Atlas release failed."); };
  assert.throws(() => cache.destroy(), /atlas cleanup failed/);
  assert.equal(f.images[1].src, "");
  assert.equal(cache.stats().retainedRowCount, 0);
  assert.equal(cache.stats().pendingRowCount, 0);
  assert.equal(cache.isPrepared("normal"), false);
  assert.equal(cache.isPrepared("methane"), false);
  pending.reject(new Error("Retired variant."));
  await warming;
  cache.destroy();
});

test("Neptune row cache releases pending decodes and retries live failures", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const pending = deferred();
  f.imageBehavior(() => pending.promise);
  const cache = createPreparedOrbitMaterialCache(PREPARED_NEPTUNE_LENSES);
  const old = cache.preparePresentation(0, "normal");
  cache.destroy();
  assert.equal(f.images[0].src, "");
  pending.reject(new Error("Retired row."));
  await old;
  assert.equal(cache.stats().retainedRowCount, 0);
  const fresh = createPreparedOrbitMaterialCache(PREPARED_NEPTUNE_LENSES);
  t.after(() => fresh.destroy());
  f.imageBehavior(() => Promise.reject(new Error("Current failure.")));
  await assert.rejects(fresh.preparePresentation(0, "normal"), /Prepared image did not decode/);
  assert.equal(fresh.stats().pendingRowCount, 0);
  assert.equal(f.images.at(-1).src, "");
  f.imageBehavior(() => Promise.resolve());
  for (const frame of [0, 16, 32, 48, 64]) await fresh.preparePresentation(frame, "normal");
  assert.equal(fresh.stats().retainedRowCount, 3);
  assert.equal(fresh.stats().maximumRetainedRowCount, 3);
});

test("Neptune row cleanup clears all resident and pending ownership after release failure", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const cache = createPreparedOrbitMaterialCache(PREPARED_NEPTUNE_LENSES);
  await cache.prepareInitial();
  const pending = deferred();
  f.imageBehavior(() => pending.promise);
  const warming = cache.preparePresentation(0, "normal");
  assert.equal(f.images.length, 4);
  f.images[0].removeAttribute = () => { throw new Error("Row release failed."); };
  assert.throws(() => cache.destroy(), /row image cleanup failed/);
  assert.ok(f.images.slice(1).every(({ src }) => src === ""));
  assert.equal(cache.stats().retainedRowCount, 0);
  assert.equal(cache.stats().pendingRowCount, 0);
  pending.reject(new Error("Retired row."));
  await warming;
  assert.equal(cache.stats().retainedRowCount, 0);
  cache.destroy();
});

test("Neptune nested material preparation cannot publish an obsolete lens", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  const errors = [];
  const controls = createNeptuneLensControls({ stage: f.stage, lifetime, onError: (error) => errors.push(error) });
  const pending = deferred();
  const ids = PREPARED_NEPTUNE_LENSES.controls.map(({ id }) => id);
  const oldId = ids[1];
  const newId = ids[2];
  let entered = false;
  let actualMaterial = ids[0];
  controls.bindRuntime({ materialLeaf: new Element(), orbitCamera: {
    async prepareLens(id) { if (id === oldId) { entered = true; await pending.promise; } },
    commitLens(id) { actualMaterial = id; },
  } });
  const old = controls.select(oldId);
  await until(() => entered);
  assert.equal(actualMaterial, ids[0]);
  assert.equal(await controls.select(newId), true);
  pending.resolve();
  assert.equal(await old, false);
  assert.equal(actualMaterial, newId);
  assert.equal(controls.state().id, newId);
  assert.equal(f.stage.dataset.lens, newId);
  assert.deepEqual(errors, []);
});

test("Neptune camera fatal retirement stops the synchronous commit tail", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  ownNeptunePresentationCleanup(f.stage, { parentNode: f.stage }, lifetime);
  const controls = createNeptuneLensControls({ stage: f.stage, lifetime, onError: assert.fail });
  controls.bindRuntime({ materialLeaf: new Element(), orbitCamera: {
    prepareLens() { return Promise.resolve(); },
    commitLens() { lifetime.destroy(); },
  } });
  assert.equal(await controls.select("methane"), false);
  assert.equal(controls.state().id, "normal");
  assert.equal(f.stage.dataset.lens, undefined);
  assert.equal(f.stage.style["--neptune-surface-image"], undefined);
  assert.equal(f.stage.style["--neptune-poles-image"], undefined);
});

for (const [id, own] of [["Saturn", ownSaturnPresentationCleanup], ["Neptune", ownNeptunePresentationCleanup]]) {
  test(`${id} clears its owned stage presentation before camera removal`, (t) => {
    const f = environment(t);
    const lifetime = createSceneLifetime();
    const camera = { parentNode: f.stage };
    f.stage.dataset.lens = "owned";
    f.stage.dataset.view = "interior";
    f.stage.style.setProperty("--neptune-surface-image", "owned surface");
    f.stage.style.setProperty("--neptune-poles-image", "owned poles");
    lifetime.onDispose(() => {
      assert.equal(f.stage.dataset.lens, undefined);
      camera.parentNode = null;
    });
    own(f.stage, camera, lifetime);
    assert.deepEqual(lifetime.destroy(), []);
    if (id === "Saturn") assert.equal(f.stage.dataset.view, undefined);
    else {
      assert.equal(f.stage.style["--neptune-surface-image"], undefined);
      assert.equal(f.stage.style["--neptune-poles-image"], undefined);
    }
  });

  test(`${id} old-camera cleanup cannot erase a replacement on the same stage`, (t) => {
    const f = environment(t);
    const oldLifetime = createSceneLifetime(), replacementLifetime = createSceneLifetime();
    const oldCamera = { parentNode: f.stage }, replacementCamera = { parentNode: f.stage };
    own(f.stage, oldCamera, oldLifetime);
    oldCamera.parentNode = null;
    own(f.stage, replacementCamera, replacementLifetime);
    f.stage.dataset.lens = "replacement";
    f.stage.dataset.view = "interior";
    f.stage.style.setProperty("--neptune-surface-image", "replacement surface");
    f.stage.style.setProperty("--neptune-poles-image", "replacement poles");
    assert.deepEqual(oldLifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, "replacement");
    assert.equal(f.stage.dataset.view, "interior");
    assert.equal(f.stage.style["--neptune-surface-image"], "replacement surface");
    assert.equal(f.stage.style["--neptune-poles-image"], "replacement poles");
    assert.deepEqual(replacementLifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, undefined);
  });
}

test("Neptune failed row preparation retires inactive lens images and allows retry", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  const controls = createNeptuneLensControls({ stage: f.stage, lifetime, onError: assert.fail });
  const ids = PREPARED_NEPTUNE_LENSES.controls.map(({ id }) => id);
  await controls.prepare(ids[0]);
  const activeImages = [...f.images];
  let fail = true;
  controls.bindRuntime({ materialLeaf: new Element(), orbitCamera: {
    prepareLens() { return fail ? Promise.reject(new Error("Material row failed.")) : Promise.resolve(); },
    commitLens() {},
    cancelLensPreparation() {},
  } });
  for (const id of ids.slice(1, 3)) {
    await assert.rejects(controls.select(id), /Material row failed/);
    assert.equal(controls.state().id, ids[0]);
    assert.ok(activeImages.every(({ src }) => src !== ""));
    assert.ok(f.images.filter((image) => !activeImages.includes(image)).every(({ src }) => src === ""));
  }
  fail = false;
  assert.equal(await controls.select(ids[1]), true);
  assert.equal(controls.state().id, ids[1]);
  assert.ok(activeImages.every(({ src }) => src === ""));
});

test("Neptune A/B/A supersession retains only active and newest pending lens groups", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  const controls = createNeptuneLensControls({ stage: f.stage, lifetime, onError: assert.fail });
  const ids = PREPARED_NEPTUNE_LENSES.controls.map(({ id }) => id);
  await controls.prepare(ids[0]);
  const pending = [];
  controls.bindRuntime({ materialLeaf: new Element(), orbitCamera: {
    prepareLens(id) { const request = { id, ...deferred() }; pending.push(request); return request.promise; },
    commitLens() {},
    cancelLensPreparation() {},
  } });
  const firstA = controls.select(ids[1]);
  await until(() => pending.length === 1);
  const b = controls.select(ids[2]);
  await until(() => pending.length === 2);
  const newestA = controls.select(ids[1]);
  await until(() => pending.length === 3);
  const liveBefore = f.images.filter(({ src }) => src !== "");
  assert.equal(liveBefore.length, 8);
  pending[0].reject(new Error("Stale A row failed."));
  pending[1].resolve();
  assert.equal(await firstA, false);
  assert.equal(await b, false);
  assert.ok(liveBefore.every(({ src }) => src !== ""));
  pending[2].resolve();
  assert.equal(await newestA, true);
  assert.equal(controls.state().id, ids[1]);
  assert.equal(f.images.filter(({ src }) => src !== "").length, 4);
});

test("Neptune deferred row publication failure reports one fatal retirement without rejection leakage", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const errors = [];
  const cache = createPreparedOrbitMaterialCache(PREPARED_NEPTUNE_LENSES, {
    onError(error) { errors.push(error); cache.destroy(); },
  });
  t.after(() => cache.destroy());
  cache.onReady(() => { throw new Error("Deferred material publication failed."); });
  assert.equal(cache.presentation(0, "normal"), null);
  assert.equal(cache.presentation(0, "normal"), null);
  await until(() => errors.length === 1);
  await new Promise(setImmediate);
  assert.match(errors[0].message, /Deferred material publication failed/);
  assert.equal(errors.length, 1);
  assert.equal(cache.stats().retainedRowCount, 0);
  assert.equal(cache.stats().pendingRowCount, 0);
  assert.ok(f.images.every(({ src }) => src === ""));
});

test("Neptune lens preparation follows a camera row changed during decoding", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const cache = createPreparedOrbitMaterialCache(PREPARED_NEPTUNE_LENSES);
  t.after(() => cache.destroy());
  const requests = [];
  f.imageBehavior(() => { const item = deferred(); requests.push(item); return item.promise; });
  let frame = 0;
  let finished = false;
  const prepared = prepareCurrentNeptuneMaterial({
    id: "normal", isCurrent: () => true, cache,
    readState: () => ({ frame, useDefault: false }),
  }).then(() => { finished = true; });
  frame = 64;
  requests[0].resolve();
  await until(() => requests.length === 2);
  assert.equal(finished, false);
  assert.match(f.images[1].selectedUrl, /row-04/);
  requests[1].resolve();
  await prepared;
  assert.equal(cache.hasPresentation(64, "normal"), true);
});

test("Neptune stale row preparation never starts another camera-row request", async (t) => {
  const f = environment(t, PREPARED_NEPTUNE_LENSES.controls);
  const cache = createPreparedOrbitMaterialCache(PREPARED_NEPTUNE_LENSES);
  t.after(() => cache.destroy());
  const pending = deferred();
  f.imageBehavior(() => pending.promise);
  let current = true;
  let frame = 0;
  const result = prepareCurrentNeptuneMaterial({
    id: "normal", isCurrent: () => current, cache,
    readState: () => ({ frame, useDefault: false }),
  });
  current = false;
  frame = 64;
  pending.resolve();
  await result;
  assert.equal(f.images.length, 1);
});

for (const [id, descriptors, create] of [
  ["Saturn", PREPARED_SATURN_LENSES.controls, createSaturnLensControls],
  ["Neptune", PREPARED_NEPTUNE_LENSES.controls, createNeptuneLensControls],
]) {
  test(`${id} rejects duplicate or mismatched lens buttons before binding listeners`, (t) => {
    const f = environment(t, descriptors);
    const lifetime = createSceneLifetime();
    t.after(() => lifetime.destroy());
    f.lensRoot.children[1].value = f.lensRoot.children[0].value;
    assert.throws(() => create({ stage: f.stage, lifetime, onError: assert.fail }), /does not match/);
    f.lensRoot.children[1].value = "not-a-prepared-lens";
    assert.throws(() => create({ stage: f.stage, lifetime, onError: assert.fail }), /does not match/);
    assert.equal(lifetime.stats().ownerCount, 0);
  });
}
