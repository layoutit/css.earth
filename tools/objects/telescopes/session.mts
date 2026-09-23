/** Saved requests connect the public query and qualifier. They never authorize stale archive actions. */
import { copyFile, mkdir, open, readFile, rename, rm, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256File } from '../../../src/platform/sha256.mts';
import { hasErrorCode, requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { readProductRecord, type ProductRecord } from '../product-record.mts';
import { loadQueryInputs, queryCapabilities, requestFromArguments, selectObservation, assessObservationSelection,
  type CapabilityAnswer, type CapabilityRequest, type QueryInputs } from './query.mts';
import { matchingProduct, loadQualifiedObservations, type QualifiedObservation } from './qualified-observations.mts';
import { qualifyObservation, type QualificationRequest } from './qualify.mts';
import { selectedProductInput } from './selected-product.mts';
import { qualifiedProductInput } from './selected-product.mts';
import { assessRequest, type ProductFacts } from './request-satisfaction.mts';
import type { QualificationConfiguration } from './qualification-routes.mts';
import { EXPLORATION_SCHEMA, exploreTarget, parseExplorationArguments, type ExplorationAnswer, type ExplorationChoice, type ExplorationRequest } from './exploration.mts';
import type { DeliveryContext, ExplorationReference as DeliveryExplorationReference } from './delivery-context.mts';
import { canonical } from './vo/contracts.mts';

export const SESSION_SCHEMA = 'cssearth-telescope-session@1';
export interface Choice {
  readonly acquisitionKey?: string;
  readonly pick: number; readonly telescope: string; readonly mode: string; readonly observation: string; readonly program: string;
  readonly state: 'ready' | 'qualify'; readonly configuration?: QualificationConfiguration; readonly product?: QualifiedObservation;
  readonly sourceId?: string;
}
export const choiceKey = (choice: Pick<Choice, 'telescope' | 'mode' | 'observation' | 'program' | 'acquisitionKey'>): string =>
  JSON.stringify(choice.acquisitionKey ? ['vo-acquisition@1', choice.acquisitionKey] : [choice.telescope, choice.mode, choice.observation, choice.program]);

/** Only offer observations that have a current artifact or an API-provided qualification action. */
export function observationChoices(answer: CapabilityAnswer): Choice[] {
  const choices = new Map<string, Choice>();
  const add = (choice: Omit<Choice, 'pick'>) => { const key = choiceKey(choice); if (!choices.has(key)) choices.set(key, { ...choice, pick: choices.size + 1 }); };
  for (const candidate of answer.candidates) {
    const { telescope, mode } = candidate;
    for (const product of candidate.qualifiedProducts ?? []) {
      if (assessObservationSelection(answer, telescope, mode, product.program).blockers.length) continue;
      const best = matchingProduct((candidate.qualifiedProducts ?? []).filter(p => p.observation === product.observation), answer.request, product.program);
      if (best) add({ telescope, mode, observation: best.observation, program: best.program, state: 'ready', product: best });
    }
    for (const action of candidate.selectionAssessment.qualificationActions) {
      add({ telescope, mode, observation: action.observation, program: action.configuration.kind === 'source-product' ? action.configuration.id : action.program,
        configuration: action.configuration, ...(action.configuration.kind === 'source-product' ? { sourceId: action.configuration.id } : {}), state: 'qualify' });
    }
  }
  for (const candidate of answer.archiveProducts ?? []) {
    if (candidate.satisfaction.status === 'refused' || !candidate.product && !candidate.action) continue;
    const configuration = candidate.action?.configuration;
    add({ acquisitionKey: candidate.acquisitionKey, telescope: candidate.observation.service, mode: candidate.product?.mode ?? `native-${candidate.observation.kind}`,
      observation: candidate.observation.key, program: candidate.acquisitionKey, state: candidate.product ? 'ready' : 'qualify',
      ...(configuration ? { configuration } : {}), ...(candidate.product ? { product: candidate.product } : {}) });
  }
  return [...choices.values()];
}

export interface Session {
  readonly schema: typeof SESSION_SCHEMA; readonly createdAt: string; readonly arguments: readonly string[];
  readonly target: string; readonly choices: readonly Choice[]; readonly answer: CapabilityAnswer;
}
export interface SessionServices {
  readonly loadRequest?: (root: string, request: CapabilityRequest, selectedObservation?: string, progress?: (stage:string)=>void) => Promise<QueryInputs>;
  readonly load: (root: string, target: string) => Promise<QueryInputs>;
  readonly qualify: (root: string, request: QualificationRequest) => Promise<unknown>;
  readonly explore?: (root: string, request: ExplorationRequest, selectedObservation?: string, progress?: (stage:string)=>void) => Promise<ExplorationAnswer>;
}
const services: SessionServices = { load: loadQueryInputs, loadRequest: loadQueryInputs, qualify: qualifyObservation, explore: exploreTarget };
const loadForRequest = (api: SessionServices, root: string, request: CapabilityRequest, selectedObservation?: string, progress?: (stage:string)=>void) => api.loadRequest ? api.loadRequest(root, request, selectedObservation, progress) : api.load(root, request.target);
const emptyInputs: QueryInputs = { ledgers: [], capabilities: [], targetCatalogue: [], targetAssociations: [], bodyMaps: [] };
const exploreForRequest = (api: SessionServices, root: string, request: ExplorationRequest, selectedObservation?: string, progress?: (stage:string)=>void) =>
  (api.explore ?? exploreTarget)(root, request, selectedObservation, progress);
export function sessionRequest(args: readonly string[]): CapabilityRequest {
  const request = requestFromArguments(args);
  queryCapabilities(request, emptyInputs); // Public validation, before archive IO.
  if (request.result !== 'telescope-product') throw new TypeError('Saved telescope queries retrieve native products. Derived outputs are selected later with telescope export.');
  if (!request.time || !request.kind || (request.angularResolutionArcsec === undefined && request.surfaceResolutionKm === undefined && request.resolutionElements === undefined))
    throw new TypeError('State --kind, --any-time or --from/--to, and a resolution requirement (--min-arcsec, --min-km or --min-elements).');
  if (request.surfaceResolutionKm !== undefined && request.rangeKm === undefined || request.resolutionElements !== undefined && (request.rangeKm === undefined || request.bodyRadiusKm === undefined))
    throw new TypeError('Surface resolution needs --range-km; resolution elements also need --radius-km.');
  return request;
}
async function locked<T>(directory: string, run: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, '.session.lock');
  const file = await open(path, 'wx').catch((error: unknown) => {
    if (hasErrorCode(error, 'EEXIST')) throw new Error(`Another operation owns ${path}. If its process was interrupted, inspect the lock before removing it.`);
    throw error;
  });
  try { await file.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await run(); }
  finally { await file.close(); await rm(path, { force: true }); }
}
export async function saveSession(root: string, args: readonly string[], directory: string, api: SessionServices = services, progress?: (stage:string)=>void): Promise<Session> {
  const request = sessionRequest(args);
  return locked(directory, async () => {
    const path = resolve(directory, 'query.json');
    try { await readFile(path); throw new Error(`${path} already exists. Use a new --out directory to preserve its numbered choices.`); }
    catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
    const inputs=await loadForRequest(api, root, request, undefined, progress);
    progress?.('Evaluating candidates');
    const answer = queryCapabilities(request, inputs);
    progress?.('Saving query');
    const session: Session = { schema: SESSION_SCHEMA, createdAt: new Date().toISOString(), arguments: args, target: answer.target, choices: observationChoices(answer), answer };
    const temporary = `${path}.${randomUUID()}.partial`;
    try { await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`); await rename(temporary, path); }
    finally { await rm(temporary, { force: true }); }
    return session;
  });
}

export interface ExplorationSession {
  readonly schema: typeof EXPLORATION_SCHEMA; readonly createdAt: string; readonly arguments: readonly string[];
  readonly target: string; readonly choices: readonly ExplorationChoice[]; readonly answer: ExplorationAnswer;
}
const runDirectory = (target: string) => {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, '');
  const canonical = target.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'unknown-target';
  return resolve(process.cwd(), 'telescope-runs', `${canonical}-${stamp}-${randomUUID().slice(0, 8)}`);
};
/** Save the unfiltered archive exploration separately from a scientific query. */
export async function saveExploration(root: string, args: readonly string[], directory?: string, api: SessionServices = services, progress?: (stage:string)=>void): Promise<ExplorationSession & { readonly directory: string }> {
  const request = parseExplorationArguments(args), initial = await exploreForRequest(api, root, request, undefined, progress);
  progress?.('Saving exploration');
  const destination = directory ?? runDirectory(initial.target);
  return locked(destination, async () => {
    const path = resolve(destination, 'explore.json');
    try { await readFile(path); throw new Error(`${path} already exists. Use a new --out directory to preserve its numbered choices.`); }
    catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
    const answer = initial;
    const session: ExplorationSession = { schema: EXPLORATION_SCHEMA, createdAt: new Date().toISOString(), arguments: args, target: answer.target, choices: answer.choices, answer };
    const temporary = `${path}.${randomUUID()}.partial`;
    try { await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`); await rename(temporary, path); }
    finally { await rm(temporary, { force: true }); }
    return { ...session, directory: destination };
  });
}

