#!/usr/bin/env node
import { sampleAgreement } from './sample-agreement.mts';
/** The JWST ledger: what the public archive holds in each observing mode, which of it this repository can already turn into
 * something drawn, and which of the objects it ships JWST has observed.
 *
 *   node tools/objects/jwst/archive-ledger.mts [--write] [--local] [--targets <path>]
 *
 * Read only against MAST. Every public level-3 observation is listed by mode (MAST's instrument_name); NIRSpec's multi-object
 * mode is only counted, since each of its 145,000 rows is one galaxy in a survey field. Each mode's state is read from this
 * repository, not declared: the bands bands.mts defines for it, the programs pinned for it, and the programs that carry a
 * reproduction receipt or an author's deposit to compare with. A target is matched to a shipped object by name, or, for a
 * target that does not move, by lying within the object's radius on the sky; a moving target's name is also read by its first
 * word (TITAN-LEADING is Titan), and a background or offset pointing is never an object. --write replaces
 * data/jwst/ledger.json and docs/jwst-ledger.md; --local rewrites only the repository-derived part of both, from the ledger
 * already on disk, because pinning a program or writing a receipt changes nothing the archive said; --targets writes every
 * target of every mode, which is too long to keep. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firstSkyPosition } from '../archive-sky-position.mts';
import { hasErrorCode, isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { mastRequest } from './mast.mts';
import { bandMode, JWST_BANDS } from './imaging/bands.mts';
import { countRecord, isCommand, ledgerFiles, nameList, numberOrNull, receiptProblem, receiptProblemsParagraph, REPOSITORY, runArchiveLedger, shippedObjectIds, type ArchiveLedger } from '../archives/ledger.mts';


/** MAST's observing modes, what each one records, and the tool that reduces it here (none: nothing reads it yet). */
export const JWST_MODES: readonly { readonly mode: string; readonly records: string; readonly draws: string; readonly tool: string | null; readonly note?: string }[] = [
  { mode: 'NIRCAM/IMAGE', records: 'pictures, 0.6–5 µm', draws: 'nebulae and shells as volumes; pictures of Solar System bodies', tool: 'tools/objects/jwst/imaging/image3.mts' },
  { mode: 'NIRCAM/CORON', records: 'pictures with the star blocked out', draws: 'discs and rings attached to their star', tool: 'tools/objects/jwst/imaging/coron3.mts', note: 'Full-frame observations do not name their occulter.' },
  { mode: 'NIRCAM/GRISM', records: 'slitless spectra: time series of one star, or every source in a field', draws: 'exoplanet maps from eclipses and phase curves', tool: null, note: 'Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.' },
  { mode: 'MIRI/IMAGE', records: 'pictures, 5–26 µm, and time series of one star through a filter', draws: 'nebulae as volumes; exoplanet maps from eclipse photometry', tool: 'tools/objects/jwst/imaging/image3.mts', note: 'Time series are reduced from raw by reduce-tso.mts; pictures go through image3.' },
  { mode: 'MIRI/CORON', records: 'pictures with the star nulled by a phase mask', draws: 'discs and rings attached to their star', tool: null, note: 'Refused: the pipeline\'s alignment does not converge (docs/jwst-imaging.md).' },
  { mode: 'MIRI/IFU', records: 'cubes: a 5–28 µm spectrum in every pixel', draws: 'maps of what a surface or a gas is made of; gas velocity as depth', tool: 'tools/objects/jwst/cubes/spec3.mts', note: 'One observation is twelve cubes: four channels in three sub-bands, each pinned and rebuilt on its own.' },
  { mode: 'MIRI/SLIT', records: 'one 5–14 µm spectrum through a slit', draws: 'whole-disc composition; nothing resolved', tool: null, note: 'Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.' },
  { mode: 'MIRI/SLITLESS', records: 'time series of one star\'s 5–12 µm spectrum', draws: 'exoplanet maps from eclipses and phase curves', tool: 'tools/objects/jwst/reduce-tso.mts' },
  { mode: 'NIRSPEC/IFU', records: 'cubes: a 0.6–5.3 µm spectrum in every pixel', draws: 'maps of what a surface or a gas is made of; gas velocity as depth', tool: 'tools/objects/jwst/cubes/spec3.mts', note: 'Only a body several pixels across gets a map: NIRSpec\'s pixels are 0.1″, and most moons and small bodies fit inside one.' },
  { mode: 'NIRSPEC/SLIT', records: 'one spectrum through a slit, and time series of one star', draws: 'exoplanet maps from eclipses and phase curves', tool: null, note: 'WASP-43b\'s NIRSpec map is fitted from the authors\' deposited light curve, not reduced here. Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.' },
  { mode: 'NIRSPEC/MSA', records: 'spectra of many faint sources at once', draws: 'nothing: survey spectra of distant galaxies', tool: null },
  { mode: 'NIRISS/AMI', records: 'interferograms through a seven-hole mask', draws: 'structure closer to a star than a coronagraph reaches', tool: null, note: 'Held, not reducible here: no stage reads its level-3 interferometric products.' },
  { mode: 'NIRISS/SOSS', records: 'time series of one star\'s 0.6–2.8 µm spectrum', draws: 'exoplanet maps from eclipses and phase curves', tool: null, note: 'Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.' },
  { mode: 'NIRISS/WFSS', records: 'slitless spectra of every source in a field', draws: 'nothing: survey spectra', tool: null },
  { mode: 'NIRISS/IMAGE', records: 'pictures, 0.9–4.8 µm', draws: 'nebulae as volumes', tool: null, note: 'Held, not reducible here: the image3 stage would read it, but no NIRISS filter is defined as a band and no program is pinned.' },
];

