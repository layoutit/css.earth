import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { objectValue, stringValue, numberValue, readElementRecord, readVectorFixture, readStarRecord, readHostedOrbitRecord } from './lib/generator-records.mts';
import { shape, optional, boolean } from './lib/source-validation.mts';

const nullableString = (value: unknown) => value === null ? null : stringValue(value);
const nullableNumber = (value: unknown) => value === null ? null : numberValue(value);
const parseRecord = shape({
  id: stringValue, classification: stringValue, order: optional(numberValue), classificationOrder: optional(numberValue),
  physical: shape({ name: stringValue, horizonsCode: nullableString, meanRadiusKm: numberValue,
    gravitationalParameterKm3PerS2: numberValue, parent: nullableString, effectiveTemperatureK: optional(numberValue) }),
  asteroid: optional(readElementRecord), comet: optional(readElementRecord), star: optional(readStarRecord), hostedOrbit: optional(readHostedOrbitRecord),
  asteroidFixture: optional(readVectorFixture), cometFixture: optional(readVectorFixture),
  acquisition: optional(shape({
    heliocentric: optional(shape({ target: stringValue, model: stringValue })),
    satellite: optional(shape({ target: stringValue, center: stringValue, parent: stringValue,
      fromJd: numberValue, toJd: numberValue, stepDays: numberValue, barycentreCompanion: optional(stringValue),
      radial: boolean, libration: boolean, positionCorrection: boolean,
      positionCorrectionOptions: optional(shape({ count: numberValue, method: stringValue })) })),
    fixture: optional(shape({ target: stringValue, center: stringValue, range: optional(stringValue) })),
    sceneSatellite: optional(shape({ parent: stringValue, target: nullableNumber, center: nullableNumber })),
  })),
});
export type BodyRecord = ReturnType<typeof parseRecord> & Record<string, unknown>;

function bodyRecord(value: unknown): BodyRecord {
  const raw = objectValue(value);
  let parsed: ReturnType<typeof parseRecord>;
  // A refused field names the record it belongs to.
  try { parsed = parseRecord(value); } catch (error) { throw new TypeError(`Astronomy record ${String(raw.id)}: ${error instanceof Error ? error.message : String(error)}`); }
  const record = { ...raw, ...parsed };
  if (!/^[a-z][a-z0-9-]*$/.test(record.id)) throw new TypeError('Invalid astronomy identity.');
  if (![...Object.keys(kinds), 'star', 'satellite'].includes(record.classification)) throw new TypeError(`Invalid astronomy classification: ${record.id}.`);
  for (const value of [record.order, record.classificationOrder]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new TypeError(`Invalid astronomy order: ${record.id}.`);
  }
  const physical = record.physical;
  if (!physical.name || physical.meanRadiusKm < 0 || physical.gravitationalParameterKm3PerS2 < 0) throw new TypeError(`Invalid physical data: ${record.id}.`);
  if (physical.effectiveTemperatureK !== undefined && (record.classification !== 'star' || !(physical.effectiveTemperatureK > 0))) {
    throw new TypeError(`A measured effective temperature belongs to a star and is positive: ${record.id} has ${physical.effectiveTemperatureK}.`);
  }
  // Zero radius means no source measures one; only a star known from its hosted orbit alone may lack it (most S-stars).
  if (physical.meanRadiusKm === 0 && (record.classification !== 'star' || record.hostedOrbit === undefined)) {
    throw new TypeError(`Only a hosted star may have an unmeasured radius: ${record.id} has meanRadiusKm 0.`);
  }
  // A star or black hole beyond the Solar System is placed by its astrometry and orbits nothing this package models.
  if (record.star !== undefined && (!['star', 'black-hole'].includes(record.classification) || physical.parent !== null)) {
    throw new TypeError(`Placement astrometry belongs to a parentless star or black hole: ${record.id}.`);
  }
  // A hosted orbit is placed around its parent: every exoplanet has one, and a star may have one instead of its own placement
  // (the S-stars around Sgr A*). The parent must be placed; readBodyRecords checks that.
  if (record.classification === 'exoplanet' && record.hostedOrbit === undefined || record.hostedOrbit !== undefined &&
    (!['exoplanet', 'star'].includes(record.classification) || physical.parent === null || record.star !== undefined)) {
    throw new TypeError(`A hosted orbit belongs to an exoplanet or an unplaced star around a parent: ${record.id}.`);
  }
  const acquisition = record.acquisition;
  if (acquisition?.heliocentric && !['asteroid', 'comet', 'dwarfPlanet'].includes(acquisition.heliocentric.model)) throw new TypeError('Invalid heliocentric model.');
  if (acquisition?.satellite && (!(acquisition.satellite.toJd > acquisition.satellite.fromJd) || !(acquisition.satellite.stepDays > 0))) throw new TypeError('Invalid satellite sampling window.');
  if (acquisition?.fixture?.range !== undefined && !['daily','cassini-era','dart','limited','source-limited'].includes(acquisition.fixture.range)) throw new TypeError('Invalid fixture epoch selection.');
  return record;
}

