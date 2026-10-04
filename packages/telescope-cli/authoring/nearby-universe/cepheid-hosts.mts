#!/usr/bin/env node
/** The galaxies of the Nearby Universe field whose distance Hubble measured from their Cepheids, as the rows the field's two
 * galaxy tables hold them by:
 *
 *   node packages/telescope-cli/authoring/nearby-universe/cepheid-hosts.mts
 *
 * Riess et al. (2016), table 5, gives each of 19 type Ia supernova hosts a Cepheid distance modulus (`RIESS_2016_HOSTS`, the same
 * values that place their Cepheids' own packages). SIMBAD resolves each host's position, and the row within `MATCH_ARCSEC` of it
 * in the Cosmicflows-4 table (named by PGC number) or, when Cosmicflows-4 does not hold the galaxy, in the 2MRS table (named by
 * its 2MASS identifier) is listed with that modulus. `packages/bake/cli/prepare-catalogue-points.mts` (`table.measuredDistance`)
 * then places the row there, instead of at its group's average or its redshift's distance.
 *
 * Output: `source/galaxies/cepheid-hosts.csv.gz` and `source/galaxies-2mrs/cepheid-hosts.csv.gz`, `name,distance`. It prints each match. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { resolveSkyTarget, WORKSPACE } from '@cssearth/telescope/node';
import { hostName, RIESS_2016_HOSTS } from '../../src/new-object/archives/sh0es.mts';

/** A galaxy's catalogue position and SIMBAD's agree to a few arcseconds; the nearest other galaxy in these tables is arcminutes away. */
const MATCH_ARCSEC = 30;
const source = resolve(WORKSPACE, 'src/objects/nearby-universe/source');
const TABLES = [{ bank: 'galaxies', path: 'cf4-hyperleda.csv.gz' }, { bank: 'galaxies-2mrs', path: 'twomrs-sample.csv.gz' }] as const;

const radians = (degrees: number) => degrees * Math.PI / 180;
const separationArcsec = (ra1: number, dec1: number, ra2: number, dec2: number) => Math.acos(Math.min(1,
  Math.sin(radians(dec1)) * Math.sin(radians(dec2)) + Math.cos(radians(dec1)) * Math.cos(radians(dec2)) * Math.cos(radians(ra1 - ra2)))) * 180 / Math.PI * 3600;
// Both tables are name, RAJ2000, DEJ2000, … with a header (their points.json columns 1 to 3).
const rows = await Promise.all(TABLES.map(async table => gunzipSync(await readFile(resolve(source, table.bank, table.path))).toString('utf8').trim().split('\n').slice(1)
  .map(line => line.split(',')).filter(cells => cells[1] && cells[2]).map(cells => ({ name: cells[0]!, ra: Number(cells[1]), dec: Number(cells[2]) }))));

const listed: string[][] = TABLES.map(() => []);
for (const [host, [modulus]] of Object.entries(RIESS_2016_HOSTS)) {
  const galaxy = hostName(host), resolved = await resolveSkyTarget(WORKSPACE, galaxy);
  if (!resolved) throw new Error(`SIMBAD does not know ${galaxy}.`);
  const { raDegrees, decDegrees } = resolved.target;
  const found = rows.map(table => table.map(row => ({ row, arcsec: separationArcsec(row.ra, row.dec, raDegrees, decDegrees) })).reduce((nearest, next) => next.arcsec < nearest.arcsec ? next : nearest));
  const bank = found.findIndex(match => match.arcsec <= MATCH_ARCSEC);
  if (bank < 0) throw new Error(`${galaxy}: no row within ${MATCH_ARCSEC}" in ${TABLES.map(table => table.path).join(' or ')} (nearest ${found.map(match => `${match.arcsec.toFixed(0)}"`).join(', ')}).`);
  listed[bank]!.push(`${found[bank]!.row.name},${modulus}`);
  console.log(`${galaxy}: ${TABLES[bank]!.bank} ${found[bank]!.row.name}, ${found[bank]!.arcsec.toFixed(1)}" from SIMBAD's position, modulus ${modulus}`);
}
for (const [index, table] of TABLES.entries()) await writeFile(resolve(source, table.bank, 'cepheid-hosts.csv.gz'), gzipSync(`name,distance\n${listed[index]!.join('\n')}\n`, { level: 9 }));
