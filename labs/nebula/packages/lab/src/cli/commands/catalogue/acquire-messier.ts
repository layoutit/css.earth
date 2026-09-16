/** Metadata acquisition only. Never downloads or processes science images. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';
const queries = {
  basic: "SELECT i.id AS messier_id,b.main_id,b.ra,b.dec,b.otype,b.otype_txt,b.galdim_majaxis,b.galdim_minaxis,b.coo_bibcode,b.coo_qual,b.galdim_bibcode,b.galdim_wavelength FROM ident AS i JOIN basic AS b ON i.oidref=b.oid WHERE i.id LIKE 'M %' ORDER BY messier_id",
  aliases: "SELECT m.id AS messier_id,a.id AS alias FROM ident AS m JOIN ident AS a ON a.oidref=m.oidref WHERE m.id LIKE 'M %' AND (a.id LIKE 'NGC %' OR a.id LIKE 'IC %' OR a.id LIKE 'NAME %' OR a.id LIKE '** WNC %') ORDER BY messier_id",
};
type QueryName = keyof typeof queries;
const columns = {
  basic: ['messier_id', 'main_id', 'ra', 'dec', 'otype', 'otype_txt', 'galdim_majaxis', 'galdim_minaxis', 'coo_bibcode', 'coo_qual', 'galdim_bibcode', 'galdim_wavelength'],
  aliases: ['messier_id', 'alias'],
};
const types: Record<string, string> = {
  G: 'galaxy', AGN: 'galaxy', GiP: 'galaxy', SyG: 'galaxy', LIN: 'galaxy', Sy2: 'galaxy',
  GiG: 'galaxy', GiC: 'galaxy', SBG: 'galaxy', H2G: 'galaxy',
  GlC: 'globular-cluster', OpC: 'open-cluster', PN: 'planetary-nebula',
  SNR: 'supernova-remnant', HII: 'emission-nebula', RNe: 'reflection-nebula',
  'As*': 'stellar-association', '?': 'unknown', err: 'uncertain-identification',
};
const preferredAliases = ['Omega Nebula', 'Dumbbell Nebula', 'Praesepe Cluster', 'Pleiades', 'Whirlpool Galaxy', 'Little Dumbbell Nebula'];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Missing source text.');
  return value.trim().replace(/\s+/g, ' ');
}
function nullableText(value: unknown): string | null {
  return value === null || value === '' ? null : string(value);
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new TypeError('Invalid source number.');
  return value;
}
function axis(value: unknown): number | null {
  if (value === null) return null;
  const result = number(value, Number.MIN_VALUE, 21600);
  return result;
}
function messier(value: unknown): number {
  const match = /^M\s+(\d+)$/.exec(string(value));
  if (!match) throw new TypeError('Non-Messier identifier returned.');
  const result = number(Number(match[1]), 1, 110);
  if (!Number.isInteger(result)) throw new TypeError('Invalid Messier number.');
  return result;
}
function parseTable(text: string, query: QueryName): unknown[][] {
  const value: unknown = JSON.parse(text);
  if (!record(value) || !Array.isArray(value.metadata) || !Array.isArray(value.data)) throw new TypeError('Invalid TAP table.');
  const expected = columns[query];
  if (value.metadata.length !== expected.length || value.metadata.some((column, index) => !record(column) || column.name !== expected[index])) {
    throw new TypeError('Unexpected TAP columns.');
  }
  if (query === 'basic') {
    for (const index of [2, 3, 6, 7]) {
      const column: unknown = value.metadata[index];
      if (!record(column) || column.unit !== (index < 4 ? 'deg' : 'arcmin')) throw new TypeError('Unexpected angular units.');
      if (index < 4 && (typeof column.utype !== 'string' || !column.utype.includes('spaceSys=ICRS CT.epoch=J2000'))) {
        throw new TypeError('Unexpected coordinate frame or epoch.');
      }
    }
  }
  return value.data.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== expected.length) throw new TypeError('Malformed TAP row.');
    return row;
  });
}
function queryUrl(query: QueryName): string {
  return `${endpoint}?${new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'json', query: queries[query] })}`;
}
async function acquire(query: QueryName, cache: string, cached: boolean): Promise<string> {
  const file = resolve(cache, `${query}.json`);
  if (cached) return readFile(file, 'utf8');
  const response = await fetch(queryUrl(query), { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`SIMBAD ${query}: HTTP ${response.status}`);
  const text = await response.text();
  parseTable(text, query);
  await writeFile(file, text);
  return text;
}

export function buildMessierCatalogue(basicText: string, aliasesText: string, retrievedAt: string) {
  const basic = parseTable(basicText, 'basic'), aliasRows = parseTable(aliasesText, 'aliases');
  if (basic.length !== 110) throw new Error(`Expected 110 Messier rows; received ${basic.length}.`);
  const aliases = new Map<number, string[]>();
  for (const row of aliasRows) {
    const id = messier(row[0]), name = string(row[1]).replace(/^NAME /, '');
    aliases.set(id, [...(aliases.get(id) ?? []), name]);
  }
  const seen = new Set<number>();
  const objects = basic.map(row => {
    const id = messier(row[0]);
    if (seen.has(id)) throw new Error(`Duplicate M${id}.`);
    seen.add(id);
    const sourceType = string(row[4]), mappedType = types[sourceType];
    if (!mappedType) throw new TypeError(`Unmapped SIMBAD type ${sourceType}; inspect before importing.`);
    const names = [...new Set([`M ${id}`, string(row[1]), ...(aliases.get(id) ?? [])])];
    const common = names.find(name => !/^(M|NGC|IC) \d+$/.test(name));
    const preferred = preferredAliases.find(name => names.some(alias => alias.toLowerCase() === name.toLowerCase()));
    const sourceIds = ['simbad-basic', 'simbad-aliases', 'simbad-type-guide'];
    let type = mappedType, name = preferred ?? common ?? names.find(n => /^(NGC|IC) /.test(n)) ?? `Messier ${id}`;
    let notes: string | undefined;
    if ([8, 16, 17, 20].includes(id)) {
      notes = 'SIMBAD identifies an open-cluster entry associated with the named nebula. Its center and any reported axes must not be treated as the full surrounding nebular footprint.';
    }
    if (id === 40) {
      type = 'optical-double'; sourceIds.push('merrifield-2016-m40');
      notes = 'Two unrelated stars, not a bound binary or nebula. Literature classification supplements SIMBAD sourceType=?; the returned nominal center has quality E.';
    }
    if (id === 73) {
      type = 'asterism'; sourceIds.push('odenkirchen-2002-m73');
      notes = 'Chance alignment of unrelated field stars. Literature classification supplements SIMBAD sourceType=err; retain the Messier entry rather than deleting it as a failed lookup.';
    }
    if (id === 76) notes = 'NGC 650 and NGC 651 are aliases of this single Messier entry; do not create two targets.';
    if (id === 102) {
      if (!names.includes('NGC 5866')) throw new Error('M102 identification changed; inspect the source.');
      name = 'Spindle Galaxy'; names.push('Spindle Galaxy');
      sourceIds.push('nasa-m102', 'nasa-heasarc-messier');
      notes = 'Adopts the current SIMBAD identification NGC 5866 and NASA Hubble M102 entry. Historical identity is disputed: the older HEASARC list omits M102 as a duplicate of M101. It remains a distinct inventory target here.';
    }
    const raDegrees = number(row[2], 0, 360);
    if (raDegrees === 360) throw new TypeError('RA must be below 360 degrees.');
    return {
      id: `m${id}`, messier: id, name, aliases: names, type, sourceType,
      raDegrees, decDegrees: number(row[3], -90, 90),
      majorArcmin: axis(row[6]), minorArcmin: axis(row[7]),
      coordinateReference: { bibcode: nullableText(row[8]), quality: nullableText(row[9]) },
      extentReference: { bibcode: nullableText(row[10]), wavelength: nullableText(row[11]) },
      sourceIds, ...(notes ? { notes } : {}),
    };
  }).sort((a, b) => a.messier - b.messier);
  for (let id = 1; id <= 110; id++) if (!seen.has(id)) throw new Error(`Missing M${id}.`);
  const sources = (['basic', 'aliases'] satisfies QueryName[]).map(query => ({
    id: `simbad-${query}`, url: queryUrl(query), endpoint, query: queries[query], retrievedAt,
    sha256: createHash('sha256').update(query === 'basic' ? basicText : aliasesText).digest('hex'),
    bytes: Buffer.byteLength(query === 'basic' ? basicText : aliasesText),
    credit: 'CDS SIMBAD, Strasbourg, France; Wenger et al. (2000), A&AS 143, 9.',
    reference: 'https://doi.org/10.1051/aas:2000332',
    license: 'ODbL-1.0', licenseStatement: 'https://simbad.unistra.fr/simbad/',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  }));
  const references = [
    { id: 'simbad-type-guide', url: 'https://simbad.cds.unistra.fr/Pages/guide/otypes_desc.htx', credit: 'CDS SIMBAD object-type hierarchy; broad UI categories retain each original sourceType.' },
    { id: 'merrifield-2016-m40', url: 'https://arxiv.org/abs/1612.00834', credit: 'Merrifield, Gray and Haran (2016), Gaia Shows That Messier 40 is Definitely Not a Binary Star.' },
    { id: 'odenkirchen-2002-m73', url: 'https://arxiv.org/abs/astro-ph/0111601', credit: 'Odenkirchen and Soubiran (2002), NGC 6994 — clearly not a physical stellar ensemble, A&A 383, 163.' },
    { id: 'nasa-m102', url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-102/', credit: 'NASA Hubble Messier catalogue: Messier 102 (The Spindle Galaxy); metadata reference only.' },
    { id: 'nasa-heasarc-messier', url: 'https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html', credit: 'NASA/GSFC HEASARC Messier catalogue documentation; 109-entry historical convention excludes M102.' },
  ].map(source => ({ ...source, retrievedAt }));
  return {
    schema: 'cssearth-messier-catalogue@1',
    coordinateFrame: 'ICRS', coordinateEpoch: 'J2000',
    interpretation: 'A complete 110-identifier discovery inventory, enriched from a SIMBAD snapshot; not a homogeneous scientific sample. Angular axes are copied as reported, with heterogeneous apertures/wavelengths and nulls preserved. They are not image WCS, physical radii or guaranteed full-nebula bounds. No images or reconstructions are included.',
    sources: [...sources, ...references], objects,
  };
}

async function main() {
  const cached = process.argv.includes('--cached');
  if (process.argv.slice(2).some(arg => arg !== '--cached')) throw new Error('Usage: node labs/nebula/packages/lab/src/cli/commands/catalogue/acquire-messier.ts [--cached]');
  const cache = resolve('.local/nebula-lab/catalogue/messier');
  await mkdir(cache, { recursive: true });
  const [basic, aliases] = await Promise.all([acquire('basic', cache, cached), acquire('aliases', cache, cached)]);
  const retrievedAt = cached ? string((await readFile(resolve(cache, 'retrieved-at.txt'), 'utf8')).trim()) : new Date().toISOString();
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error('Invalid retrieval date.');
  const catalogue = buildMessierCatalogue(basic, aliases, retrievedAt);
  const directory = resolve('labs/nebula/models/messier');
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, 'catalogue.json');
  await writeFile(`${file}.tmp`, `${JSON.stringify(catalogue, null, 2)}\n`);
  await rename(`${file}.tmp`, file);
  await writeFile(resolve(cache, 'retrieved-at.txt'), `${retrievedAt}\n`);
  console.log(`Verified ${catalogue.objects.length} unique Messier entries, M1–M110; ${catalogue.objects.filter(object => object.majorArcmin !== null).length} reported major axes. Metadata only.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
