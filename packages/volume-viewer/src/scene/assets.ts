import type { CompilerBakeResult, CompilerPin } from '@cssearth/bake/volume';
import type { CompilerViewerBackend } from './backend.ts';
export interface LoadedBank<Bank> { payload: Bank; textures: Map<string, string>; urls: string[] }

export async function loadBank<Bank, Publication>(backend: CompilerViewerBackend<Bank, Publication>, reference: CompilerPin, resolvePath: (path: string) => string, signal?: AbortSignal): Promise<LoadedBank<Bank>> {
  const bytes = await readPinned(reference, resolvePath, signal);
  const payload = backend.validateBank(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const directory = reference.path.slice(0, reference.path.lastIndexOf('/') + 1), textures = new Map<string, string>(), urls: string[] = [];
  const queue = [...backend.resources(payload)], settled = await Promise.allSettled(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const resource = queue.shift()!, content = await readPinned({ path: `${directory}${resource.path}` }, resolvePath, signal);
      if (content.byteLength !== resource.bytes) throw new Error(`Compiler texture byte length differs: ${resource.path}`);
      const blob = new Blob([content]), url = URL.createObjectURL(blob); urls.push(url);
      let image: ImageBitmap;
      try { image = await createImageBitmap(blob); }
      catch (error) { throw new Error(`Compiler texture cannot be decoded: ${resource.path} (${resource.width}×${resource.height}).`, { cause: error }); }
      try {
        if (image.width !== resource.width || image.height !== resource.height) throw new Error(`Compiler texture dimensions differ: ${resource.path}`);
      } finally { image.close(); }
      textures.set(resource.path, url);
    }
  }));
  const failed = settled.find(item => item.status === 'rejected'); if (failed?.status === 'rejected') { release({ urls }); throw failed.reason; }
  return { payload, textures, urls };
}
export async function loadStarAtlas(result: CompilerBakeResult, resolvePath: (path: string) => string, signal?: AbortSignal) {
  const sprites = result.starSprites!;
  const bytes = await readPinned(sprites.atlas, resolvePath, signal), blob = new Blob([bytes], { type: 'image/png' });
  const image = await createImageBitmap(blob);
  try {
    if (image.width !== sprites.width || image.height !== sprites.height) throw new Error('Compiler stellar atlas dimensions changed.');
  } finally { image.close(); }
  signal?.throwIfAborted(); return URL.createObjectURL(blob);
}
async function readPinned(reference: CompilerPin, resolvePath: (path: string) => string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (!reference || !relativePath(reference.path)) throw new TypeError('Compiler resource path is invalid.');
  const response = await fetch(resolvePath(reference.path), { signal }); if (!response.ok) throw new Error(`Compiler resource failed to load: ${reference.path} (${response.status})`);
  return response.arrayBuffer();
}
export function requiredTexture<Bank>(bank: LoadedBank<Bank>, path: string) { const value = bank.textures.get(path); if (!value) throw new Error(`Compiler texture was not decoded: ${path}`); return value; }
export function release(bank: { urls: string[] }) {
  for (const url of bank.urls) URL.revokeObjectURL(url); bank.urls.length = 0;
}
function relativePath(path: string) { return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split('/').includes('..') && !/[\\\u0000-\u0020]/.test(path); }
