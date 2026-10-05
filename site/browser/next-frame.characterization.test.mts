import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { nextFrame } from './next-frame.mts';
test('test DOM fallback resolves only when the next task runs', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document } = parseHTML('<html></html>'); let done = false;
  const pending = nextFrame(document).then(() => { done = true; });
  await Promise.resolve();
  assert.equal(done, false); t.mock.timers.tick(0); await Promise.resolve();
  assert.equal(done, true); await pending;
  assert.equal(done, true);
});
test('animation-frame resolution waits for the shared clock callback', async () => {
  const { document, window } = parseHTML('<html></html>'); const frames: FrameRequestCallback[] = [];
  Object.assign(window, { requestAnimationFrame(callback: FrameRequestCallback) { frames.push(callback); return 1; }, cancelAnimationFrame() {} });
  let done = false; const pending = nextFrame(document).then(() => { done = true; });
  await Promise.resolve();
  assert.equal(done, false);
  assert.equal(frames.length, 1); frames.shift()!(10); await pending;
  assert.equal(done, true);
});
