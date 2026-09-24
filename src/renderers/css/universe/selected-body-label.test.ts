import { parseHTML } from 'linkedom';
import { expect, test } from 'vitest';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import { opacityClockFor } from '../stars/opacity-clock.js';
import { mountSelectedBodyLabel } from './selected-body-label.js';

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
  // linkedom has no layout: give the caption the size a browser measures for one short name.
  Object.defineProperties(label.label, { offsetWidth: { value: 50 }, offsetHeight: { value: 18 } });
  // About 100 px: the caption goes under the disc.
  const small = label.publish(camera, viewport, body(10), view);
  expect(small).not.toBeNull();
  expect(small!.top).toBeGreaterThan(100);
  // About 510 px: the lower limb passes the footer, so there is no clear place below. No edge or overlay placement.
  expect(label.publish(camera, viewport, body(2.2), view)).toBeNull();
  expect(label.label.dataset.placement).toBeUndefined();
  label.destroy();
});
