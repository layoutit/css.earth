/** Checks the archive addresses this package pins against the registry of Virtual Observatory services (RegTAP, asked at GAVO
 * through PyVO). The registry owns which identifier has which address, and GAVO's crawl of every TAP server (`glots`) owns which
 * tables a server has. The addresses stay pinned in their modules, so no search waits for the registry. Run it when a profile
 * changes or an archive stops answering; it asks a live service, so it is a command and not a test:
 *
 *   node packages/telescope-cli/src/vo/registry-check.mts
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tapRows } from '@cssearth/telescope/node';
import { TAP as CHANDRA_TAP } from '../archives/chandra/archive.mts';
import { CADC_TAP } from '../archives/gemini/cadc.mts';
import { INSTRUMENT_TABLES, TAP_SYNC as KOA_TAP } from '../archives/keck/koa.mts';
import { SERVICES } from './discovery.mts';

export const REGISTRY = 'https://dc.g-vo.org/tap';
const KOA = 'ivo://koa.ipac/tap';
export const PINNED: ReadonlyMap<string, string> = new Map([...SERVICES.map(profile => [profile.authority, profile.service] as const),
  [KOA, KOA_TAP], ['ivo://cadc.nrc.ca/argus', CADC_TAP], ['ivo://cxc.harvard.edu/cda', CHANDRA_TAP]]);
const address = (url: string | undefined) => url?.replace(/\/$/u, '');

/** What disagrees: a pinned address the registry does not give its identifier, and a pinned table its server does not list. */
export function registryDisagreements(pinned: ReadonlyMap<string, string>, registered: readonly Readonly<Record<string, string>>[],
  pinnedTables: readonly string[], served: readonly Readonly<Record<string, string>>[]): string[] {
  const addresses = new Map(registered.map(row => [row.ivoid, address(row.access_url)])), tables = new Set(served.map(row => row.table_name));
  return [...[...pinned].filter(([id, url]) => addresses.get(id) !== address(url)).map(([id, url]) => `${id} is pinned at ${url}; the registry gives ${addresses.get(id) ?? 'no TAP address'}.`),
    ...pinnedTables.filter(table => !tables.has(table)).map(table => `The pinned table ${table} is not among the tables the registry's crawl lists.`)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [registered, served] = await Promise.all([
    tapRows(REGISTRY, `SELECT ivoid, access_url FROM rr.interface NATURAL JOIN rr.capability WHERE standard_id = 'ivo://ivoa.net/std/tap' AND intf_role = 'std' AND ivoid IN (${[...PINNED.keys()].map(id => `'${id}'`).join(', ')})`),
    tapRows(REGISTRY, `SELECT table_name FROM glots.tables WHERE ivoid = '${KOA}'`)]);
  const disagreements = registryDisagreements(PINNED, registered, INSTRUMENT_TABLES, served);
  for (const line of disagreements) console.error(line);
  console.log(disagreements.length ? `${disagreements.length} pinned value(s) disagree with the registry at ${REGISTRY}.`
    : `The registry at ${REGISTRY} gives all ${PINNED.size} pinned addresses and lists KOA's ${INSTRUMENT_TABLES.length} pinned tables.`);
  process.exitCode = disagreements.length ? 1 : 0;
}
