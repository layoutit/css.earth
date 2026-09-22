/** A fresh checkout has recipe metadata but no extracted preview pixels yet. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { overlayVariantsPath, parseOverlayVariants } from './overlay-variants.js';

export async function availableOverlayVariants(root: string) {
  const rows = parseOverlayVariants(parseLabModelJson(await readFile(resolve(root, overlayVariantsPath), 'utf8')));
  const variants = [];
  for (const row of rows) {
    const layers = [];
    for (const layer of row.layers) {
      const bytes = await readFile(resolve(root, layer.texturePath)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      });
      if (!bytes) continue;
      layers.push(layer);
    }
    if (layers.length) variants.push({ ...row, layers });
  }
  return { schema: 'cssearth-nebula-overlay-variants@1', variants };
}
