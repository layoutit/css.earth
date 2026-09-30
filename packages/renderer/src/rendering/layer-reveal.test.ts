import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { revealLayer } from './layer-reveal.js';

test('a layer with a large image waits hidden for its decode, then shows on a frame of its own', async () => {
  const { document } = parseHTML('<div id="host"><i></i><b></b></div>');
  const window = document.defaultView as unknown as Record<string, unknown>;
  const frames: FrameRequestCallback[] = [];
  let decoded!: () => void;
  const decode = () => new Promise<void>(resolve => { decoded = resolve; });
  Object.assign(window, { requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback), cancelAnimationFrame() {} });
  const [large, plain] = [...document.getElementById('host')!.children] as HTMLElement[];
  revealLayer(large!, '/detail.webp', decode); revealLayer(plain!);
  assert.deepEqual(([large!.style.visibility, plain!.style.visibility]), ['hidden', 'hidden']);
  // The plain layer shows first; the large one waits for its decode, then takes a later frame.
  frames.shift()!(0);
  assert.deepEqual(([large!.style.visibility, plain!.style.visibility]), ['hidden', '']);
  decoded(); await new Promise(resolve => setTimeout(resolve, 0));
  while (frames.length) frames.shift()!(16);
  assert.equal(large!.style.visibility, '');
});

test('without animation frames a layer shows at once', () => {
  const { document } = parseHTML('<div id="host"><i style="visibility:hidden"></i></div>');
  const layer = document.querySelector('i') as unknown as HTMLElement;
  Object.defineProperty(layer.ownerDocument, 'defaultView', { value: null });
  revealLayer(layer, '/detail.webp');
  assert.equal(layer.style.visibility, '');
});
