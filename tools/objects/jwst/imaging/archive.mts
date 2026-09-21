#!/usr/bin/env node
/** Find a JWST imaging observation's products on MAST and pin them as an imaging program.
 *
 *   node tools/objects/jwst/imaging/archive.mts <program id> <crds context> <level-3 obs_id> [<level-3 obs_id> ...]
 *
 * For each level-3 observation (e.g. jw02733-o001_t001_nircam_clear-f187n) the program records the pipeline's own level-3
 * mosaic, its image3 association and the level-2 calibrated exposures the association names, each by MAST URI and byte count.
 * A coronagraphic observation (e.g. jw01386-c1020_t001_nircam_f444w-maskrnd-sub320a335r) has a coron3 association instead:
 * its members are the per-integration _calints exposures of the target at each roll and, as references, of the PSF star.
 * An integral-field observation (e.g. jw01250-o002_t001_nirspec_g395h-f290lp) has a spec3 association, and its level-3 product
 * is a spectral cube (_s3d) built from the _cal exposures of both detectors at each dither. A MIRI MRS observation
 * (e.g. jw01250-o003_t001_miri_ch1-short) is one of the twelve cubes its association covers, and the whole association is
 * pinned for it: the cube itself is drizzled from one channel of one grating setting, but a moving target's frame is the mean
 * position of every science exposure in the association (jwst 2.0.1, assign_mtwcs), so leaving any of them out moves the grid.
 * The band comes from the product's filter and pupil. The association fixes the membership; the program stores it, so a re-run
 * of the mosaic step uses the same exposures MAST used. Digests are added the first time a file is downloaded (imaging.mts).
 * The program is written to tools/objects/jwst/imaging/programs/<program id>.json. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../source-values.mts';
import { MAST_CACHE, mastFile, mastRequest, type MastFile } from '../mast.mts';
import { isCubeBand, JWST_BANDS, NIRCAM_OCCULTERS, type JwstBand } from './bands.mts';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
export const DEFAULT_CRDS_CONTEXT = 'jwst_1535.pmap';
const NAME = /^[A-Za-z0-9._-]+$/u;

export interface ImagingBand {
  readonly band: string;
  readonly observation: string;
  readonly level3: MastFile;
  readonly association: MastFile;
  /** The level-3 stage that builds the mosaic; absent for image3. */
  readonly stage?: 'coron3' | 'spec3';
  readonly members: readonly MastFile[];
  /** coron3 only: the PSF reference star's exposures, which the stage subtracts from the members. */
  readonly references?: readonly MastFile[];
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
    if (entry.stage !== undefined && entry.stage !== 'coron3' && entry.stage !== 'spec3') throw new TypeError(`${band}: unsupported stage ${String(entry.stage)}.`);
    const coron = entry.stage === 'coron3', cube = entry.stage === 'spec3', stage = coron ? 'coron3' : cube ? 'spec3' : 'image3', members = requireArray(entry.members).map(file);
    const references = coron ? requireArray(entry.references).map(file) : entry.references === undefined ? [] : null;
    if (!references) throw new TypeError(`${band}: only a coron3 band has PSF references.`);
    const level2 = coron ? '_calints.fits' : '_cal.fits';
    if (!members.length || !members.every(member => member.name.endsWith(level2))) throw new TypeError(`${band}: members are level-2 ${level2.slice(0, -5)} exposures.`);
    if (coron && (!references.length || !references.every(member => member.name.endsWith(level2)))) throw new TypeError(`${band}: references are level-2 _calints exposures.`);
    if (coron !== Boolean(JWST_BANDS[band]!.coronagraph)) throw new TypeError(`${band}: a coronagraph band is built by coron3, and only it.`);
    if (cube !== isCubeBand(JWST_BANDS[band]!)) throw new TypeError(`${band}: a cube band is built by spec3, and only it.`);
    const level3 = file(entry.level3), association = file(entry.association);
    if (!level3.name.endsWith(cube ? '_s3d.fits' : '_i2d.fits') || !new RegExp(`_${stage}_\\d+_asn\\.json$`, 'u').test(association.name))
      throw new TypeError(`${band}: not a level-3 ${cube ? 'cube' : 'mosaic'} and ${stage} association.`);
    return { band, observation: requireString(entry.observation, 'Observation'), level3, association, ...(coron ? { stage: 'coron3' as const } : cube ? { stage: 'spec3' as const } : {}), members,
      ...(coron ? { references } : {}) };
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