function readSavedChoice(value: unknown, pick: number) {
  const session = requireRecord(value, 'saved query');
  if (session.schema !== SESSION_SCHEMA) throw new TypeError('Unsupported saved query schema.');
  const args = requireArray(session.arguments, 'saved arguments').map(value => requireString(value, 'argument'));
  const choices = requireArray(session.choices, 'saved choices');
  if (!Number.isSafeInteger(pick) || pick < 1 || pick > choices.length) throw new TypeError(`--pick must be between 1 and ${choices.length}.`);
  const choice = requireRecord(choices[pick - 1], 'saved choice');
  if (choice.pick !== pick) throw new TypeError('Saved choice numbering is inconsistent.');
  return { args, ...(choice.acquisitionKey === undefined ? {} : { selectedObservation: requireString(choice.observation) }), target: requireString(session.target, 'saved target'), key: choiceKey({ ...(choice.acquisitionKey === undefined ? {} : { acquisitionKey: requireString(choice.acquisitionKey) }), telescope: requireString(choice.telescope), mode: requireString(choice.mode),
    observation: requireString(choice.observation), program: requireString(choice.program) }) };
}
interface FilePin { readonly bytes: number; readonly sha256: string }
interface ExportFile extends FilePin { readonly path: string; readonly original: string }
interface Artifact {
  readonly file: string; readonly receipt: string; readonly record: string; readonly outputRoot: string;
  readonly facts: ProductFacts; readonly extraEvidence: readonly string[];
}
function relativeFile(root: string, file: string): string {
  const path = relative(root, resolve(root, file));
  if (!path || path === '..' || path.startsWith('../') || isAbsolute(path)) throw new Error(`Artifact is outside the repository: ${file}`);
  return path;
}
async function resolveArtifact(root: string, answer: CapabilityAnswer, choice: Choice): Promise<Artifact> {
  if (!choice.product) throw new Error('The route did not produce a current, selectable artifact.');
  // Bind this observation even when a program contains several qualified observations.
  const selected = await selectedProductInput(root, { ...selectObservation(answer, choice.telescope, choice.mode, choice.program), product: choice.product });
  const q = selected.qualification;
  return { file: selected.file, receipt: resolve(root, q.receipt), record: resolve(root, q.productRecord), outputRoot: resolve(root, q.outputRoot), facts: selected.facts,
    extraEvidence: [...(q.facts.calibrationDependencies??[]).flatMap(d=>d.file?[resolve(root,d.file)]:[]), ...(q.facts.angularResolutionBound ? [resolve(root, q.facts.angularResolutionBound.receipt)] : []),
      ...(q.facts.resolutionEvidence ?? []).flatMap(e => e.receipt ? [resolve(root, e.receipt.file)] : [])] };
}

