import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptionMeasurer } from './world-context-caption-measure.js';

type Report = (records: { target: Element }[]) => void;
/** A window whose intersection observer reports when the test says the layout is done. */
function fakeWindow(widths: Map<object, string>) {
  const observed = new Set<object>(), reads: object[] = [];
  let report: Report = () => {};
  class IntersectionObserver {
    constructor(callback: Report) { report = callback; }
    observe(target: object) { observed.add(target); }
    unobserve(target: object) { observed.delete(target); }
    disconnect() { observed.clear(); }
  }
  const windowTarget = { IntersectionObserver,
    getComputedStyle(target: object, pseudo: string) { assert.equal(pseudo, '::after'); reads.push(target); return { width: widths.get(target) ?? 'auto', height: '18px' }; } };
  return { windowTarget: windowTarget as unknown as Window & typeof globalThis, observed, reads,
    layout() { report([...observed].map(target => ({ target: target as Element }))); } };
}
const caption = () => ({ isConnected: true }) as unknown as Element;

test("a caption is read after the layout that follows its request, once, and never while the camera coasts", () => {
  const first = { caption: caption() }, second = { caption: caption() };
  const page = fakeWindow(new Map<object, string>([[first.caption, '81.4px'], [second.caption, 'auto']]));
  const sizes = new Map<object, unknown>(); let done = 0, coasting = false;
  const measurer = createCaptionMeasurer(page.windowTarget, { hold: () => coasting, measured: (entry, size) => sizes.set(entry, size), done: () => done++ })!;
  measurer.request(first); measurer.request(first); measurer.request(second);
  assert.equal(page.reads.length, 0, 'the request itself reads no style: that would force a layout inside the frame');
  page.layout();
  assert.deepEqual(sizes.get(first), { width: 82, height: 18 });
  assert.equal(sizes.has(second), false, 'a caption with no box yet is left for a later request');
  assert.deepEqual([page.reads.length, done, page.observed.size], [2, 1, 0]);
  // While the camera coasts a report is dropped, and the next publication's request reads it.
  coasting = true; measurer.request(second); page.layout();
  assert.deepEqual([page.reads.length, done], [2, 1]);
  coasting = false; measurer.request(second); page.layout();
  assert.deepEqual([page.reads.length, done], [3, 1], 'read again, still without a box');
  measurer.destroy();
});

test('a document without the observer has no measurer: its publication measures as before', () => {
  assert.equal(createCaptionMeasurer({} as unknown as Window & typeof globalThis, { hold: () => false, measured() {}, done() {} }), null);
});
