import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createPreparedImageStore } from "../../../platform/prepared-image-store.mjs";
import { createSceneLifetime } from "../../../platform/scene-lifetime.mjs";
import { createEarthLensControls } from "../runtime/client.mjs";
import { PREPARED_EARTH_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import {
  createEarthSurfaceImageBanks,
  publishEarthSurfacePages,
  requireEarthSurfacePages,
} from "../runtime/surface-image-banks.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const inventory = ["a", "b", "c"].map((id) => ({ id,
  urls: Array.from({ length: 7 }, (_, i) => `/scenes/earth/${id}-${i}.webp`),
}));

function fixture(bankInventory = inventory) {
  const images = [];
  const imageStore = createPreparedImageStore({ createImage() {
    const image = {
      src: "", naturalWidth: 1, naturalHeight: 1, settled: false, releases: 0,
      decode() { return new Promise((resolve, reject) => {
        this.resolve = () => { this.settled = true; resolve(); };
        this.reject = (error) => { this.settled = true; reject(error); };
      }); },
      removeAttribute(name) {
        if (name !== "src") return;
        this.releases++;
        if (this.failRelease) throw new Error("native release failed");
        this.src = "";
        // Deliberately do NOT settle decode: Chrome may leave it pending.
      },
    };
    images.push(image);
    return image;
  } });
  const banks = createEarthSurfaceImageBanks({ imageStore, banks: bankInventory });
  async function complete(ticket) {
    let settled = false, failure;
    ticket.ready.then(() => { settled = true; }, (error) => { settled = true; failure = error; });
    for (let iteration = 0; iteration < 20 && !settled; iteration++) {
      await tick();
      for (const image of images) if (!image.settled && ticket.urls.includes(image.src)) image.resolve();
    }
    assert.ok(settled, `Bank ${ticket.id} did not finish`);
    if (failure) throw failure;
    return ticket.ready;
  }
  return { images, imageStore, banks, complete,
    cleanup() { banks.destroy(); imageStore.destroy(); } };
}

test("Earth requires explicit nonempty page arrays and exclusive bank URLs", () => {
  for (const pages of [undefined, "/scenes/earth/a.webp", [], ["/scenes/earth/a.webp", "/scenes/earth/a.webp"]]) {
    assert.throws(() => requireEarthSurfacePages(pages), /prepared page URLs/u);
  }
  const store = { load() {}, release() {} };
  assert.throws(() => createEarthSurfaceImageBanks({ imageStore: store, banks: [
    { id: "a", urls: inventory[0].urls }, { id: "b", urls: inventory[0].urls },
  ] }), /distinct page URLs/u);
});

test("Earth decodes at most two owned pages and retains only the committed surface bank", async () => {
  const f = fixture();
  try {
    for (const id of ["a", "b", "c"]) {
      const previous = f.banks.stats().activeId;
      const ticket = f.banks.request(id);
      await tick();
      assert.equal(f.images.filter((image) => image.src && !image.settled).length, 2);
      assert.equal(f.banks.stats().activeId, previous);
      assert.ok(f.banks.stats().retainedBankCount <= 2);
      await f.complete(ticket);
      f.banks.commit(ticket);
      assert.equal(f.banks.stats().activeId, id);
      assert.equal(f.banks.stats().retainedBankCount, 1);
      assert.deepEqual(f.imageStore.stats(), { retainedCount: 7, pendingCount: 0 });
      assert.ok(f.images.filter((image) => image.src).every((image) => ticket.urls.includes(image.src)));
    }
  } finally { f.cleanup(); }
});

test("Earth coalesces live requests without letting an old discard retire the newer owner", async () => {
  const f = fixture();
  try {
    const first = f.banks.request("a"), latest = f.banks.request("a");
    assert.equal(first.ready, latest.ready);
    f.banks.discard(first);
    await f.complete(latest);
    assert.throws(() => f.banks.commit(first), /stale/u);
    f.banks.commit(latest);
    assert.equal(f.images.length, 7);
    assert.equal(f.banks.stats().activeId, "a");
  } finally { f.cleanup(); }
});

