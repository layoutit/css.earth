#!/usr/bin/env node
/** Pin one night of NACO jitter imaging and the calibration frames its reduction needs, as a NACO program.
 *
 *   node tools/objects/naco/archive.mts <program id> <prog_id> <object> [--night YYYY-MM-DD]
 *
 * NACO is `NAOS+CONICA` in the ESO archive's raw table, not `NACO`; `instrument = 'NACO'` returns nothing. A program records
 * one night's science exposures and, from the archive's own calibration association tree, the darks and flats ESO associates
 * with them. Every file is recorded by its `dp_id` and its byte count.
 *
 * The night is grouped by observing template (`tpl_start`), because that is how NACO was commanded and it is not the same as
 * the night: the Ceres night of 11 November 2007 is three templates — two of twenty object frames each and one of nine sky
 * frames — not one sequence of forty-nine. Each object template is a jitter sequence of its own, reduced on its own with the
 * night's sky frames. Two object templates of one night, one setup and one target are what this route compares.
 *
 * Byte counts come from a range request, so nothing is downloaded to pin it. What the observation is — instrument, technique,
 * filter, integration time, template, programme, release date — comes from the raw table and is checked against the frame's
 * own primary header from the archive's header service: a disagreement stops the pin, as it does for the Hubble route.
 *
 * The archive access is this repository's own: `PyVO`, `archiveHeader` and `rawFrame` from the interferometry
 * modules, and `associationTree` for the calibration tree. Nothing here repeats them.
 *
 * The program is written to tools/objects/naco/programs/<program id>.json. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { archiveHeader, column, type RawRow } from '../interferometry/eso-pipeline.mts';
import { associationTree, type Association } from '../interferometry/eso-associations.mts';
import { tapRows } from '@cssearth/telescope/node';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
export const SCHEMA = 'cssearth-naco-program@1';
export const INSTRUMENT = 'NAOS+CONICA';
export const TAP = 'https://archive.eso.org/tap_obs';
export const PORTAL = 'https://dataportal.eso.org/dataPortal/file';

const ID = /^[A-Za-z0-9._-]+$/u;
export const DP_ID = /^NACO\.\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/u;

/** The raw-table columns a program records. Read by name, so the saved CSV of a fixture is the archive's own text. */
export const COLUMNS = ['dp_id', 'dp_cat', 'dp_tech', 'dp_type', 'object', 'filter_path', 'det_dit', 'det_ndit', 'exposure',
  'exp_start', 'tpl_start', 'tpl_id', 'prog_id', 'release_date', 'instrument'] as const;

/** An ADQL query against the raw table. PyVO owns TAP and VOTable parsing. */
export async function rawQuery(query: string) {
  return tapRows(TAP, query);
}

const literal = (value: string) => {
  if (!/^[A-Za-z0-9 ()+._:-]+$/u.test(value)) throw new TypeError(`${value} is not a name this query may carry.`);
  return `'${value}'`;
};

/** Every raw frame of one programme and target, science and acquisition alike, in dp_id order. */
export async function programmeFrames(progId: string, object: string) {
  const query = `SELECT ${COLUMNS.join(', ')} FROM dbo.raw WHERE instrument = ${literal(INSTRUMENT)}`
    + ` AND prog_id = ${literal(progId)} AND object = ${literal(object)} ORDER BY dp_id`;
  const rows = await rawQuery(query);
  if (!rows.length) throw new Error(`No NACO frames for ${progId} on ${object}.`);
  return rows;
}

/** The byte count the data portal serves for a frame, from a one-byte range request. */
export async function frameBytes(dpId: string) {
  if (!DP_ID.test(dpId)) throw new TypeError(`${dpId} is not a NACO frame id.`);
  const response = await fetch(`${PORTAL}/${dpId}`, { headers: { Range: 'bytes=0-0' } });
  if (!response.ok) throw new Error(`${dpId}: the ESO data portal answered ${response.status}.`);
  await response.body?.cancel();
  const range = response.headers.get('content-range');
  const total = range ? /\/(\d+)$/u.exec(range)?.[1] : response.headers.get('content-length');
  if (!total) throw new Error(`${dpId}: the data portal stated no size.`);
  return Number(total);
}

