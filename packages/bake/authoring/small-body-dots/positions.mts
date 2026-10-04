import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
/**
 * The small bodies of a bank's populations that have no page, each at its position at the world's epoch.
 *
 * A dots package names its populations in `source/dots/query.json`: for each, the orbit classes of JPL's Small-Body
 * Database and the cuts that keep the bodies a dot can stand for. One request for each population lists those objects with their osculating heliocentric
 * elements: ecliptic of J2000, at the epoch of each orbit solution. Each orbit is carried from its perihelion passage to
 * the Sun's prepared epoch as an unperturbed ellipse about the Sun, and turned to ICRF axes. An object that has an object
 * package is left out: it has its own marker. Writes `name,xKm,yKm,zKm` and reports how far each left-out object's ellipse
 * lands from its package's own prepared position, which came from JPL Horizons.
 *
 * Usage: node packages/bake/authoring/small-body-dots/positions.mts <object id>
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const root = checkoutProjectRoot(import.meta.url), objects = resolve(root, 'src/objects');
const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: positions.mts <object id>');
const queryPath = resolve(objects, id, 'source/dots/query.json');
const query = JSON.parse(await readFile(queryPath, 'utf8')) as Record<string, unknown>;
const refuseUnknown = (value: Record<string, unknown>, fields: readonly string[], at: string) => {
  const unknown = Object.keys(value).filter(field => !fields.includes(field));
  if (unknown.length) throw new TypeError(`${queryPath}: ${at} has unknown ${unknown.join(', ')}; it holds ${fields.join(', ')}.`);
};
const names = (value: unknown, at: string, pattern: RegExp, example: string) => {
  if (!Array.isArray(value) || !value.length || !value.every((name): name is string => typeof name === 'string' && pattern.test(name))) {
    throw new TypeError(`${queryPath}: ${at} must list names such as "${example}", got ${JSON.stringify(value)}.`);
  }
  return value;
};
refuseUnknown(query, ['pageClassifications', 'populations', 'pagesTable'], 'the query');
/** The classifications of the pages these bodies can have: a moon or a comet that shares an asteroid's name (Europa,
 * Halley) is another body. */
const pageClassifications = names(query.pageClassifications, 'pageClassifications', /^[a-z-]+$/u, 'asteroid');
/** A `name,xKm,yKm,zKm` table beside the query whose rows join the bank as they are: the pages that draw no marker of
 * their own, at their prepared positions (site/build/prepare/paged-asteroid-dot-positions.mts). */
const pagesTable = query.pagesTable;
if (pagesTable !== undefined && (typeof pagesTable !== 'string' || !/^[a-z0-9.-]+\.csv\.gz$/u.test(pagesTable))) throw new TypeError(`${queryPath}: pagesTable must name a .csv.gz table beside the query, got ${JSON.stringify(pagesTable)}.`);
const FIELDS = ['pdes', 'name', 'full_name', 'e', 'q', 'i', 'om', 'w', 'tp', 'condition_code'] as const;
if (!Array.isArray(query.populations) || !query.populations.length) throw new TypeError(`${queryPath}: populations must list at least one population, got ${JSON.stringify(query.populations)}.`);
/** One population of a bank: the banks of one host draw as one layer, so the populations that share a region share a bank. */
const populations = query.populations.map((entry: unknown, index) => {
  const at = `populations[${index}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError(`${queryPath}: ${at} must be an object, got ${JSON.stringify(entry)}.`);
  const population = entry as Record<string, unknown>;
  refuseUnknown(population, ['classes', 'loosestConditionCode', 'faintestAbsoluteMagnitude', 'constraints'], at);
  const optionalNumber = (field: string) => {
    const value = population[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) throw new TypeError(`${queryPath}: ${at}.${field} must be a number when given, got ${JSON.stringify(value)}.`);
    return value as number | undefined;
  };
  /** The database's orbit classes. */
  const classes = names(population.classes, `${at}.classes`, /^[A-Za-z]{3}$/u, 'TNO');
  /** The loosest orbit drawn. The condition code is the Minor Planet Center's uncertainty parameter, 0 to 9: how far an
   * object can drift along its orbit from the predicted place in ten years. At 6 that is under 2.1 degrees; at 7 it is up to
   * 9.2 degrees and at 9 more than 40.7 (https://minorplanetcenter.net/iau/info/UValue.html). */
  const loosest = optionalNumber('loosestConditionCode');
  /** The faintest absolute magnitude drawn, where a population is too large to draw whole. */
  const faintest = optionalNumber('faintestAbsoluteMagnitude');
  /** Further cuts in the database's own constraint form, such as "a|RG|3.7|4.2" for a semi-major axis between 3.7 and 4.2 au. */
  const constraints = population.constraints === undefined ? [] : population.constraints;
  if (!Array.isArray(constraints) || !constraints.every((cut): cut is string => typeof cut === 'string' && /^[a-zA-Z_]+\|(?:EQ|NE|LT|GT|LE|GE|RG)\|[-\d.|]+$/u.test(cut))) {
    throw new TypeError(`${queryPath}: ${at}.constraints must list Small-Body Database constraints such as "a|RG|3.7|4.2", got ${JSON.stringify(population.constraints)}.`);
  }
  const cuts = [...(faintest === undefined ? [] : [`H|LE|${faintest}`]), ...constraints];
  return { loosest, url: `https://ssd-api.jpl.nasa.gov/sbdb_query.api?${new URLSearchParams({ fields: FIELDS.join(','), 'sb-class': classes.join(','), 'full-prec': 'true',
    ...(cuts.length ? { 'sb-cdata': JSON.stringify({ AND: cuts }) } : {}) })}` };
});
/** IAU 2012 astronomical unit, the J2000 obliquity JPL's ecliptic frame uses (IAU 1976, 84381.448 arcseconds), and the
 * Gaussian gravitational constant: the Sun's pull on a massless body, in au^1.5 per day. */
const KM_PER_AU = 149_597_870.7, OBLIQUITY_RAD = 84381.448 / 3600 * Math.PI / 180, GAUSSIAN_K = 0.01720209895;
const sun = JSON.parse(await readFile(resolve(objects, 'sun/object.json'), 'utf8')) as { properties: { worldFrame: { epochJdTt: number } } };
const epochJdTt = sun.properties.worldFrame.epochJdTt;
if (!Number.isFinite(epochJdTt)) throw new TypeError(`src/objects/sun/object.json properties.worldFrame.epochJdTt must be a Julian date, got ${JSON.stringify(epochJdTt)}.`);

/** The rows of one population's request. */
async function request(url: string): Promise<unknown[][]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status} ${response.statusText}.`);
  const answer = await response.json() as { fields?: unknown; data?: unknown };
  if (JSON.stringify(answer.fields) !== JSON.stringify(FIELDS) || !Array.isArray(answer.data)) {
    throw new TypeError(`${url}: expected the fields ${FIELDS.join(', ')} and a data table, got fields ${JSON.stringify(answer.fields)}.`);
  }
  return answer.data as unknown[][];
}

