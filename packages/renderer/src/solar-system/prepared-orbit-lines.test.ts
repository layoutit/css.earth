import { expect, test } from 'vitest';
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
  const a = mountPreparedOrbitLines(mars.root, { renderer: 'strokes', id: 'mars' });
  const b = mountPreparedOrbitLines(earth.root, { renderer: 'strokes', id: 'earth', dashed: true });
  const svgs = root.children.filter(child => child.tagName === 'svg');
  expect(svgs).toHaveLength(1);
  const [groupA, groupB] = svgs[0]!.children;
  // No inline colour: the published swatch rule for [data-context-orbit] colours the group like its marker.
  expect(groupA!.style.color).toBeUndefined(); expect(groupA!.dataset.contextOrbit).toBe('mars');
  expect(groupB!.dataset.contextPlacement).toBe('approximate');
  expect(a.presentation.dataset).toBe(groupA!.dataset); expect(b.presentation.dataset).toBe(groupB!.dataset);
  a.publish([chord(0, 0, 10, 0, 1), chord(10, 0, 10, 10, 1), chord(20, 20, 30, 20, .5), chord(30, 20, 30, 30, .3)]);
  // Polylines are created in ascending opacity level: 0.3 → 5/16, 0.5 → 8/16, 1 → 16/16.
  const lines = groupA!.children;
  expect(lines.map(line => line.tagName)).toEqual(['polyline', 'polyline', 'polyline']);
  expect(lines.map(line => line.getAttribute('points'))).toEqual(['30,20 30,30', '20,20 30,20', '0,0 10,0 10,10']);
  expect(lines.map(line => Number(line.style.strokeOpacity))).toEqual([5 / ORBIT_OPACITY_LEVELS, 8 / ORBIT_OPACITY_LEVELS, 1]);
  expect(lines.every(line => line.style.opacity === undefined)).toBe(true);
  // Group opacity reaches the compositor as stroke opacity on every run, never as an effect.
  a.presentation.style.opacity = '0.5';
  expect(a.presentation.style.opacity).toBe('0.5');
  expect(lines.map(line => Number(line.style.strokeOpacity))).toEqual([2.5 / ORBIT_OPACITY_LEVELS, 4 / ORBIT_OPACITY_LEVELS, .5]);
  expect(groupA!.style.opacity).toBeUndefined();
  a.presentation.style.opacity = '1';
  expect(groupA!.style.display).toBe('');
  // The same chords write nothing; a break in the chain starts a second run.
  const writes = a.stats().pointWrites;
  a.publish([chord(0, 0, 10, 0, 1), chord(10, 0, 10, 10, 1), chord(20, 20, 30, 20, .5), chord(30, 20, 30, 30, .3)]);
  expect(a.stats().pointWrites).toBe(writes);
  a.publish([chord(0, 0, 10, 0, 1), chord(40, 40, 50.06, 40.04, 1)]);
  expect(groupA!.children.filter(line => line.getAttribute('points')).map(line => line.getAttribute('points'))).toEqual(['0,0 10,0', '40,40 50.1,40']);
  // A dashed orbit keeps every chord; the stylesheet dashes the group.
  b.publish([chord(0, 0, 1, 0, 1), chord(1, 0, 2, 0, 1), chord(2, 0, 3, 0, 1)]);
  expect(groupB!.children[0]!.getAttribute('points')).toBe('0,0 1,0 2,0 3,0');
  a.publish([]);
  expect(groupA!.style.display).toBe('none'); expect(lines.every(line => line.getAttribute('points') === null)).toBe(true);
  a.destroy();
  expect(svgs[0]!.children).toEqual([groupB]);
});

test('bars keep their host as presentation and an orbit-less root gets bars whatever the renderer', () => {
  const { orbit } = world();
  const venus = orbit('venus').root, bars = mountPreparedOrbitLines(venus, { renderer: 'bars', capacity: 8 });
  expect(bars.presentation).toBe(venus);
  const detached = new FakeDocument().createElement('div') as unknown as HTMLElement;
  const fallback = mountPreparedOrbitLines(detached, { renderer: 'strokes', capacity: 4 });
  expect(fallback.presentation).toBe(detached);
});
