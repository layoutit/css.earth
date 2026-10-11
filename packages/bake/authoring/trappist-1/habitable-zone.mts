#!/usr/bin/env node
/**
 * TRAPPIST-1's habitable zone as one picture on a plane in its system: the package `trappist-1-habitable-zone`, a plane
 * bank the world draws while the star or one of its planets is selected.
 *
 *   node packages/bake/authoring/trappist-1/habitable-zone.mts [--fetch]
 *
 * The four distances are the Habitable Zone Gallery's (Kane & Gelino 2012, https://hzgallery.org), which calculates them
 * by Kopparapu et al. (2013, 2014) from the star's temperature and luminosity in the NASA Exoplanet Archive. `--fetch`
 * downloads the Gallery's JSON product again and rewrites the kept rows of this system (`source/hzgallery/`); without it
 * the kept rows are read. The plane is the mean of the planets' orbit planes as the world draws them, through the star's
 * world position, so the world step runs first. Writes the descriptor, the prepared plane and picture, and the inventory.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { AU_M, systemOrbitPlane, writePlaneBank } from './system-plane.mts';

const GALLERY = 'https://hzgallery.org/data/hzgallery.json';
const root = findProjectRoot(import.meta.url), id = 'trappist-1-habitable-zone';
const objectDirectory = resolve(root, 'src/objects', id);
const recipe = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'source/zone.json'), 'utf8')));
if (recipe.schema !== 'cssearth-habitable-zone-source@1' || recipe.id !== id) throw new TypeError(`source/zone.json: expected a cssearth-habitable-zone-source@1 record of ${id}.`);
const host = requireString(recipe.host), edges = requireRecord(recipe.edges), system = requireString(edges.system);
const rowsPath = resolve(objectDirectory, requireString(edges.source));

if (process.argv.includes('--fetch')) {
  const cache = resolve(root, 'output/trappist-1/hzgallery/hzgallery.json');
  if (!(await stat(cache).then(() => true, () => false))) {
    const response = await fetch(GALLERY, { headers: { 'user-agent': 'css.earth preparation (https://css.earth)' } });
    if (!response.ok) throw new Error(`${GALLERY}: HTTP ${response.status}`);
    await mkdir(resolve(cache, '..'), { recursive: true }); await writeFile(cache, Buffer.from(await response.arrayBuffer()));
  }
  const rows = requireArray(JSON.parse(await readFile(cache, 'utf8'))).map(row => requireRecord(row)).filter(row => row.system === system);
  if (!rows.length) throw new TypeError(`${GALLERY}: no planet of ${system}.`);
  await mkdir(resolve(rowsPath, '..'), { recursive: true }); await writeFile(rowsPath, `${JSON.stringify(rows, null, 2)}\n`);
}

// Every planet's row carries its star's four distances: they must agree, and rise from the inside out.
const rows = requireArray(JSON.parse(await readFile(rowsPath, 'utf8'))).map(row => requireRecord(row)), fields = requireRecord(edges.fields);
const edge = (name: string) => {
  const field = requireString(fields[name]), values = new Set(rows.map(row => requireFiniteNumber(row[field])));
  if (rows.length === 0 || values.size !== 1 || rows.some(row => row.system !== system)) throw new TypeError(`${requireString(edges.source)}: the rows of ${system} must agree on ${field}.`);
  return [...values][0]!;
};
const au = [edge('optimisticInnerAu'), edge('conservativeInnerAu'), edge('conservativeOuterAu'), edge('optimisticOuterAu')] as const;
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
  source: `Habitable Zone Gallery (${GALLERY}), rows of ${system}`, meaning: requireString(recipe.meaning),
  centreFadeM: requireArray(recipe.centreFadeOuterRadii).map(value => requireFiniteNumber(value) * au[3] * AU_M) });
console.log(`${id}: optimistic ${au[0].toFixed(4)} to ${au[3].toFixed(4)} au, conservative ${au[1].toFixed(4)} to ${au[2].toFixed(4)} au; ` +
  `the planets' orbit normals lie within ${plane.spreadDegrees.toFixed(3)} degrees of the plane's, and no planet stands more than ${plane.offPlaneDegrees.toFixed(3)} degrees off it; picture ${webp.length} bytes.`);