export interface NacoFrame {
  readonly dpId: string;
  /** SCIENCE, CALIB or ACQUISITION, as the raw table states it. */
  readonly category: string;
  /** The tag the recipes read this frame under (NACO_IMG_JITTER_OBJ, NACO_CALIB_DARK...). */
  readonly tag: string;
  readonly type: string;
  readonly technique: string;
  readonly filter: string;
  readonly dit: number;
  readonly ndit: number;
  readonly exposure: number;
  readonly start: string;
  /** The tpl_start of the observing template that took this frame. A NACO night commands object frames and sky frames as
   * separate templates, so this is what groups a jitter sequence, not the night. */
  readonly template: string;
  readonly bytes: number;
}

export interface NacoProgram {
  readonly schema: typeof SCHEMA;
  readonly program: string;
  readonly instrument: typeof INSTRUMENT;
  readonly programme: string;
  readonly object: string;
  /** What the pipeline does with this night: one program is one mode. */
  readonly mode: NacoMode;
  /** The observing night, as the date of the first science frame. */
  readonly night: string;
  readonly templateId: string;
  /** The templates that took object frames, in time order: each is a jitter sequence reduced on its own. */
  readonly objectTemplates: readonly string[];
  /** The templates that took sky frames. Every one of their frames goes into every object template's reduction. */
  readonly skyTemplates: readonly string[];
  readonly releaseDate: string;
  readonly pipeline: { readonly version: string; readonly kit: string };
  readonly science: readonly NacoFrame[];
  readonly calibration: readonly NacoFrame[];
  /** The telluric standard-star nod set the archive associates with this night, empty when there is none. A point source
   * through the same slit and grism: the reference that says whether the target is resolved. */
  readonly standard: readonly NacoFrame[];
  /** The calselector association categories the calibration frames came from, in tree order. */
  readonly associations: readonly string[];
  /** Whether the archive associates any arc frames with this night. Without them no wavelength calibration can be run. */
  readonly arcs: boolean;
}

/** What the pipeline does with a template. NACO's raw table states a technique, not a mode; these are the two this route
 * reduces, and anything else is refused by name rather than half-reduced. */
export const MODES = ['imaging', 'spectroscopy'] as const;
export type NacoMode = (typeof MODES)[number];

/** Technique words this route refuses, each for a reason given in `REFUSAL_REASONS`. Most of them change what a frame means
 * and these recipes do not undo it: `naco_img_jitter` would combine a masking or coronagraphic sequence without complaint and
 * the product would look right and mean nothing. `CUBE` is refused for the other reason — nothing here has measured it.
 *
 * `PT` and `NOAO` are not here: they say how the frames were guided, not what they mean. */
export const REFUSED_TECHNIQUES = ['SAM', 'SAMPOL', 'SDI4', 'APP', 'CORONOGRAPHY', 'DIFFERENTIAL', 'FABRY-PEROT', 'CHOPPING', 'CUBE'] as const;

/** Why each refused technique is refused, so the message a caller sees is the reason and not just a name. */
export const REFUSAL_REASONS: Readonly<Record<string, string>> = {
  SAM: 'a sparse-aperture-masking frame is an interference pattern, not an image of the sky',
  SAMPOL: 'a polarimetric masking frame is an interference pattern, not an image of the sky',
  SDI4: 'a simultaneous-differential-imaging frame carries four channels on one detector',
  APP: 'an apodising-phase-plate frame has a deliberately shaped point-spread function',
  CORONOGRAPHY: 'a coronagraphic frame has its target occulted',
  DIFFERENTIAL: 'a differential-imaging frame is two bands that must be differenced, not combined',
  'FABRY-PEROT': 'a Fabry-Perot frame is one narrow wavelength of a scan',
  CHOPPING: 'a chopped frame is differenced in the detector, not by the jitter recipe',
  // Cube mode is a storage form, not a different measurement, and `naco_img_jitter` carries a cube path. It is refused here
  // for a different reason: that path has never been run in this repository, so nothing measured backs it. Removing it from
  // this list is all it takes to try, and a receipt is what would let it stay removed.
  CUBE: 'cube mode is stored as thousands of short exposures per file and this route has never run the recipe cube path, so'
    + ' no measurement here backs it',
};

