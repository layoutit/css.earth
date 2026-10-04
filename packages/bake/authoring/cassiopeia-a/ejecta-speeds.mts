// Entry script: node packages/bake/authoring/cassiopeia-a/ejecta-speeds.mts [--frame] [model.zip]
/**
 * The measured depths of Cassiopeia A's [Ar II] ejecta as the table the image-layer bake reads
 * (`src/objects/cassiopeia-a-layers/source/ejecta-speeds.dat`), from the Chandra X-ray Center's files of the model of
 * DeLaney et al. (2010): each cell of one model unit the [Ar II] surface passes through, as its place from the expansion
 * centre (arcsec east and north) and its speed along the sight line relative to the fitted shell's centre (km/s,
 * positive away from the Sun).
 *
 * The files are surfaces in the model's own units, which nothing published states. Measured here (`--frame` prints it):
 * x is east, z is north and y points at the Sun; the origin is on the expansion centre of Thorstensen, Fesen & van den
 * Bergh (2001) and, along the sight line, at the centre of the paper's shell. A unit is `MODEL_UNIT_ARCSEC`. The
 * ejecta expand freely, so the paper turns a speed into a depth with one factor, 0.022 arcsec per km/s (Sect. IV.1);
 * the table states the depths as speeds with that factor, which the recipe's `expansionKmSPerArcsec` undoes.
 *
 * Input: the model's zip (downloaded from `MODEL_URL` unless a path is given); with `--frame`, also the bank's picture
 * and its registration. Output: the table, or with `--frame` the printed measurement.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseImageLayerRecipe } from '@cssearth/bake/image-layers';

const MODEL_URL = 'https://chandra.harvard.edu/graphics/resources/illustrations/3d_files/CasA_supernova_remnant-ascii_vtks.zip';
const MEMBERS = 'CasA_supernova_remnant-ascii_vtks/CasA_supernova_remnant-ascii_vtks/asciivtks/';
/** A model unit on the sky. Measured on 2026-10-04 three ways (`--frame`): the scale that puts the most of Webb's
 * picture under the [Ar II] surface, 3.62; the paper's shell radius, 108.6 arcsec, over the radius of the sphere
 * fitted to the surface, 30.47 units: 3.56; the paper's shell centre, 18.9 arcsec behind zero velocity, over the
 * neutron-star marker's place in front of the origin, 5.47 units: 3.45. */
const MODEL_UNIT_ARCSEC = 3.6;
/** DeLaney et al. (2010), Sect. IV.1: the fitted shell. Its centre recedes at `v_c`, it crosses the sight line through
 * its centre at `v_m`, and an arcsecond along the sight line is 1/`S` km/s. */
const SHELL = { centreKmS: 859, nearKmS: -4077, arcsecPerKmS: 0.022 };
/** The expansion centre (Thorstensen, Fesen & van den Bergh 2001) and the neutron star (Fesen, Pavlov & Sanwal 2006,
 * as DeLaney et al. place it), ICRS degrees. */
const CENTRE = [(23 + 23 / 60 + 27.77 / 3600) * 15, 58 + 48 / 60 + 49.4 / 3600] as const, NEUTRON_STAR = [(23 + 23 / 60 + 27.94 / 3600) * 15, 58 + 48 / 60 + 42.5 / 3600] as const;

type Point = readonly [number, number, number];
const root = checkoutProjectRoot(import.meta.url), sourceDirectory = resolve(root, 'src/objects/cassiopeia-a-layers/source');
const frame = process.argv.includes('--frame'), given = process.argv.slice(2).find(argument => !argument.startsWith('--'));

