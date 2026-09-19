#!/usr/bin/env node
/** Qualify one indexed archive observation with the telescope-specific reducer that owns its physics. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue } from '../../cli-arguments.mts';
import { compareCubeWithMast, runSpec3 } from '../jwst/cubes/spec3.mts';
import { DEFAULT_CRDS_CONTEXT, pinImagingProgram } from '../jwst/imaging/archive.mts';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { refreshLocalLedger as refreshJwstLedger } from '../jwst/archive-ledger.mts';
import { PROGRAMS as NACO_PROGRAMS, pinProgram as pinNacoProgram, writeProgram as writeNacoProgram } from '../naco/archive.mts';
import { refreshLocalLedger as refreshNacoLedger } from '../naco/archive-ledger.mts';
import { compareTemplates } from '../naco/compare.mts';
import { pinFrames, reduceProgram as reduceNacoProgram } from '../naco/reduce.mts';
import { qualifyPdsArchiveProduct } from '../pds/archive-final.mts';
import { buildPdsLedger } from '../pds/archive-ledger.mts';
import { productRecordPath, readProductRecord } from '../product-record.mts';
import { compareChannel, receiptName } from '../spitzer/compare.mts';
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
    program: programId, configuration: request.configuration, product: record.outputs[0]!.path, receipt: receiptName(programId, channelNumber),
    ...(observation.programme ? { archiveProgramme: observation.programme } : {}) };
}

async function qualifyJwstNirspec(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (request.configuration.kind !== 'jwst-band') throw new TypeError('JWST NIRSpec qualification requires a band.');
  const coverage = JWST_CUBE_COVERAGE[request.configuration.band];
  if (!coverage) throw new TypeError(`Unknown JWST cube band ${request.configuration.band}.`);
  const { answer, observation } = await indexedObservation(root, request, coverage);
  const programId = `${answer.target}-${request.observation}`;
  const { program } = await pinImagingProgram(programId, DEFAULT_CRDS_CONTEXT, [request.observation]);
  const entry = program.bands.find(band => band.observation === request.observation);
  if (!entry || entry.band !== request.configuration.band) throw new Error(`${request.observation} is ${entry?.band ?? 'not a cube'}, not ${request.configuration.band}.`);
  if (observation.programme && program.programme !== observation.programme) throw new Error(`${request.observation} is programme ${program.programme}, not indexed programme ${observation.programme}.`);
  const work = resolve(root, 'output/jwst', programId), run = await runSpec3(programId, request.configuration.band, work);
  const compared = await compareCubeWithMast(programId, request.configuration.band, run.cube, work);
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
  await writeNacoProgram(pinFrames(program, records.flatMap(record => record.inputs)));
  await compareTemplates(programId, work, templates);
  await refreshNacoLedger();
  return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: request.observation,
    program: programId, configuration, product: reductions[0]!.combined,
    receipt: resolve(NACO_PROGRAMS, `${programId}.COADDED_IMG.reproduction.json`), archiveProgramme: configuration.programme };
}

async function qualifyLowellLmi(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (request.configuration.kind !== 'pds-product') throw new TypeError('Lowell LMI qualification requires an exact PDS product.');
  const { answer, observation } = await indexedObservation(root, request, [0.520975, 0.697365]), configuration = request.configuration;
  if (observation.productLidvid !== configuration.lidvid || observation.targetLid !== configuration.targetLid || observation.archiveTarget !== configuration.targetName)
    throw new Error(`${request.observation} does not match the indexed PDS identity.`);
  const programId = `${answer.target}-pds-${request.observation}`;
  const result = await qualifyPdsArchiveProduct({ id: programId, target: answer.target, targetLid: configuration.targetLid, targetName: configuration.targetName,
    lidvid: configuration.lidvid, telescope: 'Lowell/LDT', archiveTelescope: 'Lowell Discovery Telescope (LDT)', mode: 'LMI/VR calibrated image', instrument: 'Large Monolithic Imager', kind: 'image',
    use: 'Archive-calibrated VR detector image of the unresolved Didymos system; suitable as a pinned telescope product, not as a resolved body-surface map.' }, resolve(root, 'output/pds', programId));
  await writeFile(resolve(root, 'data/pds/ledger.json'), `${JSON.stringify(await buildPdsLedger(), null, 2)}\n`);
  return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: request.observation,
    program: programId, configuration, product: result.productPath, receipt: result.recordPath, archiveProgramme: configuration.lidvid };
}

const QUALIFIERS: Readonly<Record<string, (root: string, request: QualificationRequest) => Promise<QualificationResult>>> = Object.freeze({
  'Spitzer :: IRAC Map': qualifySpitzerIrac,
  'JWST :: NIRSPEC/IFU': qualifyJwstNirspec,
  'VLT/NACO :: imaging': qualifyNacoImaging,
  'Lowell/LDT :: LMI/VR calibrated image': qualifyLowellLmi,
});

export async function qualifyObservation(root: string, request: QualificationRequest): Promise<QualificationResult> {
  const qualifier = QUALIFIERS[`${request.telescope} :: ${request.mode}`];
  if (!qualifier) throw new TypeError(`No qualification implementation is registered for ${request.telescope} ${request.mode}.`);
  return qualifier(root, request);
}

export const QUALIFY_HELP = `Usage: pnpm telescope:qualify --target TARGET --telescope NAME --mode MODE --observation ID ROUTE_OPTIONS

Route options are emitted by telescope:query. Registered routes currently use --channel N, --band ID,
--archive-programme ID --archive-target NAME --night YYYY-MM-DD, or the exact --pds-target-lid/--pds-target-name/--pds-lidvid identity.`;

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
