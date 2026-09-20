/** Saved requests connect the public query and qualifier. They never authorize stale archive actions. */
import { copyFile, mkdir, open, readFile, rename, rm, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hasErrorCode, requireArray, requireRecord, requireString } from '../../source-values.mts';
import { pinFile, readProductRecord, type ProductRecord } from '../product-record.mts';
import { loadQueryInputs, queryCapabilities, requestFromArguments, selectObservation, assessObservationSelection,
  type CapabilityAnswer, type CapabilityRequest, type QueryInputs } from './query.mts';
import { matchingProduct, type QualifiedObservation } from './qualified-observations.mts';
import { qualifyObservation, type QualificationRequest } from './qualify.mts';
import { selectedProductInput } from './selected-product.mts';
import { assessRequest, type ProductFacts } from './request-satisfaction.mts';
import type { QualificationConfiguration } from './qualification-routes.mts';

export const SESSION_SCHEMA = 'cssearth-telescope-session@1';
export interface Choice {
  readonly pick: number; readonly telescope: string; readonly mode: string; readonly observation: string; readonly program: string;
  readonly state: 'ready' | 'qualify'; readonly configuration?: QualificationConfiguration; readonly product?: QualifiedObservation;
  readonly sourceId?: string;
}
export const choiceKey = (choice: Pick<Choice, 'telescope' | 'mode' | 'observation' | 'program'>): string =>
  JSON.stringify([choice.telescope, choice.mode, choice.observation, choice.program]);

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
  return [...choices.values()];
}

