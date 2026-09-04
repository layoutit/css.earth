import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSceneLifetime } from "../../../platform/scene-lifetime.mjs";
import { createLatestSelection } from "../../../platform/latest-selection.mjs";
import { decodePreparedImage, releasePreparedImage } from "../../../platform/prepared-image-store.mjs";

class Element {
  constructor(value = "") {
    this.value = value;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.checked = false;
    this.clearCount = 0;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force) {
        const enabled = force ?? !classes.has(name);
        if (enabled) classes.add(name); else classes.delete(name);
      },
    };
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  replaceChildren() { this.clearCount += 1; }
  addEventListener(name, callback, options = {}) {
    if (options.signal?.aborted) return;
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
    options.signal?.addEventListener("abort", () => this.removeEventListener(name, callback), { once: true });
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}


const ids = ["moon", "pluto", "sun", "venus", "mars", "jupiter"];

for (const id of ids) {
  const name = id[0].toUpperCase() + id.slice(1);
  const { [`mount${name}Client`]: mount } = await import(`../../${id}/runtime/client.mjs`);
  const { [`PREPARED_${id.toUpperCase()}_LENSES`]: plan } = await import(`../../${id}/runtime/preparedLenses.mjs`);

  test(`${name} cancels startup without native decode settlement and leaves a replacement untouched`, async () => {
    const fixture = installFixture(plan);
    try {
      const errors = [];
      const mounted = mount(fixture.stage, { onError: (error) => errors.push(error) });
      assert.equal(fixture.speed.disabled, true);
      assert.ok(fixture.images.length > 0, "startup must have requested actual prepared URLs");
      mounted.resume();
      mounted.pause();
      mounted.destroy();
      await mounted.ready;
      assert.equal(fixture.stage.clearCount, 0);
      assert.ok(fixture.images.every((image) => image.src === ""));
      assert.equal(fixture.buttons.every((button) => button.listenerCount() === 0), true);
      fixture.stage.dataset.lens = "replacement";
      mounted.destroy();
      for (const image of fixture.images) image.reject(new Error("late decode"));
      await flush();
      assert.equal(fixture.stage.dataset.lens, "replacement");
      assert.equal(fixture.stage.clearCount, 0);
      assert.deepEqual(errors, []);
    } finally { fixture.restore(); }
  });

  test(`${name} preserves live startup rejection and releases pending siblings`, async () => {
    const fixture = installFixture(plan);
    try {
      const mounted = mount(fixture.stage, { onError: () => assert.fail("startup failure must reject ready") });
      const readiness = assert.rejects(mounted.ready, /decode|Prepared/i);
      fixture.images[0].reject(new Error("injected decode failure"));
      await readiness;
      assert.ok(fixture.images.every((image) => image.src === ""));
      assert.equal(fixture.stage.clearCount, 0);
      for (const image of fixture.images) image.reject(new Error("late sibling failure"));
      await flush();
      mounted.destroy();
    } finally { fixture.restore(); }
  });

  test(`${name} finishes other cleanup when one image release throws`, async () => {
    const fixture = installFixture(plan);
    try {
      const mounted = mount(fixture.stage, { onError() {} });
      fixture.images[0].removeAttribute = () => { throw new Error("release failed"); };
      assert.throws(() => mounted.destroy(), /cleanup failed/);
      await mounted.ready;
      assert.ok(fixture.images.slice(1).every((image) => image.src === ""));
      assert.equal(fixture.buttons.every((button) => button.listenerCount() === 0), true);
      for (const image of fixture.images) image.reject(new Error("late failure"));
      await flush();
      mounted.destroy();
    } finally { fixture.restore(); }
  });
}

