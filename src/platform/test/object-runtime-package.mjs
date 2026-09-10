import assert from "node:assert/strict";
import test from "node:test";
import { createObjectRuntime, preparedObjectCapabilities } from "../../renderers/css/dist/index.js";
import { createPreparedPlayback, createPreparedResidency, createObjectControlBinding,
  createObjectSelectionRuntime, mountPreparedPresentation, resolvePreparedPresentation,
  initialObjectSelection } from "../../renderers/css/dist/testing.js";
import { viewSunDirectionToPreparedLightDirection } from "../directional-sun-coordinate.mts";
import { createSceneLifetime } from "@cssearth/engine";
import { requireObjectRuntimeDefinition } from "../../../tools/object-runtime-contract.mts";

const flush = async () => { for (let index = 0; index < 32; index++) await Promise.resolve(); };

// Actual package definitions and native decode receipts are used here. Chrome
// conformance covers retained rendering and the shell; these cases preserve
// cancellation/failure guarantees formerly tested by extracting private code.
export function objectRuntimePackageTests(definition) {
  test(`${definition.id}: the actual definition satisfies the common contract`, () => {
    requireObjectRuntimeDefinition(definition);
    const view = { ...definition.camera, controlPitch: definition.camera.defaultControlPitchDegrees ?? 0,
      controlYaw: 0, zoom: definition.camera.defaultZoom, revision: 1,
      skySunViewDirection: definition.sun?.referenceViewDirection ?? null,
      sunViewDirection: definition.sun ? viewSunDirectionToPreparedLightDirection(definition.sun.referenceViewDirection) : null };
    view.reference = view;
    const selection = initialObjectSelection(definition.controls);
    resolvePreparedPresentation(definition, { selection, view });
  });

  function fixture() {
    const images = [], errors = [], services = {};
    let resources;
    const stage = { nodeType: 1, style: {}, remove() {}, dataset: { objectId: definition.id },
      ownerDocument: { readyState: "complete", defaultView: {} } };
    const mount = createObjectRuntime(definition, {
      waitDocument: () => Promise.resolve(),
      createControls: () => ({ publish() {}, setReady() {}, destroy() { services.controlsDestroyed = true; } }),
      createResources(options) {
        resources = createPreparedResidency({ ...options, createImage() {
          let resolve, reject;
          const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
          const image = { naturalWidth: 1, naturalHeight: 1, src: "", resolve, reject,
            decode: () => promise, removeAttribute(name) { if (name === "src") this.src = ""; } };
          images.push(image); return image;
        } });
        return resources;
      },
    });
    const runtime = mount(stage, { onError: error => errors.push(error), capabilities: preparedObjectCapabilities });
    return { runtime, stage, images, errors, services, resources: () => resources };
  }

  test(`${definition.id}: cancellation releases actual startup assets without decode settlement`, async () => {
    const f = fixture(); await flush();
    assert.ok(f.images.length > 0);
    const catalog = new Set(definition.assets.entries.map(entry => entry.url));
    assert.ok(f.images.every(image => catalog.has(image.src)));
    f.runtime.resume(); f.runtime.pause(); f.runtime.destroy(); await f.runtime.ready;
    f.stage.dataset.lens = "replacement";
    assert.ok(f.images.every(image => image.src === ""));
    assert.equal(f.resources().stats().images.entries.length, 0);
    assert.equal(f.services.controlsDestroyed, true);
    for (const image of f.images) image.reject(new Error("late decode"));
    await flush(); f.runtime.destroy();
    assert.equal(f.stage.dataset.lens, "replacement");
    assert.deepEqual(f.errors, []);
  });

  test(`${definition.id}: startup rejection releases native siblings and rejects readiness once`, async () => {
    const f = fixture(); await flush();
    const failure = assert.rejects(f.runtime.ready, /decode/i);
    f.images[0].reject(new Error("injected decode failure")); await failure;
    assert.ok(f.images.every(image => image.src === ""));
    assert.equal(f.services.controlsDestroyed, true);
    for (const image of f.images) image.reject(new Error("late sibling"));
    await flush(); f.runtime.destroy(); assert.deepEqual(f.errors, []);
  });

  test(`${definition.id}: one native release failure does not retain other startup owners`, async () => {
    const f = fixture(); await flush();
    f.images[0].removeAttribute = () => { throw new Error("release failed"); };
    assert.throws(() => f.runtime.destroy(), /cleanup failed/); await f.runtime.ready;
    assert.ok(f.images.slice(1).every(image => image.src === ""));
    assert.equal(f.resources().stats().images.entries.length, 0);
    assert.equal(f.services.controlsDestroyed, true);
    for (const image of f.images) image.reject(new Error("late"));
    await flush(); f.runtime.destroy(); assert.deepEqual(f.errors, []);
  });
}

