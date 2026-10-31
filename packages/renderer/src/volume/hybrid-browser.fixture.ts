/** Browser-only qualification fixture. Uses the real retained runtime, never a second compositor. */
import { validatePreparedCssVolume } from '@cssearth/objects';
import { mountPreparedCssVolume } from './prepared-volume-runtime.js';
import { parseEmbedPageMessage, EMBED_BRIDGE_PROTOCOL } from '../embed/embed-bridge.js';
import type { PreparedMaterialVolumeRuntime } from './types.js';

let runtime: PreparedMaterialVolumeRuntime | undefined;
let host: HTMLElement | undefined;
let nodes: Element[] = [];
export async function load(value: unknown, urls: unknown): Promise<number> {
  const payload = validatePreparedCssVolume(value);
  if (!urls || typeof urls !== 'object' || Array.isArray(urls)) throw new TypeError('Expected prepared resource URLs');
  const resolve = (path: string): string => {
    const url: unknown = Reflect.get(urls, path);
    if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) throw new TypeError('Missing prepared PNG');
    return url;
  };
  await Promise.all(payload.resources.map(async resource => { const image = new Image(); image.src = resolve(resource.path); await image.decode(); }));
  runtime?.destroy(); host?.remove();
  host = document.createElement('div'); host.style.position = 'absolute'; host.style.left = '0'; host.style.top = '0'; host.style.transformOrigin = '0 0';
  const before = document.createElement('i'); host.append(before); document.body.append(host);
  runtime = mountPreparedCssVolume({host, before, payload, resolveResource: resolve, residentStacks: true});
  return payload.stacks.reduce((sum, stack) => sum + stack.leaves.length, 0);
}
export async function publish(raw: unknown, layout: unknown): Promise<number> {
  const message = parseEmbedPageMessage({protocol: EMBED_BRIDGE_PROTOCOL, type: 'camera', camera: raw, moving: false});
  if (!message || message.type !== 'camera' || !runtime || !host) throw new TypeError('Invalid fixture camera');
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) throw new TypeError('Invalid fixture layout');
  const width: unknown = Reflect.get(layout, 'width'), height: unknown = Reflect.get(layout, 'height'), transform: unknown = Reflect.get(layout, 'transform');
  if (typeof width !== 'number' || !(width > 0) || typeof height !== 'number' || !(height > 0) || typeof transform !== 'string' ||
      !/^matrix\([-\d.e+, ]+\)$/u.test(transform)) throw new TypeError('Invalid fixture registration transport');
  host.style.width = width + 'px'; host.style.height = height + 'px'; host.style.transform = transform;
  runtime.publish(message.camera);
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const current = [...host.querySelectorAll('s')];
  if (nodes.length && (current.length !== nodes.length || current.some((node, i) => node !== nodes[i]))) throw new Error('Camera changed retained membership');
  nodes = current;
  return current.length;
}
