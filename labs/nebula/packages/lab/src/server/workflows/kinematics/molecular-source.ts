import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { parseMolecularTable, readMolecularRecipe } from './molecular-data.ts';
import type { MolecularCatalogue, MolecularSourcePin } from '@cssearth/nebula-reconstruction/methods/kinematics/molecular-types';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function readRecipe(root: string, recipePath: string) {
  if (isAbsolute(recipePath)) throw new TypeError('Use a repository-relative molecular recipe.');
  const modelDirectory = await realpath(resolve(root, 'labs/nebula/models')), filename = await realpath(resolve(root, recipePath));
  if (!filename.startsWith(modelDirectory + sep) || !filename.endsWith('.json')) throw new TypeError('Molecular recipe lies outside model sources.');
  const bytes = await readFile(filename);
  if (bytes.length > 262144) throw new TypeError('Molecular recipe is too large.');
  return { recipe: readMolecularRecipe(JSON.parse(bytes.toString()) as unknown), recipeSha256: digest(bytes) };
}
function validateBytes(bytes: Uint8Array, pin: MolecularSourcePin): void {
  if (bytes.byteLength !== pin.bytes) throw new TypeError(`Molecular source identity changed: ${pin.cachePath}`);
}
async function readPinned(root: string, pin: MolecularSourcePin): Promise<Buffer> {
  const directory = await realpath(resolve(root, '.local/nebula-lab/kinematics')), filename = await realpath(resolve(root, pin.cachePath));
  if (!filename.startsWith(directory + sep)) throw new TypeError('Molecular source escapes the cache.');
  const bytes = await readFile(filename); validateBytes(bytes, pin); return bytes;
}
function isMissing(error: unknown): boolean { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
/** Acquisition is explicit and never replaces existing source bytes whose identity changed. */
async function acquirePin(root: string, pin: MolecularSourcePin): Promise<'verified' | 'downloaded'> {
  try { await readPinned(root, pin); return 'verified'; } catch (error) { if (!isMissing(error)) throw error; }
  const response = await fetch(pin.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error(`Molecular source HTTP ${response.status}: ${pin.url}`);
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > pin.bytes) { await reader.cancel(); throw new TypeError('Molecular download exceeds its pinned size.'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks); validateBytes(bytes, pin);
  const filename = resolve(root, pin.cachePath), directory = resolve(root, '.local/nebula-lab/kinematics');
  await mkdir(dirname(filename), { recursive: true });
  const actualParent = await realpath(dirname(filename)), actualDirectory = await realpath(directory);
  if (actualParent !== actualDirectory && !actualParent.startsWith(actualDirectory + sep)) throw new TypeError('Molecular cache directory escapes source storage.');
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, bytes, { flag: 'wx' }); await rename(temporary, filename); }
  finally { await rm(temporary, { force: true }); }
  await readPinned(root, pin); return 'downloaded';
}
export async function acquireMolecularSources(root: string, recipePath: string, options: { includePaper?: boolean } = {}) {
  const { recipe } = await readRecipe(root, recipePath);
  const pins = [recipe.citation.readme, recipe.table, ...(options.includePaper ? [recipe.citation.paper] : [])];
  const results: { cachePath: string; status: 'verified' | 'downloaded' }[] = [];
  for (const pin of pins) results.push({ cachePath: pin.cachePath, status: await acquirePin(root, pin) });
  // A successful request is insufficient: parse and verify the full observed table before reporting completion.
  const catalogue = await loadMolecularCatalogue(root, recipePath);
  return { status: 'complete' as const, sources: results, recipeSha256: catalogue.recipeSha256, diagnostics: catalogue.diagnostics };
}
/** Read-only preparation boundary. Missing sources require explicit acquireMolecularSources. */
export async function loadMolecularCatalogue(root: string, recipePath: string): Promise<MolecularCatalogue> {
  const { recipe, recipeSha256 } = await readRecipe(root, recipePath);
  await readPinned(root, recipe.citation.readme);
  const table = await readPinned(root, recipe.table);
  return { schema: 'cssearth-molecular-catalogue@1', recipe, recipeSha256,
    ...parseMolecularTable(table.toString('ascii'), recipe) };
}
