import type { PreparedGalaxyCatalog } from './galaxy-catalog.js';

export const GALAXY_DISPLAY_SAMPLE_SCHEMA = 'cssearth-galaxy-display-sample@1';

/** Sampling metadata is written by bake; runtime admission depends only on the schema and catalogue identities. */
export interface PreparedGalaxyDisplaySample {
  readonly schema: typeof GALAXY_DISPLAY_SAMPLE_SCHEMA;
  readonly ids: readonly string[];
  readonly budget: number;
  readonly cellSizeM: number;
  readonly method: string;
}
/** Preserve the historical reader's acceptance of samples without bake-only metadata. */
export type GalaxyDisplaySample = Pick<PreparedGalaxyDisplaySample, 'schema' | 'ids'>;

export function parseGalaxyDisplaySample(input: unknown, catalog: PreparedGalaxyCatalog): GalaxyDisplaySample {
  if (!input || typeof input !== 'object' || !('schema' in input) || input.schema !== GALAXY_DISPLAY_SAMPLE_SCHEMA ||
        !('ids' in input) || !Array.isArray(input.ids) || input.ids.length > 48 ||
        !input.ids.every(id => typeof id === 'string' && catalog.objects.some(row => row.id === id && row.membership.group === 'local-group'))) throw new TypeError('Invalid baked galaxy sample.');
  return input as GalaxyDisplaySample;
}
