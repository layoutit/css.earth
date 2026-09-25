#!/usr/bin/env node
/** The archive's own final product of an observation a retired instrument took, pinned and read here.
 *
 *   node tools/objects/hst/archive-final.mts <program id> <work directory> [--raw <dir>]...
 *
 * Hubble's retired instruments cannot be re-calibrated here: their pipelines are not in the pinned toolchain, and STScI has
 * frozen their calibration. That is one fact about this repository. It is not the same fact as whether usable observations
 * exist, and the two must never be merged: the archive still distributes a complete calibrated product for each of those
 * observations, and says so plainly. "Data from HST legacy instruments are preserved in a static form, and there are no plans
 * to regularly reprocess these data... For ACS/HRC, FOC, FOS, GHRS, NICMOS, and WFPC2, no further improvements in the
 * calibration for these instruments are expected. The user is provided with a copy of the raw and final calibrated data from
 * the archive once a request is made."
 * (https://hst-docs.stsci.edu/hstdhb/1-obtaining-hst-data/1-1-archive-overview)
 *
 * So this stage pins the COMPLETE scientific product of ONE observation and reads every part of it:
 *
 * - **science**: the calibrated values themselves;
 * - **coordinates**: the wavelength array of a spectrum, or the world coordinate system a picture carries in its own header;
 * - **uncertainty**: the propagated statistical error, where the archive supplies one;
 * - **quality**: the per-sample data-quality flags.
 *
 * A part the archive does not supply is recorded as missing with the reason, never left out in silence: calwp2 writes no error
 * array at all, and a WFPC2 program therefore states `uncertainty: supplied false` and why.
 *
 * Beside the parts it pins the identity of the observation, and the run refuses to pin anything it cannot agree on. What MAST's
 * catalogue says about the observation and what the files' own headers say are compared field by field (instrument,
 * configuration, optical element, aperture, target, proposal, exposure start and end); a disagreement stops the run rather than
 * being reported. Whatever calibration provenance the headers carry is recorded too: the archive's own calibration version, its
 * reference files and its calibration switches. That is provenance of the file, not software that ran here.
 *
 * The legacy instruments store these products in "waivered" FITS, the format STScI made to carry a GEIS group image in one
 * file: the science values sit in the PRIMARY unit, the GEIS groups are its second axis, and the group parameters follow in a
 * table extension. WFPC2 is also distributed as ordinary multi-extension FITS, one 800 by 800 chip per extension, which is the
 * form pinned here. Both are read by this repository's own FITS reader; a unit this reader cannot read stops the run and says
 * why, and nothing is inferred around it.
 *
 * WHAT RUNNING THIS ESTABLISHES, AND WHAT IT DOES NOT. Retrieval establishes origin and integrity: these bytes are the
 * archive's own final product, at the size and sha256 recorded. It is written as `archive-origin` evidence and never as
 * `archive-agreement`, and it is not a successful local re-calibration anywhere: nothing here re-ran anyone's pipeline and
 * nothing was compared against anything.
 *
 * The record of the run is written beside the downloaded products, which are not committed, and a copy is committed beside the
 * program as `<program id>.archive-final.product.json`, so the ledger can read what was pinned without holding the files. */
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '@cssearth/core/node';
import { positionalArguments, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import type { FitsHeader } from '@cssearth/fits';
import { readFitsFileRegion, type FitsFileHdu } from '@cssearth/fits/node';
import { mastFile, mastRequest, type MastFile } from '@cssearth/telescope/node';
import { assertInputPins, writeProductRecord } from '@cssearth/telescope/node';
import { productRecordPath, type ProductEvidence, type ProductInput, type ProductRecord, type ProductRun } from '@cssearth/telescope';
import { PROGRAMS } from './archive.mts';
import { readHstFileHdus, type HstFileHdu } from './product-file.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');
export const ARCHIVE_FINAL_SCHEMA = 'cssearth-hst-archive-final@1';
/** The stage a product record carries for a file this repository did not make. */
export const ARCHIVE_FINAL_STAGE = 'archive-final';
export const ARCHIVE_FINAL_TELESCOPE = 'Hubble';
export const ARCHIVE_OVERVIEW = 'https://hst-docs.stsci.edu/hstdhb/1-obtaining-hst-data/1-1-archive-overview';
/** The four parts of a complete scientific product. `coordinates` is a wavelength array or a world coordinate system. */
export const ARCHIVE_FINAL_ROLES = ['science', 'coordinates', 'uncertainty', 'quality'] as const;
export type ArchiveFinalRole = typeof ARCHIVE_FINAL_ROLES[number];
export const ARCHIVE_FINAL_KINDS = ['image', 'spectrum'] as const;
export type ArchiveFinalKind = typeof ARCHIVE_FINAL_KINDS[number];

/** No unit larger than this is read whole; a WFPC2 chip is 640,000 samples. */
const MAX_SAMPLES = 8 * 1024 * 1024;
const NAME = /^[A-Za-z0-9._-]+$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
/** A reference file is written as an IRAF path: `uref$m3c1004mu.r4h`, `ytab$l611655oy.cy6`. */
const REFERENCE_VALUE = /^[A-Za-z][A-Za-z0-9]*\$\S/u;
/** One second, as a fraction of a day: MAST's catalogue and a header state the same epoch to about this. */
const EPOCH_TOLERANCE_DAYS = 1 / 86_400;

