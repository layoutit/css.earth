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
 * sso_freeze here is a producing stage like any other: beside the object-centred list it writes, it records the archive product
 * and the three ephemeris files that made it at their pinned digests, and the CIAO and CALDB that ran. The receipt then states
 * each list's environment from the record beside that list, never from the software installed on the machine writing the
 * receipt, and refuses when a list has no record. What the Horizons check establishes goes back on both records as geometric
 * registration.
 *
 * One receipt: programs/<program id>.<obsid>.solar-system.json. */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addProductEvidence, readProductRecord, writeProductRecord } from '@cssearth/telescope/node';
import { productRecordPath, type ProductEvidence, type ProductInput, type ProductRun } from '@cssearth/telescope';
import { astroqueryRows } from '@cssearth/telescope/node';
import type { FitsHeader } from '@cssearth/fits';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { toolchainPython } from '../jwst/mast.mts';
import { PROGRAMS, type ChandraFile, type ChandraObservation } from './archive.mts';
import { reprocessedWith } from './compare.mts';
import { column, eventTable, gunzipFile, type EventTable } from './events.mts';
import { chandraFiles, chandraToolchainDigest } from './reprocess.mts';
import { chandraToolchain, chandraVersions, CHANDRA_ROOT } from './toolchain.mts';

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

/** The body's apparent angular diameter, in arcseconds, from Astroquery's typed Horizons table for an observer at Chandra. */
export async function horizonsAngularDiameter(body: string, startUtc: string, stopUtc: string) {
  const rows = await astroqueryRows({ operation: 'horizons-ephemerides', id: body, location: CHANDRA_OBSERVER,
    epochs: { start: startUtc, stop: stopUtc, step: '1m' }, quantities: '1,13' });
  const parsed = rows.map(row => ({ diameter: Number(row.ang_width), raDeg: Number(row.RA), decDeg: Number(row.DEC) }));
  if (!parsed.length || parsed.some(row => !Number.isFinite(row.diameter) || row.diameter <= 0 || !Number.isFinite(row.raDeg) || !Number.isFinite(row.decDeg)))
    throw new Error('Horizons returned no usable position and angular diameter.');
  const diameters = parsed.map(entry => entry.diameter);
  const first = parsed[0]!, last = parsed.at(-1)!;
  const motionArcseconds = Math.hypot((last.raDeg - first.raDeg) * Math.cos(first.decDeg * Math.PI / 180), last.decDeg - first.decDeg) * 3600;
  return { provider: 'JPL Horizons through Astroquery', observer: CHANDRA_OBSERVER, centreBody: 'Chandra (-151)', rows: rows.length,
    motionArcseconds: +motionArcseconds.toFixed(2), startRaDeg: +first.raDeg.toFixed(6), startDecDeg: +first.decDeg.toFixed(6),
    angularDiameterArcseconds: diameters.reduce((total, value) => total + value, 0) / diameters.length,
    spreadArcseconds: Math.max(...diameters) - Math.min(...diameters) };
}

const RADII = [1, 1.5, 2] as const;

/** What the object-centred list is, in the terms its own header states. */
const FROZEN_CONVENTIONS: Readonly<Record<string, string>> = {
  frame: 'ocx and ocy are sky pixels in the frame that moves with the body; its reference pixel is the body centre',
  ephemerides: 'the archive\'s own spacecraft orbit and body ephemerides, with the aspect solution, all pinned inputs',
  rows: 'one row per event of the archive\'s level-2 list, re-projected and not refiltered',
};

/** The run that re-projects the archive's own level-2 list into the frame that moves with the body: that list and the three
 * files the frame is built from at their pinned digests, and the CIAO and CALDB that ran sso_freeze. */
export function freezeRun(entry: ChandraObservation, files: { readonly archive: ChandraFile; readonly orbit: ChandraFile; readonly body: ChandraFile; readonly aspect: ChandraFile },
  options: { readonly versions: { ciao: string; caldb: string }; readonly toolchainDigest: string }): ProductRun {
  const pin = (role: string, file: ChandraFile): ProductInput => {
    return { role, identity: file.url, bytes: file.bytes };
  };
  return { telescope: 'Chandra', stage: `sso-freeze/${entry.obsid}-${entry.instrument}`,
    inputs: [pin('archive level-2 event list', files.archive), pin('spacecraft orbit ephemeris', files.orbit), pin('body ephemeris', files.body), pin('aspect solution', files.aspect)],
    parameters: { ...FREEZE_PARAMETERS, target: entry.targetName }, software: [{ name: 'ciao', version: options.versions.ciao }, { name: 'caldb', version: options.versions.caldb }],
    toolchainDigest: options.toolchainDigest };
}

/** What binning the events about the body's Horizons disc establishes, for the record of the run that made the list measured. */
export const discRegistration = (product: string, receipt: string, diameterArcseconds: number): ProductEvidence => ({ kind: 'geometric-registration', product, receipt,
  establishes: `The events of ${product} were binned about the reference pixel of its object-centred grid and compared with the ` +
    `${diameterArcseconds.toFixed(2)} arcsecond disc JPL Horizons gives the body for an observer at Chandra itself. That establishes where the body ` +
    'lands in the moving frame and how far the source is spread across it; it establishes nothing about the events being calibrated, and nothing ' +
    'about any list this run did not make.' });

/** What sso_freeze is told beyond its files. The ephemerides decide the frame and are recorded as inputs, not as parameters. */
export const FREEZE_PARAMETERS: Readonly<Record<string, string | number>> = { clobber: 'yes', verbose: 1 };

