import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { createWorldContextMarkerFactory, createWorldContextMarkerPaint } from './world-context-marker-paint.js';
import type { createOpacityFader } from '../../stars/opacity-fader.js';

type Fader = ReturnType<typeof createOpacityFader>;
type Frame = Parameters<ReturnType<typeof createWorldContextMarkerPaint>['publish']>[0];

test('a marker moved by less than a thousandth of a pixel is not written again', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const { mover, marker, spriteLeaf, caption } = createWorldContextMarkerFactory(document)(true);
  const locator = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
  const paint = createWorldContextMarkerPaint(marker, mover, spriteLeaf, caption, { color: '#ffffff' }, undefined, locator);
  const fader = { visible() {}, multiply() {}, set() {} } as unknown as Fader;
  const writes: string[] = [];
  let transform = '';
  const style = { visibility: '', willChange: '', zIndex: '', opacity: '1',
    get transform() { return transform; }, set transform(value: string) { writes.push(value); transform = value; } };
  Object.defineProperty(mover, 'style', { configurable: true, value: style });
  const frame = (x: number): Frame => ({ projected: { x, y: 377.25, markerOpacity: 1, emphasis: 1 } as Frame['projected'], billboardShown: true, plannedShown: true,
    markerShown: true, markerDiameter: 8, flatDot: true, zIndex: '3600', selected: false, hovered: false, animated: false, coast: false,
    policyChanged: false });
  paint.publish(frame(567.5162251070), fader);
  paint.publish(frame(567.5162989), fader);
  assert.deepEqual(writes, ['translate(567.516px,377.25px) translate(-50%,-50%)']);
  paint.publish(frame(567.5171), fader);
  assert.equal(writes.length, 2);
});

test('what lands after a coast fades: a name and a ring in and out, and a name that changes side in again', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const { mover, marker, spriteLeaf, caption } = createWorldContextMarkerFactory(document)(true);
  const locator = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
  const paint = createWorldContextMarkerPaint(marker, mover, spriteLeaf, caption, { color: '#ffffff' }, undefined, locator);
  const fades: string[] = [];
  for (const [part, owner] of [['ring', marker], ['name', caption]] as const) {
    Object.defineProperty(owner, 'animate', { value: (keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      fades.push(`${part} ${options.pseudoElement} ${keyframes.length === 1 ? 'in' : 'out'} ${options.duration}`);
    } });
  }
  const named = (labelX: number) => ({ x: 100, y: 100, markerOpacity: 1, emphasis: 1, labelPosition: [labelX, 91] }) as unknown as Frame['projected'];
  const fader = { visible() {}, multiply() {}, set() {} } as unknown as Fader;
  const show = (billboardShown: boolean) => paint.publish({ projected: named(112), billboardShown, plannedShown: billboardShown, markerShown: billboardShown,
    markerDiameter: 8, flatDot: true, zIndex: '3600', selected: false, hovered: false, animated: false, coast: false, policyChanged: false }, fader);
  // A marker that is not shown changes at once, landing or not.
  paint.publishIndicator(true, false, false, true); paint.publishLabel(named(112), true, false, true);
  paint.publishIndicator(false, false, false, true); paint.publishLabel(named(112), false, false, true);
  // So does an ordinary publication of one that is.
  show(true);
  paint.publishIndicator(true, false, false); paint.publishLabel(named(112), true, false);
  assert.deepEqual(fades, []);
  // Landing: the state it already shows fades nothing.
  paint.publishIndicator(true, false, false, true); paint.publishLabel(named(112), true, false, true);
  assert.deepEqual(fades, []);
  paint.publishLabel(named(60), true, false, true);
  paint.publishIndicator(false, false, false, true); paint.publishLabel(named(60), false, false, true);
  paint.publishIndicator(true, false, false, true); paint.publishLabel(named(60), true, false, true);
  assert.deepEqual(fades, ['name ::after in 200', 'ring ::before out 200', 'name ::after out 200', 'ring ::before in 200', 'name ::after in 200']);
  assert.equal(caption.style.transform, 'translate(-40px,-9px)');
});