/** Which cards state an observation's identity, per instrument. The catalogue is the other side of every comparison, so this
 * map is the tool's, not a program's: a program states the values, never where to read them. */
const IDENTITY_CARDS: Readonly<Record<string, { readonly detector: readonly string[]; readonly opticalElement: readonly string[]; readonly aperture: readonly string[] }>> = {
  WFPC2: { detector: ['DETECTOR'], opticalElement: ['FILTNAM1', 'FILTNAM2'], aperture: ['APERTURE'] },
  FOS: { detector: ['DETECTOR'], opticalElement: ['FGWA_ID'], aperture: ['APER_ID'] },
  HRS: { detector: ['DETECTOR'], opticalElement: ['GRATING'], aperture: ['APERTURE'] },
};
/** Where each instrument records the version of the calibration that made these files. */
const CALIBRATION_VERSION_CARDS = ['CAL_VER', 'OPUS_VER', 'CALHRS', 'CALFOS', 'CALWP2'] as const;
/** How an HST pipeline states that a step was asked for, left out, or done. */
const SWITCH_WORDS = new Set(['PERFORM', 'OMIT', 'COMPLETE', 'COMPLETED', 'SKIPPED']);
/** When the archive wrote these files, which is all a legacy product says about when it was calibrated. */
const CALIBRATION_DATE_CARDS = ['DATE', 'FITSDATE', 'DADSDATE', 'PROCTIME', 'ORIGIN'] as const;
/** A/D converter saturation in a WFPC2 data quality file: "The actual signal is unrecoverable but known to exceed the A/D
 * full-scale signal (4095)" (table 3.4 of https://www.stsci.edu/instruments/wfpc2/Wfpc2_dhb/wfpc2_ch34.html). */
export const WFPC2_SATURATION_FLAG = 8;

export interface ArchiveFinalComponent {
  readonly role: ArchiveFinalRole;
  readonly supplied: boolean;
  /** The pinned file this part is in, when it has one of its own. */
  readonly file?: string;
  /** The pinned file whose headers carry this part, when it is not a file (a picture's world coordinate system). */
  readonly carriedBy?: string;
  /** Zero-based unit of that file: the PRIMARY of a waivered product, one chip's extension of a multi-extension one. */
  readonly hdu?: number;
  readonly units?: string;
  /** Why the archive supplies nothing for this part. The one thing a missing part may never be is absent. */
  readonly reason?: string;
  readonly note?: string;
}
export interface ArchiveFinalIdentity {
  readonly instrument: string; readonly detector: string; readonly opticalElement: string; readonly aperture: string;
  /** What the instrument's own card calls the optical element, where that is not what the catalogue calls it: the FOS wheel
   * records `H27` for the grating the catalogue lists as `G270H`. Both sides are pinned, and neither is translated. */
  readonly headerOpticalElement?: string;
  readonly targetName: string; readonly proposal: string;
  readonly exposureStartMjd: number; readonly exposureEndMjd: number;
}
export interface ArchiveFinalProgram {
  readonly schema: typeof ARCHIVE_FINAL_SCHEMA;
  readonly id: string;
  /** CAOM's own name for the configuration (`WFPC2/PC`, `FOS/BL`, `HRS/1`): the ledger keys on it. */
  readonly configuration: string;
  readonly observation: string;
  readonly target: string;
  readonly kind: ArchiveFinalKind;
  /** The instrument handbook page that says what this product's file set is. */
  readonly handbook: string;
  readonly identity: ArchiveFinalIdentity;
  readonly components: readonly ArchiveFinalComponent[];
  readonly files: readonly MastFile[];
  readonly note?: string;
}

const trimmed = (value: unknown) => typeof value === 'string' ? value.trim() : value === undefined ? '' : String(value).trim();

