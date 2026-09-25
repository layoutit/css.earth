/** Relocated to `@cssearth/bake/volume/node`; the lab keeps its historical recipe-path revival policy. */
import { loadSimulationPrior as load } from '@cssearth/bake/volume/node';
import { parseLabModelJson } from '../../resources/model-paths.ts';

export const loadSimulationPrior = (root: string, cloudProvenance: unknown, distanceKpc: number,
  tangentBoundsKpc: { min: number[]; max: number[] }) =>
  load(root, cloudProvenance, distanceKpc, tangentBoundsKpc, { reviveJson: parseLabModelJson });
