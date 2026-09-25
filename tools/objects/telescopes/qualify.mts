#!/usr/bin/env node
/** Qualify one indexed archive observation with the telescope-specific reducer that owns its physics. */
import { loadSourceProducts } from './source-products.mts';
import { qualifySourceProduct } from './qualify-source.mts';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { rememberQualification } from './qualified-observations.mts';
import { readProductScience } from './product-science.mts';
import { pdsPackages } from '../astronomy-packages/pds-client.mts';
import { measureCubeResolution } from '../jwst/cubes/resolution.mts';
import type { FitsHeader } from '@cssearth/fits';
import { readFitsFileHdus } from '@cssearth/fits/node';
import type { ProductFacts } from './request-satisfaction.mts';
import { pathToFileURL } from 'node:url';
import { flagValue } from '@cssearth/core';
import { compareCubeWithMast, runSpec3 } from '../jwst/cubes/spec3.mts';
import { DEFAULT_CRDS_CONTEXT, pinImagingProgram } from '../jwst/imaging/archive.mts';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { refreshLocalLedger as refreshJwstLedger } from '../jwst/archive-ledger.mts';
import { PROGRAMS as NACO_PROGRAMS, pinProgram as pinNacoProgram, writeProgram as writeNacoProgram } from '../naco/archive.mts';
import { refreshLocalLedger as refreshNacoLedger } from '../naco/archive-ledger.mts';
import { compareTemplates } from '../naco/compare.mts';
import { reduceProgram as reduceNacoProgram } from '../naco/reduce.mts';
import { qualifyPdsArchiveProduct } from '../pds/archive-final.mts';
import { buildPdsLedger } from '../pds/archive-ledger.mts';
import { productRecordPath } from '@cssearth/telescope';
import { readProductRecord, sameRun } from '@cssearth/telescope/node';
import { compareChannel, receiptPath } from '../spitzer/compare.mts';
import { defaultDataRoot, pinProgram, writeSpitzerProgram } from '../spitzer/archive.mts';
import { refreshLocalLedger as refreshSpitzerLedger } from '../spitzer/archive-ledger.mts';
import { defaultWorkRoot, remosaicChannel } from '../spitzer/mosaic.mts';
import { loadQueryInputs, queryCapabilities } from './query.mts';
import { qualificationConfigurationFromArguments, supportsQualificationRoute, type QualificationConfiguration } from './qualification-routes.mts';

export const QUALIFICATION_SCHEMA = 'cssearth-telescope-qualification@2';
export interface QualificationRequest {
  readonly target: string; readonly telescope: string; readonly mode: string; readonly observation: string; readonly configuration: QualificationConfiguration;
}
export interface QualificationResult {
  readonly schema: typeof QUALIFICATION_SCHEMA; readonly target: string; readonly telescope: string; readonly mode: string;
  readonly observation: string; readonly program: string; readonly configuration: QualificationConfiguration; readonly product: string; readonly receipt: string;
  readonly archiveProgramme?: string;
}

const indexedObservation = async (root: string, request: QualificationRequest, wavelengthMicrometres: readonly [number, number]) => {
  if (!supportsQualificationRoute(request.telescope, request.mode, request.configuration)) throw new TypeError(`No qualification route handles ${request.telescope} ${request.mode} ${request.configuration.kind}.`);
  const answer = queryCapabilities({ target: request.target, wavelengthMicrometres }, await loadQueryInputs(root, request.target));
  if (answer.targetResolution.status === 'unknown') throw new TypeError(`Unknown target ${request.target}.`);
  const candidate = answer.candidates.find(entry => entry.telescope === request.telescope && entry.mode === request.mode);
  if (!candidate) throw new TypeError(`${request.telescope} ${request.mode} has no indexed observation of ${answer.target}.`);
  const observation = candidate.observations?.records?.find(entry => entry.id === request.observation);
  if (!observation) throw new TypeError(`${request.observation} is not an indexed ${request.telescope} ${request.mode} observation of ${answer.target}.`);
  return { answer, observation };
};

