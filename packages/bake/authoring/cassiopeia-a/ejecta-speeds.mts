// Entry script: node packages/bake/authoring/cassiopeia-a/ejecta-speeds.mts [--bank=<bank id>] [--frame] [model.zip]
/**
 * The measured depths of Cassiopeia A's ejecta as the table the image-layer bake reads
 * (`src/objects/cassiopeia-a-layers/source/ejecta-speeds.dat`), from the Chandra X-ray Center's files of the model of
 * DeLaney et al. (2010): each cell of one model unit a surface passes through, as its place from the expansion centre
 * (arcsec east and north), its depth along the sight line from the fitted shell's centre stated as a speed (km/s,
 * positive away from the Sun) and, beyond the forward shock's radius (the recipe's ring), the surface's name. The
 * surfaces are the [Ar II] ejecta, and, beyond the forward shock only, the outer optical knots and the jets, whose
 * places are older or newer than the [Ar II] map's: each is grown or shrunk by free expansion to the epoch of the Webb
 * picture (`EPOCHS`), and with `--bank` to the epoch of that bank's picture (`PICTURES`). Every row beyond the shock names its surface, the [Ar II] ones there too: those rows are sparse,
 * and the bake takes them as surfaces of their own (`speeds.columns.surface`), apart from the [Ar II] shell inside.
 *
 * The files are surfaces in the model's own units, which nothing published states. Measured here (`--frame` prints it):
 * x is east, z is north and y points at the Sun; the origin is on the expansion centre of Thorstensen, Fesen & van den
 * Bergh (2001) and, along the sight line, at the centre of the paper's shell. A unit is `MODEL_UNIT_ARCSEC`. The
 * ejecta expand freely, so the paper turns a speed into a depth with one factor, 0.022 arcsec per km/s (Sect. IV.1);
 * the table states the depths as speeds with that factor, which the recipe's `expansionKmSPerArcsec` undoes.
 *
 * Input: the model's zip (downloaded from `MODEL_URL` unless a path is given); with `--frame`, also the bank's picture
 * and its registration. Output: the bank's table (`--bank`, by default the NIRCam bank, `cassiopeia-a-layers`), or with
 * `--frame` the printed measurement.
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
/** Years. The knots' convergent date, assuming no deceleration (Thorstensen, Fesen & van den Bergh 2001). The Webb
 * NIRCam picture, 2022 November 5 (Milisavljevic et al. 2024, Table 1). Each surface's own: [Ar II], the Spitzer IRS
 * map of 2005 January 13 (DeLaney et al. 2010, Sect. II); the outer optical knots, plotted "at their 1988 or 1996
 * locations" (Sect. IV.5), so 1992 give or take 4 years, 1.3% of their distance; the jets, which the CXC's README does
 * not name, taken as the Chandra million-second observation of 2004 February to May (Sect. III). `MODEL_UNIT_ARCSEC` is
 * the [Ar II] surface laid on the Webb picture, so a surface at its own epoch is grown by the ratio of its age at the
 * [Ar II] map to its age then: free expansion from the [Ar II] map's epoch to Webb's is already in that unit. On the NIRCam
 * picture the [Ar II] surface itself is unchanged. `--frame` checks the factors against the picture's light beyond the forward shock. */
const EPOCHS = { explosion: 1671.3, webb: 2022.85 } as const;
const SURFACES = [{ file: 'newar', name: 'argon', year: 2005.03, outside: false }, { file: 'newopt', name: 'optical-knots', year: 1992, outside: true }, { file: 'newjets', name: 'jets', year: 2004.3, outside: true }] as const;
/** Years. Each bank's picture: the NIRCam one, 2022 November 5, which `MODEL_UNIT_ARCSEC` was measured on; the MIRI
 * one, whose mosaic was taken on 2022 August 4 and 5 and its gaps filled on 2022 October 22 (Milisavljevic et al.
 * 2024, Table 1 and Sect. 2): 2022 August 5, the mosaic's. */
const PICTURES: Record<string, number> = { 'cassiopeia-a-layers': EPOCHS.webb, 'cassiopeia-a-miri-layers': 2022.59 };
const bank = process.argv.find(argument => argument.startsWith('--bank='))?.slice('--bank='.length) ?? 'cassiopeia-a-layers', picture = PICTURES[bank];
if (picture === undefined) throw new TypeError(`--bank names a Cassiopeia A bank: ${Object.keys(PICTURES).join(' or ')}; got ${JSON.stringify(bank)}.`);
/** How much a surface's places and depths are grown to sit with the [Ar II] surface on the bank's picture: from its own
 * epoch to the [Ar II] map's, then by free expansion from the NIRCam picture, where the unit was measured, to the bank's. */
const grown = (year: number) => (SURFACES[0].year - EPOCHS.explosion) / (year - EPOCHS.explosion) * (picture - EPOCHS.explosion) / (EPOCHS.webb - EPOCHS.explosion);
/** The expansion centre (Thorstensen, Fesen & van den Bergh 2001) and the neutron star (Fesen, Pavlov & Sanwal 2006,
 * as DeLaney et al. place it), ICRS degrees. */