/** The mode of a science row, or a refusal naming what it is. */
export function modeOf(row: RawRow): NacoMode {
  const technique = column(row, 'dp_tech'), words = technique.split(',');
  const refused = REFUSED_TECHNIQUES.filter(word => words.includes(word));
  if (refused.length) {
    throw new Error(`${column(row, 'dp_id')} is ${technique}: this route refuses it because `
      + `${refused.map(word => REFUSAL_REASONS[word]!).join('; and because ')}.`);
  }
  if (words.includes('JITTER') && (words.includes('IMAGE') || words.includes('POLARIMETRY'))) return 'imaging';
  if (words.includes('SPECTRUM') && words.includes('NODDING')) return 'spectroscopy';
  throw new Error(`${column(row, 'dp_id')} is ${technique}: this route reduces imaging jitter and nodded`
    + ' spectroscopy, and refuses every other NACO mode rather than reducing it without a check.');
}

/** How the raw table's technique and type name the frame to the recipes. A NACO jitter sequence is object frames and sky
 * frames of the same template; the archive distinguishes them by dp_type, not by technique.
 *
 * The tags are the pipeline's own, from naco/naco_dfs.h of the pinned kit: NACO_IMG_JITTER_OBJ is the string "IM_JITTER_OBJ",
 * not "NACO_IMG_JITTER_OBJ". The C identifier and the tag differ, and it is the tag that goes in the set-of-frames. */
export function scienceTag(row: RawRow) {
  const words = column(row, 'dp_tech').split(','), type = column(row, 'dp_type');
  if (modeOf(row) === 'spectroscopy') return 'SPEC_NODDING';
  if (words.includes('POLARIMETRY')) return type === 'SKY' ? 'POL_JITTER_SKY' : 'POL_JITTER_OBJ';
  return type === 'SKY' ? 'IM_JITTER_SKY' : 'IM_JITTER_OBJ';
}

/** The raw calibration categories this route reduces. The archive's calselector files a calibration frame under the very
 * string the recipes read it as — CAL_DARK is both the association category and NACO_IMG_DARK_RAW's tag — so a calibration
 * frame needs no translation, only a decision about whether this route reduces it. CAL_FLAT_SPEC and the arc frames belong to
 * the spectroscopy recipes, which are not run here. */
export const CALIBRATION_TAGS: Readonly<Record<string, string>> = {
  CAL_DARK: 'CAL_DARK',
  CAL_FLAT_TW: 'CAL_FLAT_TW',
  CAL_FLAT_LAMP: 'CAL_FLAT_LAMP',
  CAL_FLAT_SPEC: 'CAL_FLAT_SPEC',
  CAL_ARC_SPEC: 'CAL_ARC_SPEC',
};

/** Every file of an association tree, with the category it was filed under, deepest last and each name once. */
export function treeFiles(tree: Association) {
  const files = new Map<string, string>(), categories: string[] = [];
  const walk = (node: Association) => {
    if (!categories.includes(node.category)) categories.push(node.category);
    for (const file of node.files) if (!files.has(file.name)) files.set(file.name, file.category);
    for (const child of node.children) walk(child);
  };
  walk(tree);
  return { files, categories };
}

/** The association categories the jitter run reduces, as direct children of the science association. */
export const DARK_ASSOCIATION = 'DARK';
export const FLAT_ASSOCIATIONS: Readonly<Record<NacoMode, readonly string[]>> = {
  imaging: ['TIMGFLAT', 'LIMGFLAT'],
  spectroscopy: ['LSPECFLAT'],
};
/** The arc association a wavelength calibration would need, and the standard-star association a telluric correction would. */
export const ARC_ASSOCIATION = 'WAVECAL';
export const STANDARD_ASSOCIATION = 'STDSPECNOD';

