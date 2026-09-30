import { expect, test } from 'vitest';
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
  const frame = (x: number): Frame => ({ projected: { x, y: 377.25, markerOpacity: 1 } as Frame['projected'], billboardShown: true, plannedShown: true,
    markerShown: true, markerDiameter: 8, flatDot: true, zIndex: '3600', selected: false, hovered: false, animated: false, coast: false,
    policyChanged: false, emphasis: 1 });
  paint.publish(frame(567.5162251070), fader);
  paint.publish(frame(567.5162989), fader);
  expect(writes).toEqual(['translate(567.516px,377.25px) translate(-50%,-50%)']);
  paint.publish(frame(567.5171), fader);
  expect(writes).toHaveLength(2);
});