export async function freezeSolarSystem(id: string, obsid: number, work: string, options: { sources?: readonly string[] } = {}) {
  const { program, entry } = await chandraFiles(id, obsid, resolve(work, 'archive'), options.sources, 'inputs');
  const target = entry.targetName.trim().toUpperCase();
  const horizonsBody = HORIZONS_BODIES[target];
  if (!horizonsBody) throw new Error(`${target} is not a moving target this route knows: ${Object.keys(HORIZONS_BODIES).join(', ')}.`);
  const find = (match: (file: ChandraFile) => boolean, what: string) => {
    const found = entry.inputs.filter(match);
    if (found.length !== 1) throw new Error(`${obsid}: the pinned inputs hold ${found.length} ${what}, not one.`);
    return found[0]!;
  };
  const pinnedOrbit = find(file => ORBIT.test(file.path), 'spacecraft orbit ephemeris');
  const pinnedBody = find(file => { const match = SSO.exec(file.path); return !!match && !NOT_SSO.has(match[1]!); }, `${target} ephemeris`);
  const pinnedAspect = find(file => ASOL.test(file.path), 'aspect solution');
  const [orbit, sso, asol] = [pinnedOrbit, pinnedBody, pinnedAspect].map(file => resolve(work, 'archive', file.path));
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
  // This run made the object-centred list, so it records what made it, with the CIAO and CALDB that ran here and now.
  const freezeRecord = productRecordPath(frozen);
  await writeProductRecord(freezeRecord, freezeRun(entry, { archive: archiveLevel2, orbit: pinnedOrbit, body: pinnedBody, aspect: pinnedAspect },
    { versions, toolchainDigest: await chandraToolchainDigest() }),
    [{ path: basename(frozen), file: frozen, conventions: FROZEN_CONVENTIONS }, { path: basename(frozenAsol), file: frozenAsol }]);
  // Each list's environment comes from the record beside that list: the chandra_repro list was made by another run, possibly
  // years ago on another machine, and a list with no record is not measured rather than being given this machine's versions.
  const reproRecord = productRecordPath(eventFile);
  const made = reprocessedWith(await readProductRecord(reproRecord), written[0]!, reproRecord);
  const froze = reprocessedWith(await readProductRecord(freezeRecord), basename(frozen), freezeRecord);

  const receipt = {
    schema: 'cssearth-chandra-solar-system@2', program: id, obsid, target: entry.targetName,
    instrument: `${entry.instrument}/${entry.detector}`, toolchain: 'tools/objects/chandra/toolchain.json',
    // Two runs, two environments: the one that reprocessed the level-2 list, and the one that froze the archive's list here.
    reprocessedWith: { ciao: made.ciao, caldb: made.caldb }, frozenWith: { ciao: froze.ciao, caldb: froze.caldb },
    productRecords: { objectCentred: relative(work, reproRecord), objectCentredFromArchive: relative(work, freezeRecord) },
    ssoFreezeSeconds: seconds,
    ephemerides: { spacecraft: orbit.slice(orbit.indexOf('archive/') + 8), body: sso.slice(sso.indexOf('archive/') + 8), aspect: asol.slice(asol.indexOf('archive/') + 8) },
    observation: { start, stop, events: ours.table.rows },
    horizons: { ...horizons, angularRadiusSkyPixels: +bodyRadiusPixels.toFixed(3), skyPixelArcseconds: +(objectGrid.degreesPerPixel * 3600).toFixed(4) },
    // The body's centre is the reference pixel of the object-centred grid, so an offset here is the body missing that centre.
    objectCentred: { file: written[0]!, columns: ['ocx', 'ocy'], by: 'chandra_repro', ...measure(ours, 'ocx', 'ocy') },
    objectCentredFromArchive: { file: frozen.slice(frozen.lastIndexOf('/') + 1), columns: ['ocx', 'ocy'], by: 'sso_freeze on the archive\'s level-2 list',
      ...measure(independent, 'ocx', 'ocy') },
    // The control: in fixed sky coordinates the body drifts across the field during the observation.
    fixedSky: { file: written[0]!, columns: ['x', 'y'], ...measure(ours, 'x', 'y') },
  };
  const path = resolve(PROGRAMS, `${id}.${obsid}.solar-system.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
  // Where the body landed is added to the record of each run whose list was measured, naming that list and this receipt.
  const receiptPath = relative(resolve(import.meta.dirname, '../../..'), path);
  await addProductEvidence(reproRecord, [discRegistration(written[0]!, receiptPath, horizons.angularDiameterArcseconds)], recorded => resolve(repro, recorded));
  await addProductEvidence(freezeRecord, [discRegistration(basename(frozen), receiptPath, horizons.angularDiameterArcseconds)], recorded => resolve(work, recorded));
  return { path, receipt, program };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, obsid, work] = args;
  if (!id || !obsid || !/^\d+$/u.test(obsid) || !work) throw new TypeError('Usage: solar-system <program id> <obsid> <work> [--raw <dir>]...');
  const sources = args.flatMap((arg, index) => arg === '--raw' ? [resolve(args[index + 1]!)] : []);
  const { path, receipt } = await freezeSolarSystem(id, Number(obsid), resolve(work), { sources });
  console.log(`SOLAR_SYSTEM ${path} ${JSON.stringify({ diameterArcsec: receipt.horizons.angularDiameterArcseconds, objectCentred: receipt.objectCentred, fixedSky: receipt.fixedSky })}`);
}