const packageRoot = resolve(import.meta.dirname, '..');
const order = (a: {id: string; order?: number}, b: {id: string; order?: number}) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en');
const kinds = { planet: 'PLANET_IDS', 'dwarf-planet': 'DWARF_PLANET_IDS', asteroid: 'ASTEROID_IDS',
  'trans-neptunian': 'TRANS_NEPTUNIAN_IDS', interstellar: 'INTERSTELLAR_IDS', comet: 'COMET_IDS', exoplanet: 'EXOPLANET_IDS',
  'black-hole': 'BLACK_HOLE_IDS' };
const models = {
  asteroid: ['ASTEROID_ELEMENTS', "import type { KeplerianElements } from '../../kepler.js'", '{ query: string; elements: KeplerianElements }'],
  comet: ['COMET_ELEMENTS', "import type { KeplerianElements } from '../../kepler.js'", '{ query: string; elements: KeplerianElements }'],
  dwarfPlanet: ['DWARF_PLANET_ELEMENTS', "import type { DwarfPlanetRecord } from '../dwarfPlanetElements.data.js'", 'DwarfPlanetRecord'],
  satellite: ['SATELLITE_ELEMENTS', "import type { SatelliteRecord } from '../satelliteElements.data.js'", 'SatelliteRecord'],
  sceneSatellite: ['SCENE_SATELLITE_STATES', "import type { SceneSatelliteRecord } from '../../sceneSatellites.js'", 'SceneSatelliteRecord'],
  star: ['STAR_ASTROMETRY', "import type { StarAstrometry } from '../../stars.js'", 'StarAstrometry'],
  hostedOrbit: ['HOSTED_ORBITS', "import type { HostedOrbit } from '../../hostedOrbits.js'", 'HostedOrbit'],
  asteroidFixture: ['ASTEROID_FIXTURES', '', ''],
  cometFixture: ['COMET_FIXTURES', '', ''],
};

