#!/usr/bin/env node
/** Find an HST observation's files on MAST and pin them as an HST program.
 *
 *   node tools/objects/hst/archive.mts <program id> <crds context> <obs_id> [<obs_id> ...]
 *
 * For each observation (e.g. od9l12010) the program records the raw exposures and the files the instrument pipeline reads
 * beside them (`_wav` wavecal, `_asn` association, `_spt` support, `_jit` jitter), and the calibrated products the archive
 * itself produced (`_flt`/`_flc`, `_crj`/`_sfl`, `_x2d`/`_sx2`, `_x1d`/`_sx1`, `_drz`/`_drc`), each by MAST URI, byte count
 * and, once downloaded, sha256. Alongside them it records what the observation is: instrument, detector, optical element,
 * aperture, exposure start and end, target and proposal. Those come from the raw file's own primary header, read over a range
 * request rather than downloaded, and are checked against what CAOM says about the observation.
 *
 * When the observation has an association table it is read here and stored: the exposures it names, each with the part it
 * plays (SCIENCE, CRSPLIT, EXP-RPT, a wavecal), and the rootname of the product it builds. That fixes the membership, so a
 * re-run of the combining stage works from the exposures the archive combined. An association may name exposures the archive
 * stores as files of their own (ACS repeats), or imsets inside the one raw file the association's own rootname carries (STIS
 * CR-SPLIT); both are pinned by whatever files MAST lists for those rootnames.
 *
 * `*CORR` calibration switches are recorded too. They are how the archive's own run was configured, and a re-run that differs
 * from MAST's product differs first in one of them (compare.mts).
 *
 * MAST catalogue access and complete-file downloads use the shared pinned Astroquery boundary (../astronomy-packages/mast.mts).
 * The program is written to tools/objects/hst/programs/<program id>.json. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsHeader, type FitsHeader } from '../../fits/fits.mts';
import { binaryTable, numbers, tableColumn, text as cell } from '../interferometry/fits-table.mts';
import { readRepeatingHeader } from './product-file.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { MAST_CACHE, mastDownloadUrl, mastFile, mastRequest, type MastFile } from '../astronomy-packages/mast.mts';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
const NAME = /^[A-Za-z0-9._-]+$/u;
/** What an instrument pipeline reads: the raw exposure, and the wavecal, association, support and jitter files beside it. */
export const INPUT_KINDS = ['RAW', 'WAV', 'ASN', 'SPT', 'JIT'] as const;
/** What the archive's own run produced: flat-fielded, cosmic-ray-combined, rectified and extracted spectra, and drizzled images. */
export const PRODUCT_KINDS = ['FLT', 'FLC', 'CRJ', 'CRC', 'SFL', 'X1D', 'X2D', 'SX1', 'SX2', 'DRZ', 'DRC'] as const;
const SUFFIXES = [...INPUT_KINDS, ...PRODUCT_KINDS].map(kind => kind.toLowerCase());
const FILE_NAME = new RegExp(`^[a-z0-9]+_(?:${SUFFIXES.join('|')})\\.fits$`, 'u');

/** What an exposure does in its association. A wavecal is calibrated beside the science exposures, never combined with them. */
export const MEMBER_TYPES = ['SCIENCE', 'CRSPLIT', 'REPEATOBS', 'EXP-RPT', 'EXP-CRJ', 'EXP-DTH', 'GO-WAVECAL', 'AUTO-WAVECAL'] as const;
export const WAVECAL_TYPES: readonly string[] = ['GO-WAVECAL', 'AUTO-WAVECAL'];
export interface AssociationMember { readonly rootname: string; readonly type: string }
export interface HstAssociation {
  /** The rootname of the product the association builds (`j9xe05011`), which is not the association's own id. */
  readonly product: string;
  readonly members: readonly AssociationMember[];
}

