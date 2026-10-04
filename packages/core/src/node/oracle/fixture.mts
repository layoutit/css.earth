/**
 * Shared reading of oracle fixtures for the comparing tests: the fixture's
 * inputs must be the pinned manifest inputs, and its tool versions must be the
 * pinned requirements, so a comparison is bound to exact inputs and an exact
 * oracle.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot } from '../project-root.ts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../validate.ts';
import { MissingSourceInputError } from '../../source-input.ts';

const oraclePath = (path: string) => resolve(ORACLE_ROOT, path);

export const ORACLE_ROOT = projectRoot(import.meta.url);
export interface OracleSample { index: number; value: number }

/** Read a fixture by its absolute or repository-relative path. */
export async function readOracleFixture(name: string) {
  const fixture = requireRecord(JSON.parse(await readFile(oraclePath(name), 'utf8')));
  if (fixture.schema !== 'cssearth-oracle-fixture@1') throw new Error(`${name} is not an oracle fixture.`);
  const inputs = requireArray(fixture.inputs).map(entry => { const e = requireRecord(entry); return { path: requireString(e.path), bytes: requireFiniteNumber(e.bytes) }; });
  // References outside the repository, such as another project's test data, are named by a commit in the URL and their size.
  const references = requireArray(fixture.references ?? []).map(entry => { const e = requireRecord(entry); return { url: requireString(e.url), bytes: requireFiniteNumber(e.bytes) }; });
  return { name, oracle: requireString(fixture.oracle), generatedBy: requireString(fixture.generatedBy), tool: requireRecord(fixture.tool), inputs, references, cases: requireRecord(fixture.cases) };
}

/** The pinned requirement versions, `name==version`, keyed by lower-case distribution name. */
export async function pinnedOracleVersions() {
  const text = await readFile(resolve(import.meta.dirname, 'requirements.txt'), 'utf8');
  return new Map(text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => { const [name, version] = line.split('=='); return [name.toLowerCase().replace(/-/g, '_'), version] as const; }));
}

export interface OracleInput { path: string; bytes?: number }
export type OracleKernelVerifier = (set: string, kernels: readonly string[]) => Promise<unknown>;
export interface OracleInputResolver {
  id: string;
  accepts: (path: string) => boolean;
  verify: (input: OracleInput, verifyKernelBank?: OracleKernelVerifier) => Promise<void>;
}
const resolvers = new Map<string, OracleInputResolver>();

/** Owners explicitly install their setup manifest before reading their oracle inputs. */
export function registerOracleInputResolvers(manifest: readonly OracleInputResolver[]) {
  const incoming = new Set<string>();
  for (const resolver of manifest) {
    if (resolvers.has(resolver.id) || incoming.has(resolver.id)) throw new Error(`Oracle input resolver already registered: ${resolver.id}`);
    incoming.add(resolver.id);
  }
  for (const resolver of manifest) resolvers.set(resolver.id, resolver);
}
const installedOwners = new Set<string>();

/** Idempotence belongs to the singleton registry, including source and built owner modules. */
export function setupOracleInputResolvers(owner: string, manifest: readonly OracleInputResolver[]) {
  if (installedOwners.has(owner)) return;
  registerOracleInputResolvers(manifest);
  installedOwners.add(owner);
}

/** Each input has exactly one owner, which validates its source record. */
export async function assertPinnedInputs(inputs: readonly OracleInput[], verifyKernelBank?: OracleKernelVerifier) {
  try {
    for (const input of inputs) {
      const owners = [...resolvers.values()].filter(resolver => resolver.accepts(input.path));
      if (owners.length !== 1) throw new Error(`Oracle input requires exactly one registered owner: ${input.path} (${owners.length} found).`);
      await owners[0]!.verify(input, verifyKernelBank);
      verifyOracleBytes(input, await readFile(oraclePath(input.path)));
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new MissingSourceInputError(`Missing oracle input ${inputs.map(input => input.path).join(', ')}. Restore it from its owner's declared source record.`, { cause: error });
    throw error;
  }
}

/** Verify the actual buffer about to be decoded has the recorded size. */
export function verifyOracleBytes(input: { path: string; bytes?: number }, bytes: Buffer) {
  if (input.bytes !== undefined && bytes.length !== input.bytes) throw new Error(`Oracle source size differs from its record: ${input.path}`);
  return bytes;
}

export async function readOracleInput(input: { path: string; bytes?: number }, verifyKernelBank?: (set: string, kernels: readonly string[]) => Promise<unknown>) {
  try {
    await assertPinnedInputs([input], verifyKernelBank);
    return verifyOracleBytes(input, await readFile(oraclePath(input.path)));
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new MissingSourceInputError(`Missing oracle input ${input.path}. Restore it from its owner's declared source record.`, { cause: error });
    throw error;
  }
}

export const sampleList = (value: unknown): OracleSample[] => requireArray(value).map(sample => { const s = requireRecord(sample); return { index: requireFiniteNumber(s.index), value: requireFiniteNumber(s.value) }; });

/** A reference is pinned when its URL names a 40-hexadecimal commit and its size is recorded. */
export function assertPinnedReferences(references: readonly { url: string; bytes: number }[]) {
  for (const reference of references) {
    if (!/^https:\/\/(raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\/|github\.com\/[^/]+\/[^/]+\/blob\/[0-9a-f]{40}\/)/u.test(reference.url)) throw new Error(`Oracle reference is not pinned to a commit: ${reference.url}`);
    if (!(reference.bytes > 0)) throw new Error(`Oracle reference lacks its size: ${reference.url}`);
  }
}