async function qualifySpitzerIrac(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (request.configuration.kind !== 'spitzer-irac-channel') throw new TypeError('Spitzer IRAC qualification requires a channel.');
  const { answer, observation } = await indexedObservation(root, request, [3.176, 9.338]);
  const aorKey = Number(request.observation);
  if (!Number.isSafeInteger(aorKey) || aorKey <= 0) throw new TypeError(`Spitzer observation ${request.observation} is not an AORKEY.`);
  const programId = `${answer.target}-${request.observation}`, channelNumber = request.configuration.channel;
  const program = await pinProgram(programId, aorKey, [channelNumber], defaultDataRoot);
  if (program.mode !== request.mode) throw new Error(`AOR ${request.observation} is ${program.mode}, not ${request.mode}.`);
  await writeSpitzerProgram(program);
  const channel = program.channels.find(entry => entry.channel === channelNumber);
  if (!channel) throw new Error(`AOR ${request.observation} returned no channel ${channelNumber}.`);
  const { record } = await remosaicChannel(program, channel, defaultDataRoot, defaultWorkRoot);
  await compareChannel(program, channel, defaultDataRoot, defaultWorkRoot);
  await refreshSpitzerLedger();
  return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: request.observation,
    program: programId, configuration: request.configuration, product: resolve(defaultWorkRoot, programId, record.outputs[0]!.path), receipt: receiptPath(programId, channelNumber),
    ...(observation.programme ? { archiveProgramme: observation.programme } : {}) };
}

async function qualifyJwstNirspec(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (request.configuration.kind !== 'jwst-band') throw new TypeError('JWST NIRSpec qualification requires a band.');
  const coverage = JWST_CUBE_COVERAGE[request.configuration.band];
  if (!coverage) throw new TypeError(`Unknown JWST cube band ${request.configuration.band}.`);
  const wavelength = request.configuration.wavelengthMicrometres;
  const { answer, observation } = await indexedObservation(root, request, wavelength);
  const programId = `${answer.target}-${request.observation}`;
  const { program } = await pinImagingProgram(programId, DEFAULT_CRDS_CONTEXT, [request.observation]);
  const entry = program.bands.find(band => band.observation === request.observation);
  if (!entry || entry.band !== request.configuration.band) throw new Error(`${request.observation} is ${entry?.band ?? 'not a cube'}, not ${request.configuration.band}.`);
  if (observation.programme && program.programme !== observation.programme) throw new Error(`${request.observation} is programme ${program.programme}, not indexed programme ${observation.programme}.`);
  const work = resolve(root, 'output/jwst', programId), run = await runSpec3(programId, request.configuration.band, work, { wavelengthMicrometres: wavelength });
  const compared = await compareCubeWithMast(programId, request.configuration.band, run.cube, work, [], wavelength);
  await refreshJwstLedger();
  return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: request.observation,
    program: programId, configuration: request.configuration, product: run.cube, receipt: compared.path,
    ...(observation.programme ? { archiveProgramme: observation.programme } : {}) };
}

async function qualifyNacoImaging(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (request.configuration.kind !== 'naco-program-night') throw new TypeError('NACO imaging qualification requires an archive programme, target and night.');
  const { answer, observation } = await indexedObservation(root, request, [1, 5]);
  const configuration = request.configuration;
  if (observation.programme !== configuration.programme || observation.archiveTarget !== configuration.archiveTarget || observation.night !== configuration.night)
    throw new Error(`${request.observation} does not match the indexed NACO programme, target and night.`);
  const programId = `${answer.target}-${request.observation}`, work = resolve(root, 'output/naco', programId), raw = resolve(work, 'raw');
  const program = await pinNacoProgram(programId, configuration.programme, configuration.archiveTarget, work, configuration.night);
  if (program.mode !== 'imaging' || program.mode !== request.mode) throw new Error(`${request.observation} is ${program.mode}, not ${request.mode}.`);
  const first = program.objectTemplates[0], second = program.objectTemplates[1];
  if (!first || !second) throw new Error(`${request.observation} has ${program.objectTemplates.length} independent object template(s); NACO qualification requires two.`);
  await writeNacoProgram(program);
  const templates = [first, second] as const;
  // The two runs share the work directory's calibration products, so they are intentionally sequential.
  const reductions = [await reduceNacoProgram(program, work, raw, first), await reduceNacoProgram(program, work, raw, second)];
  const records = await Promise.all(reductions.flatMap(reduction => [reduction.combined, ...(reduction.standardCombined ? [reduction.standardCombined] : [])])
    .map(async product => {
      const record = await readProductRecord(productRecordPath(product));
      if (!record) throw new Error(`${product} has no product record; the run that makes it writes one beside it.`);
      return record;
    }));
  await compareTemplates(programId, work, templates);
  await refreshNacoLedger();
  return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: request.observation,
    program: programId, configuration, product: reductions[0]!.combined,
    receipt: resolve(NACO_PROGRAMS, `${programId}.COADDED_IMG.reproduction.json`), archiveProgramme: configuration.programme };
}