/** Copy the complete native output set and its evidence, keeping relative paths in receipts resolvable. */
async function exportArtifact(root: string, destination: string, artifact: Artifact, progress: (text: string) => void, reuse = false): Promise<{ files: ExportFile[]; record: ProductRecord }> {
  const record = await readProductRecord(artifact.record);
  if (!record) throw new Error('Qualification product record is missing.');
  const expected = new Map<string, FilePin>();
  for (const output of record.outputs) {
    if (!output.sha256) throw new Error('The producing record has no content digest. Requalify this observation before delivery.');
    expected.set(resolve(artifact.outputRoot, output.path), { bytes: output.bytes, sha256: output.sha256 });
  }
  if (!expected.has(artifact.file)) throw new Error('The chosen file is not a qualified output.');
  for (const evidence of record.evidence) {
    const path = resolve(artifact.outputRoot, evidence.receipt);
    expected.set(path, await sha256File(path));
  }
  for (const path of [artifact.record, artifact.receipt, ...artifact.extraEvidence]) if (!expected.has(path)) expected.set(path, await sha256File(path));
  const files: ExportFile[] = [], realRoot = await realpath(root);
  for (const [file, pin] of expected) {
    relativeFile(realRoot, await realpath(file));
    const source = await sha256File(file);
    if (source.bytes !== pin.bytes || source.sha256 !== pin.sha256) throw new Error(`Artifact changed or did not match its qualification: ${file}`);
    const original = relativeFile(root, file), path = `files/${original}`, target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    progress(`${reuse ? 'Verifying' : 'Copying'} ${basename(file)} (${(pin.bytes / 1e6).toFixed(1)} MB)`);
    if (!reuse) await copyFile(file, target);
    relativeFile(await realpath(destination), await realpath(target));
    const copied = await sha256File(target);
    if (copied.bytes !== pin.bytes || copied.sha256 !== pin.sha256) throw new Error(`Artifact changed or did not match its qualification: ${original}`);
    files.push({ path, original, ...copied });
  }
  return { files, record };
}

