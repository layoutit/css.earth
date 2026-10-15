#!/usr/bin/env node
/**
 * A star's habitable zone as one picture on the plane of its planets' orbits: a package such as `trappist-1-habitable-zone`,
 * a plane bank the world draws while the star's dataset "Habitable zone" is selected.
 *
 *   node packages/bake/authoring/system-planes/habitable-zone.mts <package id> [--fetch]
 *
 * The four distances are the Habitable Zone Gallery's (Kane & Gelino 2012, https://hzgallery.org), which calculates them
 * by Kopparapu et al. (2013, 2014) from the star's temperature and luminosity in the NASA Exoplanet Archive. `--fetch`
 * downloads the Gallery's JSON product again and rewrites the kept rows of this system (`source/hzgallery/`); without it
 * the kept rows are read. The Gallery calculates the distances for each planet's row from the star's parameters in that
 * planet's reference, so a system's rows can disagree: then the recipe names the row (`edges.row`) whose star is the one
 * the star's page shows, and the others are kept and not read. The plane is the mean of the planets' orbit planes as the
 * world draws them, through the star's world position, so the world step runs first. Writes the descriptor, the prepared
 * plane and picture, and the inventory.
 *
 * A system the Gallery does not list (TOI-700, 2026-10-14) names the method instead (`edges.method: "kopparapu-2014"`): the
 * four distances are calculated here by Kopparapu et al. (2014)'s Equations 1 and 2 and their Table 1 coefficients for one
 * Earth mass, kept in the package, from the temperature and luminosity in the star's own measurements record. The same
 * calculation gives the Gallery's numbers for 55 Cnc and Proxima Centauri to the fourth decimal.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { AU_M, systemOrbitPlane, writePlaneBank } from './system-plane.mts';

const GALLERY = 'https://hzgallery.org/data/hzgallery.json';
const root = findProjectRoot(import.meta.url), id = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!id || !/^[a-z0-9][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: habitable-zone.mts <package id> [--fetch]');
const objectDirectory = resolve(root, 'src/objects', id);
const recipe = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'source/zone.json'), 'utf8')));
if (recipe.schema !== 'cssearth-habitable-zone-source@1' || recipe.id !== id) throw new TypeError(`source/zone.json: expected a cssearth-habitable-zone-source@1 record of ${id}.`);
const host = requireString(recipe.host), edges = requireRecord(recipe.edges), calculated = edges.method !== undefined;
if (calculated && edges.method !== 'kopparapu-2014') throw new TypeError(`source/zone.json edges.method: only kopparapu-2014 is known, not ${String(edges.method)}.`);
const system = calculated ? host : requireString(edges.system), rowsPath = calculated ? '' : resolve(objectDirectory, requireString(edges.source));

if (process.argv.includes('--fetch') && !calculated) {
  const cache = resolve(root, 'output/hzgallery/hzgallery.json');
  if (!(await stat(cache).then(() => true, () => false))) {
    const response = await fetch(GALLERY, { headers: { 'user-agent': 'css.earth preparation (https://css.earth)' } });
    if (!response.ok) throw new Error(`${GALLERY}: HTTP ${response.status}`);
    await mkdir(resolve(cache, '..'), { recursive: true }); await writeFile(cache, Buffer.from(await response.arrayBuffer()));
  }
  const rows = requireArray(JSON.parse(await readFile(cache, 'utf8'))).map(row => requireRecord(row)).filter(row => row.system === system);
  if (!rows.length) throw new TypeError(`${GALLERY}: no planet of ${system}.`);
  await mkdir(resolve(rowsPath, '..'), { recursive: true }); await writeFile(rowsPath, `${JSON.stringify(rows, null, 2)}\n`);
}

/** The four distances from the Gallery's kept rows: every planet's row carries its star's four, and they must agree, or the
 * recipe names the one row read. */
async function galleryDistances() {
  const kept = requireArray(JSON.parse(await readFile(rowsPath, 'utf8'))).map(row => requireRecord(row)), fields = requireRecord(edges.fields);
  const named = edges.row === undefined ? undefined : requireString(edges.row), rows = named === undefined ? kept : kept.filter(row => row.name === named);
  if (named !== undefined && rows.length !== 1) throw new TypeError(`${requireString(edges.source)}: edges.row names ${named}, which is ${rows.length ? 'more than one row' : 'no row'} of ${system}.`);
  const edge = (name: string) => {
    const field = requireString(fields[name]), values = new Set(rows.map(row => requireFiniteNumber(row[field])));
    if (rows.length === 0 || values.size !== 1 || rows.some(row => row.system !== system)) throw new TypeError(`${requireString(edges.source)}: the rows of ${system} must agree on ${field}.`);
    return [...values][0]!;
  };
  return { au: [edge('optimisticInnerAu'), edge('conservativeInnerAu'), edge('conservativeOuterAu'), edge('optimisticOuterAu')] as const, source: `Habitable Zone Gallery (${GALLERY}), rows of ${system}` };
}

