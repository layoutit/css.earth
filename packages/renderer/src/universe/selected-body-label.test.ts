import { parseHTML } from 'linkedom';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { WorldCameraPose } from '@cssearth/objects';
import { opacityClockFor } from '../stars/opacity-clock.js';
import { mountSelectedBodyLabel } from './selected-body-label.js';
import { stubGlobal } from '@cssearth/objects/node/contract';

const observations = new Map<Element, ResizeObserverCallback>();
stubGlobal('ResizeObserver', class {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) { this.callback = callback; }
  observe(element: Element) { observations.set(element, this.callback); }
  unobserve(element: Element) { observations.delete(element); }
  disconnect() { for (const [element, callback] of observations) if (callback === this.callback) observations.delete(element); }
});
function deliverSize(element: Element) {
  const callback = observations.get(element);
  if (!callback) throw new Error('Caption is not observed.');
  callback([{ target: element, contentRect: { width: 50, height: 18 } } as ResizeObserverEntry], {} as ResizeObserver);
}

const { document } = parseHTML('<div id="host"></div>');
const host = document.getElementById('host') as unknown as HTMLElement;
const clock = opacityClockFor({ requestAnimationFrame: () => 0, cancelAnimationFrame() {}, performance: { now: () => 0 } });
const camera = { referenceFrame: 'test', epochJdTt: 0, pose: { positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] } } as unknown as WorldCameraPose;
const viewport = { focalPixels: 1000, widthPixels: 800, heightPixels: 1000, principalOffsetPixels: [0, 0] as const };
// A body straight ahead; its disc radius on screen is 1000 / sqrt(distance² - 1) px.
const body = (distance: number) => ({ id: 'earth', name: 'Earth', color: '#fff', positionM: [0, 0, -distance] as const, radiusM: 1 });
const view = { overview: false, focused: false, preview: undefined };

test('the caption sits below a body that fits, and leaves once it cannot sit clear below it', () => {
  const label = mountSelectedBodyLabel(host, clock);
  label.prepare(body(10)); deliverSize(label.label);
  // About 100 px: the caption goes under the disc.
  const small = label.publish(camera, viewport, body(10), view);
  assert.notEqual(small, null);
  assert.ok(small!.top > 100);
  // About 510 px: the lower limb passes the footer, so there is no clear place below. No edge or overlay placement.
  assert.equal(label.publish(camera, viewport, body(2.2), view), null);
  assert.equal(label.label.dataset.placement, undefined);
  label.destroy();
});

test('the caption box offered to the context planner is the box it publishes for the same camera', () => {
  const label = mountSelectedBodyLabel(host, clock);

  // Before the caption is measured for a body there is no box to offer.
  assert.equal(label.rect(camera, viewport, body(10), view), null);
  assert.equal(label.publish(camera, viewport, body(10), view), null);
  deliverSize(label.label);
  const published = label.publish(camera, viewport, body(10), view);
  assert.deepEqual(label.rect(camera, viewport, body(10), view), published);
  assert.equal(label.rect(camera, viewport, body(10), { ...view, overview: true }), null);
  label.destroy();
});

test('the prepared destination caption keeps its node and transform when preview becomes selected', () => {
  const owner = mountSelectedBodyLabel(host, clock), node = owner.label;
  let measurements = 0;
  Object.defineProperties(node, { offsetWidth: { get: () => { measurements++; return 50; } }, offsetHeight: { get: () => 18 } });
  const destination = { ...body(10), id: 'lutetia', name: 'Lutetia', radiusM: 1.4 };
  owner.prepare(destination);
  assert.equal(measurements, 0);
  deliverSize(node);
  const approaching = owner.publish(camera, viewport, destination, { ...view, preview: destination.id });
  const transform = node.style.transform;
  const settled = owner.publish(camera, viewport, destination, view);
  assert.deepEqual(settled, approaching);
  assert.equal(node.style.transform, transform);
  assert.equal(owner.label, node);
  assert.equal(measurements, 0);
  assert.equal(node.textContent, 'Lutetia');
  owner.destroy();
});

test('a new name waits for layout and requests publication; disposal releases its observer', () => {
  const publish = mock.fn(() => true), owner = mountSelectedBodyLabel(host, clock, publish);
  owner.prepare(body(10)); deliverSize(owner.label);
  assert.equal(publish.mock.callCount(), 1);
  const destination = { ...body(10), id: 'other', name: 'Other' };
  owner.prepare(destination);
  assert.equal(owner.rect(camera, viewport, destination, view), null);
  deliverSize(owner.label);
  assert.notEqual(owner.rect(camera, viewport, destination, view), null);
  owner.destroy(); assert.equal(observations.has(owner.label), false);
});

test('a flattened mesh caption follows its projected lower edge instead of its largest sphere', () => {
  const owner = mountSelectedBodyLabel(host, clock), flattened = body(5);
  owner.prepare(flattened); deliverSize(owner.label);
  const sphere = owner.publish(camera, viewport, flattened, view)!;
  const projected = owner.publish(camera, viewport, flattened, { ...view, edge: () => 60 })!;
  const sphereRadius = viewport.focalPixels / Math.sqrt(24);
  assert.ok(Math.abs((sphere.top - projected.top) - (sphereRadius - 60)) < 10 ** -2 / 2, `${(sphere.top - projected.top)} is not close to ${sphereRadius - 60}`);
  assert.deepEqual(owner.rect(camera, viewport, flattened, { ...view, edge: () => 60 }), projected);
  // A rotated model reports its new lower edge without moving or replacing the label node.
  const rotated = owner.publish(camera, viewport, flattened, { ...view, edge: () => 90 })!;
  assert.equal((rotated.top - projected.top), 30);
  assert.deepEqual(owner.publish(camera, viewport, flattened, { ...view, edge: () => null }), sphere);
  owner.destroy();
});
