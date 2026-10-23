import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { parseSkyTarget } from '@cssearth/telescope-core/node';
import { EXPLORATION_SCHEMA, parseExplorationArguments, type ExplorationDisplay, type ExplorationReference } from '../exploration.mts';
import { displayPath } from '../cli/cli-format.mts';
import { verifiedProduct } from '../products/verified-product.mts';
import { explorationPickStatuses } from './explore-services.mts';
import type { ExploreChoice, SavedExploration } from './explore.mts';

export interface SavedRun {
  readonly run: string;
  readonly target: string;
  readonly at: string;
  readonly observations: number;
  readonly downloaded: number;
  readonly partial: number;
  readonly made: number;
}
const nullableString = (value: unknown): string | null => value === null ? null : requireString(value);
const nullableNumber = (value: unknown): number | null => value === null ? null : requireFiniteNumber(value);
function pair(value: unknown): readonly [number, number] {
  const values = requireArray(value);
  if (values.length !== 2) throw new TypeError('Expected a saved wavelength pair.');
  return [requireFiniteNumber(values[0]), requireFiniteNumber(values[1])];
}
function display(value: unknown): ExplorationDisplay {
  const record = requireRecord(value, 'saved display'), time = requireRecord(record.observationTime), wavelengths = requireArray(record.wavelengthsMicrometres);
  const basis = record.metadataBasis;
  if (basis !== 'advertised' && basis !== 'indexed' && basis !== 'qualified') throw new TypeError('Invalid saved metadata basis.');
  const range: ExplorationDisplay['wavelengthsMicrometres'] = wavelengths.length === 2 && !Array.isArray(wavelengths[0])
    ? [nullableNumber(wavelengths[0]), nullableNumber(wavelengths[1])] : wavelengths.map(pair);
  const size = nullableNumber(record.advertisedKilobytes);
  if (size !== null && size < 0) throw new TypeError('Invalid saved download size.');
  return { instrument: requireString(record.instrument), observationTime: { startIso: nullableString(time.startIso), endIso: nullableString(time.endIso) },
    productKind: nullableString(record.productKind), wavelengthsMicrometres: range, advertisedKilobytes: size, metadataBasis: basis };
}
function reference(value: unknown): ExplorationReference {
  const record = requireRecord(value, 'saved reference'), observation = requireString(record.observation);
  if (record.kind === 'vo-acquisition') return { kind: record.kind, observation, acquisitionKey: requireString(record.acquisitionKey), snapshot: requireString(record.snapshot) };
  if (record.kind !== 'indexed-observation') throw new TypeError('Invalid saved observation reference.');
  return { kind: record.kind, observation, telescope: requireString(record.telescope), mode: requireString(record.mode), programme: requireString(record.programme) };
}

/** Decode only the saved screen's inputs; the original file remains the retrieval owner's evidence. */
export async function readSavedExploration(directory: string): Promise<SavedExploration> {
  const path = resolve(directory, 'explore.json');
  try {
    const record = requireRecord(JSON.parse(await readFile(path, 'utf8')), 'saved exploration');
    if (record.schema !== EXPLORATION_SCHEMA) throw new TypeError('Unsupported saved exploration schema.');
    const createdAt = requireString(record.createdAt), args = requireArray(record.arguments).map(value => requireString(value));
    if (!Number.isFinite(Date.parse(createdAt))) throw new TypeError('Invalid saved run date.');
    const answer = requireRecord(record.answer), outcome = requireRecord(answer.outcome), resolution = requireRecord(answer.targetResolution);
    if (answer.schema !== EXPLORATION_SCHEMA) throw new TypeError('Unsupported saved answer schema.');
    const selection = outcome.selection, coverage = outcome.coverage;
    if (selection !== 'available' && selection !== 'none') throw new TypeError('Invalid saved selection.');
    if (coverage !== 'bounded' && coverage !== 'incomplete' && coverage !== 'target-unresolved') throw new TypeError('Invalid saved coverage.');
    const status = requireString(resolution.status);
    if (!['resolved', 'unknown', 'ambiguous', 'position'].includes(status)) throw new TypeError('Invalid saved target resolution.');
    const canonical = status === 'resolved' ? { name: requireString(requireRecord(resolution.canonical).name) } : undefined;
    const choices: ExploreChoice[] = requireArray(record.choices).map((value, index) => {
      const choice = requireRecord(value), pick = requireFiniteNumber(choice.pick);
      if (pick !== index + 1) throw new TypeError('Saved choice numbering is inconsistent.');
      return { pick, telescope: requireString(choice.telescope), observation: requireString(choice.observation),
        ...(choice.archiveService === undefined ? {} : { archiveService: requireString(choice.archiveService) }),
        reference: reference(choice.reference), display: display(choice.display) };
    });
    const request = parseExplorationArguments(args), savedRequest = requireRecord(answer.request);
    return { schema: EXPLORATION_SCHEMA, createdAt, arguments: args, directory: resolve(directory),
      ...(record.target === undefined ? {} : { target: requireString(record.target) }), choices,
      answer: { request: { ...request, ...(savedRequest.skyTarget === undefined ? {} : { skyTarget: parseSkyTarget(savedRequest.skyTarget) }) },
        targetResolution: { status, ...(canonical ? { canonical } : {}) }, outcome: { selection, coverage },
        services: requireArray(answer.services).map(value => {
          const service = requireRecord(value);
          return { service: requireString(service.service), state: requireString(service.state), reason: requireString(service.reason) };
        }) } };
  } catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
}

async function entries(directory: string) {
  return readdir(directory, { withFileTypes: true }).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return []; throw error; });
}
/** One completed make choice, with its published files still present, counts once. */
async function madeOutputs(directory: string): Promise<number> {
  let count = 0;
  for (const option of await entries(directory)) {
    if (!option.isDirectory() || option.name.endsWith('.partial')) continue;
    const path = resolve(directory, option.name);
    for (const record of await entries(path)) {
      if (!record.isFile() || !record.name.endsWith('.product.json')) continue;
      const product = await verifiedProduct(resolve(path, record.name));
      if (product.record.outputs.length) { count++; break; }
    }
  }
  return count;
}

export async function listSavedRuns(directory: string): Promise<readonly SavedRun[]> {
  const runs: SavedRun[] = [];
  for (const entry of await entries(directory)) {
    if (!entry.isDirectory()) continue;
    const path = resolve(directory, entry.name);
    if (!(await entries(path)).some(file => file.isFile() && file.name === 'explore.json')) continue;
    const session = await readSavedExploration(path), statuses = [...(await explorationPickStatuses(session)).values()];
    let made = 0;
    for (const choice of session.choices) made += await madeOutputs(resolve(path, `pick-${choice.pick}`, 'made'));
    runs.push({ run: displayPath(path), target: session.answer.targetResolution.canonical?.name ?? session.target ?? 'Field', at: session.createdAt,
      observations: session.choices.length, downloaded: statuses.filter(status => status.state === 'done').length,
      partial: statuses.filter(status => status.state === 'partial').length, made });
  }
  return runs.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.run.localeCompare(b.run));
}
