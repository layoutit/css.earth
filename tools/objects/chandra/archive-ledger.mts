#!/usr/bin/env node
/** What the Chandra Data Archive holds, what it holds for this project's objects, and how far this toolkit has been proved.
 *
 *   node tools/objects/chandra/archive-ledger.mts        # rewrite data/chandra/ledger.json and docs/chandra-ledger.md
 *
 * Three parts, none of them declared by hand:
 *   - the archive's own counts, by instrument, grating and exposure mode, from server-side COUNT(*) over cxc.observation;
 *   - the shipped objects Chandra observed: a moving target by the names the archive gives it, a fixed one by a box around its
 *     catalogued sky position. The object list and its positions are read from the repository, not written here;
 *   - each instrument and mode's state, derived from the pinned programs and the receipts beside them. A mode is `reproduced`
 *     when a receipt exists for it, `pinned` when a program pins it and no receipt does, and `refused` when archive.mts will
 *     not pin it.
 *
 * A pointing whose target name marks it as background, blank sky, an offset or a calibration field is never counted as an
 * observation of an object, however close to one it lands. */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { cxcQuery, parseChandraProgram, PROGRAMS, REFUSED_MODES, type ChandraObservation } from './archive.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const LEDGER = resolve(repository, 'data/chandra/ledger.json');
export const GUIDE = resolve(repository, 'docs/chandra-ledger.md');
const OBJECTS = resolve(repository, 'src/objects');
const BODIES = resolve(repository, 'packages/astronomy/data/bodies');

/** A pointing named like this is a background, blank-sky, offset or dark field: never an observation of the object nearest it. */
export const NOT_AN_OBJECT = /BLANKSKY|BLANK_SKY|BACKGROUND|BKG|OFFSET|DARK|STOWED|FIELD\b|CALIBRATION/u;
/** How far from a catalogued position a pointing still counts as an observation of that object. Chandra's fields are 16.9' for
 * ACIS-I and 30' for HRC-I, so a quarter of a degree keeps pointings that put the object well inside the field and drops the
 * ones that merely share its part of the sky. */
export const OBJECT_RADIUS_DEGREES = 0.25;

/** A shipped object the ledger searches for. A moving target has no fixed position and is found by the names the archive gives
 * it; everything else is found by a box about the position this repository states. */
export interface ShippedObject { readonly id: string; readonly raDeg?: number; readonly decDeg?: number; readonly source: string }
/** The archive's own names for a shipped Solar System body, which is caught by name and never by position. */
export const MOVING_TARGETS: Readonly<Record<string, readonly string[]>> = {
  venus: ['VENUS'], mars: ['MARS'], jupiter: ['JUPITER'], saturn: ['SATURN'], uranus: ['URANUS'], pluto: ['PLUTO', 'PLUTO(134340)'],
  titan: ['TITAN'], moon: ['MOON'], earth: ['EARTH'],
  'comet-2p': ['COMET2P/ENCKE'], 'comet-8p': ['COMET8P/TUTTLE'], 'comet-9p': ['COMET9P/TEMPEL1'],
  'comet-17p': ['COMET17P/HOLMES'], 'comet-46p': ['46P/WIRTANEN'], 'comet-103p': ['COMET103P/HARTLEY2'],
  'comet-2i': ['C/2019Q4BORISOV'], 'comet-c2013-a1': ['COMETC/2013A1SIDINGSPRING'],
};

/** Every shipped object that states a sky position, from the files that own it: a nebula catalogue beside the object, the
 * prepared Local Group catalogue, or the body record's own star position. Nothing is listed here that the repository does not
 * state. */
