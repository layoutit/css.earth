/**
 * Shared reading of oracle fixtures for the comparing tests: the fixture's
 * inputs must be the pinned manifest inputs, and its tool versions must be the
 * pinned requirements, so a comparison is bound to exact inputs and an exact
 * oracle.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../source-values.mts';

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

/** Every fixture input must be a pinned manifest input of its body with the same sha256. */
export async function assertPinnedInputs(inputs: readonly { path: string; sha256: string; bytes: number }[]) {
  for (const input of inputs) {
    const match = /^src\/planets\/([^/]+)\/source\/(.+)$/u.exec(input.path);
    if (!match) throw new Error(`Oracle input outside a body's sources: ${input.path}`);
    const manifest = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/planets', match[1], 'source/manifest.json'), 'utf8')));
    const entry = requireArray(manifest.inputs).map(e => requireRecord(e)).find(e => e.path === match[2]);
    if (!entry) throw new Error(`Oracle input is not a manifest input: ${input.path}`);
    if (entry.expectedSha256 !== input.sha256 || entry.expectedBytes !== input.bytes) throw new Error(`Oracle input differs from the manifest pin: ${input.path}`);
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
