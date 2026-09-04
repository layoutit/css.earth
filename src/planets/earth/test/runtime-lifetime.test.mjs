import assert from "node:assert/strict";
import test from "node:test";
import { mountEarthClient } from "../runtime/client.mjs";
import { mountMercuryClient } from "../../mercury/runtime/client.mjs";
import { mountUranusClient } from "../../uranus/runtime/client.mjs";
import { PREPARED_EARTH_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_MERCURY_LENSES } from "../../mercury/runtime/preparedLenses.mjs";
import { PREPARED_URANUS_LENSES } from "../../uranus/runtime/preparedLenses.mjs";

const clients = [
  ["earth", mountEarthClient, PREPARED_EARTH_LENSES],
  ["mercury", mountMercuryClient, PREPARED_MERCURY_LENSES],
  ["uranus", mountUranusClient, PREPARED_URANUS_LENSES],
];

for (const [id, mount, lenses] of clients) {
  test(`${id}: missing fatal handler fails before image allocation`, () => {
    assert.throws(() => mount({}), /requires onError/u);
  });

  test(`${id}: destroy settles loading without decode or paint, contains late work`, async () => {
    const fixture = installFixture(id, lenses);
    try {
      const errors = [];
      const client = mount(fixture.stage, { onError: (error) => errors.push(error) });
      assert.equal(fixture.speed.disabled, true);
      assert.ok(fixture.images.length > 0);
      const replacement = Object.freeze({ ready: true });
      globalThis.window[`__${id}`] = replacement;
      client.destroy();
      client.destroy();
      await client.ready;
      const allocated = fixture.images.length;
      assert.ok(fixture.images.every((image) => image.src === ""));
      for (const image of fixture.images) image.reject(new Error("late native decode"));
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(fixture.images.length, allocated);
      assert.equal(fixture.listeners.size, 0);
      assert.equal(globalThis.window[`__${id}`], replacement);
      assert.deepEqual(errors, []);
      assert.equal(fixture.frames, 0);
    } finally { fixture.restore(); }
  });

  test(`${id}: live startup rejection rejects ready and releases pending siblings`, async () => {
    const fixture = installFixture(id, lenses);
    try {
      const client = mount(fixture.stage, { onError: () => assert.fail("Startup must reject ready") });
      const failure = assert.rejects(client.ready, /Prepared image did not decode/u);
      fixture.images[0].reject(new Error("failed startup image"));
      await failure;
      assert.ok(fixture.images.every((image) => image.src === ""));
      assert.equal(fixture.listeners.size, 0);
      for (const image of fixture.images) image.reject(new Error("late sibling"));
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(fixture.frames, 0);
    } finally { fixture.restore(); }
  });

  test(`${id}: one failing release does not strand sibling images or listeners`, async () => {
    const fixture = installFixture(id, lenses);
    try {
      const client = mount(fixture.stage, { onError: () => {} });
      fixture.images[0].failRelease = true;
      assert.throws(() => client.destroy(), AggregateError);
      await client.ready;
      assert.ok(fixture.images.length > 1);
      assert.ok(fixture.images.every((image) => image.releaseAttempts === 1));
      assert.ok(fixture.images.slice(1).every((image) => image.src === ""));
      assert.equal(fixture.listeners.size, 0);
      assert.doesNotThrow(() => client.destroy());
      for (const image of fixture.images) image.reject(new Error("late native failure"));
      await new Promise((resolve) => setImmediate(resolve));
    } finally { fixture.restore(); }
  });
}

function installFixture(id, lenses) {
  const names = ["HTMLElement", "HTMLButtonElement", "HTMLInputElement", "Image", "document", "window"];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const listeners = new Set();
  const images = [];
  let frames = 0;
  class Element {
    dataset = {};
    attributes = new Map();
    disabled = false;
    checked = true;
    classList = { add() {}, remove() {}, toggle() {} };
    addEventListener(name, callback, options) {
      const entry = { target: this, name, callback };
      listeners.add(entry);
      options?.signal?.addEventListener("abort", () => listeners.delete(entry), { once: true });
    }
    removeEventListener(name, callback) {
      for (const entry of listeners) if (entry.target === this && entry.name === name && entry.callback === callback) listeners.delete(entry);
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }
  class Button extends Element {}
  class Input extends Element {}
  class PreparedImage {
    src = "";
    naturalWidth = 1;
    naturalHeight = 1;
    releaseAttempts = 0;
    constructor() { images.push(this); }
    decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
    removeAttribute(name) {
      if (name !== "src") return;
      this.releaseAttempts += 1;
      if (this.failRelease) throw new Error("native release failed");
      this.src = "";
    }
  }
  const speed = new Button();
  const toggles = new Map(["atmosphere", "shadows", "rings"].map((name) => [name, new Input()]));
  const buttons = lenses.controls.map(({ id: value }) => Object.assign(new Button(), { value }));
  const lensRoot = new Element();
  lensRoot.querySelectorAll = () => buttons;
  const settings = new Element();
  settings.querySelector = (selector) => selector.includes("speed") ? speed :
    [...toggles].find(([name]) => selector.includes(`"${name}"`))?.[1] ?? null;
  const stage = new Element();
  const input = new Element();
  const document = {
    documentElement: new Element(),
    querySelector(selector) {
      if (selector === `.${id}-input-surface`) return input;
      if (selector === ".planet-lenses") return lensRoot;
      if (selector === ".planet-settings") return settings;
      return settings.querySelector(selector);
    },
    querySelectorAll: () => buttons,
  };
  const window = { requestAnimationFrame() { frames += 1; assert.fail("No paint before decoding"); }, cancelAnimationFrame() {} };
  Object.assign(globalThis, { HTMLElement: Element, HTMLButtonElement: Button,
    HTMLInputElement: Input, Image: PreparedImage, document, window });
  return {
    stage, speed, images, listeners, get frames() { return frames; },
    restore() {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}
