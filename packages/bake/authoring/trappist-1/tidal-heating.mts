#!/usr/bin/env node
/**
 * The heat tides raise inside each planet of TRAPPIST-1, as one picture on the plane of the orbits: the package
 * `trappist-1-tidal-heating`, a plane bank the world draws while the star's dataset "Tidal heating" is selected.
 *
 *   node packages/bake/authoring/trappist-1/tidal-heating.mts
 *
 * The values are the model of Barr, Dobos & Kiss (2018, A&A 613, A37), their Table 3, kept as `source/barr-2018/table-3.json`.
 * Each planet's orbit line and marker take the color of its tidal heat flux, from an orbit's plain gray at no heat to red
 * at the table's highest value: the descriptor states the colors (`bodyColors`) and the world draws its own lines and
 * markers in them. The
 * plane's picture is the same seven circles, drawn faint: it is what the dataset's thumbnail shows whole. Writes the
 * descriptor, the prepared plane and picture, and the inventory.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { bodyData, hostedOrbit, type BodyId, type HostedPlanetId } from '@cssearth/astronomy';
import { AU_M, systemOrbitPlane, writePlaneBank } from './system-plane.mts';

const root = findProjectRoot(import.meta.url), id = 'trappist-1-tidal-heating';
const objectDirectory = resolve(root, 'src/objects', id);
const recipe = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, 'source/heating.json'), 'utf8')));
if (recipe.schema !== 'cssearth-tidal-heating-source@1' || recipe.id !== id) throw new TypeError(`source/heating.json: expected a cssearth-tidal-heating-source@1 record of ${id}.`);
const host = requireString(recipe.host), kept = requireRecord(recipe.table), field = requireString(kept.field);
const table = requireRecord(JSON.parse(await readFile(resolve(objectDirectory, requireString(kept.source)), 'utf8')));
const rows = requireArray(table.rows).map(row => requireRecord(row)).map(row => ({ planet: requireString(row.planet), value: requireFiniteNumber(row[field]) }));
const highest = Math.max(...rows.map(row => row.value));
if (rows.length < 2 || rows.some(row => row.value < 0) || !(highest > 0)) throw new TypeError(`${requireString(kept.source)}: expected two or more planets with a heat flux of zero or more, one of them above zero.`);

// Each band lies on its planet's orbit as the world draws it; the outermost orbit sets the picture's scale.
const starRadiusKm = bodyData(host as BodyId).meanRadiusKm;
const orbitM = rows.map(row => hostedOrbit(row.planet as HostedPlanetId).semiMajorAxisStellarRadii * starRadiusKm * 1000), outerM = Math.max(...orbitM);

const picture = requireRecord(recipe.picture), size = requireFiniteNumber(picture.sizePx), outerPx = requireFiniteNumber(picture.outerRadiusPx);
const ringPx = requireFiniteNumber(picture.ringPx), ringOpacity = requireFiniteNumber(picture.ringOpacity);
const palette = requireArray(picture.palette).map(stop => requireArray(stop).map(channel => requireFiniteNumber(channel)));
if (!Number.isInteger(size) || !(outerPx > 0 && outerPx + ringPx / 2 <= size / 2) || !(ringPx > 0) || !(ringOpacity > 0 && ringOpacity <= 1) ||
    palette.length < 2 || palette.some(stop => stop.length !== 3 || stop.some(channel => !(channel >= 0 && channel <= 255)))) throw new TypeError('source/heating.json picture: expected a size, an outer radius whose circles fit inside it, a line width and opacity, and a palette of colors.');
const color = (value: number) => { const place = value / highest * (palette.length - 1), stop = Math.min(palette.length - 2, Math.floor(place));
  return `#${[0, 1, 2].map(channel => Math.round(palette[stop]![channel]! + (palette[stop + 1]![channel]! - palette[stop]![channel]!) * (place - stop)).toString(16).padStart(2, '0')).join('')}`; };
const centre = size / 2, radiusPx = orbitM.map(metres => metres / outerM * outerPx);
const ring = (radius: number, stroke: string, width: number, opacity: number) => `<circle cx="${centre}" cy="${centre}" r="${radius.toFixed(3)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${rows.map((row, index) => ring(radiusPx[index]!, color(row.value), ringPx, ringOpacity)).join('')}</svg>`;
// Seven thin circles of flat color: kept lossless.
const webp = await sharp(Buffer.from(svg)).webp({ lossless: true, effort: 6 }).toBuffer();
const { data } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let drawn = 0;
for (let at = 3; at < data.length; at += 4) if (data[at]! > 0) drawn++;

const plane = await systemOrbitPlane(root, host, rows.map(row => row.planet));
await writePlaneBank({ id, objectDirectory, host, recipe: 'source/heating.json', plane, texturePath: 'heating/heating.webp', webp, sizePx: size, alphaCoverage: drawn / size ** 2,
  outerRadiusPx: outerPx, outerRadiusM: outerM, source: `${requireString(table.paper)}, ${requireString(table.locator)} (https://doi.org/10.1051/0004-6361/201731992)`, meaning: requireString(recipe.meaning),
  centreFadeM: requireArray(recipe.centreFadeOuterRadii).map(value => requireFiniteNumber(value) * outerM), bodyColors: Object.fromEntries(rows.map(row => [row.planet, color(row.value)])) });
console.log(`${id}: ${rows.map((row, index) => `${row.planet.slice(-1)} ${row.value} W/m2 at ${(orbitM[index]! / AU_M).toFixed(5)} au, ${radiusPx[index]!.toFixed(1)} px, ${color(row.value)}`).join('; ')}.`);
console.log(`  the planets' orbit normals lie within ${plane.spreadDegrees.toFixed(3)} degrees of the plane's; picture ${webp.length} bytes.`);