export interface HstObservation {
  readonly observation: string;
  readonly instrument: string;
  readonly detector: string;
  readonly opticalElement: string;
  readonly aperture: string;
  /** Modified Julian dates of the first exposure's start and the last one's end (TEXPSTRT, TEXPEND). */
  readonly exposureStartMjd: number;
  readonly exposureEndMjd: number;
  readonly targetName: string;
  /** Every `*CORR` switch of the raw header, as the archive set it: PERFORM, OMIT or COMPLETE. */
  readonly calibrationSwitches: Readonly<Record<string, string>>;
  /** Absent when the archive stored the exposure on its own, with no association table. */
  readonly association?: HstAssociation;
  readonly inputs: readonly MastFile[];
  readonly products: readonly MastFile[];
}
export interface HstProgram {
  readonly schema: 'cssearth-hst-program@1';
  readonly id: string;
  readonly programme: string;
  readonly target: string;
  readonly crdsContext: string;
  readonly observations: readonly HstObservation[];
}

const file = (value: unknown): MastFile => {
  const row = requireRecord(value, 'MAST file'), name = requireString(row.name, 'File name'), uri = requireString(row.uri, 'File URI');
  const bytes = requireFiniteNumber(row.bytes, 'File bytes');
  if (!FILE_NAME.test(name) || uri !== `mast:HST/product/${name}` || !Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`Invalid MAST file: ${name}`);
  if (row.sha256 !== undefined && !/^[0-9a-f]{64}$/u.test(requireString(row.sha256))) throw new TypeError(`Invalid ${name} sha256.`);
  return { name, uri, bytes, ...(row.sha256 === undefined ? {} : { sha256: row.sha256 as string }) };
};
export const suffixOf = (name: string) => name.slice(name.lastIndexOf('_') + 1, -'.fits'.length).toUpperCase();

export function parseHstProgram(value: unknown): HstProgram {
  const row = requireRecord(value, 'HST program');
  if (row.schema !== 'cssearth-hst-program@1') throw new TypeError('Unsupported HST program.');
  const observations = requireArray(row.observations).map(raw => {
    const entry = requireRecord(raw, 'HST observation'), observation = requireString(entry.observation, 'Observation');
    if (!/^[a-z0-9]{9}$/u.test(observation)) throw new TypeError(`${observation} is not an HST observation id.`);
    const inputs = requireArray(entry.inputs).map(file), products = requireArray(entry.products).map(file);
    let association: HstAssociation | undefined;
    if (entry.association !== undefined) {
      const table = requireRecord(entry.association, 'Association');
      const members = requireArray(table.members).map(value => {
        const member = requireRecord(value, 'Association member'), rootname = requireString(member.rootname, 'Member rootname');
        const type = requireString(member.type, 'Member type');
        if (!/^[a-z0-9]{9}$/u.test(rootname)) throw new TypeError(`${rootname} is not an HST rootname.`);
        if (!(MEMBER_TYPES as readonly string[]).includes(type)) throw new TypeError(`${observation}: ${type} is not an association member type.`);
        return { rootname, type };
      });
      const product = requireString(table.product, 'Association product');
      if (!/^[a-z0-9]{9}$/u.test(product)) throw new TypeError(`${product} is not an HST rootname.`);
      if (!members.some(member => !WAVECAL_TYPES.includes(member.type))) throw new TypeError(`${observation}: an association names at least one exposure that is not a wavecal.`);
      if (new Set(members.map(member => member.rootname)).size !== members.length) throw new TypeError(`${observation}: a member appears twice.`);
      association = { product, members };
    }
    // Every pinned file belongs to the observation, to an exposure its association names, or to the product that association
    // builds. Nothing else may be pinned under an observation's name.
    const rootnames = new Set([observation, ...association ? [association.product, ...association.members.map(member => member.rootname)] : []]);
    for (const member of [...inputs, ...products]) if (!rootnames.has(member.name.slice(0, member.name.lastIndexOf('_'))))
      throw new TypeError(`${observation}: ${member.name} belongs to no exposure of this observation.`);
    const raws = inputs.filter(input => suffixOf(input.name) === 'RAW');
    if (!raws.length) throw new TypeError(`${observation}: a program pins at least one raw exposure.`);
    if (!inputs.every(input => (INPUT_KINDS as readonly string[]).includes(suffixOf(input.name)))) throw new TypeError(`${observation}: an input is not a pipeline input.`);
    if (!products.length || !products.every(product => (PRODUCT_KINDS as readonly string[]).includes(suffixOf(product.name))))
      throw new TypeError(`${observation}: products are the archive's calibrated products.`);
    for (const list of [inputs, products]) if (new Set(list.map(entry => entry.name)).size !== list.length) throw new TypeError(`${observation}: a file appears twice.`);
    const start = requireFiniteNumber(entry.exposureStartMjd, 'Exposure start'), end = requireFiniteNumber(entry.exposureEndMjd, 'Exposure end');
    if (!(end >= start)) throw new TypeError(`${observation}: the exposure ends before it starts.`);
    const switches = Object.fromEntries(Object.entries(requireRecord(entry.calibrationSwitches, 'Calibration switches')).map(([key, value]) => {
      if (!/CORR$/u.test(key)) throw new TypeError(`${observation}: ${key} is not a calibration switch.`);
      return [key, requireString(value, key)];
    }));
    return { observation, instrument: requireString(entry.instrument, 'Instrument'), detector: requireString(entry.detector, 'Detector'),
      opticalElement: requireString(entry.opticalElement, 'Optical element'), aperture: requireString(entry.aperture, 'Aperture'),
      exposureStartMjd: start, exposureEndMjd: end, targetName: requireString(entry.targetName, 'Target name'),
      calibrationSwitches: switches, ...(association ? { association } : {}), inputs, products };
  });
  if (new Set(observations.map(entry => entry.observation)).size !== observations.length) throw new TypeError('An observation appears twice in the program.');
  return { schema: row.schema, id: requireString(row.id, 'Program id'), programme: requireString(row.programme, 'Programme'),
    target: requireString(row.target, 'Target'), crdsContext: requireString(row.crdsContext, 'CRDS context'), observations };
}