export function parseArchiveFinalProgram(value: unknown, label = 'archive-final program'): ArchiveFinalProgram {
  const row = requireRecord(value, label);
  if (row.schema !== ARCHIVE_FINAL_SCHEMA) throw new TypeError(`${label}: ${String(row.schema)} is not an archive-final program.`);
  const observation = requireString(row.observation, `${label}: observation`);
  if (!/^[a-z0-9]{9}$/u.test(observation)) throw new TypeError(`${label}: ${observation} is not an HST observation id.`);
  const kind = requireString(row.kind, `${label}: kind`);
  if (!(ARCHIVE_FINAL_KINDS as readonly string[]).includes(kind)) throw new TypeError(`${label}: ${kind} is not an archive-final kind.`);
  const identityRow = requireRecord(row.identity, `${label}: identity`);
  const identity: ArchiveFinalIdentity = {
    instrument: requireString(identityRow.instrument, `${label}: instrument`), detector: requireString(identityRow.detector, `${label}: detector`),
    opticalElement: requireString(identityRow.opticalElement, `${label}: optical element`), aperture: requireString(identityRow.aperture, `${label}: aperture`),
    targetName: requireString(identityRow.targetName, `${label}: target name`), proposal: requireString(identityRow.proposal, `${label}: proposal`),
    exposureStartMjd: requireFiniteNumber(identityRow.exposureStartMjd, `${label}: exposure start`), exposureEndMjd: requireFiniteNumber(identityRow.exposureEndMjd, `${label}: exposure end`),
    ...(identityRow.headerOpticalElement === undefined ? {} : { headerOpticalElement: requireString(identityRow.headerOpticalElement, `${label}: header optical element`) }),
  };
  if (!(identity.exposureEndMjd >= identity.exposureStartMjd)) throw new TypeError(`${label}: the exposure ends before it starts.`);
  if (!IDENTITY_CARDS[identity.instrument]) throw new TypeError(`${label}: ${identity.instrument} has no identity cards here (${Object.keys(IDENTITY_CARDS).join(', ')}).`);
  const files = requireArray(row.files, `${label}: files`).map((raw, index) => {
    const entry = requireRecord(raw, `${label}: file ${index}`), name = requireString(entry.name, `${label}: file name`);
    const bytes = requireFiniteNumber(entry.bytes, `${label}: ${name} bytes`), uri = requireString(entry.uri, `${label}: ${name} uri`);
    if (!NAME.test(name) || uri !== `mast:HST/product/${name}` || !Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`${label}: ${name} is not a MAST file.`);
    if (name.slice(0, name.lastIndexOf('_')) !== observation) throw new TypeError(`${label}: ${name} belongs to no exposure of ${observation}.`);
    if (entry.sha256 !== undefined && !HEX64.test(requireString(entry.sha256, `${label}: ${name} sha256`))) throw new TypeError(`${label}: ${name} has no sha256.`);
    return { name, uri, bytes, ...(entry.sha256 === undefined ? {} : { sha256: entry.sha256 as string }) };
  });
  if (new Set(files.map(file => file.name)).size !== files.length) throw new TypeError(`${label}: a file appears twice.`);
  const components = requireArray(row.components, `${label}: components`).map((raw, index) => {
    const entry = requireRecord(raw, `${label}: component ${index}`), role = requireString(entry.role, `${label}: component role`);
    if (!(ARCHIVE_FINAL_ROLES as readonly string[]).includes(role)) throw new TypeError(`${label}: ${role} is not a product part.`);
    const supplied = entry.supplied;
    if (typeof supplied !== 'boolean') throw new TypeError(`${label}: ${role} says neither supplied nor missing.`);
    const held = entry.file === undefined ? undefined : requireString(entry.file, `${label}: ${role} file`);
    const carriedBy = entry.carriedBy === undefined ? undefined : requireString(entry.carriedBy, `${label}: ${role} carrier`);
    if (supplied && (held === undefined) === (carriedBy === undefined)) throw new TypeError(`${label}: ${role} is supplied either as a file or carried by one, not both or neither.`);
    if (!supplied && (held !== undefined || carriedBy !== undefined)) throw new TypeError(`${label}: ${role} is missing and names a file.`);
    for (const named of [held, carriedBy]) if (named !== undefined && !files.some(file => file.name === named)) throw new TypeError(`${label}: ${role} names ${named}, which this program does not pin.`);
    // A part the archive does not supply is stated as missing WITH its reason. That is the whole point of listing it.
    if (!supplied && !trimmed(entry.reason)) throw new TypeError(`${label}: ${role} is missing and says no reason.`);
    const hdu = entry.hdu === undefined ? undefined : requireFiniteNumber(entry.hdu, `${label}: ${role} hdu`);
    if (hdu !== undefined && (!Number.isSafeInteger(hdu) || hdu < 0)) throw new TypeError(`${label}: ${role} names unit ${hdu}.`);
    return { role: role as ArchiveFinalRole, supplied, ...(held === undefined ? {} : { file: held }), ...(carriedBy === undefined ? {} : { carriedBy }),
      ...(hdu === undefined ? {} : { hdu }), ...(entry.units === undefined ? {} : { units: requireString(entry.units, `${label}: ${role} units`) }),
      ...(entry.reason === undefined ? {} : { reason: requireString(entry.reason, `${label}: ${role} reason`) }),
      ...(entry.note === undefined ? {} : { note: requireString(entry.note, `${label}: ${role} note`) }) };
  });
  for (const role of ARCHIVE_FINAL_ROLES) if (!components.some(component => component.role === role)) throw new TypeError(`${label}: nothing is said about ${role}.`);
  if (new Set(components.map(component => component.role)).size !== components.length) throw new TypeError(`${label}: a part appears twice.`);
  const science = components.find(component => component.role === 'science');
  if (!science?.supplied || !science.file) throw new TypeError(`${label}: a program pins the science values as a file of their own.`);
  return { schema: ARCHIVE_FINAL_SCHEMA, id: requireString(row.id, `${label}: id`), configuration: requireString(row.configuration, `${label}: configuration`),
    observation, target: requireString(row.target, `${label}: target`), kind: kind as ArchiveFinalKind, handbook: requireString(row.handbook, `${label}: handbook`),
    identity, components, files, ...(row.note === undefined ? {} : { note: requireString(row.note, `${label}: note`) }) };
}

