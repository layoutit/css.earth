import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mountPreparedMapPages } from "./prepared-map/city-pages.mjs";
import { retainedPresentationFixture } from "./test/object-runtime-package.mjs";

for (const failure of [null, "construction", "cleanup"]) test(`prepared map lifetime releases native pages and observers (${failure})`, () => {
  const f = retainedPresentationFixture({ assets: { entries: [] } });
  const disconnected = [], cancelled = [];
  const append = f.stage.appendChild;
  f.stage.appendChild = function(child) {
    if (failure === "construction" && this.children.length === 1) throw new Error("page construction");
    return append.call(this, child);
  };
  const globals = { Image: class {
    constructor() { assert.fail("An empty page pool must not allocate native images"); }
  }, ResizeObserver: class { observe() {} disconnect() { disconnected.push("resize"); if (failure === "cleanup") throw new Error("observer cleanup"); } },
  MutationObserver: class { observe() {} disconnect() { disconnected.push("mutation"); } },
  requestAnimationFrame: () => 17, cancelAnimationFrame: id => cancelled.push(id) };
  const saved = new Map(Object.keys(globals).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  try {
    const mount = () => mountPreparedMapPages({ plan: { schema: "cssearth-prepared-map-pages@1", assetPath: "/scenes/earth/",
      assetOrigin: "https://earth-assets.lowpoly.cc", poolSize: 2, maximumDecodedBytes: 16,
      decodedPageBytes: 4, rasterScale: 1, initialLayer: { frameMatrix: "", textureMatrix: "" },
      roots: [], index: { maximumDirectories: 1, maximumBytes: 1024, maximumConcurrentLoads: 1 } },
      carrier: f.stage, system: f.stage, scene: f.stage, camera: f.stage, stage: f.stage,
      className: "map-page", textureClassName: "map-texture", lensIds: ["normal"], own: f.context.own });
    if (failure === "construction") {
      assert.throws(mount, /page construction/);
      assert.equal(f.stage.children.length, 0);
    } else {
      const pages = mount(); assert.equal(f.stage.children.length, 2);
      pages.publish({ zoom: 0 });
      const errors = f.lifetime.destroy();
      assert.equal(errors.length, failure === "cleanup" ? 1 : 0);
      assert.equal(f.stage.children.length, 0);
      assert.deepEqual(disconnected, ["resize", "mutation"]); assert.deepEqual(cancelled, [17]);
      pages.destroy(); assert.deepEqual(cancelled, [17]);
    }
  } finally {
    f.restore();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});

test("prepared pages fetch, decode and publish while unrelated metadata is pending", async () => {
  const f = retainedPresentationFixture({ assets: { entries: [] } });
  const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  Object.defineProperty(HTMLElement.prototype, "firstElementChild", { get() { return this.children[0]; } });
  DOMMatrix.prototype.toFloat64Array = () => new Float64Array(identity);
  Object.assign(f.stage, { clientWidth: 800, clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) });
  const pixels = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6XcAAAAASUVORK5CYII=", "base64");
  const sha256 = createHash("sha256").update(pixels).digest("hex");
  const directoryHash = "a".repeat(64), requests = [], frames = new Map(), decodes = [];
  let nextFrame = 0, directoryAborted = false, knownDirectory;
  const globals = {
    Image: class { naturalWidth = 1; naturalHeight = 1; src = "";
      decode() { return new Promise(resolve => decodes.push(resolve)); } },
    ResizeObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    getComputedStyle: () => ({ transform: `matrix3d(${identity})`, scale: "1" }),
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    fetch: async (url, { signal }) => {
      requests.push(url);
      if (url.includes(directoryHash.slice(0,16))) return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => { directoryAborted = true; reject(signal.reason); }, { once: true });
      });
      if (url.includes("city-index-")) return new Response(knownDirectory);
      return new Response(pixels);
    },
  };
  const saved = new Map(Object.keys(globals).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  let pages;
  try {
    const bounds = { corners: [[-100,-100,0],[100,-100,0],[100,100,0],[-100,100,0]], normal: [0,0,1] };
    const image = { ...bounds, key: "image", rasterSource: "prepared-raster@1", width: 1, height: 1,
      bytes: pixels.length, sha256, url: `/scenes/earth/test-${sha256.slice(0,16)}.webp`,
      frameMatrix: identity.join(","), textureMatrix: identity.join(",") };
    const known = { ...bounds, key: "ready-region", level: 5, pages: [image.key], children: [], maximumCssSpan: 384 };
    knownDirectory = Buffer.from(JSON.stringify({ schema: "cssearth-city-index@1", dataset: "test", nodes: [known, image], external: [] }));
    const knownHash = createHash("sha256").update(knownDirectory).digest("hex");
    const knownStub = { ...bounds, key: known.key, level: 5, stub: true,
      directory: { url: `https://earth-assets.lowpoly.cc/scenes/earth/city-index-test-5-1-0-${knownHash.slice(0,16)}.json`, sha256: knownHash, bytes: knownDirectory.length } };
    const unknown = { ...bounds, key: "pending-region", level: 5, stub: true,
      directory: { url: `https://earth-assets.lowpoly.cc/scenes/earth/city-index-test-5-0-0-${directoryHash.slice(0,16)}.json`, sha256: directoryHash, bytes: 100 } };
    pages = mountPreparedMapPages({ plan: { schema: "cssearth-prepared-map-pages@1", topology: "wmts-quadtree@1",
      dataset: "test", assetPath: "/scenes/earth/", assetOrigin: "https://earth-assets.lowpoly.cc", poolSize: 4,
      maximumDecodedBytes: 16, decodedPageBytes: 4, maximumConcurrentLoads: 1, minimumZoom: 0,
      rasterScale: 1, initialLayer: { frameMatrix: identity.join(","), textureMatrix: identity.join(",") },
      roots: [knownStub, unknown],
      index: { maximumDirectories: 2, maximumBytes: 4096, maximumDirectoryBytes: 2048, maximumConcurrentLoads: 1 } },
      carrier: f.stage, system: f.stage, scene: f.stage, camera: f.stage, stage: f.stage,
      className: "map-page", lensIds: ["normal"], own: f.context.own });
    pages.publish({ zoom: 1 });
    for (let i = 0; i < 100 && !decodes.length; i++) {
      const callbacks = [...frames.values()]; frames.clear();
      for (const callback of callbacks) callback();
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    assert.equal(pages.stats().index.activeLoads, 1);
    assert.equal(requests.length, 3, "both directories and the ready image request start");
    assert.equal(decodes.length, 1);
    assert.equal(pages.stats().activeLoads, 1, "image admission spans decode");
    decodes[0](); await pages.whenIdle();
    assert.equal(pages.stats().index.activeLoads, 1, "directory still has not completed");
    assert.equal(pages.stats().retained[0].published, true);
    assert.equal(f.stage.children[0].style.visibility, "visible");
    assert.deepEqual(pages.stats().errors, []);
    pages.destroy(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(directoryAborted, true);
    assert.equal(pages.stats().reservedDecodedBytes, 0);
    assert.equal(f.stage.children.length, 0);
  } finally {
    pages?.destroy();
    f.restore();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});
