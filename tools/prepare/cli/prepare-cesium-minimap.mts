// Entry script: node tools/prepare/cli/prepare-cesium-minimap.mts. The work is in ../prepare-cesium-minimap.mts.
import { writeFile } from 'node:fs/promises';
import { cesiumMinimapExcerpts } from '../prepare-cesium-minimap.mts';

for (const [name, source] of await cesiumMinimapExcerpts()) {
  await writeFile(new URL(`../../../site/vendor/${name}`, import.meta.url), source);
}