interface Row { readonly name: string; readonly designations: readonly string[]; readonly km: [number, number, number] }
/** The position in kilometres, ICRF axes, of an unperturbed ellipse at the world's epoch. */
function position(row: readonly unknown[], index: number, url: string): Row {
  const pdes = row[0], name = row[1], fullName = row[2];
  if (typeof pdes !== 'string' || !pdes || name !== null && typeof name !== 'string' || typeof fullName !== 'string') {
    throw new TypeError(`${url} row ${index}: expected a designation, a name or null and a full name, got ${JSON.stringify(row)}.`);
  }
  const [e, q, i, om, w, tp] = row.slice(3, 9).map(Number) as [number, number, number, number, number, number];
  if (![e, q, i, om, w, tp].every(Number.isFinite) || !(e >= 0 && e < 1) || !(q > 0)) {
    throw new TypeError(`${url} row ${index} (${pdes}): expected a closed orbit with finite ${FIELDS.slice(3, 9).join(', ')}, got ${JSON.stringify(row)}.`);
  }
  const days = epochJdTt - tp, rad = Math.PI / 180;
  // Kepler's equation for the eccentric anomaly, the mean anomaly counted from perihelion and wrapped to a turn.
  const a = q / (1 - e), turn = 2 * Math.PI, mean = ((GAUSSIAN_K / a ** 1.5 * days + Math.PI) % turn + turn) % turn - Math.PI;
  let anomaly = e > 0.8 ? Math.sign(mean) * Math.PI : mean;
  for (let step = 0; step < 100; step++) {
    const change = (anomaly - e * Math.sin(anomaly) - mean) / (1 - e * Math.cos(anomaly));
    anomaly -= change;
    if (Math.abs(change) < 1e-14) break;
  }
  const xOrbit = a * (Math.cos(anomaly) - e), yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(anomaly);
  const cw = Math.cos(w * rad), sw = Math.sin(w * rad), co = Math.cos(om * rad), so = Math.sin(om * rad), ci = Math.cos(i * rad), si = Math.sin(i * rad);
  const xEcl = (co * cw - so * sw * ci) * xOrbit + (-co * sw - so * cw * ci) * yOrbit;
  const yEcl = (so * cw + co * sw * ci) * xOrbit + (-so * sw + co * cw * ci) * yOrbit;
  const zEcl = sw * si * xOrbit + cw * si * yOrbit;
  const ce = Math.cos(OBLIQUITY_RAD), se = Math.sin(OBLIQUITY_RAD);
  // "52 Europa (A858 CA)" is Europa and A858 CA.
  const provisional = fullName.match(/\(([^)]+)\)/u)?.[1];
  return { name: name ?? pdes, designations: [name ?? pdes, ...(provisional ? [provisional] : [])],
    km: [xEcl * KM_PER_AU, (yEcl * ce - zEcl * se) * KM_PER_AU, (yEcl * se + zEcl * ce) * KM_PER_AU] };
}

