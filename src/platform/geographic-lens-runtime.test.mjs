import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createGeographicLensRuntime } from "./geographic-lens-runtime.mjs";
import { requireGeographicLensPackage } from "./geographic-lens-contract.mjs";
import { PREPARED_GEOGRAPHIC_LENSES } from "../planets/earth/runtime/preparedGeographicLenses.mjs";
import { runtimeDefinition } from "../planets/earth/runtime/definition.mjs";

const descriptor = PREPARED_GEOGRAPHIC_LENSES[0].lens;
const bytes = await readFile(new URL(`../../public${descriptor.package.url}`, import.meta.url));
const content = JSON.parse(bytes);
const capacity = runtimeDefinition.pageLayers.find(layer => layer.geographic).plan;
const hash = value => createHash("sha256").update(value).digest("hex");
function harness(fetcher = async () => new Response(bytes)) {
  let entity = { id: "3435910", lenses: [descriptor] }, mounted = null;
  const replacements = [], bases = [], changes = [], requests = [];
  const runtime = createGeographicLensRuntime({ capacity, getEntity: () => entity,
    pages: { replacePlan(plan) { mounted = plan; replacements.push(plan); },
      stats: () => ({ errors: [], pendingSelection: false, desired: mounted?.roots.map(page => page.key) ?? [],
        retained: mounted?.roots.map(page => ({ key: page.key, published: true })) ?? [] }) },
    selectBase: async id => { bases.push(id); return true; }, onChange: state => changes.push(state),
    fetcher: (...args) => { requests.push(args); return fetcher(...args); } });
  return { runtime, replacements, bases, changes, requests, setEntity: next => { entity = next; }, mounted: () => mounted };
}
test("Earth starts with an empty fixed overlay pool and no dataset-specific selection variant", () => {
  assert.equal(capacity.roots.length, 0);
  assert.equal(runtimeDefinition.pageLayers.filter(layer => layer.geographic).length, 1);
  assert.equal(runtimeDefinition.variants.some(variant => variant.when.lensId === descriptor.id), false);
  const h = harness(); assert.equal(h.requests.length, 0); assert.equal(h.mounted(), null);
  h.runtime.destroy();
});
test("pinned package loads only on selection, reuses the normal base and releases on clear", async () => {
  const h = harness(); assert.equal(await h.runtime.select("absent"), false); assert.equal(h.requests.length, 0);
  assert.equal(await h.runtime.select(descriptor.id), true);
  assert.deepEqual(h.bases, ["normal"]); assert.deepEqual(h.mounted(), content.pages);
  assert.equal(h.runtime.state().status, "ready");
  h.runtime.clear(); assert.equal(h.runtime.state().id, null); assert.equal(h.mounted(), null);
  h.runtime.destroy();
});
test("size, hash and HTTP failures keep the base available and permit explicit retry", async () => {
  for (const failure of [() => new Response(Buffer.concat([bytes, Buffer.from("x")])),
    () => new Response(Buffer.alloc(bytes.length)), () => new Response("", { status: 503 })]) {
    let failed = true;
    const h = harness(() => failed ? failure() : new Response(bytes));
    assert.equal(await h.runtime.select(descriptor.id), false); assert.equal(h.runtime.state().status, "error");
    assert.equal(h.mounted(), null); assert.deepEqual(h.bases, []);
    failed = false; assert.equal(await h.runtime.select(descriptor.id), true); h.runtime.destroy();
  }
});
test("switching entity or destroying the mount prevents a delayed package from publishing", async () => {
  for (const action of [h => { h.setEntity({ id: "other", lenses: [] }); h.runtime.clear(); }, h => h.runtime.destroy()]) {
    let resolve;
    const h = harness(() => new Promise(done => { resolve = done; }));
    const load = h.runtime.select(descriptor.id); action(h); resolve(new Response(bytes));
    assert.equal(await load, false); assert.equal(h.mounted(), null); assert.deepEqual(h.bases, []);
    assert.equal(h.requests[0][1].signal.aborted, true);
  }
});
test("the same loader accepts another data identity without adding a renderer", async () => {
  const next = { ...content, id: "another-observation", entityIds: ["other"] };
  const nextBytes = Buffer.from(JSON.stringify(next)), sha256 = hash(nextBytes);
  const nextDescriptor = { ...descriptor, id: next.id, package: { url: `/scenes/earth/another-${sha256.slice(0,16)}.json`, bytes: nextBytes.length, sha256 } };
  const h = harness(() => new Response(nextBytes)); h.setEntity({ id: "other", lenses: [nextDescriptor] });
  assert.equal(await h.runtime.select(next.id), true); assert.equal(h.runtime.state().id, next.id);
  assert.equal(h.replacements.filter(Boolean).length, 1); h.runtime.destroy();
});
test("package identity, retained capacity and prepared geometry are validated before use", () => {
  for (const mutate of [p => { p.entityIds = ["wrong"]; }, p => { p.source.sha256 = "wrong"; },
    p => { p.pages.poolSize *= 2; }, p => { p.pages.roots[0].frameMatrix = "NaN"; },
    p => { p.pages.roots[0].url = "https://unrelated.invalid/image.webp"; }]) {
    const value = structuredClone(content); mutate(value);
    assert.throws(() => requireGeographicLensPackage(value, descriptor, "3435910", capacity));
  }
});
