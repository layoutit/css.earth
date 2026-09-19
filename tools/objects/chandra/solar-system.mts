#!/usr/bin/env node
/** Put a moving target's events in the object-centred frame, and check where the body lands.
 *
 *   node tools/objects/chandra/solar-system.mts <program id> <obsid> <work directory>
 *
 * A Chandra event list is in fixed sky coordinates, so a planet drifts across it during the observation. CIAO's `sso_freeze`
 * re-projects the events into the frame that moves with the body, from the ephemerides the archive itself ships under the
 * observation: the spacecraft orbit (`orbitf*_eph1`) and the body's own ephemeris (`<body>f*_eph1`), with the aspect solution.
 * Both are pinned inputs; nothing is fetched to make the frame.
 *
 * The check is then whether the body lands where it should and is the size it should be. The reference pixel of the frozen
 * list's sky grid is the body's centre, so:
 *   - JPL Horizons is asked for the body's apparent angular diameter as seen from Chandra itself (observer 500@-151) at the
 *     observation's midpoint, and the query and its answer go into the receipt;
 *   - the events are binned in radius about that reference pixel, a background surface brightness is measured in a wide annulus
 *     well outside the body, and the background-subtracted excess gives the source's centroid and how much of it falls inside
 *     the Horizons disc, inside 1.5 and inside 2 of its radii;
 *   - the same is measured on the fixed-sky list, which is the control: there the body is smeared over its own motion, so the
 *     excess inside one disc radius is smaller and the centroid is displaced.
 *
 * One receipt: programs/<program id>.<obsid>.solar-system.json. */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '../../../src/platform/sha256.mts';