export interface Session {
  readonly schema: typeof SESSION_SCHEMA; readonly createdAt: string; readonly arguments: readonly string[];
  readonly target: string; readonly choices: readonly Choice[]; readonly answer: CapabilityAnswer;
}
export interface SessionServices {
  readonly load: (root: string, target: string) => Promise<QueryInputs>;
  readonly qualify: (root: string, request: QualificationRequest) => Promise<unknown>;
}
const services: SessionServices = { load: loadQueryInputs, qualify: qualifyObservation };
const emptyInputs: QueryInputs = { ledgers: [], capabilities: [], targetCatalogue: [], targetAssociations: [], bodyMaps: [] };
export function sessionRequest(args: readonly string[]): CapabilityRequest {
  const request = requestFromArguments(args);
  queryCapabilities(request, emptyInputs); // Public validation, before archive IO.
  if (request.result !== 'telescope-product') throw new TypeError('This command retrieves native telescope products. Use telescope:publish-map for body maps.');
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
export async function saveSession(root: string, args: readonly string[], directory: string, api: SessionServices = services): Promise<Session> {
  const request = sessionRequest(args);
  return locked(directory, async () => {
    const path = resolve(directory, 'query.json');
    try { await readFile(path); throw new Error(`${path} already exists. Use a new --out directory to preserve its numbered choices.`); }
    catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
    const answer = queryCapabilities(request, await api.load(root, request.target));
    const session: Session = { schema: SESSION_SCHEMA, createdAt: new Date().toISOString(), arguments: args, target: answer.target, choices: observationChoices(answer), answer };
    const temporary = `${path}.${randomUUID()}.partial`;
    try { await writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`); await rename(temporary, path); }
    finally { await rm(temporary, { force: true }); }
    return session;
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
  return { args, target: requireString(session.target, 'saved target'), key: choiceKey({ telescope: requireString(choice.telescope), mode: requireString(choice.mode),
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
  const selection = selectObservation(answer, choice.telescope, choice.mode, choice.program);
  if (!choice.product) throw new Error('The route did not produce a current, selectable artifact.');
  // Bind this observation even when a program contains several qualified observations.
  const selected = await selectedProductInput(root, { ...selection, product: choice.product });
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
  for (const output of record.outputs) expected.set(resolve(artifact.outputRoot, output.path), output);
  if (!expected.has(artifact.file)) throw new Error('The chosen file is not a qualified output.');
  for (const evidence of record.evidence) {
    const path = resolve(artifact.outputRoot, evidence.receipt);
    expected.set(path, evidence.receiptPin ?? await pinFile(path));
  }
  for (const path of [artifact.record, artifact.receipt, ...artifact.extraEvidence]) if (!expected.has(path)) expected.set(path, await pinFile(path));
  const files: ExportFile[] = [], realRoot = await realpath(root);
  for (const [file, pin] of expected) {
    relativeFile(realRoot, await realpath(file));
    const original = relativeFile(root, file), path = `files/${original}`, target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    progress(`${reuse ? 'Verifying' : 'Copying'} ${basename(file)} (${(pin.bytes / 1e6).toFixed(1)} MB)`);
    if (!reuse) await copyFile(file, target);
    relativeFile(await realpath(destination), await realpath(target));
    const copied = await pinFile(target);
    if (copied.sha256 !== pin.sha256 || copied.bytes !== pin.bytes) throw new Error(`Artifact changed or did not match its qualification: ${original}`);
    files.push({ path, original, ...copied });
  }
  return { files, record };
}

export async function getSession(root: string, directory: string, pick: number, progress: (text: string) => void = () => {}, api: SessionServices = services) {
  return locked(directory, async () => {
    const saved = readSavedChoice(JSON.parse(await readFile(resolve(directory, 'query.json'), 'utf8')), pick), request = sessionRequest(saved.args);
    progress('Revalidating the saved observation');
    let inputs = await api.load(root, request.target), answer = queryCapabilities(request, inputs);
    if (answer.target !== saved.target) throw new Error('Target identity changed since the saved query. Save a new query.');
    let choice = observationChoices(answer).find(entry => choiceKey(entry) === saved.key);
    if (!choice) throw new Error('The saved observation is no longer available for this request. Save a new query to inspect current blockers.');
    if (choice.state === 'qualify') {
      if (!choice.configuration) throw new Error('No current qualification action.');
      progress(`Qualifying ${choice.telescope} ${choice.mode}: ${choice.observation}`);
      const qualification = { target: answer.target, telescope: choice.telescope, mode: choice.mode, observation: choice.observation, configuration: choice.configuration };
      await locked(resolve(root, 'output/telescopes'), () => api.qualify(root, qualification));
      inputs = await api.load(root, answer.target); answer = queryCapabilities(request, inputs);
      choice = observationChoices(answer).find(entry => choiceKey(entry) === saved.key);
      if (!choice || choice.state !== 'ready') throw new Error('Qualification did not produce a selectable artifact for the original request. Re-query for the current verdict.');
    }
    const artifact = await resolveArtifact(root, answer, choice), satisfaction = assessRequest(answer.request, artifact.facts);
    const resultPath = resolve(directory, `pick-${pick}`, 'result.json');
    const previous = await readFile(resultPath, 'utf8').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (previous !== undefined) {
      const old = requireRecord(JSON.parse(previous), 'previous result');
      if (old.schema !== 'cssearth-telescope-delivery@1' || old.choice !== saved.key || JSON.stringify(old.request) !== JSON.stringify(answer.request))
        throw new Error('Saved result identity differs. Preserve it and use a new query directory.');
      const { files, record } = await exportArtifact(root, dirname(resultPath), artifact, progress, true);
      const product = `files/${relativeFile(root, artifact.file)}`;
      const result = { schema: 'cssearth-telescope-delivery@1', choice: saved.key, request: answer.request, observation: choice.observation, product,
        receipt: `files/${relativeFile(root, artifact.receipt)}`, record: `files/${relativeFile(root, artifact.record)}`, facts: artifact.facts,
        satisfaction, evidence: record.evidence, files, reused: true };
      const temporary = `${resultPath}.${randomUUID()}.partial`;
      try { await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`); await rename(temporary, resultPath); }
      finally { await rm(temporary, { force: true }); }
      return { resultPath, product: resolve(dirname(resultPath), product), satisfaction, reused: true };
    }
    const staging = resolve(directory, `.pick-${pick}-${randomUUID()}.partial`);
    await mkdir(staging);
    try {
      const { files, record } = await exportArtifact(root, staging, artifact, progress);
      const product = `files/${relativeFile(root, artifact.file)}`;
      const result = { schema: 'cssearth-telescope-delivery@1', choice: saved.key, request: answer.request, observation: choice.observation, product,
        receipt: `files/${relativeFile(root, artifact.receipt)}`, record: `files/${relativeFile(root, artifact.record)}`, facts: artifact.facts,
        satisfaction, evidence: record.evidence, files, reused: false };
      await writeFile(resolve(staging, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      await rename(staging, dirname(resultPath));
      return { resultPath, product: resolve(dirname(resultPath), product), satisfaction, reused: false };
    } finally { await rm(staging, { recursive: true, force: true }); }
  });
}