export const archiveFinalPath = (id: string) => resolve(PROGRAMS, `${id}.archive-final.json`);
export const archiveFinalRecordPath = (id: string) => resolve(PROGRAMS, `${id}.archive-final.product.json`);
export const readArchiveFinalProgram = async (id: string): Promise<ArchiveFinalProgram> =>
  parseArchiveFinalProgram(JSON.parse(await readFile(archiveFinalPath(id), 'utf8')) as unknown, `${id}.archive-final.json`);

/** What MAST's catalogue says about an observation, as the three sides of the check need it. */
export interface CatalogueEntry {
  readonly observation: string; readonly configuration: string; readonly filters: string; readonly targetName: string;
  readonly proposal: string; readonly startMjd: number; readonly endMjd: number;
}

/** One header field of an observation, looked up in the unit that states it and then in the primary: a WFPC2 chip's DETECTOR is
 * a group keyword and lives in the extension, while its filter and exposure live in the primary. */
const card = (headers: readonly FitsHeader[], keys: readonly string[]) => {
  for (const header of headers) for (const key of keys) { const value = trimmed(header[key]); if (value !== '') return String(value); }
  return '';
};

/** The identity of an observation as its own files state it. */
export function headerIdentity(instrument: string, headers: readonly FitsHeader[]): ArchiveFinalIdentity {
  const cards = IDENTITY_CARDS[instrument];
  if (!cards) throw new Error(`${instrument} has no identity cards here (${Object.keys(IDENTITY_CARDS).join(', ')}).`);
  const start = card(headers, ['EXPSTART', 'TEXPSTRT']), end = card(headers, ['EXPEND', 'TEXPEND']);
  if (!start || !end) throw new Error(`${instrument}: the product's headers state no exposure start and end.`);
  return { instrument: card(headers, ['INSTRUME']), detector: card(headers, cards.detector), opticalElement: card(headers, cards.opticalElement),
    aperture: card(headers, cards.aperture), targetName: card(headers, ['TARGNAME']), proposal: String(Number(card(headers, ['PROPOSID']))),
    exposureStartMjd: Number(start), exposureEndMjd: Number(end) };
}

/** Every field on which MAST's catalogue, the pinned program and the files' own headers do not agree. An empty list is the only
 * state in which anything is pinned: a catalogue that describes another observation than the files means the pin is wrong, and
 * which of the two is right is not this stage's to decide. */
export function identityDisagreements(catalogue: CatalogueEntry, program: ArchiveFinalProgram, headers: ArchiveFinalIdentity): string[] {
  const said: string[] = [], pinned = program.identity;
  const text = (value: string) => value.trim().toUpperCase();
  const agree = (what: string, side: string, stated: string, expected: string) => {
    if (text(stated) !== text(expected)) said.push(`${what}: ${side} says ${stated.trim() || '(nothing)'}, the program pins ${expected.trim() || '(nothing)'}`);
  };
  if (catalogue.observation !== program.observation) said.push(`observation: the catalogue answered for ${catalogue.observation}, the program pins ${program.observation}`);
  agree('configuration', 'the catalogue', catalogue.configuration, program.configuration);
  agree('instrument', 'the catalogue', catalogue.configuration.split('/')[0] ?? '', pinned.instrument);
  agree('instrument', 'the headers', headers.instrument, pinned.instrument);
  // The catalogue lists the optical element by its own name, joined by semicolons where a configuration has more than one, and
  // the instrument's card may spell the same element differently; each side is checked against the side the program pins for it.
  for (const part of catalogue.filters.split(';').map(entry => entry.trim()).filter(Boolean)) agree('optical element', 'the catalogue', part, pinned.opticalElement);
  agree('optical element', 'the headers', headers.opticalElement, pinned.headerOpticalElement ?? pinned.opticalElement);
  agree('detector', 'the headers', headers.detector, pinned.detector);
  agree('aperture', 'the headers', headers.aperture, pinned.aperture);
  agree('target', 'the catalogue', catalogue.targetName, pinned.targetName);
  agree('target', 'the headers', headers.targetName, pinned.targetName);
  agree('proposal', 'the catalogue', catalogue.proposal, pinned.proposal);
  agree('proposal', 'the headers', headers.proposal, pinned.proposal);
  const epoch = (what: string, side: string, stated: number, expected: number) => {
    if (Math.abs(stated - expected) > EPOCH_TOLERANCE_DAYS) said.push(`${what}: ${side} says MJD ${stated}, the program pins ${expected}, apart by more than a second`);
  };
  epoch('exposure start', 'the catalogue', catalogue.startMjd, pinned.exposureStartMjd);
  epoch('exposure start', 'the headers', headers.exposureStartMjd, pinned.exposureStartMjd);
  epoch('exposure end', 'the catalogue', catalogue.endMjd, pinned.exposureEndMjd);
  epoch('exposure end', 'the headers', headers.exposureEndMjd, pinned.exposureEndMjd);
  return said;
}

