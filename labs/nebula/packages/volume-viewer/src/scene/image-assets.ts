import type { BankAssetsBackend } from './backend.ts';
interface ResourcePin { path: string }
export interface ImageBank<Bank> { payload: Bank; textures: Map<string, string> }

/** Historical image-decoder path shared by shape and joint retained scenes. */
export async function loadImageBank<Bank>(backend: BankAssetsBackend<Bank>, label: string, reference: ResourcePin,
  resolvePath: (path: string) => string, urls: string[], signal?: AbortSignal): Promise<ImageBank<Bank>> {
  const bytes = await readPinned(label, reference, resolvePath, signal);
  const payload = backend.validateBank(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const directory = reference.path.slice(0, reference.path.lastIndexOf('/') + 1);
  const textures = new Map<string, string>(), queue = [...backend.resources(payload)];
  const settled = await Promise.allSettled(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const resource = queue.shift()!;
      const content = await readPinned(label, { path: `${directory}${resource.path}` }, resolvePath, signal);
      if (content.byteLength !== resource.bytes) throw new Error(`${label} texture byte length differs: ${resource.path}`);
      const url = URL.createObjectURL(new Blob([content])); urls.push(url);
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth !== resource.width || image.naturalHeight !== resource.height)
        throw new Error(`${label} texture dimensions differ: ${resource.path}`);
      textures.set(resource.path, url);
    }
  }));
  const failure = settled.find(item => item.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return { payload, textures };
}
async function readPinned(label: string, reference: ResourcePin, resolvePath: (path: string) => string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (!reference || typeof reference.path !== 'string' || !reference.path.length || reference.path.startsWith('/') ||
      reference.path.split('/').includes('..') || /[\\\u0000-\u0020]/.test(reference.path))
    throw new TypeError(`${label} resource pin is invalid.`);
  const response = await fetch(resolvePath(reference.path), { signal });
  if (!response.ok) throw new Error(`${label} resource failed to load: ${reference.path} (${response.status})`);
  return response.arrayBuffer();
}
export function releaseImageUrls(urls: string[]) { for (const url of urls) URL.revokeObjectURL(url); urls.length = 0; }
export function requiredImageTexture<Bank>(volume: ImageBank<Bank>, path: string) {
  const texture = volume.textures.get(path); if (!texture) throw new Error(`Prepared texture was not decoded: ${path}`); return texture;
}