export function retainedPresentationFixture(definition, { failAtElement = null } = {}) {
  const previousGlobals = new Map(["document", "HTMLElement", "DOMMatrix"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  class Element {}
  // Native matrix calls are controlled here; Chrome checks the actual projection.
  class Matrix {
    constructor(value = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)") { this.value = value; }
    translate() { return this; }
    rotate() { return this; }
    multiply() { return this; }
    toString() { return this.value; }
  }
  let count = 0;
  const animations = [];
  const document = { createElement(tag) {
    if (++count === failAtElement) throw new Error("injected native element failure");
    return node(tag);
  }, createDocumentFragment() { const fragment = node(); fragment.nodeType = 11; return fragment; },
    getElementById() { return null; } };
  document.head = node("head");
  function style() {
    const values = {};
    const css = { getPropertyValue: name => values[name] ?? "", setProperty: (name, value) => { values[name] = value; },
      removeProperty: name => { delete values[name]; } };
    Object.defineProperty(css, "cssText", { set(value) {
      for (const entry of String(value).split(";")) {
        const colon = entry.indexOf(":"); if (colon < 0) continue;
        const key = entry.slice(0, colon).trim(), v = entry.slice(colon + 1).trim();
        if (key.startsWith("--")) values[key] = v;
        else css[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = v;
      }
    } });
    return new Proxy(css, { get: (target, name) => target[name] ?? "" });
  }
  function node(tag = "div") {
    const attributes = new Map();
    const result = Object.create(Element.prototype, Object.getOwnPropertyDescriptors({ nodeType: 1, tagName: tag.toUpperCase(), style: style(), dataset: {}, children: [], parentNode: null,
      ownerDocument: document, className: "",
      get parentElement() { return this.parentNode; },
      get isConnected() { return this === stage || this.parentNode?.isConnected === true; },
      setAttribute(name, value) {
        attributes.set(name, String(value));
        if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
      },
      getAttribute(name) { return name.startsWith("data-")
        ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? null : attributes.get(name) ?? null; },
      removeAttribute(name) {
        attributes.delete(name);
        if (name.startsWith("data-")) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())];
      },
      contains(child) { return child === this || this.children.some(node => node.contains(child)); },
      closest(selector) { return this.className.split(/\s+/).includes(selector.slice(1)) ? this : this.parentNode?.closest(selector) ?? null; },
      animate(keyframes, options) {
        const animation = { keyframes, options, effect: { updateTiming(next) { Object.assign(options, next); } }, currentTime: null, playbackRate: 1, playState: "running",
          play() { this.playState = "running"; }, pause() { this.playState = "paused"; },
          cancel() { this.playState = "idle"; } };
        animations.push(animation); return animation;
      },
      removeChild(child) { child.remove(); return child; },
      appendChild(child) { if (child.nodeType === 11) { for (const entry of [...child.children]) this.appendChild(entry); return child; } child.remove(); this.children.push(child); child.parentNode = this; return child; },
      append(...children) { for (const child of children) this.appendChild(child); },
      replaceChildren(...children) { for (const child of [...this.children]) child.remove(); for (const child of children) this.appendChild(child); },
      remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; },
      querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); },
    }));
    result.classList = {
      contains: name => result.className.split(/\s+/).includes(name),
      add(...names) { result.className = [...new Set([...result.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove(...names) { result.className = result.className.split(/\s+/).filter(name => !names.includes(name)).join(" "); },
      toggle(name, enabled) { const next = enabled ?? !this.contains(name); if (next) this.add(name); else this.remove(name); return next; },
    };
    return result;
  }
  const stage = node(), lifetime = createSceneLifetime();
  const playback = createPreparedPlayback();
  lifetime.onDispose(() => playback.destroy());
  stage.className = "planet-stage";
  globalThis.document = document; globalThis.HTMLElement = Element; globalThis.DOMMatrix = Matrix;
  const resources = { url: key => {
    const entry = definition.assets.entries.find(entry => entry.key === key);
    assert.ok(entry, `Declared prepared resource ${key}`); return entry.url;
  } };
  return { stage, lifetime, document, resources, playback, animations,
    context: { own: callback => lifetime.onDispose(callback), resources, density: 2,
      registerAnimation: playback.register, seekAnimation: playback.seek },
    restore() { lifetime.destroy(); for (const [name, descriptor] of previousGlobals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } },
  };
}

// Actual package presentation + common controls, selection and native resource
// receipts. Only DOM and image boundaries are controlled by the fixture.
export async function preparedSelectionFixture(definition) {
  const f = retainedPresentationFixture(definition), jobs = [], errors = [], materialErrors = [];
  const timers = new Map(); let nextTimer = 0;
  const advanceTimers = () => { const pending = [...timers.values()]; timers.clear(); for (const callback of pending) callback(); };
  const residency = createPreparedResidency({ assets: definition.assets,
    schedule(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    unschedule(id) { timers.delete(id); }, createImage() {
    return { naturalWidth: 1, naturalHeight: 1, src: "", decode() {
      return new Promise((resolve, reject) => jobs.push({ image: this, url: this.src, resolve, reject, done: false }));
    }, removeAttribute(name) { if (name === "src") this.src = ""; } };
  } });
  f.lifetime.onDispose(() => residency.destroy());
  const startup = residency.prepareStartup(); await settle(); await startup;
  const presentation = mountPreparedPresentation(f.stage, { ...f.context, resources: residency.resources }, definition);
  residency.finishStartup();
  const inputs = new Map(), buttons = [];
  const input = fields => ({ dataset: {}, disabled: false, listeners: new Map(), ...fields,
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, callback) { this.listeners.set(name, callback); },
    removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name); },
  });
  for (const lens of definition.controls.lenses.controls) buttons.push(input({ name: "lens", value: lens.id, tagName: "BUTTON", type: "button" }));
  for (const control of definition.controls.settings.controls) inputs.set(control.name, input({ name: control.name,
    tagName: "INPUT", type: control.kind === "toggle" ? "checkbox" : "range", min: "0", max: "4", step: "1" }));
  const lensRoot = f.document.createElement("div"), settingsRoot = f.document.createElement("div");
  lensRoot.querySelectorAll = () => buttons; settingsRoot.querySelectorAll = () => [...inputs.values()];
  f.document.querySelector = selector => selector === ".planet-lenses" ? lensRoot : settingsRoot;
  let binding;
  const selection = createObjectSelectionRuntime({ definition, presentation, residency, lifetime: f.lifetime,
    onCommit: state => f.playback.setSelection(state),
    onChange: state => binding?.publish(state), onFatalError(error) { errors.push(error); f.lifetime.destroy(); },
    onMaterialError: error => materialErrors.push(error) });
  f.lifetime.onDispose(() => selection.destroy());
  binding = createObjectControlBinding({ stage: f.stage, controls: definition.controls, initialSelection: initialObjectSelection(definition.controls),
    getState: selection.state, onAction: selection.dispatch, onError: error => materialErrors.push(error) });
  f.lifetime.onDispose(() => binding.destroy());
  const view = { controlPitch: definition.camera.defaultControlPitchDegrees ?? 0,
    controlYaw: definition.camera.defaultControlYawDegrees ?? 0, zoom: definition.camera.defaultZoom,
    revision: 1, sceneMatrix: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
    counterRotation: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
    counterRotationFor: () => "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
    skySunViewDirection: definition.sun?.referenceViewDirection ?? null,
    sunViewDirection: definition.sun ? viewSunDirectionToPreparedLightDirection(definition.sun.referenceViewDirection) : null };
  view.reference = view; selection.setView(view);
  async function settle() {
    for (let wave = 0; wave < 30; wave++) {
      await flush(); advanceTimers(); await flush(); const pending = jobs.filter(job => !job.done);
      if (!pending.length) return;
      for (const job of pending) { job.done = true; job.resolve(); }
    }
    throw new Error("Prepared selection did not settle.");
  }
  const started = selection.start(); await settle(); assert.equal(await started, true); binding.setReady(); f.playback.setReady();
  return { ...f, selection, binding, presentation, residency, view, inputs, buttons, jobs, errors, materialErrors,
    settle, flush, advanceTimers, listenerCount: () => [...inputs.values(), ...buttons].reduce((sum, input) => sum + input.listeners.size, 0) };
}
