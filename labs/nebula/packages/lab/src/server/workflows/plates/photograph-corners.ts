import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { imageLayerView, parseImageLayerRecipe } from '@cssearth/bake/image-layers';
import { platePictures } from '../../../features/plates/plates-model.ts';

/** What the Original control needs to lay a plate dataset's photograph where the bake laid it: the picture's file in
 * `source/` (the published original, or the star-free copy the bake read), its size, and the sight lines (Sun-ICRF
 * unit vectors) through its top-left, top-right, bottom-right and bottom-left corners, from the bake's own
 * `imageLayerView`. The browser puts them in the mounted bank's frame. */
export async function platePhotographCorners(objectDirectory: string, picture: 'original' | 'starless') {
  const source = resolve(objectDirectory, 'source');
  const raw: unknown = JSON.parse(await readFile(resolve(source, 'recipe.json'), 'utf8'));
  const manifest: unknown = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
  const recipe = parseImageLayerRecipe(raw);
  const inputs = manifest && typeof manifest === 'object' && Array.isArray((manifest as { inputs?: unknown }).inputs) ? (manifest as { inputs: unknown[] }).inputs : [];
  const pictures = platePictures(recipe.source.path, inputs, recipe.source.foregroundStars !== undefined);
  const file = pictures[picture];
  if (!file) throw new TypeError(picture === 'starless' ? pictures.starlessReason ?? `${recipe.id} has no star-free copy.` : `${recipe.id}: the source manifest declares no published original.`);
  const view = imageLayerView(recipe), [width, height] = recipe.source.dimensions;
  return { id: recipe.id, picture, file, widthPx: width, heightPx: height, credit: recipe.source.credit, sourcePageUrl: recipe.source.publisherUrl,
    corners: [view.ray(-1, 1), view.ray(1, 1), view.ray(1, -1), view.ray(-1, -1)] };
}
