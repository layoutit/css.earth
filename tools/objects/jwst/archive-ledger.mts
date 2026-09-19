#!/usr/bin/env node
/** The JWST ledger: what the public archive holds in each observing mode, which of it this repository can already turn into
 * something drawn, and which of the objects it ships JWST has observed.
 *
 *   node tools/objects/jwst/archive-ledger.mts [--write] [--targets <path>]
 *
 * Read only against MAST. Every public level-3 observation is listed by mode (MAST's instrument_name); NIRSpec's multi-object
 * mode is only counted, since each of its 145,000 rows is one galaxy in a survey field. Each mode's state is read from this
 * repository, not declared: the bands bands.mts defines for it, the programs pinned for it, and the programs that carry a
 * reproduction receipt or an author's deposit to compare with. A target is matched to a shipped object by name, or, for a
 * target that does not move, by lying within the object's radius on the sky; a moving target's name is also read by its first
 * word (TITAN-LEADING is Titan), and a background or offset pointing is never an object. --write replaces
 * data/jwst/ledger.json and docs/jwst-ledger.md; --targets writes every target of every mode, which is too long to keep. */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode, isRecord, requireFiniteNumber, requireString } from '../../source-values.mts';
import { mastRequest } from './mast.mts';
import { JWST_BANDS } from './imaging/bands.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');

/** MAST's observing modes, what each one records, and the tool that reduces it here (none: nothing reads it yet). */
export const JWST_MODES: readonly { readonly mode: string; readonly records: string; readonly draws: string; readonly tool: string | null; readonly note?: string }[] = [
  { mode: 'NIRCAM/IMAGE', records: 'pictures, 0.6–5 µm', draws: 'nebulae and shells as volumes; pictures of Solar System bodies', tool: 'tools/objects/jwst/imaging/image3.mts' },
  { mode: 'NIRCAM/CORON', records: 'pictures with the star blocked out', draws: 'discs and rings attached to their star', tool: 'tools/objects/jwst/imaging/coron3.mts', note: 'Full-frame observations do not name their occulter.' },
  { mode: 'NIRCAM/GRISM', records: 'slitless spectra: time series of one star, or every source in a field', draws: 'exoplanet maps from eclipses and phase curves', tool: null },
  { mode: 'MIRI/IMAGE', records: 'pictures, 5–26 µm, and time series of one star through a filter', draws: 'nebulae as volumes; exoplanet maps from eclipse photometry', tool: 'tools/objects/jwst/reduce-tso.mts', note: 'Time series are reduced from raw; pictures have bands but no reproduced program.' },
  { mode: 'MIRI/CORON', records: 'pictures with the star nulled by a phase mask', draws: 'discs and rings attached to their star', tool: null, note: 'Refused: the pipeline\'s alignment does not converge (docs/jwst-imaging.md).' },
  { mode: 'MIRI/IFU', records: 'cubes: a 5–28 µm spectrum in every pixel', draws: 'maps of what a surface or a gas is made of; gas velocity as depth', tool: null },
  { mode: 'MIRI/SLIT', records: 'one 5–14 µm spectrum through a slit', draws: 'whole-disc composition; nothing resolved', tool: null },
  { mode: 'MIRI/SLITLESS', records: 'time series of one star\'s 5–12 µm spectrum', draws: 'exoplanet maps from eclipses and phase curves', tool: 'tools/objects/jwst/reduce-tso.mts' },
  { mode: 'NIRSPEC/IFU', records: 'cubes: a 0.6–5.3 µm spectrum in every pixel', draws: 'maps of what a surface or a gas is made of; gas velocity as depth', tool: 'tools/objects/jwst/cubes/spec3.mts', note: 'Only a body several pixels across gets a map: NIRSpec\'s pixels are 0.1″, and most moons and small bodies fit inside one.' },
  { mode: 'NIRSPEC/SLIT', records: 'one spectrum through a slit, and time series of one star', draws: 'exoplanet maps from eclipses and phase curves', tool: null, note: 'WASP-43b\'s NIRSpec map is fitted from the authors\' deposited light curve, not reduced here.' },
  { mode: 'NIRSPEC/MSA', records: 'spectra of many faint sources at once', draws: 'nothing: survey spectra of distant galaxies', tool: null },
  { mode: 'NIRISS/AMI', records: 'interferograms through a seven-hole mask', draws: 'structure closer to a star than a coronagraph reaches', tool: null },
  { mode: 'NIRISS/SOSS', records: 'time series of one star\'s 0.6–2.8 µm spectrum', draws: 'exoplanet maps from eclipses and phase curves', tool: null },
  { mode: 'NIRISS/WFSS', records: 'slitless spectra of every source in a field', draws: 'nothing: survey spectra', tool: null },
  { mode: 'NIRISS/IMAGE', records: 'pictures, 0.9–4.8 µm', draws: 'nebulae as volumes', tool: null },
];