export async function readBodyRecords(root = packageRoot) {
  const records: BodyRecord[] = [];
  for (const file of (await readdir(resolve(root, 'data/bodies'))).sort()) {
    if (!file.endsWith('.json')) continue;
    const record = bodyRecord(JSON.parse(await readFile(resolve(root, 'data/bodies', file), 'utf8')));
    if (file !== `${record.id}.json`) throw new TypeError(`Invalid astronomy identity: ${file}.`);
    records.push(record);
  }
  const ids = new Set(records.map(record => record.id));
  if (!ids.size) throw new TypeError('Astronomy records are empty.');
  for (const record of records) {
    if (record.physical.parent !== null && !ids.has(record.physical.parent)) throw new TypeError(`Missing astronomy parent: ${record.id}.`);
    if (record.hostedOrbit !== undefined && records.find(parent => parent.id === record.physical.parent)?.star === undefined) throw new TypeError(`A hosted orbit's parent must be a placed star or black hole: ${record.id}.`);
    if (record.star?.boundTo !== undefined && records.find(host => host.id === record.star!.boundTo)?.star === undefined) throw new TypeError(`A bound star's companion must be a placed star: ${record.id}.`);
    // A circumbinary orbit is fitted about the centre of mass of its parent and a companion hosted on the same parent; the
    // published masses of both weight that centre.
    const companionId = record.hostedOrbit?.barycentreCompanion;
    if (companionId !== undefined) {
      const companion = records.find(other => other.id === companionId), parent = records.find(other => other.id === record.physical.parent);
      if (!companion?.hostedOrbit || companion.hostedOrbit.barycentreCompanion !== undefined || companion.physical.parent !== record.physical.parent || companion.id === record.id) {
        throw new TypeError(`${record.id}: hostedOrbit.barycentreCompanion ${companionId} must be another body on a plain hosted orbit around ${record.physical.parent}.`);
      }
      if (!(companion.physical.gravitationalParameterKm3PerS2 > 0) || !(parent!.physical.gravitationalParameterKm3PerS2 > 0)) {
        throw new TypeError(`${record.id}: the barycentre of ${record.physical.parent} and ${companionId} needs both masses; gravitationalParameterKm3PerS2 is ${parent!.physical.gravitationalParameterKm3PerS2} and ${companion.physical.gravitationalParameterKm3PerS2}.`);
      }
    }
  }
  return records.sort(order);
}

export async function writeBodyRecord(value: unknown, root = packageRoot) {
  const record = bodyRecord(value);
  if (!/^[a-z][a-z0-9-]*$/.test(record.id)) throw new TypeError('Invalid astronomy identity.');
  await writeChanged(resolve(root, 'data/bodies', `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
}

async function writeChanged(path: string, text: string) {
  try { if (await readFile(path, 'utf8') === text) return; }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  await writeFile(path, text);
}

/** Compile portable package inputs. No application checkout or network is needed. */
export async function prepareBodyRecords(root = packageRoot) {
  const records = await readBodyRecords(root), output = resolve(root, 'src/data/generated');
  await mkdir(output, { recursive: true });
  const header = '// Generated by tools/body-records.mts from data/. Do not edit.\n';
  const json = (value: unknown) => JSON.stringify(value);
  const ids = records.map(record => record.id);
  let bodySource = header + "import type { BodyData } from '../../body-types.js'\n" + `export const BODY_IDS = ${json(ids)} as const\n`;
  for (const [kind, symbol] of Object.entries(kinds)) {
    const members = records.filter(record => record.classification === kind).sort((a, b) => order(
      { id: a.id, order: a.classificationOrder }, { id: b.id, order: b.classificationOrder }));
    bodySource += `export const ${symbol} = ${json(members.map(record => record.id))} as const\n`;
  }
  bodySource += `export const BODIES: Record<typeof BODY_IDS[number], BodyData> = ${json(Object.fromEntries(records.map(({ id, physical }) => [id, { id, ...physical }])))}\n`;
  await writeChanged(resolve(output, 'bodies.ts'), bodySource);
  for (const [key, [symbol, imports, type]] of Object.entries(models)) {
    const entries = records.filter(record => record[key] !== undefined);
    const keys = entries.map(record => JSON.stringify(record.id)).join(' | ') || 'never';
    const annotation = type ? `: Readonly<Record<${keys}, ${type}>>` : '';
    await writeChanged(resolve(output, `${key}.ts`), header + imports + '\n' +
      `export const ${symbol}${annotation} = ${json(Object.fromEntries(entries.map(record => [record.id, record[key]])))} as const\n`);
  }
  const fixtures: Record<string, unknown> = {};
  for (const file of (await readdir(resolve(root, 'data/fixtures'))).sort()) {
    if (file.endsWith('.json')) fixtures[file.slice(0, -5)] = JSON.parse(await readFile(resolve(root, 'data/fixtures', file), 'utf8'));
  }
  await writeChanged(resolve(output, 'horizons.ts'), header + "import type { HorizonsFixture } from '../../__fixtures__/horizons.js'\n" +
    `export const HORIZONS = ${json(fixtures)} as const satisfies Record<string, HorizonsFixture>\n`);
  return records;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prepareBodyRecords();
