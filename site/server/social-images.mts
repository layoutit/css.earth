import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ObjectEntry } from '../directory/objects.mts';

/** The body whose capture stands in for a page with neither a capture nor an arrival image.
 * The site's root alias already resolves to Earth. */
export const DEFAULT_SOCIAL_IMAGE_ID = 'earth';

/** Committed social captures, read once at build time. `pnpm prepare:social` adds more. */
export function committedSocialImages(root = process.cwd()): ReadonlySet<string> {
  const directory = resolve(root, 'public/social');
  const names = readdirSync(directory)
    .filter(name => name.endsWith('.jpg'))
    .map(name => name.slice(0, -'.jpg'.length));
  if (!names.includes(DEFAULT_SOCIAL_IMAGE_ID)) {
    throw new Error(`public/social must contain the ${DEFAULT_SOCIAL_IMAGE_ID} capture every uncaptured object falls back to.`);
  }
  return new Set(names);
}

/** Scene pages without a committed capture whose share image the deploy draws from their arrival billboard
 * (`site/build/share-images.mts`), keyed by id: the billboard's `/scenes/<id>/…` address. */
export function billboardSocialImages(objects: readonly Pick<ObjectEntry, 'id' | 'discovery'>[],
  committed = committedSocialImages()): ReadonlyMap<string, string> {
  return new Map(objects.flatMap(object => {
    const billboard = object.discovery?.arrival?.billboard;
    return billboard && !committed.has(object.id) ? [[object.id, billboard.url] as const] : [];
  }));
}

/** Every page id that has a share image of its own: committed captures and arrival billboards. */
export function availableSocialImages(objects: Parameters<typeof billboardSocialImages>[0], root = process.cwd()): ReadonlySet<string> {
  const committed = committedSocialImages(root);
  return new Set([...committed, ...billboardSocialImages(objects, committed).keys()]);
}
