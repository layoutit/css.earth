/** The archive addresses this package pins, checked against the registry of Virtual Observatory services (RegTAP, asked at GAVO
 * through PyVO). The registry owns which identifier has which address, and GAVO's crawl of every TAP server (`glots`) owns which
 * tables a server has. The addresses stay pinned in their modules, so no search waits for the registry. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { astroqueryToolchain, tapRows } from '@cssearth/telescope/node';
import { TAP as CHANDRA_TAP } from '../archives/chandra/archive.mts';
import { CADC_TAP } from '../archives/gemini/cadc.mts';
import { INSTRUMENT_TABLES, TAP_SYNC as KOA_TAP } from '../archives/keck/koa.mts';
import { SERVICES } from './discovery.mts';

const REGISTRY = 'https://dc.g-vo.org/tap', KOA = 'ivo://koa.ipac/tap';
const PINNED: ReadonlyMap<string, string> = new Map([...SERVICES.map(profile => [profile.authority, profile.service] as const),
  [KOA, KOA_TAP], ['ivo://cadc.nrc.ca/argus', CADC_TAP], ['ivo://cxc.harvard.edu/cda', CHANDRA_TAP]]);
const address = (url: string) => url.replace(/\/$/u, '');
const quoted = (ids: Iterable<string>) => [...ids].map(id => `'${id}'`).join(', ');

test('every pinned archive address is the one the registry gives its service, and KOA has the pinned tables', async t => {
  if (!await astroqueryToolchain().then(() => true, () => false)) { t.skip('the astronomy packages are not installed: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery install'); return; }
  if (!await fetch(`${REGISTRY}/availability`, { signal: AbortSignal.timeout(10_000) }).then(response => response.ok, () => false)) { t.skip(`the registry at ${REGISTRY} does not answer`); return; }
  const [registered, tables] = await Promise.all([
    tapRows(REGISTRY, `SELECT ivoid, access_url FROM rr.interface NATURAL JOIN rr.capability WHERE standard_id = 'ivo://ivoa.net/std/tap' AND intf_role = 'std' AND ivoid IN (${quoted(PINNED.keys())})`),
    tapRows(REGISTRY, `SELECT table_name FROM glots.tables WHERE ivoid = '${KOA}'`)]);
  const addresses = new Map(registered.map(row => [row.ivoid!, address(row.access_url!)]));
  assert.deepEqual(Object.fromEntries([...PINNED.keys()].map(id => [id, addresses.get(id)])), Object.fromEntries([...PINNED].map(([id, url]) => [id, address(url)])));
  const served = new Set(tables.map(row => row.table_name));
  assert.deepEqual(INSTRUMENT_TABLES.filter(table => !served.has(table)), []);
});