export interface ArchiveRow { readonly observation: string; readonly target: string; readonly programme: string; readonly mode: string; readonly moving: boolean;
  readonly startIso: string; readonly endIso: string; readonly filter: string; readonly raDeg: number | null; readonly decDeg: number | null }
export interface JwstObservationRecord { readonly id: string; readonly programme: string; readonly mode: string; readonly startIso: string; readonly endIso: string; readonly filter: string }
const RETAINED_OBSERVATION_MODES = new Set(['NIRSPEC/IFU']);
export interface ShippedObject { readonly id: string; readonly names: readonly string[]; readonly position?: { readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number } }

const normalise = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/gu, '');
/** 2060 CHIRON and (2060) Chiron name Chiron. */
const withoutNumber = (name: string) => name.replace(/^\(?\d+\)?[\s_-]+(?=[A-Za-z])/u, '');
/** A pointing beside the target, taken to subtract the sky. */
const isBackground = (name: string) => /(^|[^A-Z])(BG|BKG|BKGD|BACKGROUND|OFFSET|SKY)([^A-Z]|$)/iu.test(name);

const indexes = new WeakMap<readonly ShippedObject[], Map<string, string>>();
const nameIndex = (objects: readonly ShippedObject[]) => {
  let index = indexes.get(objects);
  if (!index) {
    index = new Map();
    // Dione is Saturn's moon and asteroid 106: the plain name goes to the object whose id is the plain name, and a numbered
    // body is also found with its number (106 DIONE, DIONE-106).
    const numbered = (id: string) => /-\d+$/u.test(id);
    // An id outranks a display name: HD-189733B is the planet hd-189733b, not the companion star named HD 189733 B.
    const ordered = [...objects].sort((a, b) => Number(numbered(a.id)) - Number(numbered(b.id)));
    for (const [rank, object] of [...ordered.map(object => [0, object] as const), ...ordered.map(object => [1, object] as const)]) for (const name of rank === 0 ? [object.id] : object.names) {
      const key = normalise(name); if (!index.has(key)) index.set(key, object.id);
      const number = /-(\d+)$/u.exec(object.id)?.[1]; if (number) index.set(`${number}${key}`, object.id);
    }
    indexes.set(objects, index);
  }
  return index;
};

/** The shipped objects a target names or points at. PLUTO+CHARON is both; a background pointing is none. */
export function matchTarget(row: Pick<ArchiveRow, 'target' | 'moving' | 'raDeg' | 'decDeg'>, objects: readonly ShippedObject[]): string[] {
  if (isBackground(row.target)) return [];
  const byName = nameIndex(objects);
  const whole = byName.get(normalise(row.target)) ?? byName.get(normalise(withoutNumber(row.target)));
  if (whole) return [whole];
  if (row.moving) {
    const parts = row.target.split('+').map(part => byName.get(normalise(withoutNumber(part).split(/[-_\s]/u)[0]!))).filter((id): id is string => id !== undefined);
    return [...new Set(parts)];
  }
  if (row.raDeg === null || row.decDeg === null) return [];
  return objects.filter(({ position }) => position && Math.hypot((row.raDeg! - position.raDeg) * Math.cos(position.decDeg * Math.PI / 180), row.decDeg! - position.decDeg) < position.radiusDeg).map(object => object.id);
}

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
/** Every object package, with the names a JWST proposer might have used and, for what does not move, where it is on the sky:
 * a star within half an arcminute, a nebula within a sixth of a degree of the centre its recipe records. */
export async function shippedObjects(repository = REPOSITORY): Promise<ShippedObject[]> {
  const ids = await shippedObjectIds(repository);
  return Promise.all(ids.map(async id => {
    const body = await readJson(resolve(repository, 'packages/astronomy/data/bodies', `${id}.json`)).catch(() => undefined);
    const names = [id], physical = isRecord(body) && isRecord(body.physical) ? body.physical : undefined;
    if (physical && typeof physical.name === 'string') names.push(physical.name);
    if (isRecord(body) && isRecord(body.star)) return { id, names, position: { raDeg: requireFiniteNumber(body.star.rightAscensionDegrees), decDeg: requireFiniteNumber(body.star.declinationDegrees), radiusDeg: 0.5 / 60 } };
    const nebula = firstSkyPosition(await readJson(resolve(repository, 'src/objects', id, 'source/nebula.json')).catch(() => undefined));
    return nebula ? { id, names, position: { ...nebula, radiusDeg: 1 / 6 } } : { id, names };
  }));
}