/** What the archive's own calibration left in the headers: the version that ran, the switches it was set with, and the
 * reference files it chose. Provenance of the file, not software that ran here. */
export function archiveCalibration(headers: readonly FitsHeader[]) {
  const entries = headers.flatMap(header => Object.entries(header));
  const stated = (key: string) => entries.map(([name, value]) => name === key ? trimmed(value) : '').find(value => value !== '') ?? '';
  const version = Object.fromEntries(CALIBRATION_VERSION_CARDS.filter(key => stated(key) !== '').map(key => [key, String(stated(key))]));
  // A calibration switch is one of the pipeline's own words. A card whose name ends in CORR and whose value is a number is
  // something else (WFPC2 writes its zero point as ZP_CORR) and is not recorded as a step that ran.
  const switches = Object.fromEntries(entries.filter(([key, value]) => /CORR$/u.test(key) && SWITCH_WORDS.has(String(trimmed(value)).toUpperCase())).map(([key, value]) => [key, String(trimmed(value))]));
  const referenceFiles = Object.fromEntries(entries
    .filter(([key, value]) => typeof value === 'string' && trimmed(value) !== '' && (/(?:FILE|TAB)$/u.test(key) || REFERENCE_VALUE.test(value.trim())))
    .map(([key, value]) => [key, String(trimmed(value))]));
  const dates = Object.fromEntries(CALIBRATION_DATE_CARDS.filter(key => stated(key) !== '').map(key => [key, String(stated(key))]));
  // A version nobody wrote down is said to be missing, not left out: the WFPC2 products name calwp2 and OPUS, the FOS and GHRS
  // products name neither, and only the dates on which they were written.
  return { version, ...(Object.keys(version).length ? {} : { versionStated: false as const, versionMissing: 'These products carry no calibration-version card, so which version of the archive\'s pipeline made them is not stated in the files themselves; the dates below are when they were written.' }), dates, switches, referenceFiles };
}

/** A waivered product keeps its GEIS groups as the second axis of one unit and a multi-extension product keeps one detector per
 * extension. Both are read here as a samples-by-groups rectangle, which is the layout the bytes are already in: a one-axis unit
 * is one group and nothing is moved. A unit of any other rank is refused rather than flattened. */
export function rectangle(name: string, hdu: FitsFileHdu): FitsFileHdu & { readonly samples: number; readonly groups: number } {
  if (hdu.header.XTENSION !== undefined && hdu.header.XTENSION !== 'IMAGE') throw new Error(`${name}: ${String(hdu.header.XTENSION)} is not an image unit, so its samples are not read here.`);
  const [samples, groups = 1] = hdu.dimensions;
  if (samples === undefined || hdu.dimensions.length > 2) throw new Error(`${name}: ${hdu.dimensions.length} axes, which this stage does not read.`);
  if (samples * groups > MAX_SAMPLES) throw new Error(`${name}: ${samples * groups} samples, more than this stage reads.`);
  return { ...hdu, dimensions: [samples, groups], samples, groups };
}

/** Every sample of one unit, through the repository's own region reader. */
export async function readUnit(path: string, name: string, hdu: FitsFileHdu) {
  const rect = rectangle(name, hdu);
  const { values } = await readFitsFileRegion(path, rect, { x0: 0, y0: 0, width: rect.samples, height: rect.groups }, MAX_SAMPLES * 8);
  return { samples: rect.samples, groups: rect.groups, values };
}

const median = (values: readonly number[] | Float64Array): number => {
  const sorted = Float64Array.from(values).sort();
  return sorted.length ? sorted[sorted.length >> 1]! : Number.NaN;
};
const quantile = (values: Float64Array, q: number) => { const sorted = values.slice().sort(); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]! : Number.NaN; };

/** How many flags of each value a quality plane holds, and how much of it is flagged at all. Values are listed while there are
 * few enough to name; a plane with more distinct flags than that reports how many rather than a table nobody reads. */
export function qualitySummary(values: Float64Array, limit = 16) {
  const counts = new Map<number, number>();
  let flagged = 0;
  for (const value of values) { if (value !== 0) flagged++; counts.set(value, (counts.get(value) ?? 0) + 1); }
  const listed = [...counts].filter(([flag]) => flag !== 0).sort((a, b) => a[0] - b[0]);
  return { samples: values.length, flagged, flaggedShare: values.length ? flagged / values.length : null,
    ...(listed.length <= limit ? { flags: Object.fromEntries(listed.map(([flag, count]) => [String(flag), count])) } : { distinctFlags: listed.length }) };
}

/** The arcsec a pixel covers, from the transform the product's own header states. The square root of the matrix determinant is
 * the scale whatever the rotation, and a header that states no matrix gives none rather than a guess. */
export function plateScaleArcsec(header: FitsHeader): number | null {
  const at = (key: string) => typeof header[key] === 'number' ? header[key] : undefined;
  const [a, b, c, d] = [at('CD1_1'), at('CD1_2'), at('CD2_1'), at('CD2_2')];
  if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
  const determinant = Math.abs(a * d - b * c);
  return determinant > 0 ? Math.sqrt(determinant) * 3600 : null;
}

