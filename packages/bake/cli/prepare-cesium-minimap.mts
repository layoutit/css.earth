// Entry script: node packages/bake/cli/prepare-cesium-minimap.mts. The work is in @cssearth/bake/site-assets.
import { writeFile } from 'node:fs/promises';
import { cesiumMinimapExcerpts } from '@cssearth/bake/site-assets';

for (const [name, source] of await cesiumMinimapExcerpts()) {
  await writeFile(new URL(`../../../site/vendor/${name}`, import.meta.url), source);
}
