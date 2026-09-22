/**
 * Shared reading of oracle fixtures for the comparing tests: the fixture's
 * inputs must be the pinned manifest inputs, and its tool versions must be the
 * pinned requirements, so a comparison is bound to exact inputs and an exact
 * oracle.
 */
import { sha256 } from '../../src/platform/sha256.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fitsArchiveInputs } from './fits/archive-inputs.mts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../sources/source-values.mts';

export const ORACLE_ROOT = resolve(import.meta.dirname, '../..');
export interface OracleSample { index: number; value: number }

export async function readOracleFixture(name: string) {
  const fixture = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'tests/oracles', name), 'utf8')));
  if (fixture.schema !== 'cssearth-oracle-fixture@1') throw new Error(`${name} is not an oracle fixture.`);
  const inputs = requireArray(fixture.inputs).map(entry => { const e = requireRecord(entry); return { path: requireString(e.path), sha256: requireString(e.sha256), bytes: requireFiniteNumber(e.bytes) }; });
  // References outside the repository, such as another project's test data, are pinned by a commit in the URL and their bytes.
  const references = requireArray(fixture.references ?? []).map(entry => { const e = requireRecord(entry); return { url: requireString(e.url), sha256: requireString(e.sha256), bytes: requireFiniteNumber(e.bytes) }; });
  return { name, oracle: requireString(fixture.oracle), generatedBy: requireString(fixture.generatedBy), tool: requireRecord(fixture.tool), inputs, references, cases: requireRecord(fixture.cases) };
}

/** The pinned requirement versions, `name==version`, keyed by lower-case distribution name. */
export async function pinnedOracleVersions() {
  const text = await readFile(resolve(ORACLE_ROOT, 'tools/oracles/requirements.txt'), 'utf8');
  return new Map(text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => { const [name, version] = line.split('=='); return [name.toLowerCase().replace(/-/g, '_'), version] as const; }));
}

/** Every input matches a body manifest, checked-in FITS fixture or test-only archive record. */
export async function assertPinnedInputs(inputs: readonly { path: string; sha256: string; bytes: number }[]) {
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
      if (!pin || pin.sha256 !== input.sha256 || pin.bytes !== input.bytes) throw new Error(`FITS test archive pin changed: ${input.path}`);
      continue;
    }
    if (/^tests\/fixtures\/fits\/[a-z0-9-]+\.fits$/u.test(input.path)) {
      verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path)));
      continue;
    }
    const match = /^src\/objects\/([^/]+)\/source\/(.+)$/u.exec(input.path);
    if (!match) throw new Error(`Oracle input outside a body's sources: ${input.path}`);
    const manifest = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/objects', match[1], 'source/manifest.json'), 'utf8')));
    const entry = [...requireArray(manifest.inputs), ...requireArray(manifest.documents)].map(e => requireRecord(e)).find(e => e.path === match[2]);
    if (!entry) throw new Error(`Oracle input is not a manifest input or document: ${input.path}`);
    // A download must agree with its manifest pin. A file authored here has none, so the oracle's own record is checked against its bytes.
    if (entry.expectedSha256 === undefined) verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path)));
    else if (entry.expectedSha256 !== input.sha256 || entry.expectedBytes !== input.bytes) throw new Error(`Oracle input differs from the manifest pin: ${input.path}`);
  }
}

/** Verify the actual buffer about to be decoded, not just two declarations. */
export function verifyOracleBytes(input: { path: string; sha256: string; bytes: number }, bytes: Buffer) {
  if (bytes.length !== input.bytes || sha256(bytes) !== input.sha256)
    throw new Error(`Oracle source bytes differ from their pin: ${input.path}`);
  return bytes;
}

export async function readOracleInput(input: { path: string; sha256: string; bytes: number }) {
  await assertPinnedInputs([input]);
  try { return verifyOracleBytes(input, await readFile(resolve(ORACLE_ROOT, input.path))); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new Error(`Missing FITS oracle input ${input.path}. Run pnpm test:fits --restore.`, { cause: error });
    throw error;
  }
}

export const sampleList = (value: unknown): OracleSample[] => requireArray(value).map(sample => { const s = requireRecord(sample); return { index: requireFiniteNumber(s.index), value: requireFiniteNumber(s.value) }; });

/** A reference is pinned when its URL names a 40-hexadecimal commit and its sha256 and size are recorded. */
export function assertPinnedReferences(references: readonly { url: string; sha256: string; bytes: number }[]) {
  for (const reference of references) {
    if (!/^https:\/\/(raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\/|github\.com\/[^/]+\/[^/]+\/blob\/[0-9a-f]{40}\/)/u.test(reference.url)) throw new Error(`Oracle reference is not pinned to a commit: ${reference.url}`);
    if (!/^[0-9a-f]{64}$/u.test(reference.sha256) || !(reference.bytes > 0)) throw new Error(`Oracle reference lacks its sha256 or size: ${reference.url}`);
  }
}