/** Where the body is in a picture, and how far across it is, measured and not assumed.
 *
 * The brightest single pixel is a cosmic ray about as often as it is the target, and so is the brightest five by five mean: one
 * pixel of a hundred thousand counts outweighs a whole disc. So the disc is found by the brightest five by five MEDIAN, which
 * twelve pixels would have to conspire to lift, and that median is also its level. Everything connected to it above half that
 * level over the background is the disc. Nothing is fitted and nothing is resampled: the count of pixels is turned into the
 * diameter of the circle of the same area, which is what "how many pixels across" means for a round body. */
export function findDisc(values: Float64Array, width: number, height: number) {
  const background = median(values), at = (x: number, y: number) => values[y * width + x]!;
  const box = new Float64Array(25);
  const boxMedian = (x: number, y: number) => {
    let held = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const value = at(x + dx, y + dy);
      let slot = held++;
      while (slot > 0 && box[slot - 1]! > value) { box[slot] = box[slot - 1]!; slot--; }
      box[slot] = value;
    }
    return box[12]!;
  };
  let peakX = 2, peakY = 2, level = -Infinity;
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
    const found = boxMedian(x, y);
    if (found > level) { level = found; peakX = x; peakY = y; }
  }
  const threshold = background + (level - background) / 2;
  const seen = new Uint8Array(width * height), stack = [peakY * width + peakX];
  seen[stack[0]!] = 1;
  let pixels = 0, sumX = 0, sumY = 0, minX = width, maxX = -1, minY = height, maxY = -1;
  while (stack.length) {
    const index = stack.pop()!, x = index % width, y = (index - x) / width;
    pixels++; sumX += x; sumY += y;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (!seen[next] && at(nx, ny) > threshold) { seen[next] = 1; stack.push(next); }
    }
  }
  return { background, level, threshold, pixels, x: sumX / pixels, y: sumY / pixels,
    acrossPixels: 2 * Math.sqrt(pixels / Math.PI), box: { x0: minX, x1: maxX, y0: minY, y1: maxY } };
}

/** What a picture holds: its size, what a pixel covers, where the body is and how far across, and how much of it the archive's
 * own data quality flags. */
export function summariseImage(science: { values: Float64Array; samples: number; groups: number }, quality: Float64Array | null,
  header: FitsHeader, saturationFlag: number) {
  const width = science.samples, height = science.groups;
  const arcsecPerPixel = plateScaleArcsec(header), disc = findDisc(science.values, width, height);
  const flags = quality ? qualitySummary(quality) : null;
  let saturated = 0;
  if (quality) for (const value of quality) if ((value & saturationFlag) === saturationFlag && value !== 0) saturated++;
  return { kind: 'image' as const, width, height, arcsecPerPixel,
    target: { pixelX: disc.x, pixelY: disc.y, pixels: disc.pixels, acrossPixels: disc.acrossPixels,
      acrossArcsec: arcsecPerPixel === null ? null : disc.acrossPixels * arcsecPerPixel,
      background: disc.background, level: disc.level, threshold: disc.threshold, box: disc.box },
    quality: flags === null ? null : { ...flags, saturationFlag, saturated } };
}

/** What a spectrum holds: how far it reaches, how finely it samples, how much signal the archive's own error says each sample
 * carries, and how much of it is flagged. Every group is measured, because a waivered product keeps its readouts as groups and
 * a spectrum read as one long row would sample across the seam between them. */
export function summariseSpectrum(science: { values: Float64Array; samples: number; groups: number },
  wavelength: Float64Array, uncertainty: Float64Array | null, quality: Float64Array | null, units: { science: string; wavelength: string }) {
  const { samples, groups } = science;
  if (wavelength.length !== science.values.length) throw new Error(`The wavelength array holds ${wavelength.length} samples against the science array's ${science.values.length}.`);
  const steps: number[] = [];
  for (let group = 0; group < groups; group++) for (let i = 0; i < samples - 1; i++) {
    const at = group * samples + i;
    steps.push(Math.abs(wavelength[at + 1]! - wavelength[at]!));
  }
  const ratios: number[] = [];
  if (uncertainty) for (let i = 0; i < science.values.length; i++) if (uncertainty[i]! > 0) ratios.push(science.values[i]! / uncertainty[i]!);
  const signal = Float64Array.from(ratios);
  return { kind: 'spectrum' as const, samples, groups,
    wavelength: { units: units.wavelength, first: Math.min(...wavelength), last: Math.max(...wavelength), medianStep: median(steps) },
    science: { units: units.science, median: median(science.values) },
    signalToNoise: uncertainty === null ? null
      : { samples: signal.length, median: median(signal), p90: quantile(signal, 0.9), note: "the archive's own propagated statistical error, which carries no calibration systematic" },
    quality: quality === null ? null : qualitySummary(quality) };
}

