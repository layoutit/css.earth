import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../../unit/earth/prepared-fixture.mts";
import { earthSurfaceBankInventory } from "../../unit/earth/prepared-fixture.mts";
const banks = earthSurfaceBankInventory();
import { requireEarthSurfacePages } from "../../unit/earth/prepared-fixture.mts";
import { preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
const pages = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => required(f.residency.stats().pools.find(pool => pool.id === "pages"));
const pageUrls = new Set(runtimeDefinition.assets.entries.filter(entry => entry.pool === "pages").map(entry => entry.url));
const pendingPages = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => f.jobs.filter(job => !job.done && pageUrls.has(job.url) && job.image.src);
const withinBudget = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => {
  const stats = pages(f);
  assert.ok(stats.resident <= stats.capacity);
  assert.ok(required(stats.decodedBytes) <= required(stats.maximumDecodedBytes));
  assert.ok(stats.nativeSlots <= stats.capacity);
  assert.ok(required(f.residency.stats().images.pools.find(pool => pool.id === "pages")).active <= 2);
};
const selectedPalette = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => {
  const plan = required(f.selection.state().plan);
  return required(banks.find(bank => bank.id === required(f.selection.state().committed).lensId)).urls.map(url => {
    const source = required(runtimeDefinition.assets.entries.find(entry => entry.url === url));
    return `url("${f.residency.resources.url(required(plan.textureResources)[source.key])}")`;
  });
};
const surface = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => required(f.stage.querySelectorAll("*").find(node => node.classList.contains("earth-body") && !node.classList.contains("earth-body-polar")));
const cutaway = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => required(f.stage.querySelectorAll("*").find(node => node.classList.contains("earth-cutaway-body") && !node.classList.contains("earth-cutaway-body-polar")));
const palette = (node:ReturnType<typeof surface>) => Array.from({ length: 7 }, (_, i) => node.style.getPropertyValue(`--earth-surface-page-${i}`));

test("Earth's prepared lenses have complete banks and share only complete source banks", () => {
  for (const value of [undefined, [], "/scenes/earth/a.webp", ["/scenes/earth/a.webp", "/scenes/earth/a.webp"]]) {
    assert.throws(() => Reflect.apply(requireEarthSurfacePages,undefined,[value]), /prepared page URLs/);
  }
  assert.ok(banks.every(bank => bank.urls.length === 7));
  for (const bank of banks) {
    assert.equal(new Set(bank.urls).size, 7);
    for (const other of banks) {
      const shared = bank.urls.filter(url => other.urls.includes(url));
      assert.ok(shared.length === 0 || shared.length === 7);
      if (shared.length) assert.deepEqual(bank.urls, other.urls);
    }
  }
});

test("Earth publishes complete visible palettes with two native decode slots and clears the hidden bank", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const nodes = f.stage.querySelectorAll("*");
    assert.deepEqual(palette(cutaway(f)), Array(7).fill("none"));
    for (const id of ["topography", "night-lights", "cross-section", "normal"]) {
      const previous = palette(surface(f));
      const request = f.selection.dispatch({ kind: "lens", id }); await f.flush();
      assert.equal(pendingPages(f).length, id === "normal" ? 0 : 2);
      if (id !== "normal") assert.deepEqual(palette(surface(f)), previous);
      withinBudget(f);
      await f.settle(); assert.equal(await request, true);
      const visible = id === "cross-section" ? cutaway(f) : surface(f);
      const hidden = id === "cross-section" ? surface(f) : cutaway(f);
      assert.deepEqual(palette(visible), selectedPalette(f));
      assert.deepEqual(palette(hidden), Array(7).fill("none"));
      withinBudget(f); assert.equal(pages(f).pending, 0);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    const decodes = f.jobs.length;
    const cached = f.selection.dispatch({ kind: "lens", id: "topography" });
    await f.settle(); assert.equal(await cached, true);
    assert.equal(f.jobs.length, decodes);
    assert.deepEqual(palette(surface(f)), selectedPalette(f));
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth cancelled never-ending pages free both slots before a replacement decode settles", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const old = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    const retired = pendingPages(f); assert.equal(retired.length, 2);
    const next = f.selection.dispatch({ kind: "lens", id: "night-lights" }); await f.flush();
    assert.equal(await old, false); assert.ok(retired.every(job => !job.done && job.image.src === ""));
    assert.equal(pendingPages(f).length, 2); await f.settle(); assert.equal(await next, true);
    retired[0].resolve(); retired[1].reject(new Error("late retired page")); await f.flush();
    withinBudget(f); assert.equal(pages(f).pending, 0);
    assert.equal(required(f.selection.state().committed).lensId, "night-lights"); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth A/B/A supersession cannot release or publish over the latest page lease", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const a = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    const b = f.selection.dispatch({ kind: "lens", id: "night-lights" }); await f.flush();
    const winner = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    await f.settle(); assert.deepEqual(await Promise.all([a, b, winner]), [false, false, true]);
    assert.equal(required(f.selection.state().committed).lensId, "topography"); withinBudget(f);
    assert.deepEqual(f.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["topography"]);
  } finally { f.restore(); }
});