async function qualifyPdsProduct(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (request.configuration.kind !== 'pds-product') throw new TypeError('PDS qualification requires an exact product.');
  const { answer, observation } = await indexedObservation(root, request, [0.000001, 1_000_000]), configuration = request.configuration;
  if (observation.productLidvid !== configuration.lidvid || observation.targetLid !== configuration.targetLid || observation.archiveTarget !== configuration.targetName)
    throw new Error(`${request.observation} does not match the indexed PDS identity.`);
  if (!observation.observatory || !observation.instrument || observation.kind !== 'image' || !observation.use)
    throw new Error(`${request.observation} does not carry the complete PDS qualification description.`);
  const programId = `${answer.target}-pds-${request.observation}`;
  const result = await qualifyPdsArchiveProduct({ id: programId, target: answer.target, targetLid: configuration.targetLid, targetName: configuration.targetName,
    lidvid: configuration.lidvid, telescope: request.telescope, archiveTelescope: observation.observatory, mode: request.mode, instrument: observation.instrument, kind: 'image',
    use: observation.use, ...(observation.units ? { units: observation.units } : {}) }, resolve(root, 'output/pds', programId));
  await writeFile(resolve(root, 'data/pds/ledger.json'), `${JSON.stringify(await buildPdsLedger(), null, 2)}\n`);
  return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: request.observation,
    program: programId, configuration, product: result.productPath, receipt: result.recordPath, archiveProgramme: configuration.lidvid };
}

const QUALIFIERS: Readonly<Record<string, (root: string, request: QualificationRequest) => Promise<QualificationResult>>> = Object.freeze({
  'Spitzer :: IRAC Map': qualifySpitzerIrac,
  'JWST :: NIRSPEC/IFU': qualifyJwstNirspec,
  'VLT/NACO :: imaging': qualifyNacoImaging,
});

export async function qualifyObservation(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (request.configuration.kind === 'archive-acquisition') {
    const configuration = request.configuration;
    if (configuration.request.target !== request.target) throw new Error('Acquisition target differs from qualification target.');
    const inputs = await loadQueryInputs(root, configuration.request, request.observation, undefined, { archiveService: request.telescope });
    const spec = inputs.vo?.records.flatMap(r => r.products).find(p => p.key === configuration.key && p.observation.key === request.observation && p.observation.service === request.telescope && `native-${p.kind}` === request.mode);
    if (!spec) throw new Error('The saved archive acquisition is no longer available. Query again.');
    const { qualifyVoProduct } = await import('./vo/qualify.mts');
    const result = await qualifyVoProduct(root, spec);
    return { schema: QUALIFICATION_SCHEMA, ...result, configuration };
  }
  if (request.configuration.kind === 'source-product') {
    const { answer } = await indexedObservation(root, request, [0.000001, 1_000_000]);
    const id = request.configuration.id;
    const source = (await loadSourceProducts(root, answer.target)).find(product => product.id === id && product.id === request.observation && product.telescope === request.telescope && product.mode === request.mode);
    if (!source) throw new TypeError('Source qualification does not match the indexed observation.');
    const { qualified: _qualified, receipt: _receipt, receiptProblem: _problem, facts: _facts, ...product } = source;
    const result = await qualifySourceProduct(root, product);
    return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: id, program: id, configuration: request.configuration, ...result, product: resolve(root, result.product), receipt: resolve(root, result.receipt) };
  }
  const qualifier = request.configuration.kind === 'pds-product' ? qualifyPdsProduct : QUALIFIERS[`${request.telescope} :: ${request.mode}`];
  if (!qualifier) throw new TypeError(`No qualification implementation is registered for ${request.telescope} ${request.mode}.`);
  const result = await qualifier(root, request);
  return recordQualification(root, result);
}

/** FITS dates use the header's time scale, never the host's timezone.
 * UTC is the FITS default from 1972 onward. Other scales require conversion;
 * leave those unknown here rather than labelling TAI/TT/etc. as UTC.
 * https://fits.gsfc.nasa.gov/year2000.html */
