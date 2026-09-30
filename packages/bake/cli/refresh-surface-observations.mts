// Entry script: node packages/bake/cli/refresh-surface-observations.mts <object-id> <datasetId> [...]. The work is in
// @cssearth/bake/refresh-surface-observations, with the generated solar geometry this entry loads from the checkout.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';
import { refreshSurfaceObservations } from '@cssearth/bake/refresh-surface-observations';

const projectRoot = process.cwd();
const [id, ...datasets] = process.argv.slice(2);
if (!id) throw new TypeError('Usage: refresh-surface-observations <objectId> <datasetId> [...]');
const solarGeometry: SolarGeometry = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href);
await refreshSurfaceObservations(id, datasets, solarGeometry);