/** The calibration a mode's recipes need, and only that.
 *
 * A NACO science association carries more than its own calibration. The Ceres tree of 2007-11-11 hangs seven `STDIMG`
 * photometric-standard subtrees under the science association, each with its own darks and flats: those belong to
 * `naco_img_zpoint`, a recipe this route does not run, and taking every file the tree names would have pinned 128 frames
 * instead of 37. What is taken is the science association's own `DARK` child, its own flat child (`TIMGFLAT` or `LIMGFLAT`
 * for imaging, `LSPECFLAT` for spectroscopy), and the darks that flat association names for itself, because the flat recipe
 * subtracts a dark of its own.
 *
 * Two more things are reported rather than taken. `arcs` is whether the tree names a wavelength-calibration association: the
 * Europa nights of 088.C-0833(B) name none, so `naco_spc_wavecal` has nothing to run on there and the reduction says so
 * instead of inventing a dispersion. `standard` is the telluric standard-star nod set, which is a point source taken through
 * the same slit and grism minutes later — this route reduces it beside the science frames, because it is what tells a
 * resolved target from an unresolved one. */
export function calibrationFor(tree: Association, mode: NacoMode) {
  const files = new Map<string, string>(), used: string[] = [];
  const take = (node: Association) => {
    used.push(node.category);
    for (const file of node.files) if (file.category in CALIBRATION_TAGS && !files.has(file.name)) files.set(file.name, file.category);
  };
  const darks = tree.children.filter(child => child.category === DARK_ASSOCIATION);
  const wanted = FLAT_ASSOCIATIONS[mode];
  const flatCategory = wanted.find(category => tree.children.some(child => child.category === category));
  const flats = flatCategory ? tree.children.filter(child => child.category === flatCategory) : [];
  if (!darks.length) throw new Error(`The association tree of this ${tree.category} names no ${DARK_ASSOCIATION} child.`);
  if (!flats.length) throw new Error(`The association tree of this ${tree.category} names no ${wanted.join(' or ')} child.`);
  for (const node of [...darks, ...flats]) {
    take(node);
    // A flat association names the dark it is itself corrected with; a dark association has no children that matter here.
    for (const child of node.children) if (child.category === DARK_ASSOCIATION) take(child);
  }
  const arcs = tree.children.some(child => child.category === ARC_ASSOCIATION)
    || [...files.values()].includes('CAL_ARC_SPEC');
  const standard = tree.children.filter(child => child.category === STANDARD_ASSOCIATION)
    .flatMap(child => child.files.filter(file => file.category === 'SPEC_NODDING').map(file => file.name));
  return { files, associations: [...new Set(used)], arcs, standard: [...new Set(standard)].sort() };
}

/** The raw table's account of a frame, checked against the frame's own primary header. */
async function checkedFrame(row: RawRow, tag: string, headers: string) {
  const dpId = column(row, 'dp_id');
  const header = await archiveHeader(dpId, headers);
  const stated: readonly (readonly [string, string, string | number | boolean | undefined])[] = [
    ['instrument', INSTRUMENT, header.INSTRUME],
    ['dp_cat', column(row, 'dp_cat'), header['ESO DPR CATG']],
    ['dp_tech', column(row, 'dp_tech'), header['ESO DPR TECH']],
    ['dp_type', column(row, 'dp_type'), header['ESO DPR TYPE']],
  ];
  for (const [name, table, card] of stated) {
    if (card === undefined) throw new Error(`${dpId}: the archive header states no ${name}.`);
    if (String(card) !== table) throw new Error(`${dpId}: the raw table says ${name} is ${table}, its header says ${String(card)}.`);
  }
  const number = (name: string) => { const value = Number(column(row, name)); if (!Number.isFinite(value)) throw new Error(`${dpId}: ${name} is not a number.`); return value; };
  return {
    dpId, category: column(row, 'dp_cat'), tag, type: column(row, 'dp_type'), technique: column(row, 'dp_tech'),
    filter: column(row, 'filter_path'), dit: number('det_dit'), ndit: number('det_ndit'), exposure: number('exposure'),
    start: column(row, 'exp_start'), template: column(row, 'tpl_start'), bytes: await frameBytes(dpId),
  } satisfies NacoFrame;
}