test("Earth returning to the committed bank cancels pending pages without another decode", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const pending = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    const count = f.jobs.length;
    assert.equal(await f.selection.dispatch({ kind: "lens", id: "normal" }), true); assert.equal(await pending, false);
    assert.equal(f.jobs.length, count); withinBudget(f); assert.equal(pages(f).pending, 0);
  } finally { f.restore(); }
});

for (const failure of ["page", "pole"]) test(`Earth a ${failure} decode failure preserves the complete visible bank and permits retry`, async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const previous = palette(surface(f));
    const request = f.selection.dispatch({ kind: "lens", id: "topography" }); const rejection = assert.rejects(request, /decode/);
    await f.flush();
    const job = failure === "page" ? pendingPages(f)[0] : f.jobs.find(job => !job.done && job.url.includes("topography-poles"));
    assert.ok(job);
    if (failure === "pole") {
      for (let wave = 0; wave < 7; wave++) { for (const page of pendingPages(f)) { page.done = true; page.resolve(); } await f.flush(); }
      assert.deepEqual(palette(surface(f)), previous);
    }
    job.done = true; job.reject(new Error(`${failure} failed`)); await rejection;
    assert.deepEqual(palette(surface(f)), previous); withinBudget(f);
    const retry = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.settle(); assert.equal(await retry, true);
    assert.equal(f.stage.dataset.lens, "topography"); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth native palette publication failure retires all shared owners without committing success", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const committed = f.selection.state().committed;
    surface(f).style.setProperty = () => { throw new Error("palette publication failed"); };
    const result = f.selection.dispatch({ kind: "lens", id: "topography" }).catch(error => error);
    await f.settle(); await result;
    assert.equal(f.lifetime.disposed, true); assert.equal(f.errors.length, 1);
    assert.deepEqual(f.selection.state().committed, committed); assert.equal(f.residency.stats().images.entries.length, 0);
    assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

test("Earth disposal retires all pages after one native cleanup failure and prevents late publication", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const pending = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    const row = pendingPages(f)[0]; row.image.removeAttribute = () => { throw new Error("page release failed"); };
    assert.equal(f.lifetime.destroy().length, 1); assert.equal(await pending, false);
    f.stage.dataset.lens = "replacement";
    for (const job of f.jobs.filter(job => !job.done)) job.reject(new Error("late")); await f.flush();
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0);
    assert.equal(f.stage.dataset.lens, "replacement");
  } finally { f.restore(); }
});


test("a retired city lens cannot change the MVP surface bank", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition, { silhouetteDiameter: 100 });
  try {
    const before = pages(f).resident, paletteBefore = palette(surface(f));
    const requestedPages = () => f.jobs.filter(job => pageUrls.has(job.url)).length;
    const requests = requestedPages();
    await assert.rejects(async () => f.selection.dispatch({ kind: "lens", id: "buenos-aires-noise" }), /Unknown object lens/);
    await f.settle();
    assert.deepEqual(palette(surface(f)), paletteBefore);
    assert.equal(requestedPages(), requests); assert.equal(pages(f).resident, before);
    const back = f.selection.dispatch({ kind: "lens", id: "normal" });
    await f.settle(); assert.equal(await back, true);
    assert.equal(requestedPages(), requests);
  } finally { f.restore(); }
});