export const bandOfFilters = (instrument: string, filters: string, observation = ''): JwstBand => {
  // CAOM lists NIRCam optical elements as "FILTER;PUPIL" and "CLEAR;FILTER" forms (a coronagraph's Lyot stop is the pupil, and
  // the mask is not listed); MIRI as the filter alone. compare.mts checks the band against the level-3 product's own header,
  // which names the mask.
  const parts = filters.split(';');
  // MIRI's medium-resolution spectrometer has no filter wheel; the archive lists a cube's channel and sub-band (CH1-SHORT).
  const mrs = instrument === 'MIRI' && parts.length === 1 ? /^CH([1-4])-(SHORT|MEDIUM|LONG)$/u.exec(parts[0]!) : null;
  if (mrs) {
    const found = Object.values(JWST_BANDS).find(entry => entry.channel === mrs[1] && entry.subBand === mrs[2]);
    if (!found) throw new Error(`No JWST cube band for ${instrument} ${filters}.`);
    return found;
  }
  if (instrument === 'NIRSPEC') {
    const found = Object.values(JWST_BANDS).find(entry => entry.grating !== undefined && entry.filter !== undefined &&
      parts.length === 2 && parts.includes(entry.grating) && parts.includes(entry.filter));
    if (!found) throw new Error(`No JWST cube band for ${instrument} ${filters}.`);
    return found;
  }
  // A NIRCam coronagraph's occulter is not in the archive's filter list; the subarray in the observation's name carries it
  // (sub320a335r is module A's MASK335R). A full-frame coronagraph observation names no occulter and cannot be pinned by name.
  const lyot = parts.find(part => part === 'MASKRND' || part === 'MASKBAR');
  if (instrument === 'NIRCAM' && lyot) {
    const occulter = /-mask(?:rnd|bar)-sub\d+(?:x\d+)?a(210r|335r|430r|swb|lwb)$/u.exec(observation)?.[1]?.toUpperCase();
    if (!occulter || NIRCAM_OCCULTERS[occulter]!.pupil !== lyot) throw new Error(`${observation || filters}: the observation's name does not say which occulter it is behind.`);
    const found = JWST_BANDS[`NIRCAM-${parts.find(part => part !== lyot)}-MASK${occulter}`];
    if (!found) throw new Error(`No JWST band for ${instrument} ${filters} behind MASK${occulter}.`);
    return found;
  }
  // A MIRI coronagraph has a filter of its own, and the archive lists it with its mask as "FILTER;MASK" (F1550C;4QPM_1550).
  if (instrument === 'MIRI' && parts.length === 2 && /C$/u.test(parts[0]!)) {
    const coronagraphs = Object.values(JWST_BANDS).filter(entry => entry.instrument === 'MIRI' && entry.filter === parts[0] && entry.coronagraph === parts[1]);
    if (coronagraphs.length !== 1) throw new Error(`${coronagraphs.length ? 'More than one' : 'No'} JWST band for MIRI coronagraph filter ${filters}.`);
    return coronagraphs[0]!;
  }
  const found = Object.values(JWST_BANDS).filter(entry => !entry.coronagraph && entry.filter !== undefined && entry.instrument === instrument &&
    (entry.instrument === 'MIRI' ? parts.length === 1 && parts[0] === entry.filter
      : parts.includes(entry.filter) && parts.includes(entry.pupil ?? 'CLEAR') || entry.pupil === 'CLEAR' && parts.length === 1 && parts[0] === entry.filter));
  if (found.length !== 1) throw new Error(`${found.length ? 'More than one' : 'No'} JWST band for ${instrument} ${filters}.`);
  return found[0]!;
};

