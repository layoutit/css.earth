#!/usr/bin/env node
/** Find a JWST imaging observation's products on MAST and pin them as an imaging program.
 *
 *   node tools/objects/jwst/imaging/archive.mts <program id> <crds context> <level-3 obs_id> [<level-3 obs_id> ...]
 *
 * For each level-3 observation (e.g. jw02733-o001_t001_nircam_clear-f187n) the program records the pipeline's own level-3
 * mosaic, its image3 association and the level-2 calibrated exposures the association names, each by MAST URI and byte count.
 * The band comes from the product's filter and pupil. The association fixes the membership; the program stores it, so a re-run
 * of the mosaic step uses the same exposures MAST used. Digests are added the first time a file is downloaded (imaging.mts).
 * The program is written to tools/objects/jwst/imaging/programs/<program id>.json. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../source-values.mts';
import { mastDownloadUrl, mastRequest, type MastFile } from '../mast.mts';
import { JWST_BANDS, type JwstBand } from './bands.mts';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
const NAME = /^[A-Za-z0-9._-]+$/u;

export interface ImagingBand {
  readonly band: string;
  readonly observation: string;
  readonly level3: MastFile;
  readonly association: MastFile;
  readonly members: readonly MastFile[];
}
export interface ImagingProgram {
  readonly schema: 'cssearth-jwst-imaging-program@1';
  readonly id: string;
  readonly programme: string;
  readonly target: string;
  readonly crdsContext: string;
  /** Stage parameters beyond the CRDS defaults, by step, that reproduce MAST's level-3 products (compare.mts). */
  readonly image3?: Readonly<Record<string, Readonly<Record<string, string | number | boolean>>>>;
  readonly bands: readonly ImagingBand[];
}

const file = (value: unknown): MastFile => {
  const row = requireRecord(value, 'MAST file'), name = requireString(row.name, 'File name'), uri = requireString(row.uri, 'File URI');
  const bytes = requireFiniteNumber(row.bytes, 'File bytes');
  if (!NAME.test(name) || uri !== `mast:JWST/product/${name}` || !Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`Invalid MAST file: ${name}`);
  if (row.sha256 !== undefined && !/^[0-9a-f]{64}$/u.test(requireString(row.sha256))) throw new TypeError(`Invalid ${name} sha256.`);
  return { name, uri, bytes, ...(row.sha256 === undefined ? {} : { sha256: row.sha256 as string }) };
};
export function parseImagingProgram(value: unknown): ImagingProgram {
  const row = requireRecord(value, 'JWST imaging program');
  if (row.schema !== 'cssearth-jwst-imaging-program@1') throw new TypeError('Unsupported JWST imaging program.');
  const bands = requireArray(row.bands).map(raw => {
    const entry = requireRecord(raw, 'Imaging band'), band = requireString(entry.band, 'Band');
    if (!Object.hasOwn(JWST_BANDS, band)) throw new TypeError(`Unknown JWST band ${band}.`);
    const members = requireArray(entry.members).map(file);
    if (!members.length || !members.every(member => member.name.endsWith('_cal.fits'))) throw new TypeError(`${band}: members are level-2 _cal exposures.`);
    const level3 = file(entry.level3), association = file(entry.association);
    if (!level3.name.endsWith('_i2d.fits') || !/_image3_\d+_asn\.json$/u.test(association.name)) throw new TypeError(`${band}: not a level-3 mosaic and image3 association.`);
    return { band, observation: requireString(entry.observation, 'Observation'), level3, association, members };
  });
  if (new Set(bands.map(entry => entry.band)).size !== bands.length) throw new TypeError('A band appears twice in the program.');
  let image3: ImagingProgram['image3'];
  if (row.image3 !== undefined) {
    const steps = requireRecord(row.image3, 'image3 parameters');
    image3 = Object.fromEntries(Object.entries(steps).map(([step, raw]) => {
      if (!['tweakreg', 'skymatch', 'outlier_detection', 'resample'].includes(step)) throw new TypeError(`Unsupported image3 step ${step}.`);
      const values = requireRecord(raw, `${step} parameters`);
      for (const value of Object.values(values)) if (!['string', 'number', 'boolean'].includes(typeof value)) throw new TypeError(`${step}: parameters are scalars.`);
      return [step, values as Record<string, string | number | boolean>];
    }));
  }
  return { schema: row.schema, id: requireString(row.id, 'Program id'), programme: requireString(row.programme, 'Programme'),
    target: requireString(row.target, 'Target'), crdsContext: requireString(row.crdsContext, 'CRDS context'), ...(image3 ? { image3 } : {}), bands };
}

