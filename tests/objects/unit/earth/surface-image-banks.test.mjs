import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../../unit/earth/prepared-fixture.mjs";
import { earthSurfaceBankInventory } from "../../unit/earth/prepared-fixture.mjs";
const banks = earthSurfaceBankInventory();
import { requireEarthSurfacePages } from "../../unit/earth/prepared-fixture.mjs";
import { preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mjs";
const pages = f => f.residency.stats().pools.find(pool => pool.id === "pages");
const pendingPages = f => f.jobs.filter(job => !job.done && banks.some(bank => bank.urls.includes(job.url)) && job.image.src);
const surface = f => f.stage.querySelectorAll("*").find(node => node.classList.contains("earth-body") && !node.classList.contains("earth-body-polar"));
const cutaway = f => f.stage.querySelectorAll("*").find(node => node.classList.contains("earth-cutaway-body") && !node.classList.contains("earth-cutaway-body-polar"));
const palette = node => Array.from({ length: 7 }, (_, i) => node.style.getPropertyValue(`--earth-surface-page-${i}`));

test("Earth's actual prepared inventory has seven complete, exclusive pages per lens", () => {
  for (const value of [undefined, [], "/scenes/earth/a.webp", ["/scenes/earth/a.webp", "/scenes/earth/a.webp"]]) {
    assert.throws(() => requireEarthSurfacePages(value), /prepared page URLs/);
  }
  assert.ok(banks.every(bank => bank.urls.length === 7));
  const urls = banks.flatMap(bank => bank.urls); assert.equal(new Set(urls).size, urls.length);
});

test("Earth publishes complete visible palettes with two native decode slots and clears the hidden bank", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    assert.deepEqual(palette(cutaway(f)), Array(7).fill("none"));
    for (const id of ["topography", "night-lights", "cross-section", "normal"]) {
      const previous = palette(surface(f));
      const request = f.selection.dispatch({ kind: "lens", id }); await f.flush();
      assert.equal(pendingPages(f).length, 2); assert.deepEqual(palette(surface(f)), previous);
      assert.ok(pages(f).resident <= 14);
      await f.settle(); assert.equal(await request, true);
      const visible = id === "cross-section" ? cutaway(f) : surface(f);
      const hidden = id === "cross-section" ? surface(f) : cutaway(f);
      assert.deepEqual(palette(visible), banks.find(bank => bank.id === id).urls.map(url => `url("${url}")`));
      assert.deepEqual(palette(hidden), Array(7).fill("none"));
      assert.equal(pages(f).resident, 7); assert.equal(pages(f).pending, 0);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth cancelled never-ending pages free both slots before a replacement decode settles", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const old = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    const retired = pendingPages(f); assert.equal(retired.length, 2);
    const next = f.selection.dispatch({ kind: "lens", id: "night-lights" }); await f.flush();
    assert.equal(await old, false); assert.ok(retired.every(job => !job.done && job.image.src === ""));
    assert.equal(pendingPages(f).length, 2); await f.settle(); assert.equal(await next, true);
    retired[0].resolve(); retired[1].reject(new Error("late retired page")); await f.flush();
    assert.equal(pages(f).resident, 7); assert.equal(pages(f).pending, 0);
    assert.equal(f.selection.state().committed.lensId, "night-lights"); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth A/B/A supersession cannot release or publish over the latest page lease", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const a = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    const b = f.selection.dispatch({ kind: "lens", id: "night-lights" }); await f.flush();
    const winner = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    await f.settle(); assert.deepEqual(await Promise.all([a, b, winner]), [false, false, true]);
    assert.equal(f.selection.state().committed.lensId, "topography"); assert.equal(pages(f).resident, 7);
    assert.deepEqual(f.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["topography"]);
  } finally { f.restore(); }
});

test("Earth returning to the committed bank cancels pending pages without another decode", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.flush();
    const count = f.jobs.length;
    assert.equal(await f.selection.dispatch({ kind: "lens", id: "normal" }), true); assert.equal(await pending, false);
    assert.equal(f.jobs.length, count); assert.equal(pages(f).resident, 7); assert.equal(pages(f).pending, 0);
  } finally { f.restore(); }
});

for (const failure of ["page", "pole"]) test(`Earth a ${failure} decode failure preserves the complete visible bank and permits retry`, async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
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
    assert.deepEqual(palette(surface(f)), previous); assert.equal(pages(f).resident, 7);
    const retry = f.selection.dispatch({ kind: "lens", id: "topography" }); await f.settle(); assert.equal(await retry, true);
    assert.equal(f.stage.dataset.lens, "topography"); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth native palette publication failure retires all shared owners without committing success", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
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
  const f = await preparedSelectionFixture(runtimeDefinition);
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


test("Buenos Aires noise reuses the normal surface without decoding or retiring its pages", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const before = pages(f).resident, paletteBefore = palette(surface(f));
    const requestedPages = () => f.jobs.filter(job => banks.some(bank => bank.urls.includes(job.url))).length;
    const requests = requestedPages();
    const selected = f.selection.dispatch({ kind: "lens", id: "buenos-aires-noise" });
    await f.settle(); assert.equal(await selected, true);
    assert.deepEqual(palette(surface(f)), paletteBefore);
    assert.equal(requestedPages(), requests); assert.equal(pages(f).resident, before);
    const back = f.selection.dispatch({ kind: "lens", id: "normal" });
    await f.settle(); assert.equal(await back, true);
    assert.equal(requestedPages(), requests);
  } finally { f.restore(); }
});
