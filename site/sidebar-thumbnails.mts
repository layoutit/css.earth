import manifest from '../public/navigation/sidebar-thumbnails.json';
import { sourceObject, sourceText } from '../src/platform/source-catalog.mts';

const data = sourceObject(manifest);
if (data.schema !== 'cssearth-sidebar-thumbnails@1') throw new TypeError('Invalid sidebar thumbnail bank');
const defaults = sourceObject(data.defaults);
const images = new Map(Object.entries(sourceObject(data.images)).map(([id, raw]) => {
  const url2x = sourceText(sourceObject(raw).url2x);
  if (!/^\/navigation\/focus-[a-z0-9-]+@2x\.webp$/u.test(url2x)) throw new TypeError(`Invalid sidebar thumbnail URL: ${id}`);
  return [id, { url2x }];
}));

/** Prepared image metadata only; the catalogue continues to own object identity. */
export function sidebarThumbnail(objectId: string, lensId?: string) {
  const key = lensId ? `${objectId}/${lensId}` : defaults[objectId];
  return typeof key === 'string' ? images.get(key) : undefined;
}