const bandOfFilters = (instrument: string, filters: string): JwstBand => {
  // CAOM lists NIRCam optical elements as "FILTER;PUPIL" and "CLEAR;FILTER" forms; MIRI as the filter alone.
  const parts = filters.split(';');
  const found = Object.values(JWST_BANDS).find(entry => entry.instrument === instrument &&
    (entry.instrument === 'MIRI' ? parts.length === 1 && parts[0] === entry.filter
      : parts.includes(entry.filter) && parts.includes(entry.pupil ?? 'CLEAR') || entry.pupil === 'CLEAR' && parts.length === 1 && parts[0] === entry.filter));
  if (!found) throw new Error(`No JWST band for ${instrument} ${filters}.`);
  return found;
};

/** One level-3 observation's mosaic, association and members, as MAST lists them. */
export async function imagingBand(observation: string): Promise<ImagingBand & { programme: string; target: string }> {
  const [obs] = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', params: { columns: 'obsid,obs_id,instrument_name,filters,proposal_id,target_name,calib_level',
    filters: [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'obs_id', values: [observation] }] } });
  if (!obs || obs.calib_level !== 3) throw new Error(`${observation} is not a level-3 JWST observation.`);
  const instrument = requireString(obs.instrument_name).split('/')[0]!, band = bandOfFilters(instrument, requireString(obs.filters));
  const products = await mastRequest({ service: 'Mast.Caom.Products', format: 'json', params: { obsid: String(obs.obsid) } });
  const pick = (kind: string, level: number, pattern: RegExp) => products.filter(p => p.productSubGroupDescription === kind && p.calib_level === level &&
    pattern.test(requireString(p.productFilename)));
  const mastFileOf = (p: Record<string, unknown>): MastFile => ({ name: requireString(p.productFilename), uri: requireString(p.dataURI), bytes: requireFiniteNumber(p.size) });
  const level3 = pick('I2D', 3, new RegExp(`^${observation}_i2d\\.fits$`, 'u')), association = pick('ASN', 3, /_image3_\d+_asn\.json$/u);
  if (level3.length !== 1 || association.length !== 1) throw new Error(`${observation}: expected one level-3 mosaic and one image3 association.`);
  const asnFile = mastFileOf(association[0]!), response = await fetch(mastDownloadUrl(asnFile.uri), { signal: AbortSignal.timeout(120_000) });
  const asn = requireRecord(await response.json(), 'Association');
  const [product] = requireArray(asn.products).map(value => requireRecord(value));
  if (!product || requireString(product.name) !== observation) throw new Error(`${asnFile.name} does not build ${observation}.`);
  const names = new Set(requireArray(product.members).map(value => requireRecord(value)).filter(member => member.exptype === 'science').map(member => requireString(member.expname)));
  const members = products.filter(p => p.productSubGroupDescription === 'CAL' && names.has(requireString(p.productFilename))).map(mastFileOf)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  if (members.length !== names.size) throw new Error(`${observation}: MAST lists ${members.length} of the association's ${names.size} members.`);
  return { band: band.id, observation, level3: mastFileOf(level3[0]!), association: asnFile, members,
    programme: String(obs.proposal_id), target: requireString(obs.target_name) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, crdsContext, ...observations] = process.argv.slice(2);
  if (!id || !NAME.test(id) || !crdsContext || !/^jwst_\d+\.pmap$/u.test(crdsContext) || !observations.length)
    throw new TypeError('Usage: archive <program id> <crds context> <level-3 obs_id> [...]');
  const path = resolve(PROGRAMS, `${id}.json`);
  const existing = await readFile(path, 'utf8').then(text => parseImagingProgram(JSON.parse(text)), () => null);
  const bands = [...existing?.bands ?? []];
  let programme = existing?.programme, target = existing?.target;
  for (const observation of observations) {
    const found = await imagingBand(observation);
    if (programme !== undefined && programme !== found.programme) throw new Error(`${observation} is programme ${found.programme}, not ${programme}.`);
    programme = found.programme; target ??= found.target;
    const { programme: _programme, target: _target, ...entry } = found;
    const index = bands.findIndex(other => other.band === entry.band);
    // Digests recorded by an earlier download stay with their file.
    const withDigests = { ...entry, level3: { ...entry.level3, ...(bands[index]?.level3.name === entry.level3.name && bands[index]?.level3.sha256 ? { sha256: bands[index]!.level3.sha256 } : {}) },
      members: entry.members.map(member => ({ ...member, ...(bands[index]?.members.find(m => m.name === member.name)?.sha256 ? { sha256: bands[index]!.members.find(m => m.name === member.name)!.sha256 } : {}) })) };
    if (index >= 0) bands[index] = withDigests; else bands.push(withDigests);
    console.log(`${observation}: ${entry.band}, ${entry.members.length} members`);
  }
  const program = parseImagingProgram({ schema: 'cssearth-jwst-imaging-program@1', id, programme, target, crdsContext, ...(existing?.image3 ? { image3: existing.image3 } : {}), bands });
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(path, `${JSON.stringify(program, null, 2)}\n`);
  console.log(`IMAGING_PROGRAM ${path}`);
}
