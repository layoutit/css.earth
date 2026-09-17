/** Load the pinned simulation density named by a reconstruction request as a field-space depth prior. */
import { resolve, dirname } from 'node:path';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { fieldToPhysical, angularScale } from './simulation-guided-coordinates.ts';
import { loadVolumeSource, sampleEncoded, verifiedBytes, sha256 } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { channelDensity } from '@cssearth/volume-bake/slices/density';
import { parseVolumeRecipe } from '@cssearth/volume-core/contracts/volume-recipe';
import type { SimulationDepthPrior } from '@cssearth/nebula-reconstruction/methods/inference/simulation-guided';

interface Pin { path: string; sha256: string }
const isPin = (value: unknown): value is Pin => !!value && typeof value === 'object' &&
  typeof (value as { path?: unknown }).path === 'string' && typeof (value as { sha256?: unknown }).sha256 === 'string';

export async function loadSimulationPrior(root: string, cloudProvenance: unknown, distanceKpc: number, tangentBoundsKpc: { min: number[]; max: number[] }): Promise<SimulationDepthPrior> {
  if (!isPin(cloudProvenance)) throw new TypeError('Reconstruction request has no pinned simulation provenance.');
  if (![...tangentBoundsKpc.min, ...tangentBoundsKpc.max].every(Number.isFinite) || tangentBoundsKpc.min.length < 2 || tangentBoundsKpc.max.length < 2)
    throw new TypeError('Invalid tangent bounds.');
  const recipe = parseVolumeRecipe(parseLabModelJson((await verifiedBytes(root, cloudProvenance)).toString()));
  const source = await loadVolumeSource(dirname(resolve(root, cloudProvenance.path)), recipe), A = angularScale(distanceKpc), encoded: [number, number, number, number] = [0, 0, 0, 0];
  return {
    identity: sha256(Buffer.from(JSON.stringify({ source: cloudProvenance, distance: distanceKpc, mapping: 'tangent-perspective@1' }))),
    bounds: { min: [tangentBoundsKpc.min[0]! * A, tangentBoundsKpc.min[1]! * A, recipe.grid.bounds.min[2] * A], max: [tangentBoundsKpc.max[0]! * A, tangentBoundsKpc.max[1]! * A, recipe.grid.bounds.max[2] * A] },
    sampleDensity: (x, y, z) => { const p = fieldToPhysical([x, y, z], distanceKpc); sampleEncoded(source, ...p, encoded); return channelDensity(encoded[3], recipe.grid.encoding); },
  };
}
