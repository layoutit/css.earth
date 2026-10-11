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
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import { hostedPlanetStateRelativeKm, type HostedPlanetId } from '@cssearth/astronomy';
import { GALAXY_BACKING_SCHEMA, OBJECT_SCHEMA, parseDensityVolumeFrame, parseGalaxyBacking, type VolumeSliceQuad } from '@cssearth/objects';
import { inventoryPreparedAssets } from '@cssearth/objects/node';
import { compilePlaneLeaf } from '@cssearth/bake/volume-leaves';

type Vector3 = [number, number, number];
const AU_M = 149597870700, GALLERY = 'https://hzgallery.org/data/hzgallery.json';
const root = findProjectRoot(import.meta.url), id = 'trappist-1-habitable-zone';
const objectDirectory = resolve(root, 'src/objects', id), prepared = resolve(objectDirectory, 'prepared');
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

// The world's frame and the star's place in it, as the world step prepared them.
const world = requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects/observable-universe/prepared/world-context.json'), 'utf8')));
const worldFrame = requireRecord(world.frame), bodies = [requireRecord(world.focus), ...requireArray(world.bodies).map(body => requireRecord(body))];
const placeOf = (body: string) => {
  const found = bodies.find(candidate => candidate.id === body);
  if (!found) throw new TypeError(`The prepared world holds no ${body}; run the world step first.`);
  return requireArray(found.positionM).map(value => requireFiniteNumber(value)) as Vector3;
};
const originM = placeOf(host), epochJdTt = requireFiniteNumber(worldFrame.epochJdTt);

// The plane: the mean of the planets' orbit normals, each the cross product of its position and velocity about the star.
const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: Vector3): Vector3 => { const length = Math.hypot(...v); return [v[0] / length, v[1] / length, v[2] / length]; };
const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const planets = requireArray(requireRecord(recipe.plane).orbits).map(value => requireString(value));
const normals = planets.map(planet => {
  const state = hostedPlanetStateRelativeKm(planet as HostedPlanetId, epochJdTt);
  if (state.hostId !== host) throw new TypeError(`${planet} orbits ${state.hostId}, not ${host}.`);
  return unit(cross([...state.positionKm] as Vector3, [...state.velocityKmPerDay] as Vector3));
});
const z = unit([0, 1, 2].map(axis => normals.reduce((sum, normal) => sum + normal[axis]!, 0)) as Vector3);
const spreadDegrees = Math.max(...normals.map(normal => Math.acos(Math.min(1, dot(normal, z))) * 180 / Math.PI));
// Any direction in the plane serves a picture that is the same all the way round: the first planet's, taken into the plane.
const toward = placeOf(planets[0]!).map((value, axis) => value - originM[axis]!) as Vector3, along = dot(toward, z);
const x = unit(toward.map((value, axis) => value - along * z[axis]!) as Vector3), y = cross(z, x);
const offPlaneDegrees = Math.max(...planets.map(planet => {
  const from = placeOf(planet).map((value, axis) => value - originM[axis]!) as Vector3;
  return Math.abs(Math.asin(dot(from, z) / Math.hypot(...from))) * 180 / Math.PI;
}));
if (!(offPlaneDegrees < 1)) throw new TypeError(`A planet stands ${offPlaneDegrees.toFixed(2)} degrees off the zone's plane; the plane is not the planets'.`);
// The rotation with columns x, y, z as a unit quaternion (local to reference).
const trace = x[0] + y[1] + z[2];
const quaternion = ((): [number, number, number, number] => {
  if (trace > 0) { const s = 2 * Math.sqrt(trace + 1); return [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4]; }
  if (x[0] > y[1] && x[0] > z[2]) { const s = 2 * Math.sqrt(1 + x[0] - y[1] - z[2]); return [s / 4, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s]; }
  if (y[1] > z[2]) { const s = 2 * Math.sqrt(1 + y[1] - x[0] - z[2]); return [(y[0] + x[1]) / s, s / 4, (z[1] + y[2]) / s, (z[0] - x[2]) / s]; }
  const s = 2 * Math.sqrt(1 + z[2] - x[0] - y[1]); return [(z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4, (x[1] - y[0]) / s];
})();

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

// One frame unit is a tenth of the outer distance; the picture's half side reaches a little past it, as its margin does.
const metersPerUnit = au[3] * AU_M / 10, half = 10 * centre / outerPx;
const frame = parseDensityVolumeFrame({ referenceFrame: requireString(worldFrame.referenceFrame), epochJdTt, originM, localToReferenceXyzw: quaternion, metersPerUnit,
  boundsUnits: { min: [-half, -half, -half / 100], max: [half, half, half / 100] } });
const texturePath = 'zone/zone.webp';
const quad: VolumeSliceQuad = { id, axis: 'z', sliceIndex: 0, texturePath, widthPx: size, heightPx: size,
  vertices: [[-half, half, 0], [half, half, 0], [half, -half, 0], [-half, -half, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: [0, 0, 0], normal: [0, 0, 1],
  bytes: webp.length, alphaCoverage: Math.PI * (px[3]! ** 2 - px[0]! ** 2) / size ** 2 };
const leaf = compilePlaneLeaf(id, frame, quad);
const fade = requireArray(recipe.centreFadeOuterRadii).map(value => requireFiniteNumber(value) * au[3] * AU_M);
const plane = { schema: GALAXY_BACKING_SCHEMA, id, source: `Habitable Zone Gallery (${GALLERY}), rows of ${system}`, meaning: requireString(recipe.meaning),
  frame, leaf: { texturePath: leaf.texturePath, style: leaf.style }, centreFadeM: fade };
parseGalaxyBacking(plane, `${id}/prepared/plane.json`);

await rm(prepared, { recursive: true, force: true });
await mkdir(resolve(prepared, 'zone'), { recursive: true });
await writeFile(resolve(prepared, texturePath), webp);
await writeFile(resolve(prepared, 'plane.json'), `${JSON.stringify(plane)}\n`);
await writeFile(resolve(objectDirectory, 'object.json'), `${JSON.stringify({ schema: OBJECT_SCHEMA, id, type: 'plane-bank',
  properties: { preparation: { source: 'source/zone.json' }, host, frame }, prepared: { format: GALAXY_BACKING_SCHEMA, url: 'prepared/plane.json' } }, null, 2)}\n`);
await inventoryPreparedAssets({ objectId: id, objectDirectory });
console.log(`${id}: optimistic ${au[0].toFixed(4)} to ${au[3].toFixed(4)} au, conservative ${au[1].toFixed(4)} to ${au[2].toFixed(4)} au; ` +
  `the planets' orbit normals lie within ${spreadDegrees.toFixed(3)} degrees of the plane's, and no planet stands more than ${offPlaneDegrees.toFixed(3)} degrees off it; picture ${webp.length} bytes.`);
