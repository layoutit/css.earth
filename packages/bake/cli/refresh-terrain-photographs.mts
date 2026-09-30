// Entry script: node packages/bake/cli/refresh-terrain-photographs.mts <object-id> <datasetId>... [--apply-staged]. The
// work is in @cssearth/bake/refresh-terrain-photographs, with the generated solar geometry this entry loads from the
// checkout.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';
import { applyStagedTerrainPhotographs, refreshTerrainPhotographs } from '@cssearth/bake/refresh-terrain-photographs';

const projectRoot = process.cwd();
const [id, ...args] = process.argv.slice(2);
if (args.includes('--apply-staged')) await applyStagedTerrainPhotographs(id!, args.filter(arg => arg !== '--apply-staged'));
else {
  const solarGeometry: SolarGeometry = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href);
  await refreshTerrainPhotographs(id!, args, solarGeometry);
}