/** The vertices of one of the model's surfaces. */
function points(zip: string, name: string): Point[] {
  const tokens = execFileSync('unzip', ['-p', zip, `${MEMBERS}${name}-ascii.vtk`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\s+/u), at = tokens.indexOf('POINTS'), count = Number(tokens[at + 1]);
  if (at < 0 || !Number.isInteger(count) || count < 1) throw new TypeError(`${name}-ascii.vtk in ${zip} has no POINTS block.`);
  const read = (index: number) => { const value = Number(tokens[at + 3 + index]); if (!Number.isFinite(value)) throw new TypeError(`${name}-ascii.vtk in ${zip}: coordinate ${index} of its ${3 * count} is not a number.`); return value; };
  return Array.from({ length: count }, (_, index) => [read(3 * index), read(3 * index + 1), read(3 * index + 2)] as const);
}

/** The sphere nearest a surface's vertices (algebraic least squares): its centre and radius. */
function sphere(surface: readonly Point[]): { centre: Point; radius: number } {
  const system = Array.from({ length: 4 }, () => new Float64Array(5));
  for (const [x, y, z] of surface) { const row = [2 * x, 2 * y, 2 * z, 1], square = x * x + y * y + z * z; for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) system[i]![j]! += row[i]! * row[j]!; system[i]![4]! += row[i]! * square; } }
  for (let i = 0; i < 4; i++) { let pivot = i; for (let r = i + 1; r < 4; r++) if (Math.abs(system[r]![i]!) > Math.abs(system[pivot]![i]!)) pivot = r;
    [system[i], system[pivot]] = [system[pivot]!, system[i]!];
    for (let r = 0; r < 4; r++) if (r !== i) { const factor = system[r]![i]! / system[i]![i]!; for (let j = i; j < 5; j++) system[r]![j]! -= factor * system[i]![j]!; } }
  const [a, b, c, d] = system.map((row, index) => row[4]! / row[index]!) as [number, number, number, number];
  return { centre: [a, b, c], radius: Math.sqrt(d + a * a + b * b + c * c) };
}