/** Every public level-3 observation of the given modes. */
export async function archiveRows(modes: readonly string[]): Promise<ArchiveRow[]> {
  const rows: ArchiveRow[] = [];
  for (const mode of modes) for (let page = 1, pages = 1; page <= pages; page++) {
    const data = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', pagesize: 50_000, page, params: { columns: 'obs_id,target_name,proposal_id,mtFlag,t_min,t_max,filters,s_ra,s_dec',
      filters: [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'calib_level', values: [3] }, { paramName: 'dataRights', values: ['PUBLIC'] }, { paramName: 'instrument_name', values: [mode] }] } });
    for (const row of data) rows.push({ observation: requireString(row.obs_id), target: String(row.target_name ?? ''), programme: String(row.proposal_id), mode, moving: row.mtFlag === true,
      startIso: new Date((requireFiniteNumber(row.t_min, 'Observation start') - 40_587) * 86_400_000).toISOString(),
      endIso: new Date((requireFiniteNumber(row.t_max, 'Observation end') - 40_587) * 86_400_000).toISOString(), filter: requireString(row.filters, 'Observation filter'),
      raDeg: typeof row.s_ra === 'number' ? row.s_ra : null, decDeg: typeof row.s_dec === 'number' ? row.s_dec : null });
    if (data.length === 50_000) pages = page + 1;
  }
  return rows;
}
const archiveCount = async (mode: string) => Number(Object.values((await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', params: { columns: 'COUNT_BIG(*)',
  filters: [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'calib_level', values: [3] }, { paramName: 'dataRights', values: ['PUBLIC'] }, { paramName: 'instrument_name', values: [mode] }] } }))[0]!)[0]);

/** Time-series exposure types: one star watched for hours. They are listed apart because a filter time series has no level-3
 * product, and because a grism or slit mode mixes them with ordinary spectra. */
export const JWST_TIME_SERIES: readonly { readonly exposure: string; readonly service: string; readonly records: string; readonly programInstrument: string | null }[] = [
  { exposure: 'MIR_LRS-SLITLESS', service: 'Miri', records: 'MIRI 5–12 µm spectra', programInstrument: 'MIRI/SLITLESSPRISM' },
  { exposure: 'MIR_IMAGE', service: 'Miri', records: 'MIRI brightness through one filter', programInstrument: 'MIRI/IMAGE' },
  { exposure: 'NRS_BRIGHTOBJ', service: 'Nirspec', records: 'NIRSpec 0.6–5.3 µm spectra', programInstrument: null },
  { exposure: 'NIS_SOSS', service: 'Niriss', records: 'NIRISS 0.6–2.8 µm spectra', programInstrument: null },
  { exposure: 'NRC_TSGRISM', service: 'Nircam', records: 'NIRCam 2.4–5 µm spectra', programInstrument: null },
  { exposure: 'NRC_TSIMAGE', service: 'Nircam', records: 'NIRCam brightness through one filter', programInstrument: null },
];
export interface TimeSeriesVisit { readonly exposure: string; readonly programme: string; readonly observation: string; readonly target: string; readonly raDeg: number | null; readonly decDeg: number | null }

/** Every public time-series visit, from MAST's instrument keyword search (one row per exposure file, folded to visits). */
export async function timeSeriesVisits(nowMjd: number): Promise<TimeSeriesVisit[]> {
  const visits = new Map<string, TimeSeriesVisit>();
  for (const service of new Set(JWST_TIME_SERIES.map(entry => entry.service))) {
    const data = await mastRequest({ service: `Mast.Jwst.Filtered.${service}`, format: 'json', pagesize: 100_000, params: { columns: 'program,observtn,targprop,exp_type,targ_ra,targ_dec,publicReleaseDate_mjd',
      filters: [{ paramName: 'tsovisit', values: ['t'] }, { paramName: 'exp_type', values: JWST_TIME_SERIES.filter(entry => entry.service === service).map(entry => entry.exposure) }] } });
    if (data.length === 100_000) throw new RangeError(`${service}: the time-series listing is cut at its page size.`);
    for (const row of data) if (typeof row.publicReleaseDate_mjd === 'number' && row.publicReleaseDate_mjd <= nowMjd) {
      const exposure = requireString(row.exp_type), programme = String(row.program), observation = String(row.observtn);
      visits.set(`${exposure}|${programme}|${observation}`, { exposure, programme, observation, target: String(row.targprop ?? ''), raDeg: typeof row.targ_ra === 'number' ? row.targ_ra : null, decDeg: typeof row.targ_dec === 'number' ? row.targ_dec : null });
    }
  }
  return [...visits.values()];
}

