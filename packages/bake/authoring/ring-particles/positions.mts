/**
 * Dots across a planet's rings, their density taken from the planet's measured ring profile.
 *
 * Nobody has measured where single ring particles are. What is measured is how much of a star's light each kilometre of
 * the rings blocks: the occultation profile the planet's ring image is prepared from (`source/preparation/rings.json`).
 * This draws a fixed number of dots whose radii follow that profile: a kilometre bin is chosen in proportion to its opacity,
 * 1 - exp(-tau), times its radius (its share of the ring's lit area). Bins the profile flags, and bins with no measured
 * optical depth, get no dot. Each dot's place inside its bin and its longitude come from a seeded generator, so they are
 * not measurements; nothing else is authored. The dots lie in the planet's equatorial plane at its prepared epoch.
 *
 * A planet whose rings are a table of bands (an `annular-field` layer: each ring's radius, width and normal optical depth)
 * is sampled the same way, one bin per band: opacity times the band's published width times its radius, the dot uniform
 * across that width.
 *
 * Usage: node packages/bake/authoring/ring-particles/positions.mts <host id> [dots]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { bodyPoleIcrf, bodyRotationAt, ROTATING_BODY_IDS, type RotatingBodyId } from '@cssearth/astronomy';

/** How many dots are drawn unless the command says, and the generator's seed. Both are display choices, not measurements. */
const DEFAULT_DOTS = 4000, SEED = 20061012;

const host = process.argv[2] ?? '';
if (!(ROTATING_BODY_IDS as readonly string[]).includes(host)) throw new TypeError(`Usage: positions.mts <host id>; ${JSON.stringify(host)} has no rotation model.`);
const root = resolve(import.meta.dirname, '../../../..'), hostDirectory = resolve(root, 'src/objects', host);
const recipePath = resolve(hostDirectory, 'source/preparation/rings.json');
const DOTS = process.argv[3] === undefined ? DEFAULT_DOTS : Number(process.argv[3]);
if (!Number.isInteger(DOTS) || DOTS < 1) throw new TypeError(`The dot count must be a whole number above zero, got ${JSON.stringify(process.argv[3])}.`);
interface Band { id?: string; source?: { radiusKm?: number; widthKm?: number; innerRadiusKm?: number; outerRadiusKm?: number; opticalDepth?: number; verticalThicknessKm?: number } }
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as { sources?: { path?: string }[]; layers?: { kind?: string; bounds?: number[]; bands?: Band[] }[] };
const profile = recipe.layers?.find(layer => layer.kind === 'observed-radial-profile'), field = recipe.layers?.find(layer => layer.kind === 'annular-field');
if (!profile && !field) throw new TypeError(`${recipePath}: needs an observed-radial-profile or an annular-field layer; ${host} has no measured rings.`);
const descriptorPath = resolve(hostDirectory, 'object.json');
const epochJdTt = (JSON.parse(await readFile(descriptorPath, 'utf8')) as { properties: { worldFrame: { epochJdTt: number } } }).properties.worldFrame.epochJdTt;
if (!Number.isFinite(epochJdTt)) throw new TypeError(`${descriptorPath} properties.worldFrame.epochJdTt must be a Julian date, got ${JSON.stringify(epochJdTt)}.`);