export interface ArchiveRow { readonly observation: string; readonly target: string; readonly programme: string; readonly mode: string; readonly moving: boolean; readonly raDeg: number | null; readonly decDeg: number | null }
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

const modeOfBand = (band: { instrument: string; coronagraph?: string; grating?: string }) => `${band.instrument}/${band.coronagraph ? 'CORON' : band.grating ? 'IFU' : 'IMAGE'}`;
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
const firstSkyPosition = (value: unknown): { raDeg: number; decDeg: number } | undefined => {
  if (Array.isArray(value)) { for (const item of value) { const found = firstSkyPosition(item); if (found) return found; } return undefined; }
  if (!isRecord(value)) return undefined;
  if (typeof value.raDeg === 'number' && typeof value.decDeg === 'number') return { raDeg: value.raDeg, decDeg: value.decDeg };
  for (const item of Object.values(value)) { const found = firstSkyPosition(item); if (found) return found; }
  return undefined;
};

/** Every object package, with the names a JWST proposer might have used and, for what does not move, where it is on the sky:
 * a star within half an arcminute, a nebula within a sixth of a degree of the centre its recipe records. */
export async function shippedObjects(repository = REPOSITORY): Promise<ShippedObject[]> {
  const ids = (await readdir(resolve(repository, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
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
    const data = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', pagesize: 50_000, page, params: { columns: 'obs_id,target_name,proposal_id,mtFlag,s_ra,s_dec',
      filters: [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'calib_level', values: [3] }, { paramName: 'dataRights', values: ['PUBLIC'] }, { paramName: 'instrument_name', values: [mode] }] } });
    for (const row of data) rows.push({ observation: requireString(row.obs_id), target: String(row.target_name ?? ''), programme: String(row.proposal_id), mode, moving: row.mtFlag === true,
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

/** What this repository holds for each mode: bands defined, programs pinned, and programs checked against someone else's result. */
export async function repositoryState(repository = REPOSITORY) {
  const state = new Map<string, { bands: number; programs: string[]; checked: string[] }>(JWST_MODES.map(({ mode }) => [mode, { bands: 0, programs: [], checked: [] }]));
  for (const band of Object.values(JWST_BANDS)) state.get(modeOfBand(band))!.bands++;
  const imaging = resolve(repository, 'tools/objects/jwst/imaging/programs'), files = await readdir(imaging);
  for (const file of files.filter(name => name.endsWith('.json') && !name.endsWith('.reproduction.json'))) {
    const program = await readJson(resolve(imaging, file));
    if (!isRecord(program) || !Array.isArray(program.bands)) throw new TypeError(`${file} is not an imaging program.`);
    const id = requireString(program.id), modes = new Set(program.bands.map(entry => { return modeOfBand(JWST_BANDS[requireString(isRecord(entry) ? entry.band : undefined)]!); }));
    for (const mode of modes) { state.get(mode)!.programs.push(id); if (files.some(name => name.startsWith(`${id}.`) && name.endsWith('.reproduction.json'))) state.get(mode)!.checked.push(id); }
  }
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
  return { modes: state, timeSeries };
}

export interface Ledger {
  readonly schema: 'cssearth-jwst-ledger@1'; readonly archiveDate: string;
  readonly modes: readonly { readonly mode: string; readonly observations: number; readonly targets: number | null; readonly movingObservations: number | null; readonly tool: string | null;
    readonly bands: number; readonly programs: readonly string[]; readonly checked: readonly string[]; readonly shippedObjects: number }[];
  readonly timeSeries: readonly { readonly exposure: string; readonly visits: number; readonly targets: number; readonly shippedObjects: readonly string[]; readonly programs: readonly string[]; readonly checked: readonly string[] }[];
  readonly objects: readonly { readonly id: string; readonly observations: Readonly<Record<string, number>>; readonly timeSeriesVisits: Readonly<Record<string, number>>; readonly programmes: readonly string[]; readonly drawn: readonly string[] }[];
}

export function buildLedger(rows: readonly ArchiveRow[], visits: readonly TimeSeriesVisit[], counts: ReadonlyMap<string, number>, objects: readonly ShippedObject[], held: Awaited<ReturnType<typeof repositoryState>>, archiveDate: string): Ledger {
  const state = held.modes, seen = new Map<string, { observations: Record<string, number>; visits: Record<string, number>; programmes: Set<string> }>();
  const entryOf = (id: string) => { const entry = seen.get(id) ?? { observations: {}, visits: {}, programmes: new Set<string>() }; seen.set(id, entry); return entry; };
  const watched = new Map<string, Set<string>>();
  for (const visit of visits) for (const id of matchTarget({ target: visit.target, moving: false, raDeg: visit.raDeg, decDeg: visit.decDeg }, objects)) {
    const entry = entryOf(id); entry.visits[visit.exposure] = (entry.visits[visit.exposure] ?? 0) + 1; entry.programmes.add(visit.programme);
    watched.set(visit.exposure, (watched.get(visit.exposure) ?? new Set()).add(id));
  }
  for (const row of rows) for (const id of matchTarget(row, objects)) {
    const entry = entryOf(id); entry.observations[row.mode] = (entry.observations[row.mode] ?? 0) + 1; entry.programmes.add(row.programme);
  }
  const listed = new Set(rows.map(row => row.mode));
  return { schema: 'cssearth-jwst-ledger@1', archiveDate,
    modes: JWST_MODES.map(({ mode, tool }) => { const own = rows.filter(row => row.mode === mode), held = state.get(mode)!; return { mode, observations: counts.get(mode) ?? own.length,
      targets: listed.has(mode) ? new Set(own.map(row => row.target)).size : null, movingObservations: listed.has(mode) ? own.filter(row => row.moving).length : null, tool,
      bands: held.bands, programs: [...held.programs].sort(), checked: [...held.checked].sort(), shippedObjects: [...seen.values()].filter(entry => entry.observations[mode]).length }; }),
    timeSeries: JWST_TIME_SERIES.map(({ exposure, programInstrument }) => { const own = visits.filter(visit => visit.exposure === exposure), pinned = programInstrument ? held.timeSeries.get(programInstrument) : undefined;
      return { exposure, visits: own.length, targets: new Set(own.map(visit => visit.target)).size, shippedObjects: [...watched.get(exposure) ?? []].sort(), programs: [...pinned?.programs ?? []].sort(), checked: [...pinned?.checked ?? []].sort() }; }),
    objects: [...seen].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([id, entry]) => ({ id, observations: Object.fromEntries(Object.entries(entry.observations).sort(([a], [b]) => a.localeCompare(b, 'en'))),
      timeSeriesVisits: Object.fromEntries(Object.entries(entry.visits).sort(([a], [b]) => a.localeCompare(b, 'en'))),
      programmes: [...entry.programmes].sort((a, b) => Number(a) - Number(b)), drawn: [...JWST_MODES.filter(({ mode }) => entry.observations[mode] && state.get(mode)!.programs.some(program => program.startsWith(id))).map(({ mode }) => mode),
        ...JWST_TIME_SERIES.filter(({ exposure, programInstrument }) => entry.visits[exposure] && programInstrument && held.timeSeries.get(programInstrument)?.programs.some(program => program.startsWith(id))).map(({ exposure }) => exposure)] })) };
}

export function ledgerGuide(ledger: Ledger): string {
  const number = (value: number | null) => value === null ? '—' : value.toLocaleString('en-US');
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
${ledger.timeSeries.map(series => `| ${series.exposure} | ${JWST_TIME_SERIES.find(entry => entry.exposure === series.exposure)!.records} | ${number(series.visits)} | ${number(series.targets)} | ${series.shippedObjects.join(', ') || '—'} | ${series.programs.length} | ${series.checked.length} |`).join('\n')}

## Shipped objects JWST has observed

${ledger.objects.length} shipped objects appear in the archive. ${unread.length} of them were observed only in modes with no checked program here. "Drawn" names the modes a pinned program of that object already uses.

| Object | Observations by mode | Time-series visits | Programmes | Drawn |
|---|---|---|---|---|
${ledger.objects.map(object => `| ${object.id} | ${Object.entries(object.observations).map(([mode, count]) => `${mode} ${count}`).join(', ') || '—'} | ${Object.entries(object.timeSeriesVisits).map(([exposure, count]) => `${exposure} ${count}`).join(', ') || '—'} | ${object.programmes.join(', ')} | ${object.drawn.join(', ') || '—'} |`).join('\n')}

## Limits

- A target is matched by the name its proposer typed, or by position for what does not move. A moving target is matched by the first word of its name, so TITAN-LEADING is Titan; a pointing named as a background or an offset is left out. A name two objects share (Dione the moon, 106 Dione) goes to the unnumbered one unless the target carries the number. An object observed under a name this does not recognise is missed, and a nebula is matched to anything pointed within a sixth of a degree of its centre.
- The archive changes daily; this is a dated snapshot, and only public data are counted.
- NIRSpec's multi-object mode is counted but not listed by target.
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), listed = JWST_MODES.map(entry => entry.mode).filter(mode => mode !== 'NIRSPEC/MSA');
  const now = new Date(), nowMjd = now.getTime() / 86_400_000 + 40_587;
  const [rows, visits, objects, state, msa] = await Promise.all([archiveRows(listed), timeSeriesVisits(nowMjd), shippedObjects(), repositoryState(), archiveCount('NIRSPEC/MSA')]);
  const ledger = buildLedger(rows, visits, new Map([['NIRSPEC/MSA', msa]]), objects, state, now.toISOString().slice(0, 10));
  for (const mode of ledger.modes) console.log(`${mode.mode.padEnd(14)} ${String(mode.observations).padStart(7)} obs ${String(mode.targets ?? '').padStart(5)} targets ${String(mode.shippedObjects).padStart(3)} shipped  bands ${String(mode.bands).padStart(2)}  programs ${mode.programs.length} checked ${mode.checked.length}`);
  for (const series of ledger.timeSeries) console.log(`${series.exposure.padEnd(17)} ${String(series.visits).padStart(4)} visits ${String(series.targets).padStart(4)} targets  shipped ${series.shippedObjects.length}  programs ${series.programs.length} checked ${series.checked.length}`);
  console.log(`JWST_LEDGER ${JSON.stringify({ observations: ledger.modes.reduce((total, mode) => total + mode.observations, 0), shippedObjects: ledger.objects.length })}`);
  if (args.includes('--write')) {
    const data = resolve(REPOSITORY, 'data/jwst/ledger.json'); await mkdir(dirname(data), { recursive: true });
    await writeFile(data, `${JSON.stringify(ledger, null, 1)}\n`); await writeFile(resolve(REPOSITORY, 'docs/jwst-ledger.md'), ledgerGuide(ledger));
  }
  const targets = args.indexOf('--targets');
  if (targets >= 0) {
    const byTarget = new Map<string, { target: string; mode: string; observations: number; programmes: Set<string>; objects: string[] }>();
    for (const row of rows) { const key = `${row.mode}|${row.target}`, entry = byTarget.get(key) ?? { target: row.target, mode: row.mode, observations: 0, programmes: new Set<string>(), objects: matchTarget(row, objects) }; entry.observations++; entry.programmes.add(row.programme); byTarget.set(key, entry); }
    await writeFile(resolve(args[targets + 1]!), `${JSON.stringify([...byTarget.values()].map(entry => ({ ...entry, programmes: [...entry.programmes] })), null, 1)}\n`);
  }
}