/** The templates of one night that took object frames and those that took sky frames, in time order. */
export function templatesOf(science: readonly RawRow[]) {
  const group = (type: (value: string) => boolean) => [...new Set(science.filter(row => type(column(row, 'dp_type'))).map(row => column(row, 'tpl_start')))].sort();
  return { objectTemplates: group(type => type !== 'SKY'), skyTemplates: group(type => type === 'SKY') };
}

/** Pin one night of a programme: its science frames and the calibration frames the archive associates with the first one. */
export async function pinProgram(program: string, progId: string, object: string, work: string, night?: string): Promise<NacoProgram> {
  if (!ID.test(program)) throw new TypeError(`${program} is not a program id.`);
  const rows = await programmeFrames(progId, object);
  const allScience = rows.filter(row => column(row, 'dp_cat') === 'SCIENCE');
  if (!allScience.length) throw new Error(`${progId} on ${object} has no science frames.`);
  const nights = [...new Set(allScience.map(row => column(row, 'exp_start').slice(0, 10)))].sort();
  const chosenNight = night ?? (nights.length === 1 ? nights[0]! : undefined);
  if (!chosenNight) throw new Error(`${progId} on ${object} spans ${nights.length} nights; name one with --night: ${nights.join(' ')}`);
  if (!nights.includes(chosenNight)) throw new Error(`${chosenNight} is not a night of ${progId} on ${object}: ${nights.join(' ')}`);
  const chosenRows = allScience.filter(row => column(row, 'exp_start').startsWith(chosenNight));
  const modes = [...new Set(chosenRows.map(modeOf))];
  if (modes.length !== 1) throw new Error(`${progId} on ${object} took ${modes.join(' and ')} on ${chosenNight}; a program is one mode.`);
  const mode = modes[0]!;
  const { objectTemplates, skyTemplates } = templatesOf(chosenRows);
  if (!objectTemplates.length) throw new Error(`${progId} on ${object} took no object frames on ${chosenNight}.`);
  const headers = resolve(work, 'headers');
  await mkdir(headers, { recursive: true });

  const scienceFrames: NacoFrame[] = [];
  for (const row of chosenRows) scienceFrames.push(await checkedFrame(row, scienceTag(row), headers));

  const tree = await associationTree(scienceFrames[0]!.dpId, work);
  const { files, associations, arcs, standard } = calibrationFor(tree, mode);
  const byId = new Map(rows.map(row => [column(row, 'dp_id'), row]));
  const row = async (name: string) => byId.get(name) ?? (await calibrationRow(name));
  const calibration: NacoFrame[] = [];
  for (const [name, category] of files) calibration.push(await checkedFrame(await row(name), CALIBRATION_TAGS[category]!, headers));
  calibration.sort((a, b) => a.dpId.localeCompare(b.dpId));
  // The telluric standard is a science-shaped nod set of its own: same slit, same grism, a point source. It is pinned with
  // the tag the spectroscopy recipe reads so it can be reduced exactly as the target is.
  const standardFrames: NacoFrame[] = [];
  for (const name of standard) standardFrames.push(await checkedFrame(await row(name), 'SPEC_NODDING', headers));

  const { entry } = await import('./toolchain.mts').then(module => module.nacoToolchainDescriptor());
  const releaseDates = [...new Set(chosenRows.map(item => column(item, 'release_date')))].sort();
  return {
    schema: SCHEMA, program, instrument: INSTRUMENT, programme: progId, object, mode, night: chosenNight,
    templateId: column(chosenRows[0]!, 'tpl_id'), objectTemplates, skyTemplates, releaseDate: releaseDates.at(-1)!,
    pipeline: { version: requireString(entry.version, 'pipeline version'), kit: requireString(entry.kit, 'kit') },
    science: scienceFrames, calibration, standard: standardFrames, associations, arcs,
  };
}

/** A calibration frame's own raw-table row, which its science programme's query does not hold. */
async function calibrationRow(dpId: string) {
  if (!DP_ID.test(dpId)) throw new TypeError(`${dpId} is not a NACO frame id.`);
  const rows = await rawQuery(`SELECT ${COLUMNS.join(', ')} FROM dbo.raw WHERE dp_id = ${literal(dpId)}`);
  if (rows.length !== 1) throw new Error(`${rows.length} raw-table rows for ${dpId}.`);
  return rows[0]!;
}