/** One sampling bin: a dot lands within `widthKm` centred on `radiusKm`, chosen in proportion to `weight`. */
const bins: { radiusKm: number; widthKm: number; thicknessKm: number; weight: number }[] = [];
let described: string;
if (profile) {
const [inner, outer] = profile.bounds ?? [], tablePath = recipe.sources?.[0]?.path;
if (!tablePath || !Number.isFinite(inner) || !Number.isFinite(outer)) throw new TypeError(`${recipePath}: the observed-radial-profile layer needs a source table and bounds.`);
// The PDS occultation table: ring radius (km), ..., normal optical depth (column 5), its detectable maximum (column 6),
// ..., note flag (column 12, 0 for a clean bin). -1 marks a missing optical depth.
const table = resolve(hostDirectory, 'source', tablePath);
for (const [index, line] of (await readFile(table, 'latin1')).split('\n').entries()) {
  if (!line.trim()) continue;
  const fields = line.split(',').map(Number), [radiusKm, , , , tau, maximum, , , , , , flag] = fields;
  if (fields.length !== 12 || !Number.isFinite(radiusKm) || !Number.isFinite(tau)) throw new TypeError(`${table} row ${index + 1}: expected 12 numeric columns, got ${JSON.stringify(line)}.`);
  if (radiusKm! < inner! || radiusKm! > outer! || flag !== 0 || !(tau! > 0)) continue;
  bins.push({ radiusKm: radiusKm!, widthKm: 1, thicknessKm: 0, weight: (1 - Math.exp(-(maximum! > 0 ? Math.min(tau!, maximum!) : tau!))) * radiusKm! });
}
if (!bins.length) throw new TypeError(`${table}: no clean bin with a measured optical depth between ${inner} and ${outer} km.`);
described = `${bins.length} clean bins of ${table} (${inner} to ${outer} km)`;
} else {
  for (const band of field!.bands ?? []) {
    // A band states its centre and width, or its inner and outer edges; a published vertical thickness spreads its dots
    // evenly through that thickness, centred on the ring plane.
    const source = band.source ?? {}, { opticalDepth, verticalThicknessKm: thicknessKm = 0 } = source;
    const radiusKm = source.radiusKm ?? (source.innerRadiusKm! + source.outerRadiusKm!) / 2, widthKm = source.widthKm ?? source.outerRadiusKm! - source.innerRadiusKm!;
    if (![radiusKm, widthKm, opticalDepth].every(value => typeof value === 'number' && value > 0) || !(thicknessKm >= 0)) {
      throw new TypeError(`${recipePath}: band ${JSON.stringify(band.id)} needs a positive source radius and width (or inner and outer radius) and opticalDepth, got ${JSON.stringify(band.source)}.`);
    }
    bins.push({ radiusKm, widthKm, thicknessKm, weight: (1 - Math.exp(-opticalDepth!)) * widthKm * radiusKm });
  }
  if (!bins.length) throw new TypeError(`${recipePath}: the annular-field layer has no bands.`);
  described = `the ${bins.length} bands of ${recipePath}`;
}
let total = 0;
const cumulative = bins.map(bin => total += bin.weight);

// mulberry32: a fixed, published 32-bit generator, so the same dots come out on every machine.
let state = SEED;
const random = () => {
  state = state + 0x6D2B79F5 | 0;
  let t = Math.imul(state ^ state >>> 15, 1 | state);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

// The ring plane: the planet's pole at the world's epoch, the ascending node of its equator on the ICRF equator, and the
// direction a quarter turn on.
const pole = bodyPoleIcrf(bodyRotationAt(host as RotatingBodyId, epochJdTt)), nodeLength = Math.hypot(pole[0], pole[1]);
const node = [-pole[1] / nodeLength, pole[0] / nodeLength, 0] as const;
const quarter = [pole[1] * node[2] - pole[2] * node[1], pole[2] * node[0] - pole[0] * node[2], pole[0] * node[1] - pole[1] * node[0]] as const;
const rows: string[] = [];
for (let dot = 1; dot <= DOTS; dot++) {
  const pick = random() * total;
  let low = 0, high = cumulative.length - 1;
  while (low < high) { const middle = low + high >> 1; if (cumulative[middle]! < pick) low = middle + 1; else high = middle; }
  const radiusKm = bins[low]!.radiusKm + (random() - 0.5) * bins[low]!.widthKm, longitude = random() * 2 * Math.PI;
  const heightKm = bins[low]!.thicknessKm ? (random() - 0.5) * bins[low]!.thicknessKm : 0;
  rows.push(`${dot},${[0, 1, 2].map(axis => (radiusKm * (Math.cos(longitude) * node[axis]! + Math.sin(longitude) * quarter[axis]!) + heightKm * pole[axis]!).toFixed(1)).join(',')}`);
}
const output = resolve(root, `src/objects/${host}-ring-particles/source/dots/positions.csv.gz`);
await writeFile(output, gzipSync(`name,xKm,yKm,zKm\n${rows.join('\n')}\n`));
console.log(`Wrote ${rows.length} dots from ${described}; opacity-weighted area ${Math.round(2 * Math.PI * total).toLocaleString('en')} km2; ring plane at JD ${epochJdTt} TT, to ${output}.`);