export function fitsObservationInterval(header: FitsHeader): Pick<ProductFacts, 'startIso' | 'endIso'> {
  const scale = header.TIMESYS;
  if (scale !== undefined && (typeof scale !== 'string' || scale.trim() !== 'UTC')) return {};
  const timestamp = (date: unknown, time: unknown): string | undefined => {
    if (typeof date !== 'string') return undefined;
    const text = /^\d{4}-\d{2}-\d{2}$/u.test(date) && typeof time === 'string' ? `${date}T${time}` : date;
    const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/u.exec(text);
    if (!parts || (scale === undefined && text.slice(0, 10) < '1972-01-01')) return undefined;
    // Reject normalized invalid dates (e.g. February 30), incomplete dates and leap
    // seconds which JavaScript cannot represent. Keep the interval unknown instead.
    const wallTime = Date.parse(`${parts[1]}Z`);
    if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 19) !== parts[1]) return undefined;
    const value = Date.parse(parts[3] ? text : `${text}Z`);
    return Number.isFinite(value) ? new Date(value).toISOString() : undefined;
  };
  const startIso = timestamp(header['DATE-BEG'] ?? header['DATE-OBS'], header['TIME-OBS']);
  const endIso = timestamp(header['DATE-END'], header['TIME-END']);
  return startIso && endIso && startIso <= endIso ? { startIso, endIso } : {};
}

/** Read back the produced file, not its mode's nominal capabilities. */
export async function recordQualification(root: string, result: QualificationResult): Promise<QualificationResult> {
  const recordPath = result.configuration.kind === 'pds-product' ? result.receipt : productRecordPath(result.product);
  const record = await readProductRecord(recordPath);
  if(!record || !await sameRun(record,record,path=>resolve(dirname(result.product),path)))throw new Error('Producing record or output pins are invalid');
  let decoded:unknown;
  if(result.configuration.kind==='pds-product'){
    const labels=record.outputs.filter(o=>o.path.endsWith('.xml'));
    if(labels.length!==1)throw new Error('PDS producing record must identify one pinned observation label');
    decoded=(await pdsPackages({operation:'decode-product',labelPath:resolve(dirname(result.product),labels[0].path)})).decoded;
  }
  let facts: ProductFacts = { target: result.target, verified: true, kind: result.configuration.kind==='jwst-band'?'cube':'image', result: 'telescope-product',
    ...await readProductScience(root,{file:result.product,format:result.configuration.kind==='pds-product'?'pds':'fits',target:result.target,decoded}) };
  if (result.configuration.kind === 'jwst-band') {
    const resolution = await measureCubeResolution(result.product);
    if (resolution.bound) facts = { ...facts, angularResolutionBound: resolution.bound };
  }
  if (result.configuration.kind !== 'pds-product') {
    const headers = await readFitsFileHdus(result.product), header = headers[0]!.header;
    facts = { ...facts, ...fitsObservationInterval(header) };
  }
  const evidence = record?.evidence.findLast(entry => entry.kind === 'archive-agreement' || entry.kind === 'internal-consistency' || entry.kind === 'geometric-registration' || entry.kind === 'published-value');
  const qualified = { ...result, receipt: evidence ? resolve(dirname(result.product), evidence.receipt) : result.receipt };
  if(!await sameRun(record,record,path=>resolve(dirname(result.product),path)))throw new Error('Producing outputs changed during qualification');
  await rememberQualification(root, { ...qualified, facts, productRecord: result.configuration.kind === 'pds-product' ? result.receipt : productRecordPath(result.product), outputRoot: dirname(result.product) });
  return qualified;
}

export const QUALIFY_HELP = `Usage: node tools/cli/run-typed-module.mjs tools/objects/telescopes/qualify.mts --target TARGET --telescope NAME --mode MODE --observation ID ROUTE_OPTIONS

Route options are emitted by telescope:query. Registered routes currently use --channel N, --band ID --wavelength FROM,TO,
--archive-programme ID --archive-target NAME --night YYYY-MM-DD, --source-product ID, or the exact --pds-target-lid/--pds-target-name/--pds-lidvid identity.`;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) process.stdout.write(`${QUALIFY_HELP}\n`);
  else {
    const target = flagValue(args, '--target'), telescope = flagValue(args, '--telescope'), mode = flagValue(args, '--mode'), observation = flagValue(args, '--observation');
    if (!target || !telescope || !mode || !observation) throw new TypeError(QUALIFY_HELP);
    const configuration = qualificationConfigurationFromArguments(telescope, mode, args);
    process.stdout.write(`${JSON.stringify(await qualifyObservation(resolve(import.meta.dirname, '../../..'), { target, telescope, mode, observation, configuration }), null, 2)}\n`);
  }
}