test("Earth retirement frees worker slots even if both old native decodes never settle", async () => {
  const f = fixture();
  try {
    const first = f.banks.request("a");
    await tick();
    const old = [...f.images];
    assert.equal(old.length, 2);
    const second = f.banks.request("b");
    assert.equal(await first.ready, null);
    await tick();
    assert.equal(f.images.length, 4, "B starts before either retired A promise settles");
    assert.ok(old.every((image) => image.src === "" && !image.settled));
    assert.equal(f.banks.stats().inFlightPageCount, 2);
    await f.complete(second);
    f.banks.commit(second);
    old[0].resolve(); old[1].reject(new Error("late retired failure"));
    await tick();
    assert.equal(f.banks.stats().inFlightPageCount, 0, "late finalizers cannot release slots twice");
    assert.deepEqual(f.imageStore.stats(), { retainedCount: 7, pendingCount: 0 });
  } finally { f.cleanup(); }
});

test("Earth pending A/B/A reacquires retired pages without late release of replacement bytes", async () => {
  const f = fixture();
  try {
    const first = f.banks.request("a");
    await tick();
    const old = [...f.images];
    const middle = f.banks.request("b");
    await tick();
    const final = f.banks.request("a");
    assert.equal(await first.ready, null); assert.equal(await middle.ready, null);
    await tick();
    assert.equal(f.images.filter((image) => image.src === inventory[0].urls[0]).length, 1);
    old.forEach((image) => image.reject(new Error("retired original A")));
    f.banks.discard(first);
    await f.complete(final);
    f.banks.commit(final);
    assert.equal(f.imageStore.stats().retainedCount, 7);
  } finally { f.cleanup(); }
});

test("Earth returning to active A cancels pending B without decoding or double-counting A", async () => {
  const f = fixture();
  try {
    const first = f.banks.request("a"); await f.complete(first); f.banks.commit(first);
    const second = f.banks.request("b"); await tick();
    const allocationCount = f.images.length;
    const final = f.banks.request("a");
    assert.equal(await second.ready, null);
    await final.ready; f.banks.commit(final);
    assert.equal(f.images.length, allocationCount);
    assert.deepEqual(f.banks.stats(), { activeId: "a", pendingId: null,
      retainedBankCount: 1, inFlightPageCount: 0, queuedPageCount: 0 });
  } finally { f.cleanup(); }
});

test("Earth partial page failure releases its siblings but preserves the visible bank and permits retry", async () => {
  const f = fixture();
  try {
    const active = f.banks.request("a"); await f.complete(active); f.banks.commit(active);
    const failed = f.banks.request("b"); const rejection = assert.rejects(failed.ready, /did not decode/u);
    await tick();
    const pending = f.images.filter((image) => failed.urls.includes(image.src));
    pending[0].reject(new Error("page failed"));
    await rejection;
    assert.ok(pending.every((image) => image.src === ""));
    assert.equal(f.banks.stats().activeId, "a");
    assert.equal(f.imageStore.stats().retainedCount, 7);
    const retry = f.banks.request("b");
    await f.complete(retry); f.banks.commit(retry);
    pending[1].reject(new Error("late sibling"));
    await tick();
    assert.equal(f.banks.stats().activeId, "b");
    assert.equal(f.imageStore.stats().retainedCount, 7);
  } finally { f.cleanup(); }
});

test("Earth failed decode plus throwing cleanup preserves the primary error and releases every sibling", async () => {
  const f = fixture();
  try {
    const failed = f.banks.request("a");
    const rejection = assert.rejects(failed.ready, (error) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.message, /did not decode/u);
      return true;
    });
    await tick();
    f.images[0].failRelease = true;
    f.images[0].reject(new Error("primary native failure"));
    await rejection;
    assert.ok(f.images.every((image) => image.releases === 1));
    assert.equal(f.images[1].src, "");
    assert.equal(f.banks.stats().inFlightPageCount, 0);
    assert.equal(f.imageStore.stats().pendingCount, 0);
    const replacement = f.banks.request("a");
    f.images[1].reject(new Error("late failed sibling"));
    await f.complete(replacement); f.banks.commit(replacement);
    assert.equal(f.imageStore.stats().retainedCount, 7);
  } finally { f.cleanup(); }
});

test("Earth destruction retires every page despite a throwing native release and contains late work", async () => {
  const f = fixture();
  const active = f.banks.request("a"); await f.complete(active); f.banks.commit(active);
  const pending = f.banks.request("b"); await tick();
  f.images[0].failRelease = true;
  assert.throws(() => f.banks.destroy(), AggregateError);
  assert.equal(await pending.ready, null);
  assert.ok(f.images.every((image) => image.releases === 1));
  assert.equal(f.banks.stats().retainedBankCount, 0);
  assert.equal(f.banks.stats().inFlightPageCount, 0);
  assert.deepEqual(f.imageStore.stats(), { retainedCount: 0, pendingCount: 0 });
  for (const image of f.images) if (!image.settled) image.reject(new Error("late disposal failure"));
  await tick();
  assert.equal(f.images.length, 9);
  assert.doesNotThrow(f.banks.destroy);
  f.imageStore.destroy();
});

