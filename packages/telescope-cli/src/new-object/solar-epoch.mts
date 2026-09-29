/** The scene epoch the generator writes into a package. The solar geometry is generated into the checkout after the packages
 * build (`src/platform/solar-geometry.mts`, by `packages/bake/cli/prepare-solar-geometry.mts`), so no library here imports it:
 * an entry loads it once with `loadSolarEpoch` and passes the epoch down. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';

export type SolarEpoch = Pick<SolarGeometry, 'SOLAR_GEOMETRY_EPOCH_JD_TT' | 'SOLAR_GEOMETRY_EPOCH_LABEL'>;

/** The epoch of the checkout's generated solar geometry. */
export async function loadSolarEpoch(root: string): Promise<SolarEpoch> {
  const { SOLAR_GEOMETRY_EPOCH_JD_TT, SOLAR_GEOMETRY_EPOCH_LABEL } = await import(pathToFileURL(resolve(root, 'src/platform/solar-geometry.mts')).href) as SolarEpoch;
  return { SOLAR_GEOMETRY_EPOCH_JD_TT, SOLAR_GEOMETRY_EPOCH_LABEL };
}