/** A name as the database and the packages both spell it: no accents, click letters, punctuation or case. */
const key = (name: string) => name.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/gu, '');
/** The Solar System object packages of the population's kinds, by name, by the designation a name carries in brackets,
 * and by the name without a leading asteroid number ("52 Europa"). */
const paged = new Map<string, { id: string; originM: readonly number[] }>();
for (const pageId of await readdir(objects)) {
  const text = await readFile(resolve(objects, pageId, 'object.json'), 'utf8').catch(() => null);
  if (!text?.includes('"Solar System"')) continue;
  const properties = (JSON.parse(text) as { properties?: { catalog?: { name?: unknown; systemName?: unknown; classification?: unknown }; worldFrame?: { originM?: unknown } } }).properties;
  const name = properties?.catalog?.name, originM = properties?.worldFrame?.originM;
  if (properties?.catalog?.systemName !== 'Solar System' || !pageClassifications.includes(properties.catalog.classification as string) || typeof name !== 'string' || !Array.isArray(originM)) continue;
  for (const part of name.split(/[()]/u).flatMap(piece => [piece, piece.replace(/^\s*\d+\s+(?=\D)/u, '')]).map(key).filter(Boolean)) {
    paged.set(part, { id: pageId, originM: originM as number[] });
  }
}
const offsetAu = (km: readonly number[], page: { originM: readonly number[] }) => Math.hypot(...km.map((value, axis) => value * 1000 - page.originM[axis]!)) / 1000 / KM_PER_AU;

const rows: string[] = [], pagedOffsets: { id: string; au: number }[] = [], loose = new Map<string, number>(), written = new Set<string>();
let farthestAu = 0, nearestAu = Infinity;
for (const { url, loosest } of populations) for (const [index, row] of (await request(url)).entries()) {
  const { name, designations, km } = position(row, index, url);
  const page = designations.map(designation => paged.get(key(designation))).find(Boolean);
  if (page) { pagedOffsets.push({ id: page.id, au: offsetAu(km, page) }); continue; }
  if (loosest !== undefined) {
    const code = row[9] === null ? NaN : Number(row[9]);
    if (row[9] !== null && !(Number.isInteger(code) && code >= 0 && code <= 9)) throw new TypeError(`${url} row ${index} (${name}): expected a condition code 0 to 9 or null, got ${JSON.stringify(row[9])}.`);
    if (!(code <= loosest)) { loose.set(String(row[9]), (loose.get(String(row[9])) ?? 0) + 1); continue; }
  }
  if (name.includes(',') || written.has(name)) throw new TypeError(`${url} row ${index}: the name ${JSON.stringify(name)} ${written.has(name) ? 'is listed twice' : 'holds a comma, which the table cannot carry'}.`);
  written.add(name);
  const au = Math.hypot(...km) / KM_PER_AU;
  farthestAu = Math.max(farthestAu, au); nearestAu = Math.min(nearestAu, au);
  rows.push(`${name},${km.map(value => value.toFixed(0)).join(',')}`);
}
let pageRows = 0;
if (pagesTable !== undefined) {
  const tablePath = resolve(objects, id, 'source/dots', pagesTable);
  const [header, ...lines] = gunzipSync(await readFile(tablePath)).toString('utf8').split('\n').filter(Boolean);
  if (header !== 'name,xKm,yKm,zKm') throw new TypeError(`${tablePath}: the header must be name,xKm,yKm,zKm, got ${JSON.stringify(header)}.`);
  for (const line of lines) {
    const name = line.split(',')[0]!;
    if (written.has(name)) throw new TypeError(`${tablePath}: ${name} is already a row of the catalogue.`);
    written.add(name); rows.push(line); pageRows++;
  }
}
// From far away the app draws only the first rows of a bank. In the order of a hash of each name (FNV-1a), any first
// part holds every population and every region in proportion, so a thinned view loses no swarm whole.
const order = (line: string) => {
  let hash = 0x811c9dc5;
  for (const unit of line.slice(0, line.indexOf(','))) hash = Math.imul(hash ^ unit.codePointAt(0)!, 0x01000193) >>> 0;
  return hash;
};
rows.sort((left, right) => order(left) - order(right) || (left < right ? -1 : 1));
const output = resolve(objects, id, 'source/dots/positions.csv.gz');
await writeFile(output, gzipSync(`name,xKm,yKm,zKm\n${rows.join('\n')}\n`));
if (pagesTable !== undefined) console.log(`Joined ${pageRows} rows of ${pagesTable}.`);
console.log(`Wrote ${rows.length} positions at JD ${epochJdTt} TT to ${output}, ${nearestAu.toFixed(1)} to ${farthestAu.toFixed(1)} au from the Sun.`);
pagedOffsets.sort((left, right) => right.au - left.au);
console.log(`Left out, with a page (${pagedOffsets.length}); ellipse to prepared position, au: ${pagedOffsets.map(({ id: pageId, au }) => `${pageId} ${au.toFixed(4)}`).join(', ')}.`);
if (loose.size) console.log(`Left out, orbit looser than its population's condition code: ${[...loose].sort().map(([code, count]) => `code ${code} (${count})`).join(', ') || 'none'}.`);
