import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import type { PreparedCloudSegments } from '@cssearth/objects';
import { createCloudSegments } from './cloud-segments.js';

const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-10, -10, -10] as const, max: [10, 10, 10] as const } };
const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as [number, number], widthPixels: 400, heightPixels: 300 };
const at = (z: number) => ({ world: { referenceFrame: 'fixture', epochJdTt: 1,
  pose: { positionM: [0, 0, z] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } }, viewport });
const body = { centreUnits: [0, 0, 0], axesUnits: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } as const;
/** In front of the body with an arrowhead; behind its middle at half opacity; reaching from in front of the body to z = 9.5. */
const lines: PreparedCloudSegments = { id: 'motions', frame: frame as never, count: 3,
  from: Float64Array.from([-3, 0, 2, -.5, 0, -4, 0, 2, 2]), to: Float64Array.from([3, 0, 2, .5, 0, -4, 0, 2, 9.5]),
  rgba: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]).map((value, index) => index === 7 ? 128 : value), heads: Uint8Array.from([1, 0, 0]),
  widthPixels: 2, occluder: [body], label: { text: 'Model', atUnits: [0, -2, 0] } };
const layout = (root: Element) => [root, ...root.querySelectorAll('*')].map(node => [node.tagName,
  (node.getAttribute('style') ?? '').split(';').filter(rule => rule && !/^\s*(transform|opacity)\s*:/u.test(rule)).join(';'), node.textContent]);

test('a moving camera changes only each line\'s transform and opacity, and a line with an end behind the eye is not drawn', () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const layer = createCloudSegments({ host, lines });
  assert.deepEqual([layer.root.parentNode, host.children.length], [null, 0], 'built off the page: its owner attaches it');
  const [first, tip, hidden, reaching, label] = [...layer.root.children] as HTMLElement[];
  assert.deepEqual([layer.root.children.length, label!.textContent], [5, 'Model'], 'one element a line, one more for its arrowhead, and its caption');
  const mounted = layout(layer.root);
  layer.place(at(10));
  assert.deepEqual(layout(layer.root).slice(1), mounted.slice(1), 'the first publication writes each element\'s transform and opacity only');
  const before = layout(layer.root);
  assert.ok([first, tip, hidden, reaching, label].every(node => node!.style.transform), 'every line, head and caption is placed by its transform');
  assert.deepEqual([first, tip, label].map(node => Number(node!.style.opacity)), [1, 1, 1]);
  assert.equal(Number(hidden!.style.opacity), Number((128 / 255 * .15).toFixed(3)), "a line behind the body's middle keeps its own opacity's occluded floor");
  assert.equal(Number(reaching!.style.opacity), 1, 'both its ends in front of the eye, it is drawn');
  layer.place(at(9));
  assert.deepEqual(layout(layer.root), before, 'a second publication writes nothing but transforms and opacities');
  assert.equal(reaching!.style.opacity, '0', 'its far end now behind the eye, the line is not drawn');
  assert.equal(Number(first!.style.opacity), 1, 'the others still are');
  layer.place(at(1.5));
  assert.deepEqual([first, tip].map(node => node!.style.opacity), ['0', '0'], 'a line with both ends behind the eye hides with its arrowhead');
  const writes: string[] = [];
  for (const element of [layer.root, ...layer.root.querySelectorAll<HTMLElement>('*')]) {
    const style = element.style;
    Object.defineProperty(element, 'style', { configurable: true, value: new Proxy(style, { set(target, key, value) { writes.push(String(key)); (target as unknown as Record<string | symbol, unknown>)[key] = value; return true; } }) });
  }
  layer.place(at(1.5));
  assert.deepEqual(writes, [], 'the same publication again writes nothing');
  layer.place(at(10));
  assert.deepEqual([...new Set(writes)].sort(), ['opacity', 'transform']);
});