/** The four distances calculated by Kopparapu et al. (2014): S = S_sun + aT + bT^2 + cT^3 + dT^4 with T = Teff - 5780 K, and
 * d = sqrt(L / S) au, from the kept Table 1 and the star's measurements record. Their fit covers 2,600 to 7,200 K. */
async function calculatedDistances() {
  const table = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, requireString(edges.coefficients)), 'utf8')));
  const record = requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects', host, 'source/measurements.json'), 'utf8')));
  const teff = requireFiniteNumber(record.effectiveTemperatureK), luminosity = 10 ** requireFiniteNumber(record.luminosityLogSolar), [low, high] = requireArray(table.validTeffK).map(value => requireFiniteNumber(value));
  if (!(teff >= low! && teff <= high!)) throw new RangeError(`${host}: ${teff} K lies outside the ${low} to ${high} K that ${requireString(table.paper)} fitted.`);
  const limits = requireRecord(table.limits), t = teff - 5780;
  const distance = (name: string) => {
    const c = requireRecord(limits[name]), flux = requireFiniteNumber(c.seffSun) + requireFiniteNumber(c.a) * t + requireFiniteNumber(c.b) * t ** 2 + requireFiniteNumber(c.c) * t ** 3 + requireFiniteNumber(c.d) * t ** 4;
    return Math.sqrt(luminosity / flux);
  };
  return { au: [distance('recentVenus'), distance('runawayGreenhouse'), distance('maximumGreenhouse'), distance('earlyMars')] as const,
    source: `${requireString(table.paper)}, ${requireString(table.locator)}, from ${host}'s ${teff} K and log L ${record.luminosityLogSolar}`, teff, luminosity };
}

const distances = calculated ? await calculatedDistances() : await galleryDistances(), au = distances.au;
if (!(au[0] > 0 && au[0] < au[1] && au[1] < au[2] && au[2] < au[3])) throw new TypeError(`The zone's distances must rise from the inside out, not ${au.join(', ')} au.`);

const planets = requireArray(requireRecord(recipe.plane).orbits).map(value => requireString(value));
const plane = await systemOrbitPlane(root, host, planets);

// The picture: three flat rings of one color, the conservative zone and the optimistic zone's two extensions of it.
const picture = requireRecord(recipe.picture), size = requireFiniteNumber(picture.sizePx), outerPx = requireFiniteNumber(picture.outerRadiusPx);
const color = requireString(picture.color), strong = requireFiniteNumber(picture.conservativeOpacity), faint = requireFiniteNumber(picture.optimisticOpacity);
if (!Number.isInteger(size) || !(outerPx > 0 && outerPx < size / 2) || !/^#[0-9a-f]{6}$/u.test(color) || !(faint > 0 && faint < strong && strong <= 1)) throw new TypeError('source/zone.json picture: expected a size, an outer radius inside it, a color and two opacities, the optimistic one fainter.');
const px = au.map(value => value / au[3] * outerPx), centre = size / 2;
const circle = (radius: number) => `M${centre - radius},${centre}a${radius},${radius} 0 1,0 ${2 * radius},0a${radius},${radius} 0 1,0 ${-2 * radius},0z`;
const ring = (inner: number, outer: number, opacity: number) => `<path fill-rule="evenodd" fill="${color}" fill-opacity="${opacity}" d="${circle(outer)}${circle(inner)}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${ring(px[0]!, px[1]!, faint)}${ring(px[1]!, px[2]!, strong)}${ring(px[2]!, px[3]!, faint)}</svg>`;
// Two flat values and their edges: kept lossless.
const webp = await sharp(Buffer.from(svg)).webp({ lossless: true, effort: 6 }).toBuffer();

await writePlaneBank({ id, objectDirectory, host, recipe: 'source/zone.json', plane, texturePath: 'zone/zone.webp', webp, sizePx: size,
  alphaCoverage: Math.PI * (px[3]! ** 2 - px[0]! ** 2) / size ** 2, outerRadiusPx: outerPx, outerRadiusM: au[3] * AU_M,
  source: distances.source, meaning: requireString(recipe.meaning),
  centreFadeM: requireArray(recipe.centreFadeOuterRadii).map(value => requireFiniteNumber(value) * au[3] * AU_M) });
console.log(`${id}: optimistic ${au[0].toFixed(4)} to ${au[3].toFixed(4)} au, conservative ${au[1].toFixed(4)} to ${au[2].toFixed(4)} au; ` +
  `the planets' orbit normals lie within ${plane.spreadDegrees.toFixed(3)} degrees of the plane's, and no planet stands more than ${plane.offPlaneDegrees.toFixed(3)} degrees off it; picture ${webp.length} bytes.`);