/** The primary header of an archive file, read over a range request: a header is a few records, the file may be megabytes. */
export async function mastPrimaryHeader(uri: string, records = 128): Promise<FitsHeader> {
  const response = await fetch(mastDownloadUrl(uri), { headers: { Range: `bytes=0-${records * 2880 - 1}` }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`MAST refused ${uri}: ${response.status}`);
  return readFitsHeader(Buffer.from(await response.arrayBuffer())).header;
}

const text = (header: FitsHeader, key: string) => {
  const value = header[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`The raw header has no ${key}.`);
  return value.trim();
};

/** The association table of an observation, downloaded through Astroquery into the ignored MAST cache: which exposures it names, what each one
 * does, and the rootname of the product it builds. An exposure the table marks absent is not pinned. */
export async function hstAssociation(file: MastFile): Promise<HstAssociation> {
  if (file.bytes > 4 * 1024 * 1024) throw new Error(`${file.uri} is larger than an association table.`);
  const bytes = await readFile(await mastFile(file, MAST_CACHE));
  // ACS association tables repeat NEXTEND in their primary header (j9xe05010, j9z001010), which the shared reader refuses as a
  // duplicate field (product-file.mts). The primary of an association carries no data, so the table follows its cards.
  const primary = readRepeatingHeader(bytes);
  if (primary.header.NAXIS !== 0) throw new Error(`${file.uri} is not an association table: its primary holds data.`);
  const extension = readRepeatingHeader(bytes, primary.dataOffset);
  if (extension.header.XTENSION !== 'BINTABLE') throw new Error(`${file.uri} does not begin with a binary table.`);
  const table = binaryTable({ header: extension.header, headerOffset: primary.dataOffset, dataOffset: extension.dataOffset,
    dataBytes: bytes.length - extension.dataOffset, extname: typeof extension.header.EXTNAME === 'string' ? extension.header.EXTNAME : '' });
  const name = tableColumn(table, 'MEMNAME'), kind = tableColumn(table, 'MEMTYPE'), present = tableColumn(table, 'MEMPRSNT');
  const members: AssociationMember[] = [];
  let product: string | undefined;
  for (let row = 0; row < table.rows; row++) {
    if (!numbers(bytes, table, row, present)[0]) continue;
    const rootname = cell(bytes, table, row, name).toLowerCase(), type = cell(bytes, table, row, kind).toUpperCase();
    if (type.startsWith('PROD')) { if (product) throw new Error(`${file.uri} builds more than one product.`); product = rootname; }
    else members.push({ rootname, type });
  }
  if (!product) throw new Error(`${file.uri} names no product.`);
  return { product, members };
}

/** The optical element, as the archive catalogue spells it, checked against the cards the instrument writes it in: STIS names
 * it OPT_ELEM, WFC3 FILTER, ACS FILTER1 and FILTER2. A catalogue entry that no card states stops the pin. */
function opticalElementOf(header: FitsHeader, filters: string) {
  const stated = ['OPT_ELEM', 'FILTER', 'FILTER1', 'FILTER2'].map(key => String(header[key] ?? '').trim().toUpperCase());
  const missing = filters.split(';').map(part => part.trim().toUpperCase()).filter(part => part && !stated.includes(part));
  if (missing.length) throw new Error(`The catalogue's element ${filters} is not among the header's ${stated.filter(Boolean).join(', ')}.`);
  return filters;
}
/** STIS dates the whole file (TEXPSTRT, TEXPEND); WFC3 and ACS date each exposure (EXPSTART, EXPEND). */
const exposureBounds = (header: FitsHeader) => ({
  start: requireFiniteNumber(header.TEXPSTRT ?? header.EXPSTART, 'Exposure start'),
  end: requireFiniteNumber(header.TEXPEND ?? header.EXPEND, 'Exposure end'),
});

/** One observation's raw inputs, archive products and identity, as MAST lists them and its own raw headers state them. */
export async function hstObservation(observation: string): Promise<HstObservation & { programme: string }> {
  const [obs] = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', params: { columns: 'obsid,obs_id,instrument_name,filters,proposal_id,target_name,calib_level',
    filters: [{ paramName: 'obs_collection', values: ['HST'] }, { paramName: 'obs_id', values: [observation] }] } });
  if (!obs) throw new Error(`MAST has no HST observation ${observation}.`);
  const products = await mastRequest({ service: 'Mast.Caom.Products', format: 'json', params: { obsid: String(obs.obsid) } });
  const mastFileOf = (p: Record<string, unknown>): MastFile => ({ name: requireString(p.productFilename), uri: requireString(p.dataURI), bytes: requireFiniteNumber(p.size) });
  const listed = (kinds: readonly string[], rootnames: ReadonlySet<string>) => products.filter(p => typeof p.productSubGroupDescription === 'string' &&
    kinds.includes(p.productSubGroupDescription) && FILE_NAME.test(String(p.productFilename)) &&
    rootnames.has(String(p.productFilename).slice(0, String(p.productFilename).lastIndexOf('_')))).map(mastFileOf)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  // The association names the exposures, so it is read before anything else is chosen: their files are this observation's too.
  const [asn] = listed(['ASN'], new Set([observation]));
  const association = asn ? await hstAssociation(asn) : undefined;
  const rootnames = new Set([observation, ...association ? [association.product, ...association.members.map(member => member.rootname)] : []]);
  const inputs = listed(INPUT_KINDS, rootnames), calibrated = listed(PRODUCT_KINDS, rootnames);
  const raws = inputs.filter(input => suffixOf(input.name) === 'RAW');
  if (!raws.length) throw new Error(`${observation}: MAST lists no raw exposure.`);
  if (!calibrated.length) throw new Error(`${observation}: MAST lists no calibrated product.`);
  // Every raw exposure is read, because an association's exposures must agree on what they are and the observation spans them.
  const headers = await Promise.all(raws.map(raw => mastPrimaryHeader(raw.uri)));
  const header = headers[0]!;
  const instrument = text(header, 'INSTRUME'), detector = text(header, 'DETECTOR');
  const opticalElement = opticalElementOf(header, requireString(obs.filters, 'Catalogue filters')), aperture = text(header, 'APERTURE');
  for (const other of headers.slice(1)) {
    if (text(other, 'INSTRUME') !== instrument || text(other, 'DETECTOR') !== detector || text(other, 'APERTURE') !== aperture)
      throw new Error(`${observation}: its raw exposures are not the same configuration.`);
    opticalElementOf(other, opticalElement);
  }
  // The pin must describe the files it pins, so the headers' own identity is checked against what the archive catalogue says.
  const named = requireString(obs.instrument_name).split('/');
  if (named[0] !== instrument || (named[1] !== undefined && named[1] !== detector)) throw new Error(`${observation}: CAOM calls it ${String(obs.instrument_name)}, the header ${instrument}/${detector}.`);
  if (String(obs.proposal_id) !== String(header.PROPOSID)) throw new Error(`${observation}: CAOM's proposal is ${String(obs.proposal_id)}, the header's ${String(header.PROPOSID)}.`);
  const bounds = headers.map(exposureBounds);
  const switches = Object.fromEntries(Object.entries(header).filter(([key, value]) => /CORR$/u.test(key) && typeof value === 'string')
    .map(([key, value]) => [key, String(value).trim()]).filter(([, value]) => value));
  return { observation, instrument, detector, opticalElement, aperture,
    exposureStartMjd: Math.min(...bounds.map(entry => entry.start)), exposureEndMjd: Math.max(...bounds.map(entry => entry.end)),
    targetName: text(header, 'TARGNAME'), calibrationSwitches: switches, ...(association ? { association } : {}),
    inputs, products: calibrated, programme: String(obs.proposal_id) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, crdsContext, ...observations] = process.argv.slice(2);
  if (!id || !NAME.test(id) || !crdsContext || !/^hst_\d+\.pmap$/u.test(crdsContext) || !observations.length)
    throw new TypeError('Usage: archive <program id> <crds context> <obs_id> [...]');
  const path = resolve(PROGRAMS, `${id}.json`);
  const existing = await readFile(path, 'utf8').then(text => parseHstProgram(JSON.parse(text)), () => null);
  const entries = [...existing?.observations ?? []];
  let programme = existing?.programme, target = existing?.target;
  for (const observation of observations) {
    const found = await hstObservation(observation);
    if (programme !== undefined && programme !== found.programme) throw new Error(`${observation} is programme ${found.programme}, not ${programme}.`);
    programme = found.programme; target ??= found.targetName;
    const { programme: _programme, ...entry } = found;
    const index = entries.findIndex(other => other.observation === entry.observation);
    // Digests recorded by an earlier download stay with their file.
    const keep = (list: readonly MastFile[], previous: readonly MastFile[] = []) => list.map(member => {
      const before = previous.find(other => other.name === member.name && other.bytes === member.bytes);
      return before?.sha256 ? { ...member, sha256: before.sha256 } : member;
    });
    const withDigests = { ...entry, inputs: keep(entry.inputs, entries[index]?.inputs), products: keep(entry.products, entries[index]?.products) };
    if (index >= 0) entries[index] = withDigests; else entries.push(withDigests);
    console.log(`${observation}: ${entry.instrument}/${entry.detector} ${entry.opticalElement} ${entry.aperture}, ${entry.inputs.length} inputs${
      entry.association ? `, ${entry.association.members.length} association members` : ''}, ${[...new Set(entry.products.map(p => suffixOf(p.name)))].join(' ')}`);
  }
  const program = parseHstProgram({ schema: 'cssearth-hst-program@1', id, programme, target, crdsContext, observations: entries });
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(path, `${JSON.stringify(program, null, 2)}\n`);
  console.log(`HST_PROGRAM ${path}`);
}