/** One observation's entry in MAST's catalogue, which is the third party every identity field is checked against. */
export async function catalogueEntry(observation: string): Promise<CatalogueEntry> {
  const [row] = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json',
    params: { columns: 'obs_id,instrument_name,filters,target_name,proposal_id,t_min,t_max', filters: [{ paramName: 'obs_collection', values: ['HST'] }, { paramName: 'obs_id', values: [observation] }] } });
  if (!row) throw new Error(`MAST has no HST observation ${observation}.`);
  return { observation: requireString(row.obs_id, 'obs_id'), configuration: requireString(row.instrument_name, 'instrument_name'),
    filters: String(row.filters ?? ''), targetName: String(row.target_name ?? ''), proposal: String(Number(row.proposal_id)),
    startMjd: requireFiniteNumber(row.t_min, 't_min'), endMjd: requireFiniteNumber(row.t_max, 't_max') };
}

const roleOf = (program: ArchiveFinalProgram, name: string) =>
  program.components.filter(component => component.file === name).map(component => component.role).join('+') || 'archive-file';

export interface ArchiveFinalRun {
  readonly program: ArchiveFinalProgram;
  readonly files: readonly (MastFile & { readonly sha256: string; readonly path: string })[];
  readonly identity: ArchiveFinalIdentity;
  readonly catalogue: CatalogueEntry;
  readonly calibration: ReturnType<typeof archiveCalibration>;
  readonly measured: ReturnType<typeof summariseImage> | ReturnType<typeof summariseSpectrum>;
}