/** The schemas the three imaging stages write their reproduction receipts under. Nothing else is a receipt. */
export const JWST_REPRODUCTION_SCHEMAS = ['cssearth-jwst-image3-reproduction@1', 'cssearth-jwst-image3-reproduction@2', 'cssearth-jwst-coron3-reproduction@1', 'cssearth-jwst-coron3-reproduction@2', 'cssearth-jwst-spec3-reproduction@1', 'cssearth-jwst-spec3-reproduction@2', 'cssearth-jwst-spec3-reproduction@3'] as const;
/** What a receipt has to say for the band it names to count as checked: which program, band and observation it reduced, and the
 * MAST product it compared the result against, pinned by name, size and digest. */
export interface ReproductionReceipt { readonly schema: string; readonly program: string; readonly band: string; readonly observation: string; readonly accepted: boolean;
  readonly mast: { readonly name: string; readonly bytes: number } }

/** One receipt read as the external value it is: another schema, a missing field or a missing pin is an error, never a skip. */
export function parseReproductionReceipt(value: unknown, label: string): ReproductionReceipt {
  const record = requireRecord(value, label), schema = requireString(record.schema, `${label}: schema`);
  if (!(JWST_REPRODUCTION_SCHEMAS as readonly string[]).includes(schema)) throw new TypeError(`${label}: ${schema} is not a reproduction receipt.`);
  const mast = requireRecord(record.mast, `${label}: MAST product`);
  let accepted = false;
  if (schema === 'cssearth-jwst-spec3-reproduction@3' || schema === 'cssearth-jwst-image3-reproduction@2' || schema === 'cssearth-jwst-coron3-reproduction@2') {
    const acceptance = requireRecord(record.acceptance, 'cube acceptance'), local = requireRecord(record.local, 'local cube');
    if (!(requireFiniteNumber(local.bytes, 'local cube bytes') > 0)) throw new TypeError('The compared local cube must record its size.');
    const cube = schema.includes('spec3'), expected = sampleAgreement(record.samples, cube ? 'cube' : 'image');
    accepted = (cube || Array.isArray(record.differentWcs) && record.differentWcs.length === 0 && requireRecord(record.pixels, 'image comparison').comparedOn === 'pixels')
      && acceptance.policy === expected.policy && acceptance.tolerance === expected.tolerance && acceptance.accepted === true && expected.accepted;
  }
  return { schema, accepted, program: requireString(record.program, `${label}: program`), band: requireString(record.band, `${label}: band`),
    observation: requireString(record.observation, `${label}: observation`),
    mast: { name: requireString(mast.name, `${label}: MAST name`), bytes: requireFiniteNumber(mast.bytes, `${label}: MAST bytes`) } };
}

/** What this repository holds for each mode: bands defined, programs pinned, programs checked against someone else's result,
 * and every receipt that could not be accepted. A band counts as checked only when a receipt parses under one of the stages'
 * schemas and names that program, that band, that observation and the level-3 product the program pins. */