test("Earth publishes complete prepared page palettes and clears hidden CSS without replacing carriers", () => {
  const carriers = [{ style: style() }, { style: style() }];
  const original = [...carriers];
  publishEarthSurfacePages(carriers, inventory[0].urls, 7);
  for (const carrier of carriers) for (let i = 0; i < 7; i++) {
    assert.equal(carrier.style.getPropertyValue(`--earth-surface-page-${i}`), `url("${inventory[0].urls[i]}")`);
  }
  assert.throws(() => publishEarthSurfacePages(carriers, inventory[0].urls.slice(1), 7), /complete page bank/u);
  publishEarthSurfacePages(carriers, [], 7);
  assert.deepEqual(carriers, original);
  assert.ok(carriers.every((carrier) => [...carrier.style.values.values()].every((value) => value === "none")));
});

test("Earth builds retained cutaway nodes with no initial large surface URL references", async () => {
  const source = await readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function createPreparedInterior(");
  const end = source.indexOf("\nfunction ", start + 1);
  let options;
  const mesh = () => ({ appendChild() {} });
  const factory = new Function("createMesh", "mountPreparedSphereBands", "canonicalPreparedUrl", "document",
    `${source.slice(start, end)}; return createPreparedInterior;`)(mesh, (value) => { options = value; return {}; },
    (pair) => pair.two, { createDocumentFragment: mesh });
  factory({ interior: { ...PREPARED_EARTH_SCENE.interior, shells: [], sectionLeaves: [] }, earth: {} });
  assert.deepEqual(options.textureUrls.surface, []);
  assert.equal(options.surfacePageCount, 7);
});

function style() {
  const values = new Map();
  return { values, setProperty(name, value) { values.set(name, value); }, getPropertyValue(name) { return values.get(name) ?? ""; } };
}

async function controlsFixture({ decode } = {}) {
  const bankInventory = PREPARED_EARTH_LENSES.controls.map((lens) => ({ id: lens.id,
    urls: lens.view === "interior" ? PREPARED_EARTH_SCENE.interior.outerAssets.surface.twoUrls : lens.surfaceUrls,
  }));
  const f = fixture(bankInventory);
  const initial = f.banks.request("normal"); await f.complete(initial); f.banks.commit(initial);
  const original = new Map(["HTMLElement", "document"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  class Element {
    classList = { add() {}, remove() {}, toggle() {} };
    setAttribute(name, value) { if (name === "aria-busy") this.busy = value; }
  }
  const buttons = PREPARED_EARTH_LENSES.controls.map(({ id }) => ({ value: id, addEventListener() {},
    setAttribute(name, value) { if (name === "aria-pressed") this.pressed = value; },
  }));
  const root = new Element(); root.querySelectorAll = () => buttons;
  globalThis.HTMLElement = Element; globalThis.document = { querySelector: () => root };
  const stage = { dataset: { lens: "normal" } };
  const body = [{ style: style() }], interior = [{ style: style() }], polar = [{ style: style() }];
  publishEarthSurfacePages(body, initial.urls, 7); publishEarthSurfacePages(interior, [], 7);
  const lifetime = createSceneLifetime(), errors = [], decoded = [];
  lifetime.onDispose(f.cleanup);
  const controls = createEarthLensControls({ stage, lifetime, surfaceBanks: f.banks,
    decodePreparedImage: async (asset) => { decoded.push(asset); await decode?.(asset); },
    onError(error) { errors.push(error); lifetime.destroy(); },
  });
  await controls.bindRuntime({ bodyCarriers: { surface: body, polar }, viewBank: {
    mountInterior() {},
    publishSurfacePages(urls) { publishEarthSurfacePages(interior, urls, 7); },
    clearSurfacePages() { publishEarthSurfacePages(interior, [], 7); },
  } });
  async function completeSelection(id) {
    // Observe the current bank without acquiring another ownership ticket.
    const urls = bankInventory.find((bank) => bank.id === id).urls;
    for (let i = 0; i < 10; i++) {
      await tick();
      for (const image of f.images) if (!image.settled && urls.includes(image.src)) image.resolve();
    }
  }
  return { ...f, controls, stage, root, body, interior, buttons, errors, decoded, lifetime, completeSelection,
    restore() {
      lifetime.destroy();
      for (const [name, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
      }
    },
  };
}

test("Earth actual lens transaction preserves visible pages on failure and atomically retires replaced pages", async () => {
  const f = await controlsFixture();
  try {
    const before = new Map(f.body[0].style.values);
    const selection = f.controls.select("topography");
    const failure = assert.rejects(selection, /did not decode/u);
    await tick();
    f.images.find((image) => image.src.includes("earth-topography")).reject(new Error("failed page"));
    await failure;
    assert.deepEqual(f.body[0].style.values, before);
    assert.equal(f.stage.dataset.lens, "normal");
    assert.equal(f.controls.state().ready, true);
    const retry = f.controls.select("topography");
    await f.completeSelection("topography");
    assert.equal(await retry, true);
    assert.equal(f.stage.dataset.lens, "topography");
    assert.equal(f.banks.stats().activeId, "topography");
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth a later pole decode failure discards prepared pages without changing the visible bank", async () => {
  const f = await controlsFixture({ decode: () => { throw new Error("pole decode failed"); } });
  try {
    const before = new Map(f.body[0].style.values);
    const selection = f.controls.select("topography");
    const failure = assert.rejects(selection, /pole decode failed/u);
    await f.completeSelection("topography"); await failure;
    assert.deepEqual(f.body[0].style.values, before);
    assert.equal(f.banks.stats().activeId, "normal");
    assert.equal(f.imageStore.stats().retainedCount, 7);
    assert.equal(f.controls.state().ready, true);
  } finally { f.restore(); }
});

test("Earth actual palette publication failure reaches the fatal boundary and releases all banks", async () => {
  const f = await controlsFixture();
  try {
    f.body[0].style.setProperty = () => { throw new Error("palette publication failed"); };
    const selection = f.controls.select("topography");
    const failure = assert.rejects(selection, /palette publication failed/u);
    await f.completeSelection("topography"); await failure;
    assert.equal(f.errors.length, 1);
    assert.equal(f.lifetime.disposed, true);
    assert.equal(f.banks.stats().retainedBankCount, 0);
    assert.equal(f.imageStore.stats().retainedCount, 0);
  } finally { f.restore(); }
});

test("Earth actual A/B/A selection contains never-settling retired pages and keeps the latest pressed state", async () => {
  const f = await controlsFixture();
  try {
    const a = f.controls.select("topography"); await tick();
    const b = f.controls.select("night-lights"); await tick();
    const latest = f.controls.select("topography"); await tick();
    assert.equal(await a, false); assert.equal(await b, false);
    await f.completeSelection("topography");
    assert.equal(await latest, true);
    assert.equal(f.stage.dataset.lens, "topography");
    assert.deepEqual(f.buttons.filter((button) => button.pressed === "true").map((button) => button.value), ["topography"]);
    assert.equal(f.banks.stats().retainedBankCount, 1);
  } finally { f.restore(); }
});

test("Earth actual interior/exterior commits clear the hidden large atlas while retaining all carriers", async () => {
  const f = await controlsFixture();
  try {
    const body = f.body[0], interior = f.interior[0];
    const cutaway = f.controls.select("cross-section");
    await f.completeSelection("cross-section"); assert.equal(await cutaway, true);
    assert.equal(f.stage.dataset.view, "interior");
    assert.ok([...body.style.values.values()].every((value) => value === "none"));
    assert.ok([...interior.style.values.values()].every((value) => value.includes("earth-interior-outer")));
    assert.equal(f.banks.stats().activeId, "cross-section");
    const normal = f.controls.select("normal");
    await f.completeSelection("normal"); assert.equal(await normal, true);
    assert.equal(f.stage.dataset.view, undefined);
    assert.ok([...interior.style.values.values()].every((value) => value === "none"));
    assert.equal(f.body[0], body); assert.equal(f.interior[0], interior);
    assert.equal(f.banks.stats().activeId, "normal");
  } finally { f.restore(); }
});

test("Earth actual destruction settles pending selection and prevents late palette writes", async () => {
  const f = await controlsFixture();
  try {
    const before = new Map(f.body[0].style.values);
    const selection = f.controls.select("topography"); await tick();
    f.lifetime.destroy();
    assert.equal(await selection, false);
    for (const image of f.images) if (!image.settled) image.reject(new Error("late disposed page"));
    await tick();
    assert.deepEqual(f.body[0].style.values, before);
    assert.equal(f.banks.stats().retainedBankCount, 0);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