/** One level-3 observation's mosaic, association and members, as MAST lists them. */
export async function imagingBand(observation: string): Promise<ImagingBand & { programme: string; target: string }> {
  const [obs] = await mastRequest({ service: 'Mast.Caom.Filtered', format: 'json', params: { columns: 'obsid,obs_id,instrument_name,filters,proposal_id,target_name,calib_level',
    filters: [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'obs_id', values: [observation] }] } });
  if (!obs || obs.calib_level !== 3) throw new Error(`${observation} is not a level-3 JWST observation.`);
  const instrument = requireString(obs.instrument_name).split('/')[0]!, band = bandOfFilters(instrument, requireString(obs.filters), observation);
  const products = await mastRequest({ service: 'Mast.Caom.Products', format: 'json', params: { obsid: String(obs.obsid) } });
  const pick = (kind: string, level: number, pattern: RegExp) => products.filter(p => p.productSubGroupDescription === kind && p.calib_level === level &&
    pattern.test(requireString(p.productFilename)));
  const mastFileOf = (p: Record<string, unknown>): MastFile => ({ name: requireString(p.productFilename), uri: requireString(p.dataURI), bytes: requireFiniteNumber(p.size) });
  const ifu = band.grating ? 'NIRSPEC/IFU' : band.subBand ? 'MIRI/IFU' : null;
  if (ifu && obs.instrument_name !== ifu) throw new Error(`${observation} is ${String(obs.instrument_name)}, not an integral-field observation.`);
  const coron = Boolean(band.coronagraph), cube = isCubeBand(band), stage = coron ? 'coron3' : cube ? 'spec3' : 'image3';
  const level3 = pick(cube ? 'S3D' : 'I2D', 3, new RegExp(`^${observation}_${cube ? 's3d' : 'i2d'}\\.fits$`, 'u')), association = pick('ASN', 3, new RegExp(`_${stage}_\\d+_asn\\.json$`, 'u'));
  if (level3.length !== 1 || association.length !== 1) throw new Error(`${observation}: expected one level-3 ${cube ? 'cube' : 'mosaic'} and one ${stage} association.`);
  const asnFile = mastFileOf(association[0]!);
  const asn = requireRecord(JSON.parse(await readFile(await mastFile(asnFile, MAST_CACHE), 'utf8')) as unknown, 'Association');
  const [product] = requireArray(asn.products).map(value => requireRecord(value));
  // A spec3 association names its product as far as the setting (…_nirspec_g395h, …_miri); the stage appends the rest, after a
  // dash for NIRSpec's filter and an underscore for MIRI's channel and sub-band.
  const builds = cube ? /^[-_]/u.test(observation.slice(requireString(product?.name ?? '').length)) && observation.startsWith(requireString(product?.name ?? ''))
    : requireString(product?.name ?? '') === observation;
  if (!product || !builds) throw new Error(`${asnFile.name} does not build ${observation}.`);
  // Target acquisition exposures are association members too; the stage reads only science and PSF reference exposures.
  const exposures = (exptype: string) => {
    const names = new Set(requireArray(product.members).map(value => requireRecord(value)).filter(member => member.exptype === exptype).map(member => requireString(member.expname)));
    const found = products.filter(p => p.productSubGroupDescription === (coron ? 'CALINTS' : 'CAL') && names.has(requireString(p.productFilename))).map(mastFileOf)
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    if (found.length !== names.size) throw new Error(`${observation}: MAST lists ${found.length} of the association's ${names.size} ${exptype} members.`);
    return found;
  };
  return { band: band.id, observation, level3: mastFileOf(level3[0]!), association: asnFile, ...(coron ? { stage: 'coron3' as const } : cube ? { stage: 'spec3' as const } : {}), members: exposures('science'),
    ...(coron ? { references: exposures('psf') } : {}), programme: String(obs.proposal_id), target: requireString(obs.target_name) };
}

export async function pinImagingProgram(id: string, crdsContext: string, observations: readonly string[]): Promise<{ readonly path: string; readonly program: ImagingProgram }> {
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
      members: entry.members.map(member => ({ ...member, ...(bands[index]?.members.find(m => m.name === member.name)?.sha256 ? { sha256: bands[index]!.members.find(m => m.name === member.name)!.sha256 } : {}) })),
      ...(entry.references ? { references: entry.references.map(member => ({ ...member, ...(bands[index]?.references?.find(m => m.name === member.name)?.sha256 ? { sha256: bands[index]!.references!.find(m => m.name === member.name)!.sha256 } : {}) })) } : {}) };
    if (index >= 0) bands[index] = withDigests; else bands.push(withDigests);
    console.error(`${observation}: ${entry.band}, ${entry.members.length} members${entry.references ? `, ${entry.references.length} PSF references` : ''}`);
  }
  const program = parseImagingProgram({ schema: 'cssearth-jwst-imaging-program@1', id, programme, target, crdsContext, ...(existing?.image3 ? { image3: existing.image3 } : {}), bands });
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(path, `${JSON.stringify(program, null, 2)}\n`);
  console.error(`IMAGING_PROGRAM ${path}`);
  return { path, program };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, crdsContext, ...observations] = process.argv.slice(2);
  await pinImagingProgram(id!, crdsContext!, observations);
}
