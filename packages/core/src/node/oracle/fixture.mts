/**
 * Shared reading of oracle fixtures for the comparing tests: the fixture's
 * inputs must be the pinned manifest inputs, and its tool versions must be the
 * pinned requirements, so a comparison is bound to exact inputs and an exact
 * oracle.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '@cssearth/core';

export const ORACLE_ROOT = projectRoot(import.meta.url);
export interface OracleSample { index: number; value: number }

export async function readOracleFixture(name: string) {
  const fixture = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'tests/oracles', name), 'utf8')));
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

/** Every input is a body manifest input, a checked-in FITS fixture or a test-only archive record.
 * Kernel callers supply their existing bank verifier; core does not own acquisition. */
export async function assertPinnedInputs(inputs: readonly { path: string; bytes?: number }[], verifyKernelBank?: (set: string, kernels: readonly string[]) => Promise<unknown>) {
  for (const input of inputs) {
    if (/^tests\/fixtures\/hosted-orbits\/[a-z0-9-]+\/qualification\.json$/u.test(input.path)) {
      verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path)));
      continue;
    }
    if (/^tests\/fixtures\/sbmt\/[a-z0-9-]+\.(json|tab|sum|info)$/u.test(input.path)) {
      verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path)));
      continue;
    }
    if (input.path.startsWith('.local/fits-reference/')) {
      const pin = (await fitsArchiveInputs()).find(pin => pin.path === input.path);
      if (!pin || (input.bytes !== undefined && pin.bytes !== input.bytes)) throw new Error(`FITS test archive record changed: ${input.path}`);
      continue;
    }
    if (/^tests\/fixtures\/fits\/[a-z0-9-]+\.fits$/u.test(input.path)) {
      verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path)));
      continue;
    }
    const kernel = /^src\/spice\/([a-z][a-z0-9-]*)\/(.+)$/u.exec(input.path);
    if (kernel) {
      // A shared kernel bank verifies its own pins (packages/bake/cli/kernel-bank.mts).
      if (!verifyKernelBank) throw new Error('Kernel oracle inputs require the caller bank verifier.');
      await verifyKernelBank(kernel[1]!, [kernel[2]!]);
      verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path)));
      continue;
    }
    const match = /^src\/objects\/([^/]+)\/source\/(.+)$/u.exec(input.path);
    if (!match) throw new Error(`Oracle input outside a body's sources: ${input.path}`);
    const manifest = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/objects', match[1], 'source/manifest.json'), 'utf8')));
    const entry = [...requireArray(manifest.inputs), ...requireArray(manifest.documents)].map(e => requireRecord(e)).find(e => e.path === match[2]);
    if (!entry) throw new Error(`Oracle input is not a manifest input or document: ${input.path}`);
    verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path)));
  }
}

/** Verify the actual buffer about to be decoded has the recorded size. */
export function verifyOracleBytes(input: { path: string; bytes?: number }, bytes: Buffer) {
  if (input.bytes !== undefined && bytes.length !== input.bytes) throw new Error(`Oracle source size differs from its record: ${input.path}`);
  return bytes;
}

export async function readOracleInput(input: { path: string; bytes?: number }, verifyKernelBank?: (set: string, kernels: readonly string[]) => Promise<unknown>) {
  await assertPinnedInputs([input], verifyKernelBank);
  try { return verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path))); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new Error(`Missing FITS oracle input ${input.path}. Run pnpm test:fits --restore.`, { cause: error });
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

async function fitsArchiveInputs() {
  const record = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'tests/fixtures/fits/archive-inputs.json'), 'utf8')));
  if (record.schema !== 'cssearth-fits-reference-inputs@1') throw new Error('Invalid FITS reference input record.');
  const inputs = requireArray(record.inputs).map(raw => {
    const entry = requireRecord(raw), path = requireString(entry.path), url = requireString(entry.url);
    const bytes = requireFiniteNumber(entry.bytes);
    if (!/^\.local\/fits-reference\/[a-z0-9-]+\.fits$/u.test(path) || !/^https:\/\//u.test(url) ||
        !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 64 * 1024 * 1024)
      throw new Error('Invalid FITS reference input identity or size.');
    const headers = Object.fromEntries(Object.entries(requireRecord(entry.headers ?? {})).map(([key, value]) => [key, requireString(value)]));
    return { path, url, bytes, headers };
  });
  if (!inputs.length || inputs.length > 16 || new Set(inputs.map(i => i.path)).size !== inputs.length)
    throw new Error('Invalid FITS reference input population.');
  return inputs;
}
