import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { mountPreparedOrbitLines, ORBIT_OPACITY_LEVELS } from './prepared-orbit-lines.js';
import type { OrbitSegment } from './types.js';

class FakeElement {
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>(); className = ''; parentNode: FakeElement | null = null;
  readonly ownerDocument: FakeDocument; readonly tagName: string;
  constructor(ownerDocument: FakeDocument, tagName: string) { this.ownerDocument = ownerDocument; this.tagName = tagName; }
  get parentElement() { return this.parentNode; }
  get isConnected() { return true; }
  appendChild(child: FakeElement) { child.parentNode = this; this.children.push(child); }
  insertBefore(child: FakeElement, before: FakeElement | null) { child.parentNode = this; this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  closest(selector: string): FakeElement | null { return this.className === selector.slice(1) ? this : this.parentNode?.closest(selector) ?? null; }
  setAttribute(name: string, value: string) { if (name === 'class') this.className = value; this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
}
class FakeDocument {
  createElement(tag: string) { return new FakeElement(this, tag); }
  createElementNS(_ns: string, tag: string) { return new FakeElement(this, tag); }
}
function world() {
  const document = new FakeDocument(), root = document.createElement('div'); root.className = 'prepared-world-context';
  const orbit = (id: string) => { const node = document.createElement('div'); node.className = 'context-orbit'; root.appendChild(node); return { root: node as unknown as HTMLElement, id }; };
  return { root, orbit };
}
const chord = (x0: number, y0: number, x1: number, y1: number, weight: number): OrbitSegment => [x0, y0, x1, y1, weight];

test('strokes share one svg per world context, name each group by its body and join chords into polylines per opacity level', () => {
  const { root, orbit } = world();
  const mars = orbit('mars'), earth = orbit('earth');
  const a = mountPreparedOrbitLines(mars.root, { renderer: 'strokes', id: 'mars', depthBase: 700 });
  const b = mountPreparedOrbitLines(earth.root, { renderer: 'strokes', id: 'earth', dashed: true, depthBase: 700 });
  assert.equal(root.children.filter(child => child.tagName === 'svg').length, 0);
  a.publish([chord(0, 0, 10, 0, 1), chord(10, 0, 10, 10, 1), chord(20, 20, 30, 20, .5), chord(30, 20, 30, 30, .3)]);
  b.publish([chord(0, 0, 1, 0, 1)]);
  const svgs = root.children.filter(child => child.tagName === 'svg');
  assert.equal(svgs.length, 1);
  // Its box is a world-context.css rule; only the stage's depth is inline.
  assert.deepEqual(svgs[0]!.style, { zIndex: '700' });
  const [groupA, groupB] = svgs[0]!.children;
  // No inline color: the published swatch rule for [data-context-orbit] colors the group like its marker.
  assert.equal(groupA!.style.color, undefined); assert.equal(groupA!.dataset.contextOrbit, 'mars');
  assert.equal(groupB!.dataset.contextPlacement, 'approximate');
  assert.equal(a.presentation.dataset, groupA!.dataset); assert.equal(b.presentation.dataset, groupB!.dataset);
  a.publish([chord(0, 0, 10, 0, 1), chord(10, 0, 10, 10, 1), chord(20, 20, 30, 20, .5), chord(30, 20, 30, 30, .3)]);
  // Polylines are created in ascending opacity level: a weight takes the level at or above it.
  const level = (weight: number) => Math.ceil(weight * ORBIT_OPACITY_LEVELS) / ORBIT_OPACITY_LEVELS;
  const lines = groupA!.children;
  assert.deepEqual(lines.map(line => line.tagName), ['polyline', 'polyline', 'polyline']);
  assert.deepEqual(lines.map(line => line.getAttribute('points')), ['30,20 30,30', '20,20 30,20', '0,0 10,0 10,10']);
  assert.deepEqual(lines.map(line => Number(line.style.strokeOpacity)), [level(.3), level(.5), 1]);
  assert.equal(lines.every(line => line.style.opacity === undefined), true);
  // Group opacity reaches the compositor as stroke opacity on every run, never as an effect.
  a.presentation.style.opacity = '0.5';
  assert.equal(a.presentation.style.opacity, '0.5');
  assert.deepEqual(lines.map(line => Number(line.style.strokeOpacity)), [level(.3) / 2, level(.5) / 2, .5]);
  assert.equal(groupA!.style.opacity, undefined);
  a.presentation.style.opacity = '1';
  assert.equal(groupA!.style.display, '');
  // The same chords write nothing; a break in the chain starts a second run.
  const writes = a.stats().pointWrites;
  a.publish([chord(0, 0, 10, 0, 1), chord(10, 0, 10, 10, 1), chord(20, 20, 30, 20, .5), chord(30, 20, 30, 30, .3)]);
  assert.equal(a.stats().pointWrites, writes);
  a.publish([chord(0, 0, 10, 0, 1), chord(40, 40, 50.06, 40.04, 1)]);
  assert.deepEqual(groupA!.children.filter(line => line.getAttribute('points')).map(line => line.getAttribute('points')), ['0,0 10,0', '40,40 50.1,40']);
  // A dashed orbit keeps every chord; the stylesheet dashes the group.
  b.publish([chord(0, 0, 1, 0, 1), chord(1, 0, 2, 0, 1), chord(2, 0, 3, 0, 1)]);
  assert.equal(groupB!.children[0]!.getAttribute('points'), '0,0 1,0 2,0 3,0');
  a.publish([]);
  assert.equal(groupA!.style.display, 'none'); assert.equal(lines.every(line => line.getAttribute('points') === null), true);
  a.destroy();
  assert.deepEqual(svgs[0]!.children, [groupB]);
});

test('bars keep their host as presentation and an orbit-less root gets bars whatever the renderer', () => {
  const { orbit } = world();
  const venus = orbit('venus').root, bars = mountPreparedOrbitLines(venus, { renderer: 'bars', capacity: 8 });
  assert.equal(bars.presentation, venus);
  const detached = new FakeDocument().createElement('div') as unknown as HTMLElement;
  const fallback = mountPreparedOrbitLines(detached, { renderer: 'strokes', capacity: 4 });
  assert.equal(fallback.presentation, detached);
});


test('detached orbit owners attach only a populated group on demand and reuse it', () => {
  const { root } = world(), host = root.ownerDocument.createElement('div');
  const orbit = mountPreparedOrbitLines(host as unknown as HTMLElement, { renderer: 'strokes', strokeHost: root as unknown as HTMLElement, id: 'test', depthBase: 7 });
  orbit.publish([]);
  assert.equal(root.children.length, 0);
  orbit.publish([chord(0, 0, 10, 10, 1)]);
  const svg = root.children[0]!, group = svg.children[0]!, line = group.children[0]!;
  assert.equal(line.getAttribute('points'), '0,0 10,10');
  orbit.publish([]); orbit.publish([chord(0, 0, 10, 10, 1)]);
  assert.deepEqual(root.children, [svg]); assert.deepEqual(svg.children, [group]); assert.deepEqual(group.children, [line]);
  orbit.destroy(); assert.equal(svg.children.length, 0);
});