export async function repositoryState(repository = REPOSITORY) {
  const state = new Map<string, { bands: number; programs: string[]; checked: string[] }>(JWST_MODES.map(({ mode }) => [mode, { bands: 0, programs: [], checked: [] }]));
  for (const band of Object.values(JWST_BANDS)) state.get(bandMode(band))!.bands++;
  const imaging = resolve(repository, 'tools/objects/jwst/imaging/programs'), files = await readdir(imaging);
  const receiptProblems: string[] = [], receipts = new Map<string, ReproductionReceipt>();
  for (const file of files.filter(name => name.endsWith('.reproduction.json')).sort()) {
    try {
      const receipt = parseReproductionReceipt(await readJson(resolve(imaging, file)), file);
      if (file !== `${receipt.program}.${receipt.band}.reproduction.json`) throw new TypeError(`${file}: it is the receipt of ${receipt.program} ${receipt.band}.`);
      receipts.set(`${receipt.program}|${receipt.band}`, receipt);
    } catch (error) { receiptProblems.push(receiptProblem(file, error)); }
  }
  for (const file of files.filter(name => name.endsWith('.json') && !name.endsWith('.reproduction.json')).sort()) {
    const program = await readJson(resolve(imaging, file));
    if (!isRecord(program) || !Array.isArray(program.bands)) throw new TypeError(`${file} is not an imaging program.`);
    const id = requireString(program.id), pinned = new Set<string>(), proved = new Set<string>();
    for (const entry of program.bands) {
      const band = requireRecord(entry, `${file}: band`), name = requireString(band.band, `${file}: band name`), mode = bandMode(JWST_BANDS[name]!);
      pinned.add(mode);
      const receipt = receipts.get(`${id}|${name}`);
      if (!receipt) continue;
      receipts.delete(`${id}|${name}`);
      const level3 = requireRecord(band.level3, `${file}: ${name} level-3 product`);
      const wrong = receipt.observation !== requireString(band.observation, `${file}: ${name} observation`) ? `the observation ${receipt.observation}`
        : receipt.mast.name !== requireString(level3.name, `${file}: ${name} product name`) ? `the product ${receipt.mast.name}`
        : receipt.mast.bytes !== requireFiniteNumber(level3.bytes, `${file}: ${name} product bytes`) ? `${receipt.mast.bytes} bytes` : null;
      if (wrong) receiptProblems.push(`${id}.${name}.reproduction.json: it compared ${wrong}, which ${file} does not pin.`);
      else if (receipt.accepted) proved.add(mode);
    }
    for (const mode of pinned) state.get(mode)!.programs.push(id);
    for (const mode of proved) state.get(mode)!.checked.push(id);
  }
  for (const [key] of [...receipts].sort(([a], [b]) => a.localeCompare(b, 'en')))
    receiptProblems.push(`${key.replace('|', '.')}.reproduction.json: no pinned program holds that band.`);
  const timeSeries = new Map<string, { programs: string[]; checked: string[] }>();
  const series = resolve(repository, 'tools/objects/jwst/programs');
  for (const entry of (await readdir(series, { withFileTypes: true })).filter(item => item.isDirectory())) {
    // A directory without a program.json is a joint fit of several visits, not an observation.
    const program = await readJson(resolve(series, entry.name, 'program.json')).catch(error => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    if (program === null) continue;
    if (!isRecord(program)) throw new TypeError(`${entry.name} is not a time-series program.`);
    const instrument = requireString(program.instrument), mode = instrument === 'MIRI/SLITLESSPRISM' ? 'MIRI/SLITLESS' : instrument, target = state.get(mode);
    if (!target) throw new RangeError(`${entry.name}: ${instrument} is not a ledger mode.`);
    const own = timeSeries.get(instrument) ?? { programs: [], checked: [] }; timeSeries.set(instrument, own);
    for (const held of [target, own]) { held.programs.push(entry.name); if (isRecord(program.oracle)) held.checked.push(entry.name); }
  }
  return { modes: state, timeSeries, receiptProblems };
}

export interface Ledger {
  readonly schema: 'cssearth-jwst-ledger@1' | 'cssearth-jwst-ledger@2'; readonly archiveDate: string;
  readonly modes: readonly { readonly mode: string; readonly observations: number; readonly targets: number | null; readonly movingObservations: number | null; readonly tool: string | null;
    readonly bands: number; readonly programs: readonly string[]; readonly checked: readonly string[]; readonly shippedObjects: number }[];
  readonly timeSeries: readonly { readonly exposure: string; readonly visits: number; readonly targets: number; readonly shippedObjects: readonly string[]; readonly programs: readonly string[]; readonly checked: readonly string[] }[];
  readonly objects: readonly { readonly id: string; readonly observations: Readonly<Record<string, number>>; readonly records: readonly JwstObservationRecord[];
    readonly timeSeriesVisits: Readonly<Record<string, number>>; readonly programmes: readonly string[]; readonly drawn: readonly string[] }[];
  /** Receipts that could not be accepted, and so proved nothing. An empty list is the only passing state. */
  readonly receiptProblems: readonly string[];
}

export function buildLedger(rows: readonly ArchiveRow[], visits: readonly TimeSeriesVisit[], counts: ReadonlyMap<string, number>, objects: readonly ShippedObject[], held: Awaited<ReturnType<typeof repositoryState>>, archiveDate: string): Ledger {
  const state = held.modes, seen = new Map<string, { observations: Record<string, number>; records: JwstObservationRecord[]; visits: Record<string, number>; programmes: Set<string> }>();
  const entryOf = (id: string) => { const entry = seen.get(id) ?? { observations: {}, records: [], visits: {}, programmes: new Set<string>() }; seen.set(id, entry); return entry; };
  const watched = new Map<string, Set<string>>();
  for (const visit of visits) for (const id of matchTarget({ target: visit.target, moving: false, raDeg: visit.raDeg, decDeg: visit.decDeg }, objects)) {
    const entry = entryOf(id); entry.visits[visit.exposure] = (entry.visits[visit.exposure] ?? 0) + 1; entry.programmes.add(visit.programme);
    watched.set(visit.exposure, (watched.get(visit.exposure) ?? new Set()).add(id));
  }
  for (const row of rows) for (const id of matchTarget(row, objects)) {
    const entry = entryOf(id); entry.observations[row.mode] = (entry.observations[row.mode] ?? 0) + 1; entry.programmes.add(row.programme);
    if (RETAINED_OBSERVATION_MODES.has(row.mode)) entry.records.push({ id: row.observation, programme: row.programme, mode: row.mode, startIso: row.startIso, endIso: row.endIso, filter: row.filter });
  }
  const listed = new Set(rows.map(row => row.mode));
  return { schema: 'cssearth-jwst-ledger@2', archiveDate,
    modes: JWST_MODES.map(({ mode, tool }) => { const own = rows.filter(row => row.mode === mode), held = state.get(mode)!; return { mode, observations: counts.get(mode) ?? own.length,
      targets: listed.has(mode) ? new Set(own.map(row => row.target)).size : null, movingObservations: listed.has(mode) ? own.filter(row => row.moving).length : null, tool,
      bands: held.bands, programs: [...held.programs].sort(), checked: [...held.checked].sort(), shippedObjects: [...seen.values()].filter(entry => entry.observations[mode]).length }; }),
    timeSeries: JWST_TIME_SERIES.map(({ exposure, programInstrument }) => { const own = visits.filter(visit => visit.exposure === exposure), pinned = programInstrument ? held.timeSeries.get(programInstrument) : undefined;
      return { exposure, visits: own.length, targets: new Set(own.map(visit => visit.target)).size, shippedObjects: [...watched.get(exposure) ?? []].sort(), programs: [...pinned?.programs ?? []].sort(), checked: [...pinned?.checked ?? []].sort() }; }),
    objects: [...seen].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([id, entry]) => ({ id, observations: Object.fromEntries(Object.entries(entry.observations).sort(([a], [b]) => a.localeCompare(b, 'en'))),
      records: entry.records.sort((a, b) => a.startIso.localeCompare(b.startIso, 'en') || a.id.localeCompare(b.id, 'en')),
      timeSeriesVisits: Object.fromEntries(Object.entries(entry.visits).sort(([a], [b]) => a.localeCompare(b, 'en'))),
      programmes: [...entry.programmes].sort((a, b) => Number(a) - Number(b)), drawn: [...JWST_MODES.filter(({ mode }) => entry.observations[mode] && state.get(mode)!.programs.some(program => program.startsWith(id))).map(({ mode }) => mode),
        ...JWST_TIME_SERIES.filter(({ exposure, programInstrument }) => entry.visits[exposure] && programInstrument && held.timeSeries.get(programInstrument)?.programs.some(program => program.startsWith(id))).map(({ exposure }) => exposure)] })),
    receiptProblems: [...held.receiptProblems].sort((a, b) => a.localeCompare(b, 'en')) };
}