const scratch = given ? null : await mkdtemp(join(tmpdir(), 'cassiopeia-a-model-'));
try {
  let zip = given ? resolve(given) : '';
  if (scratch) { const response = await fetch(MODEL_URL); if (!response.ok) throw new Error(`${MODEL_URL} answered ${response.status}.`); zip = join(scratch, 'model.zip'); await writeFile(zip, Buffer.from(await response.arrayBuffer())); }
  const argon = points(zip, 'newar');
  if (!frame) {
    // One row a cell of a model unit: the mean place of the surface's vertices in it.
    const cells = new Map<string, [number, number, number, number]>();
    for (const [x, y, z] of argon) { const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`; let cell = cells.get(key); if (!cell) cells.set(key, cell = [0, 0, 0, 0]); cell[0] += x; cell[1] += y; cell[2] += z; cell[3]++; }
    const rows = [...cells.values()].map(([x, y, z, count]) => `${(MODEL_UNIT_ARCSEC * x / count).toFixed(1)} ${(MODEL_UNIT_ARCSEC * z / count).toFixed(1)} ${Math.round(-MODEL_UNIT_ARCSEC * y / count / SHELL.arcsecPerKmS)}`);
    await writeFile(resolve(sourceDirectory, 'ejecta-speeds.dat'), rows.join('\n') + '\n');
    console.log(`${rows.length} cells of the [Ar II] surface's ${argon.length} vertices: src/objects/cassiopeia-a-layers/source/ejecta-speeds.dat`);
  } else {
    const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown), rad = Math.PI / 180;
    const { data, info } = await sharp(resolve(sourceDirectory, recipe.source.path)).greyscale().blur(3).raw().toBuffer({ resolveWithObject: true });
    const width = info.width, height = info.height, arcsecPerPixel = recipe.observation.fieldOfViewDeg[0] * 3600 / width, north = recipe.observation.northClockwiseDeg * rad;
    // A sky offset from the picture's centre (arcsec east and north) to a pixel: north is turned `northClockwiseDeg` clockwise from up.
    const pixel = (east: number, northward: number) => [width / 2 + (-east * Math.cos(north) + northward * Math.sin(north)) / arcsecPerPixel, height / 2 - (east * Math.sin(north) + northward * Math.cos(north)) / arcsecPerPixel] as const;
    const sky = ([ra, dec]: readonly [number, number]) => [(ra - recipe.observation.centerRaDeg) * Math.cos(dec * rad) * 3600, (dec - recipe.observation.centerDecDeg) * 3600] as const;
    const origin = sky(CENTRE), star = sky(NEUTRON_STAR);
    const light = (east: number, northward: number) => { const [x, y] = pixel(east, northward), i = Math.round(x), j = Math.round(y); return i < 0 || j < 0 || i >= width || j >= height ? 0 : data[j * width + i]!; };
    // The picture's mean light under every fifth vertex of the surface, for a direction of east and north, a scale and an origin.
    const score = (eastSign: number, northSign: number, unit: number, east: number, northward: number) => { let sum = 0, count = 0; for (let index = 0; index < argon.length; index += 5) { const [x, , z] = argon[index]!; sum += light(origin[0] + east + eastSign * unit * x, origin[1] + northward + northSign * unit * z); count++; } return sum / count; };
    for (const eastSign of [1, -1]) for (const northSign of [1, -1]) { let best = { unit: 0, mean: -1 };
      for (let unit = 3; unit <= 4.0001; unit += 0.05) { const mean = score(eastSign, northSign, unit, 0, 0); if (mean > best.mean) best = { unit, mean }; }
      console.log(`East along ${eastSign > 0 ? '+x' : '-x'}, north along ${northSign > 0 ? '+z' : '-z'}: the most light, ${best.mean.toFixed(1)} of 255, at ${best.unit.toFixed(2)} arcsec a unit.`); }
    let best = { unit: 0, east: 0, north: 0, mean: -1 };
    for (let unit = 3.2; unit <= 3.8001; unit += 0.02) for (let east = -8; east <= 8; east += 2) for (let northward = -8; northward <= 8; northward += 2) { const mean = score(1, 1, unit, east, northward); if (mean > best.mean) best = { unit, east, north: northward, mean }; }
    console.log(`With the origin free: ${best.unit.toFixed(2)} arcsec a unit, the origin ${best.east} arcsec east and ${best.north} north of the expansion centre (${best.mean.toFixed(1)} of 255).`);
    const fitted = sphere(argon), shellArcsec = (SHELL.centreKmS - SHELL.nearKmS) * SHELL.arcsecPerKmS;
    console.log(`The sphere nearest the [Ar II] surface: ${fitted.radius.toFixed(2)} units about (${fitted.centre.map(value => value.toFixed(2)).join(', ')}); the paper's shell is ${shellArcsec.toFixed(1)} arcsec, so a unit is ${(shellArcsec / fitted.radius).toFixed(2)} arcsec.`);
    const marker = points(zip, 'cco'), mean = [0, 1, 2].map(axis => marker.reduce((sum, point) => sum + point[axis]!, 0) / marker.length) as [number, number, number];
    console.log(`The neutron-star marker: (${mean.map(value => value.toFixed(2)).join(', ')}) units. The paper puts it at zero velocity, ${(SHELL.centreKmS * SHELL.arcsecPerKmS).toFixed(1)} arcsec in front of the shell's centre: ${(SHELL.centreKmS * SHELL.arcsecPerKmS / mean[1]).toFixed(2)} arcsec a unit. On the sky it is ${(star[0] - origin[0]).toFixed(1)} arcsec east and ${(star[1] - origin[1]).toFixed(1)} north of the expansion centre; the marker, at ${MODEL_UNIT_ARCSEC} arcsec a unit, ${(MODEL_UNIT_ARCSEC * mean[0]).toFixed(1)} and ${(MODEL_UNIT_ARCSEC * mean[2]).toFixed(1)}.`);
  }
} finally { if (scratch) await rm(scratch, { recursive: true, force: true }); }
