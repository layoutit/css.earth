/** Relocated to volume-bake; the lab keeps its historical recipe-path revival policy. */
import { loadSimulationPrior as load } from '@cssearth/volume-bake/compact-inputs/simulation-prior';
import { parseLabModelJson } from '../../resources/model-paths.ts';

export const loadSimulationPrior = (root: string, cloudProvenance: unknown, distanceKpc: number,
  tangentBoundsKpc: { min: number[]; max: number[] }) =>
  load(root, cloudProvenance, distanceKpc, tangentBoundsKpc, { reviveJson: parseLabModelJson });