import type { FitsHeader } from '../../fits.mts';
import { requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { toolchainPython } from '../jwst/mast.mts';
import { PROGRAMS, type ChandraFile } from './archive.mts';
import { column, eventTable, gunzipFile, type EventTable } from './events.mts';
import { chandraFiles } from './reprocess.mts';
import { chandraToolchain, chandraVersions, CHANDRA_ROOT } from './toolchain.mts';

export const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
/** Horizons' observer code for the Chandra X-ray Observatory: site 500 (body centre) of body -151. Verified live. */
export const CHANDRA_OBSERVER = '500@-151';
/** Horizons' body number for each moving target this route knows, by the name the archive puts in OBJECT. */
export const HORIZONS_BODIES: Readonly<Record<string, string>> = {
  MERCURY: '199', VENUS: '299', MARS: '499', JUPITER: '599', SATURN: '699', URANUS: '799', NEPTUNE: '899', PLUTO: '999',
  MOON: '301', TITAN: '606', IO: '501', EUROPA: '502', GANYMEDE: '503', CALLISTO: '504',
};
/** The archive's own ephemeris files: the spacecraft orbit, and the target's, which is named after the body. Solar, lunar and
 * aspect-angle ephemerides are neither. */
const ORBIT = /(?:^|\/)orbitf[0-9A-Za-z]*_eph1\.fits(?:\.gz)?$/u;
const SSO = /(?:^|\/)([a-z]+)f[0-9A-Za-z]*_eph1\.fits(?:\.gz)?$/u;
const NOT_SSO = new Set(['orbit', 'solar', 'lunar', 'angles']);
const ASOL = /_asol1\.fits(?:\.gz)?$/u;

const FREEZE = `
import json, os, subprocess, sys, time
os.dup2(os.open(os.devnull, os.O_RDONLY), 0)
infile, sc, sso, asol, outfile, ocsol = sys.argv[1:7]
from ciao_contrib.runtool import sso_freeze
start = time.time()
sso_freeze(infile=infile, scephemfile=sc, ssoephemfile=sso, asolfile=asol, outfile=outfile, ocsolfile=ocsol, clobber='yes', verbose=1)
print(json.dumps({'seconds': round(time.time() - start, 1)}))
`;

/** The sky grid of an event list, from the WCS the x and y columns carry (TCRPX, TCRVL, TCDLT of each column's own number). */
export interface SkyGrid { readonly xReference: number; readonly yReference: number; readonly degreesPerPixel: number; readonly xCentre: number; readonly yCentre: number }
export function skyGrid(table: EventTable, xName = 'x', yName = 'y'): SkyGrid {
  const number = (name: string) => {
    const index = table.columns.findIndex(entry => entry.name === name);
    if (index < 0) throw new Error(`The event list has no ${name} column.`);
    return index + 1;
  };
  const card = (header: FitsHeader, key: string) => requireFiniteNumber(header[key], key);
  const header = table.hdu.header, x = number(xName), y = number(yName);
  const scale = Math.abs(card(header, `TCDLT${x}`));
  if (!(scale > 0) || Math.abs(Math.abs(card(header, `TCDLT${y}`)) - scale) > 1e-12) throw new Error('The sky grid is not square.');
  return { xReference: card(header, `TCRVL${x}`), yReference: card(header, `TCRVL${y}`), degreesPerPixel: scale,
    xCentre: card(header, `TCRPX${x}`), yCentre: card(header, `TCRPX${y}`) };
}

/** Where the counts sit about the grid's reference pixel, once a flat background measured far outside the body is taken off.
 * `radii` are in units of the body's angular radius. */
export function radialProfile(xs: Float64Array, ys: Float64Array, grid: SkyGrid, bodyRadiusPixels: number, radii: readonly number[]) {
  const inner = 6 * bodyRadiusPixels, outer = 12 * bodyRadiusPixels;
  let background = 0, sumX = 0, sumY = 0, inOne = 0;
  const counts = radii.map(() => 0);
  for (let index = 0; index < xs.length; index++) {
    const dx = xs[index]! - grid.xCentre, dy = ys[index]! - grid.yCentre, distance = Math.hypot(dx, dy);
    if (distance >= inner && distance < outer) background++;
    for (const [which, radius] of radii.entries()) if (distance < radius * bodyRadiusPixels) counts[which]!++;
    if (distance < bodyRadiusPixels) { sumX += xs[index]!; sumY += ys[index]!; inOne++; }
  }
  const annulusArea = Math.PI * (outer * outer - inner * inner);
  const perPixel = annulusArea > 0 ? background / annulusArea : 0;
  const excess = radii.map((radius, which) => counts[which]! - perPixel * Math.PI * (radius * bodyRadiusPixels) ** 2);
  const arcsec = grid.degreesPerPixel * 3600;
  return {
    backgroundPerSquareArcsecond: perPixel / (arcsec * arcsec),
    // The centroid is of everything inside one body radius, so the background biases it towards the centre, not away from it.
    centroidOffsetArcseconds: inOne ? Math.hypot(sumX / inOne - grid.xCentre, sumY / inOne - grid.yCentre) * arcsec : null,
    enclosed: Object.fromEntries(radii.map((radius, which) => [`r${radius}`, { counts: counts[which]!, excess: +excess[which]!.toFixed(1) }])),
    excessShareWithinOneRadius: excess.at(-1)! > 0 ? excess[0]! / excess.at(-1)! : null,
  };
}

/** The body's apparent angular diameter, in arcseconds, as Horizons gives it for an observer at Chandra. The query is returned
 * with it, so a receipt states exactly what was asked. */
export async function horizonsAngularDiameter(body: string, startUtc: string, stopUtc: string) {
  const parameters = new URLSearchParams({ format: 'text', COMMAND: `'${body}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'OBSERVER', CENTER: `'${CHANDRA_OBSERVER}'`, START_TIME: `'${startUtc}'`, STOP_TIME: `'${stopUtc}'`,
    STEP_SIZE: '1', QUANTITIES: "'1,13'" });
  const url = `${HORIZONS}?${parameters}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`Horizons refused the query: ${response.status}`);
  const body_ = await response.text();
  const rows = body_.slice(body_.indexOf('$$SOE') + 5, body_.indexOf('$$EOE')).split('\n').map(line => line.trim()).filter(Boolean);
  if (!rows.length) throw new Error(`Horizons returned no ephemeris: ${body_.replace(/\s+/gu, ' ').slice(0, 300)}`);
  // Each row is: date, time, RA (h m s), Dec (d m s), angular diameter.
  const parsed = rows.map(row => {
    const parts = row.trim().split(/\s+/u);
    const diameter = Number(parts.at(-1));
    const [rh, rm, rs, dd, dm, ds] = parts.slice(-7, -1).map(Number);
    if (!Number.isFinite(diameter) || diameter <= 0 || [rh, rm, rs, dd, dm, ds].some(value => !Number.isFinite(value)))
      throw new Error(`Horizons row is not a position and diameter: ${row}`);
    const raDeg = (rh! + rm! / 60 + rs! / 3600) * 15;
    const decDeg = Math.sign(dd!) * (Math.abs(dd!) + dm! / 60 + ds! / 3600);
    return { diameter, raDeg, decDeg };
  });
  const diameters = parsed.map(entry => entry.diameter);
  // How far the body moves across the fixed sky between the first and last epoch asked for, as seen from Chandra.
  const first = parsed[0]!, last = parsed.at(-1)!;
  const motionArcseconds = Math.hypot((last.raDeg - first.raDeg) * Math.cos(first.decDeg * Math.PI / 180), last.decDeg - first.decDeg) * 3600;
  const centre = body_.match(/Center body name: ([^\n]*)/u)?.[1]?.trim();
  if (!centre?.includes('-151')) throw new Error(`Horizons resolved ${CHANDRA_OBSERVER} to ${centre ?? 'nothing'}, not Chandra.`);
  return { url, observer: CHANDRA_OBSERVER, centreBody: centre, rows: rows.length, motionArcseconds: +motionArcseconds.toFixed(2),
    startRaDeg: +first.raDeg.toFixed(6), startDecDeg: +first.decDeg.toFixed(6),
    angularDiameterArcseconds: diameters.reduce((total, value) => total + value, 0) / diameters.length,
    spreadArcseconds: Math.max(...diameters) - Math.min(...diameters) };
}

const RADII = [1, 1.5, 2] as const;

export async function freezeSolarSystem(id: string, obsid: number, work: string, options: { sources?: readonly string[] } = {}) {
  const { program, entry } = await chandraFiles(id, obsid, resolve(work, 'archive'), options.sources, 'inputs');
  const target = entry.targetName.trim().toUpperCase();
  const horizonsBody = HORIZONS_BODIES[target];
  if (!horizonsBody) throw new Error(`${target} is not a moving target this route knows: ${Object.keys(HORIZONS_BODIES).join(', ')}.`);
  const find = (match: (file: ChandraFile) => boolean, what: string) => {
    const found = entry.inputs.filter(match);
    if (found.length !== 1) throw new Error(`${obsid}: the pinned inputs hold ${found.length} ${what}, not one.`);
    return resolve(work, 'archive', found[0]!.path);
  };
  const orbit = find(file => ORBIT.test(file.path), 'spacecraft orbit ephemeris');
  const sso = find(file => { const match = SSO.exec(file.path); return !!match && !NOT_SSO.has(match[1]!); }, `${target} ephemeris`);
  const asol = find(file => ASOL.test(file.path), 'aspect solution');
  // The re-run's own level-2 event list. For a moving target chandra_repro already runs sso_freeze, so this file carries the
  // object-centred columns ocx and ocy beside the fixed-sky x and y; that is the frame this check measures.
  const { readdir } = await import('node:fs/promises');
  const repro = resolve(work, 'repro');
  const written = (await readdir(repro)).filter(name => /_evt2\.fits$/u.test(name));
  if (written.length !== 1) throw new Error(`${repro} holds ${written.length} level-2 event lists; run reprocess.mts first.`);
  const eventFile = resolve(repro, written[0]!);
  const toolchain = await chandraToolchain(), versions = await chandraVersions();
  for (const directory of ['param', 'work', 'ipython']) await mkdir(resolve(CHANDRA_ROOT, directory), { recursive: true });

  const read = async (path: string) => {
    const expanded = await gunzipFile(path), bytes = await readFile(expanded.path);
    const table = eventTable(bytes);
    return { path: expanded.path, table, bytes };
  };
  const ours = await read(eventFile);
  if (!ours.table.columns.some(entry => entry.name === 'ocx')) throw new Error(`${written[0]!} carries no object-centred columns; the ephemerides did not reach chandra_repro.`);
  const start = requireString(ours.table.hdu.header['DATE-OBS'], 'DATE-OBS'), stop = requireString(ours.table.hdu.header['DATE-END'], 'DATE-END');
  const horizons = await horizonsAngularDiameter(horizonsBody, start.replace('T', ' ').slice(0, 16), stop.replace('T', ' ').slice(0, 16));
  const objectGrid = skyGrid(ours.table, 'ocx', 'ocy');
  const bodyRadiusPixels = horizons.angularDiameterArcseconds / 2 / (objectGrid.degreesPerPixel * 3600);
  const measure = (side: { bytes: Buffer; table: EventTable }, xName: string, yName: string) =>
    radialProfile(column(side.bytes, side.table, xName), column(side.bytes, side.table, yName), skyGrid(side.table, xName, yName), bodyRadiusPixels, RADII);

  // The archive's own level-2 list carries no object-centred columns, so running sso_freeze on it here is an independent path to
  // the same frame: the CIAO tool, the archive's product, the archive's ephemerides.
  const archiveLevel2 = entry.products.find((file: ChandraFile) => /_evt2\.fits(?:\.gz)?$/u.test(file.path));
  if (!archiveLevel2) throw new Error(`${obsid}: the program pins no archive level-2 event list.`);
  const archiveExpanded = await gunzipFile(resolve(work, 'archive', archiveLevel2.path));
  const frozen = resolve(work, `${obsid}_frozen_evt2.fits`), frozenAsol = resolve(work, `${obsid}_frozen_asol1.fits`);
  await rm(frozen, { force: true });
  await rm(frozenAsol, { force: true });
  const result = await toolchainPython(toolchain, work, FREEZE, [archiveExpanded.path, orbit, sso, asol, frozen, frozenAsol], resolve(work, `${obsid}.sso.log`));
  const seconds = requireFiniteNumber(requireRecord(JSON.parse(result.lastLine), 'sso_freeze result').seconds, 'seconds');
  const independent = await read(frozen);

  const receipt = {
    schema: 'cssearth-chandra-solar-system@1', program: id, obsid, target: entry.targetName,
    instrument: `${entry.instrument}/${entry.detector}`, toolchain: 'tools/objects/chandra/toolchain.json',
    reprocessedWith: { ciao: versions.ciao, caldb: versions.caldb }, ssoFreezeSeconds: seconds,
    ephemerides: { spacecraft: orbit.slice(orbit.indexOf('archive/') + 8), body: sso.slice(sso.indexOf('archive/') + 8), aspect: asol.slice(asol.indexOf('archive/') + 8) },
    observation: { start, stop, events: ours.table.rows },
    horizons: { ...horizons, angularRadiusSkyPixels: +bodyRadiusPixels.toFixed(3), skyPixelArcseconds: +(objectGrid.degreesPerPixel * 3600).toFixed(4) },
    // The body's centre is the reference pixel of the object-centred grid, so an offset here is the body missing that centre.
    objectCentred: { file: written[0]!, columns: ['ocx', 'ocy'], by: 'chandra_repro', sha256: (await sha256File(ours.path)).sha256, ...measure(ours, 'ocx', 'ocy') },
    objectCentredFromArchive: { file: frozen.slice(frozen.lastIndexOf('/') + 1), columns: ['ocx', 'ocy'], by: 'sso_freeze on the archive\'s level-2 list',
      sha256: (await sha256File(independent.path)).sha256, ...measure(independent, 'ocx', 'ocy') },
    // The control: in fixed sky coordinates the body drifts across the field during the observation.
    fixedSky: { file: written[0]!, columns: ['x', 'y'], ...measure(ours, 'x', 'y') },
  };
  const path = resolve(PROGRAMS, `${id}.${obsid}.solar-system.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return { path, receipt, program };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, obsid, work] = args;
  if (!id || !obsid || !/^\d+$/u.test(obsid) || !work) throw new TypeError('Usage: solar-system <program id> <obsid> <work> [--raw <dir>]...');
  const sources = args.flatMap((arg, index) => arg === '--raw' ? [resolve(args[index + 1]!)] : []);
  const { path, receipt } = await freezeSolarSystem(id, Number(obsid), resolve(work), { sources });
  console.log(`SOLAR_SYSTEM ${path} ${JSON.stringify({ diameterArcsec: receipt.horizons.angularDiameterArcseconds, objectCentred: receipt.objectCentred, fixedSky: receipt.fixedSky })}`);
}