/** The ledger on disk, read back as the external value it is, so --local rewrites a file it has checked. */
export function parseLedger(value: unknown): Ledger {
  const row = requireRecord(value, 'JWST ledger');
  if (row.schema !== 'cssearth-jwst-ledger@1' && row.schema !== 'cssearth-jwst-ledger@2') throw new TypeError('Unsupported JWST ledger.');
  const names = nameList, counts = countRecord, orNull = numberOrNull;
  return { schema: row.schema, archiveDate: requireString(row.archiveDate, 'Archive date'),
    modes: requireArray(row.modes, 'Modes').map(raw => { const entry = requireRecord(raw, 'Mode');
      return { mode: requireString(entry.mode, 'Mode name'), observations: requireFiniteNumber(entry.observations, 'Observations'), targets: orNull(entry.targets, 'Targets'),
        movingObservations: orNull(entry.movingObservations, 'Moving observations'), tool: entry.tool === null ? null : requireString(entry.tool, 'Tool'),
        bands: requireFiniteNumber(entry.bands, 'Bands'), programs: names(entry.programs, 'Programs'), checked: names(entry.checked, 'Checked'),
        shippedObjects: requireFiniteNumber(entry.shippedObjects, 'Shipped objects') }; }),
    timeSeries: requireArray(row.timeSeries, 'Time series').map(raw => { const entry = requireRecord(raw, 'Time series');
      return { exposure: requireString(entry.exposure, 'Exposure type'), visits: requireFiniteNumber(entry.visits, 'Visits'), targets: requireFiniteNumber(entry.targets, 'Targets'),
        shippedObjects: names(entry.shippedObjects, 'Shipped objects'), programs: names(entry.programs, 'Programs'), checked: names(entry.checked, 'Checked') }; }),
    objects: requireArray(row.objects, 'Objects').map(raw => { const entry = requireRecord(raw, 'Object');
      return { id: requireString(entry.id, 'Object id'), observations: counts(entry.observations, 'Observations by mode'), timeSeriesVisits: counts(entry.timeSeriesVisits, 'Time-series visits'),
        records: requireArray(entry.records ?? [], 'Observation records').map(rawRecord => { const record = requireRecord(rawRecord, 'Observation record');
          return { id: requireString(record.id, 'Observation id'), programme: requireString(record.programme, 'Observation programme'), mode: requireString(record.mode, 'Observation mode'),
            startIso: requireString(record.startIso, 'Observation start'), endIso: requireString(record.endIso, 'Observation end'), filter: requireString(record.filter, 'Observation filter') }; }),
        programmes: names(entry.programmes, 'Programmes'), drawn: names(entry.drawn, 'Drawn') }; }),
    // A ledger written before receipts were checked states no problems; the next --write or --local gives it the field.
    receiptProblems: names(row.receiptProblems ?? [], 'Receipt problems') };
}

