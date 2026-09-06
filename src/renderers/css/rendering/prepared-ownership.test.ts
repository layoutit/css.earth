import { expect, test } from "vitest";
import { createPreparedImageStore, type PreparedImage } from "./prepared-image-store.js";
import { createPreparedResidency, type PreparedAssets } from "./prepared-residency.js";
import { mountPreparedPresentation } from "./prepared-presentation.js";

class PresentationElement {
  parentNode: PresentationElement | null = null;
  children: PresentationElement[] = [];
  className = '';
  classList = { contains: (_name: string) => false, add: (..._names: string[]) => {}, toggle: (_name: string, _force?: boolean) => {} };
  dataset: Record<string, string> = {};
  style = { cssText: '', transform: '', visibility: '', setProperty: (_name: string, _value: string) => {}, getPropertyValue: (_name: string) => '' };
  constructor(readonly ownerDocument: PresentationDocument) {}
  appendChild(child: PresentationElement) { child.parentNode?.removeChild(child); child.parentNode = this; this.children.push(child); return child; }
  removeChild(child: PresentationElement) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  remove() { this.parentNode?.removeChild(this); }
  setAttribute(_name: string, _value: string) {}
  getAttribute(_name: string) { return null; }
  removeAttribute(_name: string) {}
  animate() { return { id: '', play() {}, pause() {}, cancel() {} } as unknown as Animation; }
}
class PresentationDocument { createElement() { return new PresentationElement(this); } }

class ControlledImage implements PreparedImage {
  src = "";
  decoding: PreparedImage["decoding"] = "async";
  naturalWidth = 1;
  naturalHeight = 1;
  calls = 0;
  complete!: () => void;
  fail!: (reason: unknown) => void;
  decode() {
    this.calls += 1;
    return new Promise<void>((resolve, reject) => { this.complete = resolve; this.fail = reject; });
  }
}
function imageHarness() {
  const images: ControlledImage[] = [];
  const createImage = () => { const image = new ControlledImage(); images.push(image); return image; };
  return { images, createImage };
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

test("shared URLs decode once while independent leases retain ownership", async () => {
  const h = imageHarness(), store = createPreparedImageStore(h), first = store.createLease("first"), second = store.createLease("second");
  const a = first.load("/shared.webp"), b = second.load("/shared.webp");
  expect(h.images).toHaveLength(1);
  expect(first.load("/shared.webp")).toBe(a);
  first.release("/shared.webp");
  expect(await a).toBeNull();
  h.images[0].complete();
  expect(await b).toBe(h.images[0]);
  expect(store.read("/shared.webp")).toBe(h.images[0]);
  store.destroy();
  expect(h.images[0].src).toBe("");
});

test('prepared presentation appends only its own roots and leaves the application context sibling intact', () => {
  const document = new PresentationDocument();
  const stage = new PresentationElement(document), universe = new PresentationElement(document);
  stage.appendChild(universe);
  const cleanups: (() => void)[] = [];
  const mounted = mountPreparedPresentation(stage as unknown as HTMLElement, {
    own(cleanup) { cleanups.push(cleanup); }, registerAnimation() {}, seekAnimation() {},
  }, {
    camera: {} as never, tree: { nodes: [
      { tag: 'div', parent: -1, className: null, style: '', properties: [], attributes: {} },
      { tag: 'div', parent: -1, className: null, style: '', properties: [], attributes: {} },
    ], properties: [], camera: 0, scene: 1, stageClasses: [] },
    variants: [], materials: [], viewBindings: [], animations: [],
  });
  expect(stage.children).toContain(universe);
  expect(stage.children).toContain(mounted.cameraElement);
  for (const cleanup of cleanups) cleanup();
  expect(stage.children).toEqual([universe]);
});

for (const rejectOld of [false, true]) test(`retired native work cannot clear a reused replacement slot (${rejectOld})`, async () => {
  const h = imageHarness(), store = createPreparedImageStore({ ...h, pools: [{ id: "rows", capacity: 1, concurrency: 1, reuse: true }] });
  const lease = store.createLease();
  const abandoned = lease.load("/old.webp", { pool: "rows" }), image = h.images[0];
  const completeOld = image.complete, failOld = image.fail;
  lease.release("/old.webp");
  const replacement = lease.load("/new.webp", { pool: "rows" });
  expect(h.images).toHaveLength(1);
  if (rejectOld) failOld(new Error("late failure")); else completeOld();
  expect(await abandoned).toBeNull();
  await flush();
  expect(image.src).toBe("/new.webp");
  expect(store.stats()).toEqual({ pendingCount: 1, retainedCount: 0 });
  image.complete();
  expect(await replacement).toBe(image);
  store.destroy();
});

test("native allocation failure rejects the request and permits an explicit retry", async () => {
  const h = imageHarness();
  let fail = true;
  const store = createPreparedImageStore({ createImage() { if (fail) throw new Error("allocation"); return h.createImage(); } });
  const lease = store.createLease();
  await expect(lease.load("/selected.webp")).rejects.toThrow("allocation");
  expect(store.stats()).toEqual({ pendingCount: 0, retainedCount: 0 });
  fail = false;
  const retry = lease.load("/selected.webp");
  h.images[0].complete();
  expect(await retry).toBe(h.images[0]);
  store.destroy();
});

function assets(retention: "selection" | "warm" = "selection"): PreparedAssets {
  return { startup: [], pools: [{ id: "material", capacity: 2, concurrency: 2, retention, reuse: true, eviction: "capacity" }],
    entries: ["a", "b", "c"].map(key => ({ key, url: `/${key}.webp`, pool: "material" })) };
}

test("latest residency demand preserves the committed row and rejects stale commits", async () => {
  const h = imageHarness(), owner = createPreparedResidency({ assets: assets(), createImage: h.createImage });
  const initial = owner.request({ required: ["a"] });
  h.images[0].complete();
  await initial.ready;
  owner.commit(initial);
  owner.beginFrame(); owner.resources.url("a"); owner.endFrame();
  const abandoned = owner.request({ required: ["b"] });
  const current = owner.request({ required: ["c"] });
  expect(await abandoned.ready).toBeNull();
  expect(owner.resources.has("a")).toBe(true);
  expect(owner.stats().pools[0].keys).toEqual(["a", "c"]);
  expect(h.images).toHaveLength(2);
  h.images[1].complete();
  await current.ready;
  owner.commit(current);
  expect(() => owner.commit(abandoned)).toThrow("stale");
  expect(owner.stats().committed).toEqual(["c"]);
  owner.destroy();
});

test("warm handoff keeps a published decoded URL while releasing its native slot", async () => {
  const h = imageHarness(), owner = createPreparedResidency({ assets: assets("warm"), createImage: h.createImage });
  const ticket = owner.request({ required: ["a"] });
  h.images[0].complete();
  await ticket.ready;
  owner.commit(ticket);
  expect(owner.resources.url("a")).toBe("/a.webp");
  expect(owner.resources.has("a")).toBe(true);
  expect(h.images[0].src).toBe("/a.webp");
  expect(owner.stats().pools[0].nativeSlots).toBe(0);
  owner.destroy();
});