async function getScientificSession(root: string, directory: string, pick: number, progress: (text: string) => void = () => {}, api: SessionServices = services, options: { readonly offline?: boolean } = {}) {
  return locked(directory, async () => {
    const saved = readSavedChoice(JSON.parse(await readFile(resolve(directory, 'query.json'), 'utf8')), pick), request = sessionRequest(saved.args);
    if (options.offline) {
      const resultPath = resolve(directory, `pick-${pick}`, 'result.json'), { delivery } = await import('./outputs.mts');
      const local = await delivery(resultPath), { canonical } = await import('./vo/contracts.mts');
      if (local.context.kind !== 'scientific-request' || local.record.choice !== saved.key || canonical(local.context.request) !== canonical({ ...request, target: saved.target })) throw new Error('Offline delivery differs from its saved scientific request or choice.');
      progress('Replaying the pinned local delivery; no remote archive was refreshed.');
      return { resultPath, product: local.file, satisfaction: local.context.assessment, context: local.context, reused: true, replay: 'pinned-local-artifact' as const };
    }
    progress('Revalidating the saved observation');
    let inputs = await loadForRequest(api, root, request, saved.selectedObservation), answer = queryCapabilities(request, inputs);
    if (answer.target !== saved.target) throw new Error('Target identity changed since the saved query. Save a new query.');
    let choice = observationChoices(answer).find(entry => choiceKey(entry) === saved.key);
    if (!choice) throw new Error('The saved observation is no longer available for this request. Save a new query to inspect current blockers.');
    if (choice.state === 'qualify') {
      if (!choice.configuration) throw new Error('No current qualification action.');
      progress(`Qualifying ${choice.telescope} ${choice.mode}: ${choice.observation}`);
      const qualification = { target: answer.target, telescope: choice.telescope, mode: choice.mode, observation: choice.observation, configuration: choice.configuration };
      await locked(resolve(root, 'output/telescopes'), () => api.qualify(root, qualification));
      inputs = choice.acquisitionKey ? { ...inputs, qualifiedProducts: await loadQualifiedObservations(root, answer.target) } : await loadForRequest(api, root, { ...request, target: answer.target });
      answer = queryCapabilities(request, inputs);
      choice = observationChoices(answer).find(entry => choiceKey(entry) === saved.key);
      if (!choice || choice.state !== 'ready') throw new Error('Qualification did not produce a selectable artifact for the original request. Re-query for the current verdict.');
    }
    const artifact = await resolveArtifact(root, answer, choice), satisfaction = assessRequest(answer.request, artifact.facts);
    const resultPath = resolve(directory, `pick-${pick}`, 'result.json');
    const previous = await readFile(resultPath, 'utf8').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (previous !== undefined) {
      const old = requireRecord(JSON.parse(previous), 'previous result');
      if (old.schema !== 'cssearth-telescope-delivery@3' || old.choice !== saved.key || JSON.stringify(requireRecord(old.context).request) !== JSON.stringify(answer.request))
        throw new Error('Saved result identity differs. Preserve it and use a new query directory.');
      const { files, record } = await exportArtifact(root, dirname(resultPath), artifact, progress, true);
      const product = `files/${relativeFile(root, artifact.file)}`;
      const context: DeliveryContext = { kind: 'scientific-request', request: answer.request, assessment: satisfaction };
      const result = { schema: 'cssearth-telescope-delivery@3', choice: saved.key, context, observation: choice.observation, product, outputRoot: resolve(root) === resolve(artifact.outputRoot) ? 'files' : `files/${relativeFile(root, artifact.outputRoot)}`,
        receipt: `files/${relativeFile(root, artifact.receipt)}`, record: `files/${relativeFile(root, artifact.record)}`, facts: artifact.facts,
        evidence: record.evidence, files, reused: true };
      const temporary = `${resultPath}.${randomUUID()}.partial`;
      try { await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`); await rename(temporary, resultPath); }
      finally { await rm(temporary, { force: true }); }
      return { resultPath, product: resolve(dirname(resultPath), product), satisfaction, context, reused: true };
    }
    const staging = resolve(directory, `.pick-${pick}-${randomUUID()}.partial`);
    await mkdir(staging);
    try {
      const { files, record } = await exportArtifact(root, staging, artifact, progress);
      const product = `files/${relativeFile(root, artifact.file)}`;
      const context: DeliveryContext = { kind: 'scientific-request', request: answer.request, assessment: satisfaction };
      const result = { schema: 'cssearth-telescope-delivery@3', choice: saved.key, context, observation: choice.observation, product, outputRoot: resolve(root) === resolve(artifact.outputRoot) ? 'files' : `files/${relativeFile(root, artifact.outputRoot)}`,
        receipt: `files/${relativeFile(root, artifact.receipt)}`, record: `files/${relativeFile(root, artifact.record)}`, facts: artifact.facts,
        evidence: record.evidence, files, reused: false };
      await writeFile(resolve(staging, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      await rename(staging, dirname(resultPath));
      return { resultPath, product: resolve(dirname(resultPath), product), satisfaction, context, reused: false };
    } finally { await rm(staging, { recursive: true, force: true }); }
  });
}

function readExplorationChoice(value: unknown, pick: number) {
  const session = requireRecord(value, 'saved exploration');
  if (session.schema !== EXPLORATION_SCHEMA) throw new TypeError('Unsupported saved exploration schema.');
  const args = requireArray(session.arguments, 'saved exploration arguments').map(value => requireString(value, 'argument'));
  const choices = requireArray(session.choices, 'saved exploration choices');
  if (!Number.isSafeInteger(pick) || pick < 1 || pick > choices.length) throw new TypeError(`--pick must be between 1 and ${choices.length}.`);
  const choice = requireRecord(choices[pick - 1], 'saved exploration choice');
  if (choice.pick !== pick) throw new TypeError('Saved exploration choice numbering is inconsistent.');
  const reference = requireRecord(choice.reference, 'saved exploration reference');
  return { args, target: requireString(session.target, 'saved exploration target'), key: requireString(choice.key, 'saved exploration key'), observation: requireString(choice.observation, 'saved exploration observation'), reference };
}

async function resolveExplorationArtifact(root: string, choice: ExplorationChoice): Promise<Artifact> {
  if (!choice.product) throw new Error('The route did not produce a current, selectable artifact.');
  const selected = await qualifiedProductInput(root, choice.product), q = selected.qualification;
  return { file: selected.file, receipt: resolve(root, q.receipt), record: resolve(root, q.productRecord), outputRoot: resolve(root, q.outputRoot), facts: selected.facts,
    extraEvidence: [...(q.facts.calibrationDependencies ?? []).flatMap(entry => entry.file ? [resolve(root, entry.file)] : []), ...(q.facts.angularResolutionBound ? [resolve(root, q.facts.angularResolutionBound.receipt)] : []),
      ...(q.facts.resolutionEvidence ?? []).flatMap(entry => entry.receipt ? [resolve(root, entry.receipt.file)] : [])] };
}

const explorationContext = (target: string, reference: Record<string, unknown>): DeliveryContext => ({
  kind: 'exploration', target,
  discovery: { schema: EXPLORATION_SCHEMA, choice: reference } as unknown as DeliveryExplorationReference,
  assessment: { status: 'not-requested' },
});

/**
 * The saved choice in a fresh exploration. An archive choice keeps its observation and acquisition identity across runs, but
 * its reference also names the response snapshot it was seen in, and services such as ALMA stamp every answer with the
 * query time. Such a choice is found by its identity; the saved reference still records the snapshot it was chosen from.
 */
export function savedChoice(choices: readonly ExplorationChoice[], saved: { readonly key: string; readonly reference: Readonly<Record<string, unknown>> }): ExplorationChoice | undefined {
  const exact = choices.find(entry => entry.key === saved.key);
  if (exact || saved.reference.kind !== 'vo-acquisition') return exact;
  const matches = choices.filter(entry => entry.reference.kind === 'vo-acquisition' && entry.reference.observation === saved.reference.observation
    && entry.reference.acquisitionKey === saved.reference.acquisitionKey);
  return matches.length === 1 ? matches[0] : undefined;
}
async function getExplorationSession(root: string, directory: string, pick: number, progress: (text: string) => void = () => {}, api: SessionServices = services, options: { readonly offline?: boolean } = {}) {
  return locked(directory, async () => {
    const saved = readExplorationChoice(JSON.parse(await readFile(resolve(directory, 'explore.json'), 'utf8')), pick), request = parseExplorationArguments(saved.args);
    const resultPath = resolve(directory, `pick-${pick}`, 'result.json');
    if (options.offline) {
      const { delivery } = await import('./outputs.mts'), local = await delivery(resultPath);
      if (local.context.kind !== 'exploration' || local.context.target !== saved.target || local.record.choice !== saved.key || canonical(local.context.discovery) !== canonical({ schema: EXPLORATION_SCHEMA, choice: saved.reference }))
        throw new Error('Offline delivery differs from its saved exploration or choice.');
      progress('Replaying the pinned local delivery; no remote archive was refreshed.');
      return { resultPath, product: local.file, context: local.context, assessment: local.context.assessment, reused: true, replay: 'pinned-local-artifact' as const };
    }
    progress('Revalidating the saved observation');
    let answer = await exploreForRequest(api, root, request, saved.observation);
    if (answer.target !== saved.target) throw new Error('Target identity changed since the saved exploration. Save a new exploration.');
    let choice = savedChoice(answer.choices, saved);
    if (!choice) throw new Error('The saved observation is no longer available for this exploration. Explore again to inspect current blockers.');
    if (choice.state === 'qualify') {
      if (!choice.configuration) throw new Error('No current qualification action.');
      const qualifying = choice;
      progress(`Qualifying ${choice.telescope} ${choice.mode}: ${choice.observation}`);
      await locked(resolve(root, 'output/telescopes'), () => api.qualify(root, { target: answer.target, telescope: qualifying.telescope, mode: qualifying.mode, observation: qualifying.observation, configuration: qualifying.configuration! }));
      answer = await exploreForRequest(api, root, { ...request, ...answer.request.skyTarget ? { skyTarget: answer.request.skyTarget } : {} }, saved.observation);
      choice = savedChoice(answer.choices, saved);
      if (!choice || choice.state !== 'ready') throw new Error('Qualification did not produce a selectable artifact for the original exploration. Explore again for the current result.');
    }
    const artifact = await resolveExplorationArtifact(root, choice), context = explorationContext(answer.target, saved.reference);
    const previous = await readFile(resultPath, 'utf8').catch((error: unknown) => hasErrorCode(error, 'ENOENT') ? undefined : Promise.reject(error));
    const write = async (destination: string, reuse: boolean) => {
      const { files, record } = await exportArtifact(root, destination, artifact, progress, reuse), product = `files/${relativeFile(root, artifact.file)}`;
      const result = { schema: 'cssearth-telescope-delivery@3', choice: saved.key, context, observation: choice.observation, product,
        outputRoot: resolve(root) === resolve(artifact.outputRoot) ? 'files' : `files/${relativeFile(root, artifact.outputRoot)}`,
        receipt: `files/${relativeFile(root, artifact.receipt)}`, record: `files/${relativeFile(root, artifact.record)}`, facts: artifact.facts, evidence: record.evidence, files, reused: reuse };
      return { result, product };
    };
    if (previous !== undefined) {
      const old = requireRecord(JSON.parse(previous), 'previous result');
      if (old.schema !== 'cssearth-telescope-delivery@3' || old.choice !== saved.key) throw new Error('Saved result identity differs or predates content pins. Preserve it and use a new exploration directory.');
      const { result, product } = await write(dirname(resultPath), true), temporary = `${resultPath}.${randomUUID()}.partial`;
      try { await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`); await rename(temporary, resultPath); }
      finally { await rm(temporary, { force: true }); }
      return { resultPath, product: resolve(dirname(resultPath), product), context, assessment: context.assessment, reused: true };
    }
    const staging = resolve(directory, `.pick-${pick}-${randomUUID()}.partial`); await mkdir(staging);
    try {
      const { result, product } = await write(staging, false);
      await writeFile(resolve(staging, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      await rename(staging, dirname(resultPath));
      return { resultPath, product: resolve(dirname(resultPath), product), context, assessment: context.assessment, reused: false };
    } finally { await rm(staging, { recursive: true, force: true }); }
  });
}

/** Read exactly one saved entrance. A directory cannot mix a scientific query and an exploration. */
export async function getSession(root: string, directory: string, pick: number, progress: (text: string) => void = () => {}, api: SessionServices = services, options: { readonly offline?: boolean } = {}) {
  const [query, explore] = await Promise.all([readFile(resolve(directory, 'query.json')).then(() => true).catch(error => hasErrorCode(error, 'ENOENT') ? false : Promise.reject(error)), readFile(resolve(directory, 'explore.json')).then(() => true).catch(error => hasErrorCode(error, 'ENOENT') ? false : Promise.reject(error))]);
  if (query === explore) throw new Error(query ? 'A saved directory cannot contain both query.json and explore.json.' : 'Expected query.json or explore.json.');
  return query ? getScientificSession(root, directory, pick, progress, api, options) : getExplorationSession(root, directory, pick, progress, api, options);
}

/** Additive saved assessment for a selected family descriptor. It deliberately does not run the strict archive query. */
export const FAMILY_REQUEST_SESSION_SCHEMA='cssearth-telescope-family-request@1' as const;
export interface FamilyRequestSession {readonly schema:typeof FAMILY_REQUEST_SESSION_SCHEMA;readonly createdAt:string;readonly original:import('./family-request.mts').NormalizedFamilyRequest;readonly assessment:import('./family-request.mts').FamilyRequestAssessment;readonly status:'matched'|'unresolved'|'refused'}
export async function saveFamilyRequestSession(directory:string,input:import('./family-request.mts').FamilyScientificRequest,descriptor:unknown):Promise<FamilyRequestSession>{
  const {assessFamilyRequest}=await import('./family-request.mts');const assessment=await assessFamilyRequest(input,descriptor),answers=Object.values(assessment.verdicts).filter((value):value is NonNullable<typeof value>=>value!==undefined),status=answers.some(v=>v.answer==='no')?'refused':answers.length&&answers.every(v=>v.answer==='yes')?'matched':'unresolved';
  return locked(directory,async()=>{const path=resolve(directory,'family-request.json');try{await readFile(path);throw new Error(`${path} already exists. Use a new --out directory.`);}catch(error){if(!hasErrorCode(error,'ENOENT'))throw error;}const saved:FamilyRequestSession={schema:FAMILY_REQUEST_SESSION_SCHEMA,createdAt:new Date().toISOString(),original:assessment.request,assessment,status};const temporary=`${path}.${randomUUID()}.partial`;try{await writeFile(temporary,`${JSON.stringify(saved,null,2)}\n`);await rename(temporary,path);}finally{await rm(temporary,{force:true});}return saved;});
}