/** The ledger on disk with everything this repository owns taken again from it: what is pinned, what a receipt proved, what a
 * pinned program already draws, and the receipts that could not be accepted. Nothing the archive said is touched. */
export function withRepositoryState(ledger: Ledger, held: Awaited<ReturnType<typeof repositoryState>>): Ledger {
  return { ...ledger,
    modes: ledger.modes.map(entry => ({ ...entry, programs: [...held.modes.get(entry.mode)?.programs ?? []].sort(), checked: [...held.modes.get(entry.mode)?.checked ?? []].sort() })),
    timeSeries: ledger.timeSeries.map(entry => { const pinned = JWST_TIME_SERIES.find(series => series.exposure === entry.exposure)?.programInstrument;
      const own = pinned ? held.timeSeries.get(pinned) : undefined;
      return { ...entry, programs: [...own?.programs ?? []].sort(), checked: [...own?.checked ?? []].sort() }; }),
    objects: ledger.objects.map(object => ({ ...object,
      drawn: [...JWST_MODES.filter(({ mode }) => object.observations[mode] && held.modes.get(mode)!.programs.some(program => program.startsWith(object.id))).map(({ mode }) => mode),
        ...JWST_TIME_SERIES.filter(({ exposure, programInstrument }) => object.timeSeriesVisits[exposure] && programInstrument
          && held.timeSeries.get(programInstrument)?.programs.some(program => program.startsWith(object.id))).map(({ exposure }) => exposure)] })),
    receiptProblems: [...held.receiptProblems].sort((a, b) => a.localeCompare(b, 'en')) };
}

export function ledgerGuide(ledger: Ledger): string {
  const number = (value: number | null) => value === null ? 'none' : value.toLocaleString('en-US');
  const readable = ledger.modes.filter(mode => mode.checked.length), unread = ledger.objects.filter(object => !Object.keys(object.observations).some(mode => ledger.modes.find(entry => entry.mode === mode)!.checked.length) &&
    !Object.keys(object.timeSeriesVisits).some(exposure => ledger.timeSeries.find(entry => entry.exposure === exposure)!.checked.length));
  return `# JWST ledger

This page is written by [\`archive-ledger.mts\`](../tools/objects/jwst/archive-ledger.mts) from MAST's public archive as it stood on ${ledger.archiveDate}, and from the programs pinned in this repository. It answers two questions: what kinds of JWST observation can this project already turn into something drawn, and which of the objects it ships has JWST observed. The numbers are in [\`data/jwst/ledger.json\`](../data/jwst/ledger.json). How each route works is in [JWST imaging](jwst-imaging.md) and [eclipse mapping](eclipse-mapping.md).

## Observing modes

An observation here is one public level-3 product set: one target, one instrument setup. "Checked" counts the pinned programs whose result was compared with someone else's: MAST's own product, or the light curve an author deposited.

| Mode | What it records | What it could draw | Observations | Targets | Of moving targets | Shipped objects | Bands | Programs | Checked |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
${ledger.modes.map(mode => { const about = JWST_MODES.find(entry => entry.mode === mode.mode)!; return `| ${mode.mode} | ${about.records} | ${about.draws} | ${number(mode.observations)} | ${number(mode.targets)} | ${number(mode.movingObservations)} | ${mode.shippedObjects} | ${mode.bands} | ${mode.programs.length} | ${mode.checked.length} |`; }).join('\n')}

${readable.length} of ${ledger.modes.length} modes have a checked program: ${readable.map(mode => mode.mode).join(', ')}.

${JWST_MODES.filter(mode => mode.note).map(mode => `- **${mode.mode}.** ${mode.note}`).join('\n')}

## Time series

One star watched for hours, which is what an exoplanet map is fitted from. These are counted by visit from MAST's instrument keywords, because a time series through a filter has no level-3 product and a grism or slit mode mixes time series with ordinary spectra.

| Exposure type | What it records | Visits | Targets | Shipped objects | Programs | Checked |
|---|---|---:|---:|---|---:|---:|
${ledger.timeSeries.map(series => `| ${series.exposure} | ${JWST_TIME_SERIES.find(entry => entry.exposure === series.exposure)!.records} | ${number(series.visits)} | ${number(series.targets)} | ${series.shippedObjects.join(', ') || 'none'} | ${series.programs.length} | ${series.checked.length} |`).join('\n')}

## Shipped objects JWST has observed

${ledger.objects.length} shipped objects appear in the archive. ${unread.length} of them were observed only in modes with no checked program here. "Drawn" names the modes a pinned program of that object already uses.

| Object | Observations by mode | Time-series visits | Programmes | Drawn |
|---|---|---|---|---|
${ledger.objects.map(object => `| ${object.id} | ${Object.entries(object.observations).map(([mode, count]) => `${mode} ${count}`).join(', ') || 'none'} | ${Object.entries(object.timeSeriesVisits).map(([exposure, count]) => `${exposure} ${count}`).join(', ') || 'none'} | ${object.programmes.join(', ')} | ${object.drawn.join(', ') || 'none'} |`).join('\n')}

## Receipts

A band counts as checked only when a receipt beside its program parses, states one of the imaging stages' reproduction schemas, and names that program, that band, that observation and the level-3 product the program pins, with the digest of what it compared. A receipt that says anything else is reported here and proves nothing.

${receiptProblemsParagraph(ledger.receiptProblems)}

## Limits

- A target is matched by the name its proposer typed, or by position for what does not move. A moving target is matched by the first word of its name, so TITAN-LEADING is Titan; a pointing named as a background or an offset is left out. A name two objects share (Dione the moon, 106 Dione) goes to the unnumbered one unless the target carries the number. An object observed under a name this does not recognise is missed, and a nebula is matched to anything pointed within a sixth of a degree of its centre.
- The archive changes daily; this is a dated snapshot, and only public data are counted.
- NIRSpec integral-field entries retain every observation id, date and grating/filter pair so the capability query can offer an exact qualification command.
- NIRSpec's multi-object mode is counted but not listed by target.
`;
}

