import test from "node:test";
import assert from "node:assert/strict";
import { mountPreparedMapPages } from "./prepared-map/city-pages.mts";
import { retainedPresentationFixture } from "./test/object-runtime-package.mjs";

for (const failure of [null, "construction", "cleanup"]) test(`prepared map lifetime releases native pages and observers (${failure})`, () => {
  const f = retainedPresentationFixture({ assets: { entries: [] } });
  const images = [], disconnected = [], cancelled = [];
  const globals = { Image: class {
    constructor() {
      if (failure === "construction" && images.length === 1) throw new Error("image construction");
      images.push(this); this.src = "initial";
    }
  }, ResizeObserver: class { observe() {} disconnect() { disconnected.push("resize"); } },
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
      assert.throws(mount, /image construction/);
      assert.equal(f.stage.children.length, 0); assert.equal(images[0].src, "");
    } else {
      const pages = mount(); assert.equal(f.stage.children.length, 2);
      pages.publish({ zoom: 0 });
      if (failure === "cleanup") Object.defineProperty(images[0], "src", { set() { throw new Error("image cleanup"); } });
      const errors = f.lifetime.destroy();
      assert.equal(errors.length, failure === "cleanup" ? 1 : 0);
      assert.equal(images[1].src, ""); assert.equal(f.stage.children.length, 0);
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