export const programPath = (program: string) => resolve(PROGRAMS, `${program}.json`);

export async function writeProgram(value: NacoProgram) {
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(programPath(value.program), `${JSON.stringify(value, null, 2)}\n`);
  return programPath(value.program);
}

/** A pinned program, with every field checked rather than asserted. */
export async function readProgram(program: string): Promise<NacoProgram> {
  const record = requireRecord(JSON.parse(await readFile(programPath(program), 'utf8')) as unknown, `program ${program}`);
  if (record.schema !== SCHEMA) throw new TypeError(`${program} states schema ${String(record.schema)}, not ${SCHEMA}.`);
  if (record.instrument !== INSTRUMENT) throw new TypeError(`${program} states instrument ${String(record.instrument)}.`);
  const frames = (value: unknown, label: string): NacoFrame[] => requireArray(value, label).map(item => {
    const frame = requireRecord(item, `${label} entry`);
    const dpId = requireString(frame.dpId, 'dpId');
    if (!DP_ID.test(dpId)) throw new TypeError(`${dpId} is not a NACO frame id.`);
    return {
      dpId, category: requireString(frame.category, 'category'), tag: requireString(frame.tag, 'tag'),
      type: requireString(frame.type, 'type'), technique: requireString(frame.technique, 'technique'),
      filter: requireString(frame.filter, 'filter'), dit: requireFiniteNumber(frame.dit, 'dit'),
      ndit: requireFiniteNumber(frame.ndit, 'ndit'), exposure: requireFiniteNumber(frame.exposure, 'exposure'),
      start: requireString(frame.start, 'start'), template: requireString(frame.template, 'template'),
      bytes: requireFiniteNumber(frame.bytes, 'bytes'),
    };
  });
  const pipeline = requireRecord(record.pipeline, 'pipeline');
  return {
    schema: SCHEMA, program: requireString(record.program, 'program'), instrument: INSTRUMENT,
    programme: requireString(record.programme, 'programme'), object: requireString(record.object, 'object'),
    mode: requireMode(record.mode), night: requireString(record.night, 'night'), templateId: requireString(record.templateId, 'templateId'),
    objectTemplates: requireArray(record.objectTemplates, 'objectTemplates').map(value => requireString(value, 'template')),
    skyTemplates: requireArray(record.skyTemplates, 'skyTemplates').map(value => requireString(value, 'template')),
    releaseDate: requireString(record.releaseDate, 'releaseDate'),
    pipeline: { version: requireString(pipeline.version, 'pipeline version'), kit: requireString(pipeline.kit, 'kit') },
    science: frames(record.science, 'science'), calibration: frames(record.calibration, 'calibration'),
    standard: frames(record.standard ?? [], 'standard'),
    associations: requireArray(record.associations, 'associations').map(value => requireString(value, 'association')),
    arcs: record.arcs === true,
  };
}

function requireMode(value: unknown): NacoMode {
  const mode = requireString(value, 'mode');
  if (!(MODES as readonly string[]).includes(mode)) throw new TypeError(`${mode} is not a NACO mode this route reduces.`);
  return mode as NacoMode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [program, progId, object, ...rest] = process.argv.slice(2);
  const nightIndex = rest.indexOf('--night');
  if (!program || !progId || !object) throw new TypeError('Usage: archive <program id> <prog_id> <object> [--night YYYY-MM-DD]');
  const work = resolve(`.local/naco/${program}`);
  const pinned = await pinProgram(program, progId, object, work, nightIndex < 0 ? undefined : rest[nightIndex + 1]);
  const path = await writeProgram(pinned);
  const bytes = [...pinned.science, ...pinned.calibration, ...pinned.standard].reduce((total, frame) => total + frame.bytes, 0);
  console.error(`${path}: ${pinned.mode}, ${pinned.science.length} science frames in ${pinned.objectTemplates.length} object and`
    + ` ${pinned.skyTemplates.length} sky templates, ${pinned.calibration.length} calibration and ${pinned.standard.length} standard frames,`
    + ` ${(bytes / 1024 ** 2).toFixed(1)} MiB${pinned.arcs ? '' : ', no arcs'}.`);
}