for (const id of ["moon", "pluto", "sun", "venus"]) {
  const name = id[0].toUpperCase() + id.slice(1);
  const { [`PREPARED_${id.toUpperCase()}_LENSES`]: plan } = await import(`../../${id}/runtime/preparedLenses.mjs`);
  const source = await readFile(new URL(`../../${id}/runtime/client.mjs`, import.meta.url), "utf8");
  const start = source.indexOf(`function create${name}LensControls(`);
  const end = source.indexOf("\nfunction ", start + 1);
  const factory = new Function("document", "HTMLElement", "Image", "createLatestSelection",
    "decodePreparedImage", "releasePreparedImage", `PREPARED_${id.toUpperCase()}_LENSES`,
    "canonicalPreparedUrl", "cssUrl", `${source.slice(start, end)}; ${source.includes("function releaseImageGroup(") ? source.slice(source.indexOf("function releaseImageGroup(")) : ""}; return create${name}LensControls;`);

  test(`${name} lens controls reject mismatched IDs before attaching listeners`, () => {
    const fixture = installFixture(plan);
    const lifetime = createSceneLifetime();
    try {
      fixture.buttons[0].value = "wrong-id";
      const create = factory(globalThis.document, Element, globalThis.Image, createLatestSelection,
        decodePreparedImage, releasePreparedImage, plan, (url, high) => high || url,
        (url) => `url(${JSON.stringify(url)})`);
      assert.throws(() => create({ stage: fixture.stage, lifetime, onError() {}, decodePreparedImage() {} }), /does not match/);
      assert.ok(fixture.buttons.every((button) => button.listenerCount() === 0));
    } finally { lifetime.destroy(); fixture.restore(); }
  });

  test(`${name} lens transactions keep committed presentation through races, failure, retry, and disposal`, async () => {
    const fixture = installFixture(plan);
    const lifetime = createSceneLifetime();
    try {
      const errors = [];
      const create = factory(globalThis.document, Element, globalThis.Image, createLatestSelection,
        decodePreparedImage, releasePreparedImage, plan, (url, high) => high || url,
        (url) => `url(${JSON.stringify(url)})`);
      const pairDecodes = [];
      const controls = create({ stage: fixture.stage, lifetime, onError: (error) => errors.push(error),
        decodePreparedImage(pair) {
          const pending = deferred();
          pairDecodes.push({ ...pending, url: pair.two || pair.one });
          return pending.promise;
        },
      });
      const body = new Element();
      const mounted = { body, corona: new Element(), limb: new Element(),
        bodyCarriers: { surface: [body], polar: [new Element()] } };
      await controls.bindRuntime(mounted);
      const [base, first, second] = plan.controls.map(({ id }) => id);
      const pending = () => id === "moon" || id === "pluto" ? pairDecodes : fixture.images;
      const firstRequest = controls.select(first);
      await flush();
      const firstWork = [...pending()];
      const secondRequest = controls.select(second);
      await flush();
      const secondWork = pending().filter((entry) => !firstWork.includes(entry));
      assert.equal(controls.state().id, base);
      assert.equal(fixture.lenses.classList.contains("is-loading"), true);
      for (const entry of secondWork) entry.resolve();
      assert.equal(await secondRequest, true);
      assert.equal(controls.state().id, second);
      for (const entry of firstWork) entry.resolve();
      assert.equal(await firstRequest, false);
      assert.equal(controls.state().id, second);
      const previous = new Set(pending());
      const rejected = controls.select(first);
      const rejection = assert.rejects(rejected, /failure|decode/);
      await flush();
      const failedWork = pending().filter((entry) => !previous.has(entry));
      failedWork[0].reject(new Error("current lens failure"));
      await rejection;
      assert.equal(controls.state().id, second);
      assert.equal(fixture.lenses.classList.contains("is-loading"), false);
      const beforeRetry = new Set(pending());
      const retry = controls.select(first);
      await flush();
      const retriedWork = pending().filter((entry) => !beforeRetry.has(entry));
      assert.ok(retriedWork.length > 0, "same lens explicitly retries");
      for (const entry of retriedWork) entry.resolve();
      assert.equal(await retry, true);
      assert.equal(controls.state().id, first);
      const cancelled = controls.select(base);
      await flush();
      lifetime.destroy();
      assert.equal(await cancelled, false);
      for (const entry of pending()) entry.reject(new Error("late"));
      await flush();
      assert.deepEqual(errors, []);
      assert.equal(fixture.buttons.every((button) => button.listenerCount() === 0), true);
    } finally { lifetime.destroy(); fixture.restore(); }
  });

  test(`${name} stops publication when lens commit fails fatally`, async () => {
    const fixture = installFixture(plan);
    const lifetime = createSceneLifetime();
    try {
      const errors = [];
      const create = factory(globalThis.document, Element, globalThis.Image, createLatestSelection,
        decodePreparedImage, releasePreparedImage, plan, (url, high) => high || url,
        (url) => `url(${JSON.stringify(url)})`);
      const controls = create({ stage: fixture.stage, lifetime,
        onError(error) { errors.push(error); lifetime.destroy(); },
        decodePreparedImage: async () => ({}),
      });
      const body = new Element();
      await controls.bindRuntime({ body, corona: new Element(), limb: new Element(),
        bodyCarriers: { surface: [body], polar: [new Element()] } });
      if (id === "venus") Object.defineProperty(fixture.stage.dataset, "lens", {
        set() { throw new Error("commit failed"); }, configurable: true,
      });
      else body.style.setProperty = () => { throw new Error("commit failed"); };
      const selected = controls.select(plan.controls[1].id);
      const rejection = assert.rejects(selected, /commit failed/);
      await flush();
      for (const image of fixture.images) image.resolve();
      await rejection;
      assert.equal(lifetime.disposed, true);
      assert.equal(errors.length, 1);
      assert.equal(controls.state().id, plan.defaultLens);
      assert.equal(fixture.buttons.every((button) => button.listenerCount() === 0), true);
    } finally { lifetime.destroy(); fixture.restore(); }
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() { for (let index = 0; index < 8; index += 1) await Promise.resolve(); }


function installFixture(plan) {
  const previous = new Map(["document", "window", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "Image"]
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const images = [];
  class DeferredImage {
    constructor() {
      const pending = deferred();
      this.src = "";
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.decode = () => pending.promise;
      this.resolve = () => { this.naturalWidth = 32; this.naturalHeight = 32; pending.resolve(this); };
      this.reject = pending.reject;
      images.push(this);
    }
    removeAttribute(name) { if (name === "src") this.src = ""; }
  }
  const stage = new Element();
  const speed = new Element();
  const lenses = new Element();
  const settings = new Element();
  const buttons = plan.controls.map(({ id }) => new Element(id));
  const inputs = new Map(["rings", "shadows", "atmosphere", "stars"].map((name) => [name, new Element(name)]));
  lenses.querySelectorAll = () => buttons;
  settings.querySelector = (selector) => selector.includes('name="speed"') ? speed :
    inputs.get(selector.match(/name="([^"]+)"/)?.[1]);
  const document = {
    documentElement: new Element(),
    querySelector(selector) {
      if (selector.includes("planet-lenses")) return lenses;
      if (selector.includes("planet-settings")) return settings;
      if (selector.includes('name="speed"')) return speed;
      if (selector.includes("input-surface")) return new Element();
      return null;
    },
  };
  Object.assign(globalThis, { document, window: {}, HTMLElement: Element,
    HTMLButtonElement: Element, HTMLInputElement: Element, Image: DeferredImage });
  stage.ownerDocument = document;
  return { stage, speed, lenses, settings, buttons, images,
    restore() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}
