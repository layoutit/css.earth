import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';

class Window {
  time = 0; next = 0; frames = new Map<number, (time: number) => void>();
  performance = { now: () => this.time };
  requestAnimationFrame = (callback: (time: number) => void) => { this.frames.set(++this.next, callback); return this.next; };
  cancelAnimationFrame = (id: number) => { this.frames.delete(id); };
  advance(time: number) { this.time = time; const frames = [...this.frames.values()]; this.frames.clear(); frames.forEach(frame => frame(time)); }
}
class Element extends EventTarget {
  children: Element[] = []; parent: Element | null = null; style: Record<string, string> = {}; dataset: Record<string, string> = {};
  textContent = ''; clientWidth = 800; clientHeight = 600;
  readonly ownerDocument: Document;
  constructor(ownerDocument: Document) { super(); this.ownerDocument = ownerDocument; }
  get offsetWidth() { return this.textContent.length * 6; } get offsetHeight() { return 14; }
  setAttribute() {}
  append(...children: Element[]) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child: Element, before: Element | null) { child.remove(); child.parent = this; this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
}
class Document { count = 0; defaultView = new Window(); createElement() { this.count++; return new Element(this); } }
const read = (path: string) => JSON.parse(readFileSync(new URL(`../../../../src/objects/${path}`, import.meta.url), 'utf8'));

type Row = { id: string; name?: string; membership: { group: string }; detailedObjectId?: string };
const mount = (extra: { galaxySample?: unknown } = {}) => {
  const payload = read('local-group/prepared/catalogue.json');
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, ...extra });
  const world = { ...payload.frame, pose: { positionM: [0, 0, 1e24] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
  return { payload, document, runtime, world, viewport, root: runtime.root as unknown as Element };
};

test('the catalogue draws one dot for each Local Group row without a package, and nothing else', () => {
  const { payload, document, runtime, world, viewport, root } = mount();
  const rows: Row[] = payload.objects, packaged = rows.filter(row => row.detailedObjectId);
  assert.ok(packaged.length > 0);
  assert.equal(runtime.inspect().count, rows.filter(row => row.name && !row.detailedObjectId && row.membership.group === 'local-group').length);
  // A row with a package is a body of the world context: the catalogue draws no dot, marker or caption for it.
  for (const row of packaged) assert.equal(root.children.some(node => node.dataset.galaxyDot === row.id), false);
  assert.equal(root.children.every(node => node.dataset.galaxyDot !== undefined), true);
  for (const id of ['hydra_1', 'leo_a', 'sagittarius_1']) assert.equal(root.children.some(node => node.dataset.galaxyDot === id), true);
  runtime.publish(world, viewport, 1); document.defaultView.advance(300);
  const dots = root.children.filter(node => Number(node.style.opacity) > 0);
  assert.ok(dots.length > 10);
  assert.equal(dots.every(dot => Number(dot.style.opacity) <= .4), true);
  runtime.publish(world, viewport, 0); document.defaultView.advance(600);
  assert.equal(dots.every(dot => Number(dot.style.opacity) === 0), true);
  runtime.destroy();
  assert.equal(root.parent, null);
});

test('the baked display sample limits the dots to its rows', () => {
  const galaxySample = read('local-group/prepared/display-sample.json');
  const { payload, runtime } = mount({ galaxySample });
  const rows: Row[] = payload.objects;
  assert.equal(galaxySample.ids.length, 48);
  assert.equal(runtime.inspect().count, galaxySample.ids.filter((id: string) => !rows.find(row => row.id === id)!.detailedObjectId).length);
  runtime.destroy();
  assert.throws(() => mount({ galaxySample: { schema: 'cssearth-galaxy-display-sample@1', ids: ['not-a-row'] } }), /Invalid baked galaxy sample/u);
});

test('a camera in another frame is refused', () => {
  const { runtime, world, viewport } = mount();
  assert.throws(() => runtime.publish({ ...world, epochJdTt: world.epochJdTt + 1 }, viewport, 1), /share a reference frame and epoch/u);
  runtime.destroy();
});