/** Download the pinned files, refuse anything that is not them, read every part the archive supplies and measure it. */
export async function runArchiveFinal(id: string, work: string, sources: readonly string[] = [], log: (line: string) => void = () => {}): Promise<ArchiveFinalRun> {
  const program = await readArchiveFinalProgram(id);
  const downloaded: (MastFile & { sha256: string; path: string })[] = [];
  for (const file of program.files) {
    const path = await mastFile(file, work, sources);
    const { bytes, sha256 } = await sha256File(path);
    if (bytes !== file.bytes) throw new Error(`${file.name} downloaded to ${bytes} bytes, not the pinned ${file.bytes}.`);
    downloaded.push({ ...file, sha256, path });
    log(`${file.name}: ${bytes} bytes, sha256 ${sha256}${file.sha256 === undefined ? ' (first download; the pin records it)' : ''}`);
  }
  // Nothing is read before the pins are met: a record must describe the files its run actually used.
  await assertInputPins(downloaded.map(file => ({ role: roleOf(program, file.name), identity: file.uri, bytes: file.bytes, sha256: file.sha256 })),
    new Map(downloaded.map(file => [file.uri, file.path])));
  // Every pinned file is read with this repository's own reader. One it cannot read stops the run and says why: a product half
  // read is not a product pinned, and nothing here guesses at a layout.
  const units = new Map<string, HstFileHdu[]>(), unreadable: string[] = [];
  for (const file of downloaded) {
    try { units.set(file.name, await readHstFileHdus(file.path)); }
    catch (error) { unreadable.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  if (unreadable.length) throw new Error(`This repository's FITS reader could not read ${unreadable.join('; ')}.`);
  const at = (component: ArchiveFinalComponent | undefined) => {
    if (!component?.supplied) return null;
    const name = component.file ?? component.carriedBy!, hdus = units.get(name)!;
    const hdu = hdus[component.hdu ?? 0];
    if (!hdu) throw new Error(`${name} holds no unit ${component.hdu ?? 0}.`);
    return { name, hdu, path: downloaded.find(file => file.name === name)!.path, component };
  };
  const part = (role: ArchiveFinalRole) => at(program.components.find(component => component.role === role));
  const science = part('science')!;
  const headers = [science.hdu.header, units.get(science.name)![0]!.header];
  const identity = headerIdentity(program.identity.instrument, headers);
  const catalogue = await catalogueEntry(program.observation);
  const disagreements = identityDisagreements(catalogue, program, identity);
  if (disagreements.length) throw new Error(`${program.observation} is not the observation this program describes:\n  ${disagreements.join('\n  ')}`);
  const values = await readUnit(science.path, science.name, science.hdu);
  const read = async (role: ArchiveFinalRole) => { const held = part(role); return held ? (await readUnit(held.path, held.name, held.hdu)).values : null; };
  const quality = await read('quality');
  const measured = program.kind === 'image'
    ? summariseImage(values, quality, science.hdu.header, WFPC2_SATURATION_FLAG)
    : summariseSpectrum(values, (await read('coordinates'))!, await read('uncertainty'), quality,
      { science: String(trimmed(science.hdu.header.BUNIT) || science.component.units || ''), wavelength: String(trimmed(part('coordinates')?.hdu.header.BUNIT) || '') });
  const calibration = archiveCalibration([science.hdu.header, ...units.get(science.name)!.map(unit => unit.header)]);
  return { program, files: downloaded, identity, catalogue, calibration, measured };
}

/** What retrieval establishes, said once, in the record of the run that retrieved the bytes. */
export const archiveOriginEvidence = (run: ArchiveFinalRun, receipt: string): ProductEvidence => {
  const science = run.files.find(file => file.name === run.program.components.find(component => component.role === 'science')!.file)!;
  return { kind: 'archive-origin', receipt, product: science.name,
    establishes: `${science.name} is the archive's own final calibrated product for ${run.program.observation}, retrieved from MAST and pinned at ${science.bytes} bytes, sha256 ${science.sha256}. ` +
      `It establishes origin and integrity: the file read here is the file the archive distributes, and MAST's catalogue and the file's own headers agree on which observation it is. ` +
      'It does not establish that anything here reproduces that calibration: no pipeline was re-run and nothing was compared, so it is not agreement with the archive.' };
};

/** Everything about a program that decides WHICH samples were read, as one block the record carries and a later reader can
 * rebuild from the program.
 *
 * The digests of the pinned files are not enough on their own. One WFPC2 file holds four chips and a waivered spectrum holds
 * every group of its exposure, so moving a component from unit 1 to unit 2 measures a different detector out of the same bytes,
 * and every digest still matches. Which unit each part was read from, what role it played, and which observation the identity
 * check ran against are all part of what was qualified, so they are pinned here and the run digest covers them. */
export const archiveFinalSelection = (program: ArchiveFinalProgram) => ({
  program: program.id, observation: program.observation, configuration: program.configuration, target: program.target,
  kind: program.kind, handbook: program.handbook,
  identity: { ...program.identity },
  components: program.components.map(component => ({ ...component })),
});

/** The part of a run that a later reader can rebuild from the program alone: the recorded files at their sizes, and the
 * selection above. `runDigest` over this is what says a record still describes the program beside it. What the run measured
 * stays out of it, because nothing can recompute that without the files. */
export function archiveFinalQualificationRun(program: ArchiveFinalProgram): ProductRun {
  const inputs: ProductInput[] = program.files.map(file => ({ role: roleOf(program, file.name), identity: file.uri, bytes: file.bytes }));
  return { telescope: ARCHIVE_FINAL_TELESCOPE, stage: ARCHIVE_FINAL_STAGE, inputs, parameters: { selection: archiveFinalSelection(program) }, software: [] };
}

/** A record projected onto what a program can rebuild. A projection whose digest differs from the program's own was qualified
 * against another selection, another identity or other bytes. */
export const archiveFinalQualifiedRun = (record: ProductRecord): ProductRun =>
  ({ telescope: record.telescope, stage: record.stage, inputs: record.inputs, parameters: { selection: record.parameters.selection }, software: record.software });

export function archiveFinalRun(run: ArchiveFinalRun): ProductRun {
  const pinned = archiveFinalQualificationRun(run.program);
  return {
    ...pinned,
    parameters: {
      ...pinned.parameters,
      archiveStatement: ARCHIVE_OVERVIEW,
      identityAgreedWith: { catalogue: { ...run.catalogue }, headers: { ...run.identity } },
      // Provenance of the files, not software that ran here: this stage ran none.
      archiveCalibration: run.calibration,
      measured: run.measured,
    },
    software: [],
  };
}

/** Write the record beside the downloaded products and commit a copy beside the program, because the products themselves are
 * not committed and the ledger still has to read what was pinned. */
export async function writeArchiveFinalRecord(run: ArchiveFinalRun, work: string) {
  const committed = archiveFinalRecordPath(run.program.id), receipt = relative(REPOSITORY, committed);
  const science = run.program.components.find(component => component.role === 'science')!.file!;
  const unitsOf = (name: string) => run.program.components.find(component => component.file === name)?.units;
  const record = await writeProductRecord(productRecordPath(resolve(work, science)), archiveFinalRun(run),
    run.files.map(file => ({ path: file.name, file: file.path, ...(unitsOf(file.name) === undefined ? {} : { units: unitsOf(file.name)! }) })),
    [archiveOriginEvidence(run, receipt)]);
  await copyFile(productRecordPath(resolve(work, science)), committed);
  return { record, committed };
}

/** The digests this run measured, written back into the program the way archive.mts does: a pin gains its digest the first time
 * the file is downloaded, and every later run is refused unless the bytes are those. */
export async function recordDigests(run: ArchiveFinalRun) {
  const path = archiveFinalPath(run.program.id);
  const program = { ...run.program, files: run.program.files.map(file => ({ ...file, sha256: run.files.find(other => other.name === file.name)!.sha256 })) };
  await writeFile(path, `${JSON.stringify(parseArchiveFinalProgram(program), null, 2)}\n`);
  return path;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, work] = positionalArguments(args, ['--raw']);
  if (!id || !NAME.test(id) || !work) throw new TypeError('Usage: archive-final <program id> <work directory> [--raw <dir>]');
  const sources = args.flatMap((argument, index) => argument === '--raw' && args[index + 1] ? [resolve(args[index + 1]!)] : []);
  const run = await runArchiveFinal(id, resolve(work), sources, line => console.log(line));
  const path = await recordDigests(run);
  const { record, committed } = await writeArchiveFinalRecord(run, resolve(work));
  console.log(`ARCHIVE_FINAL ${path} ${committed} ${JSON.stringify({ outputs: record.outputs.length, measured: run.measured })}`);
}
