#!/usr/bin/env node
/** Qualify one indexed archive observation with the telescope-specific reducer that owns its physics. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue } from '../../cli-arguments.mts';
import { compareCubeWithMast, runSpec3 } from '../jwst/cubes/spec3.mts';
import { DEFAULT_CRDS_CONTEXT, pinImagingProgram } from '../jwst/imaging/archive.mts';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { refreshLocalLedger as refreshJwstLedger } from '../jwst/archive-ledger.mts';
import { compareChannel, receiptName } from '../spitzer/compare.mts';
import { defaultDataRoot, pinProgram, writeSpitzerProgram } from '../spitzer/archive.mts';
import { refreshLocalLedger as refreshSpitzerLedger } from '../spitzer/archive-ledger.mts';
import { defaultWorkRoot, remosaicChannel } from '../spitzer/mosaic.mts';
import { loadQueryInputs, queryCapabilities } from './query.mts';
import { supportsQualificationRoute, type QualificationConfiguration } from './qualification-routes.mts';

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

const QUALIFIERS: Readonly<Record<string, (root: string, request: QualificationRequest) => Promise<QualificationResult>>> = Object.freeze({
  'Spitzer :: IRAC Map': qualifySpitzerIrac,
  'JWST :: NIRSPEC/IFU': qualifyJwstNirspec,
});

export async function qualifyObservation(root: string, request: QualificationRequest): Promise<QualificationResult> {
  const qualifier = QUALIFIERS[`${request.telescope} :: ${request.mode}`];
  if (!qualifier) throw new TypeError(`No qualification implementation is registered for ${request.telescope} ${request.mode}.`);
  return qualifier(root, request);
}

export const QUALIFY_HELP = 'Usage: pnpm telescope:qualify --target TARGET --telescope NAME --mode MODE --observation ID (--channel N | --band ID)';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) process.stdout.write(`${QUALIFY_HELP}\n`);
  else {
    const target = flagValue(args, '--target'), telescope = flagValue(args, '--telescope'), mode = flagValue(args, '--mode'), observation = flagValue(args, '--observation');
    const channelText = flagValue(args, '--channel'), band = flagValue(args, '--band'), channel = Number(channelText);
    if (!target || !telescope || !mode || !observation || Boolean(channelText) === Boolean(band) || channelText && (!Number.isSafeInteger(channel) || channel <= 0)) throw new TypeError(QUALIFY_HELP);
    const configuration: QualificationConfiguration = band ? { kind: 'jwst-band', band } : { kind: 'spitzer-irac-channel', channel };
    process.stdout.write(`${JSON.stringify(await qualifyObservation(resolve(import.meta.dirname, '../../..'), { target, telescope, mode, observation, configuration }), null, 2)}\n`);
  }
}
