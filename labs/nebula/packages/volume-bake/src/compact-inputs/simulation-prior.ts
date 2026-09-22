/**
 * Load a pinned density grid as a field-space depth prior.
 *
 * Relocated from the lab so accepted deliveries can be replayed without it. The identity, bounds and
 * sampling arithmetic are unchanged; the host supplies any path-revival policy for historical recipes.
 */
import { resolve, dirname } from 'node:path';
import { fieldToPhysical, angularScale } from '@cssearth/volume-core/coordinates/observer-tangent';
import { loadVolumeSource, sampleEncoded, sourceBytes, sha256 } from './density-grid.ts';
import { channelDensity } from '../slices/density.ts';
import { parseVolumeRecipe } from '@cssearth/volume-core/contracts/volume-recipe';
import type { SimulationDepthPrior } from '@cssearth/volume-core/contracts/simulation-prior';

interface Pin { path: string }
const isPin = (value: unknown): value is Pin => !!value && typeof value === 'object' &&
  typeof (value as { path?: unknown }).path === 'string';

export async function loadSimulationPrior(root: string, cloudProvenance: unknown, distanceKpc: number, tangentBoundsKpc: { min: number[]; max: number[] },
  options: {
    reviveJson?: (text: string) => unknown;
    /**
     * Identity of the accepted pin when the same bytes are read from a delivered copy. A replay reads a
     * checked-in grid, so its own path would change the prior identity an accepted envelope was fitted
     * with. Both pins are recorded by the delivery, and the bytes are verified against whichever is read.
     */
    identityPin?: unknown;
  } = {}): Promise<SimulationDepthPrior> {
  if (!isPin(cloudProvenance)) throw new TypeError('Reconstruction request names no simulation provenance.');
  const identityPin = options.identityPin === undefined ? cloudProvenance : options.identityPin;
  if (!isPin(identityPin)) throw new TypeError('Depth prior identity must be a source path.');
  if (![...tangentBoundsKpc.min, ...tangentBoundsKpc.max].every(Number.isFinite) || tangentBoundsKpc.min.length < 2 || tangentBoundsKpc.max.length < 2)
    throw new TypeError('Invalid tangent bounds.');
  const text = (await sourceBytes(root, cloudProvenance)).toString();
  const recipe = parseVolumeRecipe(options.reviveJson ? options.reviveJson(text) : JSON.parse(text));
  const source = await loadVolumeSource(dirname(resolve(root, cloudProvenance.path)), recipe), A = angularScale(distanceKpc), encoded: [number, number, number, number] = [0, 0, 0, 0];
  return {
    identity: sha256(Buffer.from(JSON.stringify({ source: identityPin, distance: distanceKpc, mapping: 'tangent-perspective@1' }))),
    bounds: { min: [tangentBoundsKpc.min[0]! * A, tangentBoundsKpc.min[1]! * A, recipe.grid.bounds.min[2] * A], max: [tangentBoundsKpc.max[0]! * A, tangentBoundsKpc.max[1]! * A, recipe.grid.bounds.max[2] * A] },
    sampleDensity: (x, y, z) => { const p = fieldToPhysical([x, y, z], distanceKpc); sampleEncoded(source, ...p, encoded); return channelDensity(encoded[3], recipe.grid.encoding); },
  };
}
