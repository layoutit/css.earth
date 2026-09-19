/** Qualify one indexed archive observation with the telescope-specific reducer that owns its physics. This is deliberately
 * a small dispatcher, not a generic pipeline: the shared API validates target, mode and observation identity, then hands the
 * work to an explicitly registered implementation. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue } from '../../cli-arguments.mts';
import { compareChannel, receiptName } from '../spitzer/compare.mts';
import { defaultDataRoot, pinProgram, writeSpitzerProgram } from '../spitzer/archive.mts';
import { refreshLocalLedger } from '../spitzer/archive-ledger.mts';
import { defaultWorkRoot, remosaicChannel } from '../spitzer/mosaic.mts';
import { loadQueryInputs, queryCapabilities } from './query.mts';
import { supportsQualificationRoute } from './qualification-routes.mts';

export const QUALIFICATION_SCHEMA = 'cssearth-telescope-qualification@1';
export interface QualificationRequest {
  readonly target: string; readonly telescope: string; readonly mode: string; readonly observation: string; readonly channel: number;
}
export interface QualificationResult {
  readonly schema: typeof QUALIFICATION_SCHEMA; readonly target: string; readonly telescope: string; readonly mode: string;
  readonly observation: string; readonly program: string; readonly channel: number; readonly product: string; readonly receipt: string;
  readonly archiveProgramme?: string;
}

async function qualifySpitzerIrac(root: string, request: QualificationRequest): Promise<QualificationResult> {
  if (!supportsQualificationRoute(request.telescope, request.mode, request.channel)) throw new TypeError(`No qualification route handles ${request.telescope} ${request.mode} channel ${request.channel}.`);
  const inputs = await loadQueryInputs(root, request.target);
  const answer = queryCapabilities({ target: request.target, wavelengthMicrometres: [3.176, 9.338] }, inputs);
  if (answer.targetResolution.status === 'unknown') throw new TypeError(`Unknown target ${request.target}.`);
  const candidate = answer.candidates.find(entry => entry.telescope === request.telescope && entry.mode === request.mode);
  if (!candidate) throw new TypeError(`${request.telescope} ${request.mode} has no indexed observation of ${answer.target}.`);
  const observation = candidate.observations?.records?.find(entry => entry.id === request.observation);
  if (!observation) throw new TypeError(`${request.observation} is not an indexed ${request.telescope} ${request.mode} observation of ${answer.target}.`);
  const aorKey = Number(request.observation);
  if (!Number.isSafeInteger(aorKey) || aorKey <= 0) throw new TypeError(`Spitzer observation ${request.observation} is not an AORKEY.`);
  const programId = `${answer.target}-${request.observation}`;
  const program = await pinProgram(programId, aorKey, [request.channel], defaultDataRoot);
  if (program.mode !== request.mode) throw new Error(`AOR ${request.observation} is ${program.mode}, not ${request.mode}.`);
  await writeSpitzerProgram(program);
  const channel = program.channels.find(entry => entry.channel === request.channel);
  if (!channel) throw new Error(`AOR ${request.observation} returned no channel ${request.channel}.`);
  const { record } = await remosaicChannel(program, channel, defaultDataRoot, defaultWorkRoot);
  await compareChannel(program, channel, defaultDataRoot, defaultWorkRoot);
  await refreshLocalLedger();
  return { schema: QUALIFICATION_SCHEMA, target: answer.target, telescope: request.telescope, mode: request.mode, observation: request.observation,
    program: programId, channel: request.channel, product: record.outputs[0]!.path, receipt: receiptName(programId, request.channel),
    ...(observation.programme ? { archiveProgramme: observation.programme } : {}) };
}

const QUALIFIERS: Readonly<Record<string, (root: string, request: QualificationRequest) => Promise<QualificationResult>>> = Object.freeze({
  'Spitzer :: IRAC Map': qualifySpitzerIrac,
});

export async function qualifyObservation(root: string, request: QualificationRequest): Promise<QualificationResult> {
  const qualifier = QUALIFIERS[`${request.telescope} :: ${request.mode}`];
  if (!qualifier) throw new TypeError(`No qualification implementation is registered for ${request.telescope} ${request.mode}.`);
  return qualifier(root, request);
}

export const QUALIFY_HELP = 'Usage: pnpm telescope:qualify --target TARGET --telescope NAME --mode MODE --observation ID --channel N';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) process.stdout.write(`${QUALIFY_HELP}\n`);
  else {
    const target = flagValue(args, '--target'), telescope = flagValue(args, '--telescope'), mode = flagValue(args, '--mode'), observation = flagValue(args, '--observation');
    const channel = Number(flagValue(args, '--channel'));
    if (!target || !telescope || !mode || !observation || !Number.isSafeInteger(channel) || channel <= 0) throw new TypeError(QUALIFY_HELP);
    process.stdout.write(`${JSON.stringify(await qualifyObservation(resolve(import.meta.dirname, '../../..'), { target, telescope, mode, observation, channel }), null, 2)}\n`);
  }
}
