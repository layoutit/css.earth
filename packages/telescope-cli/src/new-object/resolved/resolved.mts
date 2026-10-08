/** `telescope new-object` for the surface maps this repository fits to a star's interferometry of several nights: the
 * route (maps/route.mts) that writes a season's map as datasets of the star's page and bakes the star. resolved-maps.mts
 * holds the records; `archives/interferometry/surface-star.mts` reduces a season and decides whether its map is cast.
 *
 * A page that draws its axis by convention takes the measured tilt and pole direction the map is fitted with. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readJson, type MapRoute } from '../maps/route.mts';
import type { SurfaceMapChoice } from '../maps/surface-maps.mts';
import { measuredAxisRotation, reducedSurface, RESOLVED_GENERATOR, RESOLVED_MAPS, resolvedSourceRecords, withSurfaceLedger, withSurfaceNotice, withSurfaceReadme, type ResolvedSurfaceMap } from './resolved-maps.mts';

const SEASONS = 'packages/telescope-cli/src/archives/interferometry/seasons';
const reduce = (season: string) => `node ${RESOLVED_GENERATOR} ${SEASONS}/${season} output/interferometry/${season}`;

async function reduced(root: string, host: string, choice: SurfaceMapChoice): Promise<ResolvedSurfaceMap> {
  const work = resolve(root, 'output/interferometry', choice.program);
  const receipt = await readJson(resolve(work, 'verdict.json'), `${choice.program} is not reduced (${reduce(choice.program)})`);
  const table = await readFile(resolve(work, `${choice.program}.dat`), 'utf8').catch(() => { throw new Error(`${choice.program}: its map table is not in output/interferometry (${reduce(choice.program)}).`); });
  const map = reducedSurface(choice, receipt, table);
  if ((receipt as { object?: unknown }).object !== host) throw new Error(`${choice.program} is a season of ${String((receipt as { object?: unknown }).object)}, not of ${host}.`);
  return map;
}

/** The star's README, credits and investigation ledger, with its newest map. */
async function starRecords(root: string, host: string, maps: readonly ResolvedSurfaceMap[]): Promise<Map<string, string>> {
  const at = `src/objects/${host}`, newest = maps.at(-1)!;
  return new Map([[`${at}/README.md`, withSurfaceReadme(await readFile(resolve(root, at, 'README.md'), 'utf8'), newest)],
    [`${at}/NOTICE.md`, withSurfaceNotice(await readFile(resolve(root, at, 'NOTICE.md'), 'utf8'), newest)],
    [`${at}/investigations.json`, `${JSON.stringify(withSurfaceLedger(await readJson(resolve(root, at, 'investigations.json'), `${host}: no investigation ledger`), newest), null, 2)}\n`]]);
}

export const RESOLVED_ROUTE: MapRoute<ResolvedSurfaceMap> = { kind: RESOLVED_MAPS, specKey: 'resolvedMaps', name: 'surface maps', reduced, sourceRecords: resolvedSourceRecords, tiltedRotation: measuredAxisRotation, starRecords };