/** The survey of MAST: every public level-3 observation of the listed modes, the time-series visits and the one counted
 * mode. With `--targets <path>` it also writes every target of every mode, which is too long to keep. */
async function surveyMast(args: readonly string[]): Promise<Ledger> {
  const listed = JWST_MODES.map(entry => entry.mode).filter(mode => mode !== 'NIRSPEC/MSA');
  const now = new Date(), nowMjd = now.getTime() / 86_400_000 + 40_587;
  const [rows, visits, objects, state, msa] = await Promise.all([archiveRows(listed), timeSeriesVisits(nowMjd), shippedObjects(), repositoryState(), archiveCount('NIRSPEC/MSA')]);
  const ledger = buildLedger(rows, visits, new Map([['NIRSPEC/MSA', msa]]), objects, state, now.toISOString().slice(0, 10));
  const targets = args.indexOf('--targets');
  if (targets >= 0) {
    const byTarget = new Map<string, { target: string; mode: string; observations: number; programmes: Set<string>; objects: string[] }>();
    for (const row of rows) { const key = `${row.mode}|${row.target}`, entry = byTarget.get(key) ?? { target: row.target, mode: row.mode, observations: 0, programmes: new Set<string>(), objects: matchTarget(row, objects) }; entry.observations++; entry.programmes.add(row.programme); byTarget.set(key, entry); }
    await writeFile(resolve(args[targets + 1]!), `${JSON.stringify([...byTarget.values()].map(entry => ({ ...entry, programmes: [...entry.programmes] })), null, 1)}\n`);
  }
  return ledger;
}

/** The JWST ledger, written at indent 1: the full pass prints every mode and writes only with `--write`; `--local` retakes
 * what is pinned, checked and drawn, and ends the process when it has reported. Its parse rebuilds each object's keys in
 * their parse order, so a local pass puts `timeSeriesVisits` before `records` where a full pass wrote them after. */
export const JWST_LEDGER: ArchiveLedger<Ledger> = {
  files: ledgerFiles('data/jwst/ledger.json', 'docs/jwst-ledger.md'), indent: 1, guide: ledgerGuide,
  survey: surveyMast, writes: 'with --write',
  local: { parse: parseLedger, writes: 'always', exit: true, refresh: async previous => withRepositoryState(previous, await repositoryState()) },
  receiptProblems: ledger => ledger.receiptProblems,
  summary: (ledger, { local }) => local ? [`JWST_LEDGER ${JWST_LEDGER.files.ledger} ${JWST_LEDGER.files.guide} (repository state only)`] : [
    ...ledger.modes.map(mode => `${mode.mode.padEnd(14)} ${String(mode.observations).padStart(7)} obs ${String(mode.targets ?? '').padStart(5)} targets ${String(mode.shippedObjects).padStart(3)} shipped  bands ${String(mode.bands).padStart(2)}  programs ${mode.programs.length} checked ${mode.checked.length}`),
    ...ledger.timeSeries.map(series => `${series.exposure.padEnd(17)} ${String(series.visits).padStart(4)} visits ${String(series.targets).padStart(4)} targets  shipped ${series.shippedObjects.length}  programs ${series.programs.length} checked ${series.checked.length}`),
    `JWST_LEDGER ${JSON.stringify({ observations: ledger.modes.reduce((total, mode) => total + mode.observations, 0), shippedObjects: ledger.objects.length })}`],
};

if (isCommand(import.meta.url)) await runArchiveLedger(JWST_LEDGER);