const CENTRE = [(23 + 23 / 60 + 27.77 / 3600) * 15, 58 + 48 / 60 + 49.4 / 3600] as const, NEUTRON_STAR = [(23 + 23 / 60 + 27.94 / 3600) * 15, 58 + 48 / 60 + 42.5 / 3600] as const;

type Point = readonly [number, number, number];
const root = checkoutProjectRoot(import.meta.url), sourceDirectory = resolve(root, `src/objects/${bank}/source`);
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
  const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown), rad = Math.PI / 180;
  const forwardShock = recipe.geometry.shape?.ring.semiMajorArcsec;
  if (!forwardShock) throw new TypeError(`src/objects/${bank}/source/recipe.json has no geometry.shape.ring: the forward shock the outer surfaces begin at.`);
  if (!frame) {
    const rows: string[] = [];
    for (const surface of SURFACES) {
      // One row a cell of a model unit: the mean place of the surface's vertices in it, grown to the Webb picture's epoch.
      const cells = new Map<string, [number, number, number, number]>(), unit = MODEL_UNIT_ARCSEC * grown(surface.year); let kept = 0;
      for (const [x, y, z] of surface.file === 'newar' ? argon : points(zip, surface.file)) { const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`; let cell = cells.get(key); if (!cell) cells.set(key, cell = [0, 0, 0, 0]); cell[0] += x; cell[1] += y; cell[2] += z; cell[3]++; }
      for (const [x, y, z, count] of cells.values()) { const east = unit * x / count, north = unit * z / count;
        if (surface.outside && Math.hypot(east, north) <= forwardShock) continue;
        rows.push(`${east.toFixed(1)} ${north.toFixed(1)} ${Math.round(-unit * y / count / SHELL.arcsecPerKmS)}${Math.hypot(east, north) > forwardShock ? ` ${surface.name}` : ''}`); kept++; }
      console.log(`${surface.file}: ${kept} cells${surface.outside ? ` beyond ${forwardShock} arcsec` : ''}, at ${unit.toFixed(3)} arcsec a unit (grown ${grown(surface.year).toFixed(4)} from ${surface.year}).`);
    }
    await writeFile(resolve(sourceDirectory, 'ejecta-speeds.dat'), rows.join('\n') + '\n');
    console.log(`${rows.length} rows: src/objects/${bank}/source/ejecta-speeds.dat`);
  } else {
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
    // The outer surfaces' growth, checked: the light under their places beyond the forward shock, over the mean light at
    // the same distance from the expansion centre (the picture fades outward), for factors about the free expansion.
    const ring = new Float64Array(400), ringCount = new Float64Array(400);
    for (let j = 0; j < height; j += 2) for (let i = 0; i < width; i += 2) { const dx = (i - width / 2) * arcsecPerPixel, dy = (height / 2 - j) * arcsecPerPixel, east = -dx * Math.cos(north) + dy * Math.sin(north), northward = dx * Math.sin(north) + dy * Math.cos(north), r = Math.round(Math.hypot(east - origin[0], northward - origin[1])); if (r < 400) { ring[r]! += data[j * width + i]!; ringCount[r]!++; } }
    for (const surface of SURFACES.filter(item => item.outside)) { const vertices = points(zip, surface.file); let best = { factor: 0, contrast: -1 };
      for (let factor = 0.9; factor <= 1.2001; factor += 0.01) { let sum = 0, count = 0;
        for (const [x, , z] of vertices) { const east = MODEL_UNIT_ARCSEC * factor * x, northward = MODEL_UNIT_ARCSEC * factor * z, r = Math.round(Math.hypot(east, northward)); const [px, py] = pixel(origin[0] + east, origin[1] + northward); if (r <= forwardShock || r >= 400 || !ringCount[r] || px < 0 || py < 0 || px >= width || py >= height) continue; sum += light(origin[0] + east, origin[1] + northward) / (ring[r]! / ringCount[r]! + 1); count++; }
        if (count && sum / count > best.contrast) best = { factor, contrast: sum / count }; }
      console.log(`${surface.file} beyond ${forwardShock} arcsec: the most light against its surroundings at ${best.factor.toFixed(2)} times the frame; free expansion from ${surface.year} grows it ${grown(surface.year).toFixed(3)}, and from ${surface.year} at a unit of ${MODEL_UNIT_ARCSEC} arcsec, as if that unit held at each surface's epoch, ${((picture - EPOCHS.explosion) / (surface.year - EPOCHS.explosion)).toFixed(3)}.`); }
    console.log(`The neutron-star marker: (${mean.map(value => value.toFixed(2)).join(', ')}) units. The paper puts it at zero velocity, ${(SHELL.centreKmS * SHELL.arcsecPerKmS).toFixed(1)} arcsec in front of the shell's centre: ${(SHELL.centreKmS * SHELL.arcsecPerKmS / mean[1]).toFixed(2)} arcsec a unit. On the sky it is ${(star[0] - origin[0]).toFixed(1)} arcsec east and ${(star[1] - origin[1]).toFixed(1)} north of the expansion centre; the marker, at ${MODEL_UNIT_ARCSEC} arcsec a unit, ${(MODEL_UNIT_ARCSEC * mean[0]).toFixed(1)} and ${(MODEL_UNIT_ARCSEC * mean[2]).toFixed(1)}.`);
  }
} finally { if (scratch) await rm(scratch, { recursive: true, force: true }); }