export async function shippedSkyObjects(): Promise<ShippedObject[]> {
  const ids = new Set((await readdir(OBJECTS, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name));
  const found = new Map<string, ShippedObject>();
  const add = (id: string, raDeg: unknown, decDeg: unknown, source: string) => {
    if (!ids.has(id) || found.has(id)) return;
    found.set(id, { id, raDeg: requireFiniteNumber(raDeg, `${id} right ascension`), decDeg: requireFiniteNumber(decDeg, `${id} declination`), source });
  };
  const walk = (value: unknown, source: string) => {
    if (Array.isArray(value)) { for (const entry of value) walk(entry, source); return; }
    if (value === null || typeof value !== 'object') return;
    const entry = value as Record<string, unknown>;
    const sky = entry.skyPosition;
    if (sky && typeof sky === 'object' && 'raDeg' in (sky as Record<string, unknown>)) {
      const id = typeof entry.detailedObjectId === 'string' ? entry.detailedObjectId : typeof entry.id === 'string' ? entry.id : '';
      if (id) add(id, (sky as Record<string, unknown>).raDeg, (sky as Record<string, unknown>).decDeg, source);
    }
    for (const nested of Object.values(entry)) walk(nested, source);
  };
  for (const id of [...ids].sort()) {
    for (const relative of [`${id}/source/nebula.json`, `${id}/prepared/catalogue.json`]) {
      const text = await readFile(resolve(OBJECTS, relative), 'utf8').catch(() => null);
      if (text) walk(JSON.parse(text) as unknown, `src/objects/${relative}`);
    }
  }
  for (const file of (await readdir(BODIES)).filter(name => name.endsWith('.json')).sort()) {
    const id = file.slice(0, -'.json'.length);
    if (!ids.has(id) || found.has(id)) continue;
    const body = requireRecord(JSON.parse(await readFile(resolve(BODIES, file), 'utf8')) as unknown, file);
    const star = body.star;
    if (star && typeof star === 'object' && typeof (star as Record<string, unknown>).rightAscensionDegrees === 'number')
      add(id, (star as Record<string, unknown>).rightAscensionDegrees, (star as Record<string, unknown>).declinationDegrees, `packages/astronomy/data/bodies/${file}`);
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** The ADQL a fixed object's search is: a box of `OBJECT_RADIUS_DEGREES` about its position, widened in right ascension by the
 * declination, so the box is that radius on the sky and not that many degrees of right ascension. */
export function objectBox(object: ShippedObject, radiusDegrees = OBJECT_RADIUS_DEGREES) {
  const raDeg = requireFiniteNumber(object.raDeg, `${object.id} right ascension`), decDeg = requireFiniteNumber(object.decDeg, `${object.id} declination`);
  const widen = radiusDegrees / Math.max(0.05, Math.cos(decDeg * Math.PI / 180));
  return { raLow: raDeg - widen, raHigh: raDeg + widen, decLow: decDeg - radiusDegrees, decHigh: decDeg + radiusDegrees };
}

/** Every shipped object the ledger searches for: the moving targets this module names, then everything with a stated position. */
export async function shippedObjects(): Promise<ShippedObject[]> {
  const ids = new Set((await readdir(OBJECTS, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name));
  const moving = Object.keys(MOVING_TARGETS).filter(id => ids.has(id))
    .map(id => ({ id, source: 'tools/objects/chandra/archive-ledger.mts (MOVING_TARGETS)' }));
  const fixed = (await shippedSkyObjects()).filter(object => !MOVING_TARGETS[object.id]);
  return [...moving, ...fixed].sort((a, b) => a.id.localeCompare(b.id));
}

export interface ArchiveRow { readonly obsid: number; readonly targetName: string; readonly instrument: string; readonly grating: string; readonly exposureKs: number; readonly startDate: string }
const row = (entry: Record<string, string>): ArchiveRow => ({
  obsid: Number(requireString(entry.obsid, 'obsid')), targetName: requireString(entry.target_name, 'target name'),
  instrument: requireString(entry.instrument, 'instrument'), grating: requireString(entry.grating, 'grating'),
  exposureKs: +(Number(requireString(entry.exposure_time, 'exposure')) ).toFixed(3), startDate: requireString(entry.start_date, 'start date'),
});

/** A pointing counts for an object only if its name does not mark it as a background, blank-sky or calibration field. Applied to
 * fixed objects; a moving target is matched on its name to begin with, so nothing to exclude can reach it. */
export const isObjectPointing = (targetName: string) => !NOT_AN_OBJECT.test(targetName.toUpperCase().replace(/[\s_-]/gu, ''));

const escape = (value: string) => { if (/['\\;]/u.test(value)) throw new TypeError(`Unsafe ADQL literal: ${value}`); return value; };

/** Archived observations of one shipped object: by name when it moves, by a box about its position when it does not. */
export async function observationsOf(object: ShippedObject): Promise<ArchiveRow[]> {
  const columns = 'obsid, target_name, instrument, grating, exposure_time, start_date';
  const names = MOVING_TARGETS[object.id];
  if (names) {
    const clause = names.map(name => `target_name='${escape(name)}'`).join(' OR ');
    const rows = await cxcQuery(`SELECT ${columns} FROM cxc.observation WHERE (${clause}) AND status='archived'`);
    return rows.map(row).sort((a, b) => b.exposureKs - a.exposureKs);
  }
  const box = objectBox(object);
  const rows = await cxcQuery(`SELECT ${columns} FROM cxc.observation WHERE ra BETWEEN ${box.raLow.toFixed(6)} AND ${box.raHigh.toFixed(6)}` +
    ` AND dec BETWEEN ${box.decLow.toFixed(6)} AND ${box.decHigh.toFixed(6)} AND status='archived'`);
  return rows.map(row).filter(entry => isObjectPointing(entry.targetName)).sort((a, b) => b.exposureKs - a.exposureKs);
}

/** Every pinned program and every receipt beside it. */
export async function pinnedState() {
  const files = (await readdir(PROGRAMS)).sort();
  const programs: { id: string; observations: readonly ChandraObservation[] }[] = [];
  for (const file of files.filter(name => name.endsWith('.json') && !name.includes('.'.concat('reproduction')) && !name.includes('.solar-system') && name.split('.').length === 2)) {
    const program = parseChandraProgram(JSON.parse(await readFile(resolve(PROGRAMS, file), 'utf8')));
    programs.push({ id: program.id, observations: program.observations });
  }
  const reproductions = files.filter(name => name.endsWith('.reproduction.json'));
  const solarSystem = files.filter(name => name.endsWith('.solar-system.json'));
  return { programs, reproductions, solarSystem };
}

/** The key a mode is reported under: the detector, its grating and its data mode. */
export const modeKey = (entry: { instrument: string; detector: string; grating: string; readMode?: string; dataMode: string }) =>
  `${entry.detector} ${entry.grating === 'NONE' ? 'no grating' : entry.grating} ${[entry.readMode, entry.dataMode].filter(Boolean).join('/')}`;

export async function buildLedger() {
  const counts = async (column: string) => {
    const rows = await cxcQuery(`SELECT ${column}, COUNT(*) AS n FROM cxc.observation WHERE status='archived' GROUP BY ${column}`);
    return Object.fromEntries(rows.map(entry => [requireString(entry[column] ?? '', column) || '(none)', Number(requireString(entry.n, 'count'))])
      .sort((a, b) => Number(b[1]) - Number(a[1])));
  };
  const [total] = await cxcQuery("SELECT COUNT(*) AS n FROM cxc.observation WHERE status='archived'");
  const archive = {
    archivedObservations: Number(requireString(total?.n ?? '', 'count')),
    byInstrument: await counts('instrument'), byGrating: await counts('grating'), byExposureMode: await counts('exposure_mode'),
  };
  const objects = await shippedObjects();
  const observed: Record<string, unknown> = {};
  for (const object of objects) {
    const rows = await observationsOf(object);
    if (!rows.length) continue;
    observed[object.id] = { matchedBy: MOVING_TARGETS[object.id] ? 'target name' : 'sky position',
      ...(MOVING_TARGETS[object.id] ? { archiveNames: MOVING_TARGETS[object.id] } : { position: { raDeg: object.raDeg, decDeg: object.decDeg } }), source: object.source,
      observations: rows.length, totalExposureKs: +rows.reduce((sum, entry) => sum + entry.exposureKs, 0).toFixed(1),
      longest: rows.slice(0, 3).map(entry => ({ obsid: entry.obsid, target: entry.targetName, instrument: entry.instrument, grating: entry.grating, exposureKs: entry.exposureKs, startDate: entry.startDate })) };
  }
  const { programs, reproductions, solarSystem } = await pinnedState();
  const modes: Record<string, unknown> = {};
  for (const program of programs) for (const entry of program.observations) {
    const key = modeKey(entry);
    const reproduced = reproductions.some(name => name.startsWith(`${program.id}.`));
    const frozen = solarSystem.some(name => name === `${program.id}.${entry.obsid}.solar-system.json`);
    modes[key] = { state: reproduced ? 'reproduced' : 'pinned', program: program.id, obsid: entry.obsid, target: entry.targetName,
      livetimeSeconds: +entry.livetimeSeconds.toFixed(1), ...(frozen ? { objectCentredFrame: 'checked against JPL Horizons' } : {}) };
  }
  for (const [key, why] of Object.entries(REFUSED_MODES)) if (!modes[key]) modes[key] = { state: 'refused', why };
  return { schema: 'cssearth-chandra-ledger@1', measured: new Date().toISOString().slice(0, 10), archive, shippedObjects: observed, modes };
}

function guide(ledger: Awaited<ReturnType<typeof buildLedger>>) {
  const objects = Object.entries(ledger.shippedObjects) as [string, { observations: number; totalExposureKs: number; matchedBy: string; longest: { obsid: number; instrument: string; grating: string; exposureKs: number; startDate: string }[] }][];
  objects.sort((a, b) => b[1].observations - a[1].observations);
  const modes = Object.entries(ledger.modes) as [string, { state: string; program?: string; obsid?: number; target?: string; why?: string }][];
  return `# Chandra archive ledger

Generated by \`node tools/objects/chandra/archive-ledger.mts\` from [data/chandra/ledger.json](../data/chandra/ledger.json); do not edit by hand. Counts come from the Chandra Data Archive's own TAP service, the object list from this repository, and every mode's state from the pinned programs and their receipts. Measured ${ledger.measured}. The route itself is described in [Chandra](chandra.md).

## The archive

${ledger.archive.archivedObservations.toLocaleString('en')} archived (public) observations.

| Instrument | Observations | | Grating | Observations | | Exposure mode | Observations |
| --- | ---: | --- | --- | ---: | --- | --- | ---: |
${(() => {
  const rows = (entries: Record<string, number>) => Object.entries(entries);
  const a = rows(ledger.archive.byInstrument), b = rows(ledger.archive.byGrating), c = rows(ledger.archive.byExposureMode);
  const height = Math.max(a.length, b.length, c.length);
  const cell = (pair: [string, number] | undefined) => pair ? `${pair[0]} | ${pair[1].toLocaleString('en')}` : ' | ';
  return Array.from({ length: height }, (_, index) => `| ${cell(a[index])} | | ${cell(b[index])} | | ${cell(c[index])} |`).join('\n');
})()}

## Shipped objects Chandra observed

${objects.length} of this project's objects have archived Chandra observations. A Solar System body is matched on the names the archive gives it; everything else on a ${OBJECT_RADIUS_DEGREES}° box about the position this repository states for it, with background, blank-sky, offset and calibration fields excluded by name.

| Object | Matched by | Observations | Total exposure (ks) | Longest |
| --- | --- | ---: | ---: | --- |
${objects.map(([id, entry]) => `| ${id} | ${entry.matchedBy} | ${entry.observations} | ${entry.totalExposureKs.toLocaleString('en')} | ${entry.longest[0] ? `${entry.longest[0].obsid} ${entry.longest[0].instrument}${entry.longest[0].grating === 'NONE' ? '' : `/${entry.longest[0].grating}`} ${entry.longest[0].exposureKs} ks ${entry.longest[0].startDate.slice(0, 10)}` : ''} |`).join('\n')}

## What this toolkit has been proved on

| Detector, grating and mode | State | Evidence |
| --- | --- | --- |
${modes.map(([key, entry]) => `| ${key} | ${entry.state} | ${entry.state === 'refused' ? entry.why ?? '' : `${entry.program} obsid ${entry.obsid} (${entry.target})`} |`).join('\n')}
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ledger = await buildLedger();
  await mkdir(resolve(LEDGER, '..'), { recursive: true });
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(GUIDE, guide(ledger));
  console.log(`LEDGER ${LEDGER} ${Object.keys(ledger.shippedObjects).length} objects, ${Object.keys(ledger.modes).length} modes`);
}

export { guide as ledgerGuide };
