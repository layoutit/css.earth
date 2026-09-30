import { expect, test } from 'vitest';
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
  expect([large!.style.visibility, plain!.style.visibility]).toEqual(['hidden', 'hidden']);
  // The plain layer shows first; the large one waits for its decode, then takes a later frame.
  frames.shift()!(0);
  expect([large!.style.visibility, plain!.style.visibility]).toEqual(['hidden', '']);
  decoded(); await new Promise(resolve => setTimeout(resolve, 0));
  while (frames.length) frames.shift()!(16);
  expect(large!.style.visibility).toBe('');
});

test('without animation frames a layer shows at once', () => {
  const { document } = parseHTML('<div id="host"><i style="visibility:hidden"></i></div>');
  const layer = document.querySelector('i') as unknown as HTMLElement;
  Object.defineProperty(layer.ownerDocument, 'defaultView', { value: null });
  revealLayer(layer, '/detail.webp');
  expect(layer.style.visibility).toBe('');
});
