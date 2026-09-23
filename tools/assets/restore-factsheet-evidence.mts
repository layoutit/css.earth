import assert from 'node:assert/strict';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { sourcePath } from '../../src/platform/source-catalog.mts';
import { hasErrorCode } from '../sources/source-values.mts';
import { assertSourceFile, containedPath, parseAcquisitionPlan, parseSourceManifest, restoreMissingSources } from '#preparation/operations';
export type FactsheetSourceTransport = NonNullable<Parameters<typeof restoreMissingSources>[0]['transport']>;

/** Restore one missing cited document, without acquiring the body's other source assets. */
export async function restoreFactsheetEvidence({ objectDirectory, path, manifest, transport = {
  fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(90_000) }),
} }: { objectDirectory: string; path: string; manifest: unknown; transport?: FactsheetSourceTransport }) {
  const citation = sourcePath(path);
  assert.ok(citation.startsWith('source/'), 'Fact evidence must be inside the body source directory.');
  const sourceRoot = await realpath(resolve(objectDirectory, 'source'));
  const sourceRelative = citation.slice('source/'.length), destination = containedPath(sourceRoot, sourceRelative);
  const parsed = parseSourceManifest(manifest);
  const entries = [...parsed.inputs, ...parsed.documents, ...parsed.generatedIntermediates];
  const entry = entries.find(entry => entry.path === sourceRelative);
  if (!entry) throw new Error(`Missing fact evidence pin: ${citation}.`);
  await assertContainedAncestor(sourceRoot, dirname(destination));
  // Existing evidence is immutable here, including dangling symbolic links.
  const existing = await lstat(destination).catch((error: unknown) => {
    if (hasErrorCode(error, 'ENOENT')) return null;
    throw error;
  });
  if (existing) { await assertSourceFile(entry, destination); return; }
  const planPath = 'preparation/acquisition.json', planEntry = entries.find(entry => entry.path === planPath);
  if (!planEntry) throw new Error(`Missing acquisition plan pin for ${citation}.`);
  const planFile = await realpath(containedPath(sourceRoot, planPath));
  assertContained(sourceRoot, planFile);
  const planBytes = await readFile(planFile);
  const raw: unknown = JSON.parse(planBytes.toString('utf8'));
  const plan = parseAcquisitionPlan(raw);
  const operations = plan.operations.filter(step => 'path' in step && step.path === sourceRelative);
  if (operations.length !== 1 || operations[0]?.kind !== 'download') {
    throw new Error(`Fact evidence needs one authored download operation: ${citation}.`);
  }
  const citedOnly = { ...parsed, inputs: parsed.inputs.filter(item => item.path === sourceRelative),
    documents: parsed.documents.filter(item => item.path === sourceRelative),
    generatedIntermediates: parsed.generatedIntermediates.filter(item => item.path === sourceRelative) };
  await restoreMissingSources({ sourceRoot, manifest: citedOnly, plan: { ...plan, operations },
    missing: [sourceRelative], transport });
}

function assertContained(root: string, path: string) {
  const offset = relative(root, path);
  assert.ok(offset !== '..' && !offset.startsWith('../'), 'Fact evidence escapes the body source directory.');
}
async function assertContainedAncestor(root: string, path: string): Promise<void> {
  try { assertContained(root, await realpath(path)); }
  catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error;
    // A dangling symlink is not a missing directory that restoration may create.
    const entry = await lstat(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    if (entry) throw new Error('Fact evidence has a dangling source-directory link.');
    if (path === root) throw error;
    await assertContainedAncestor(root, dirname(path));
  }
}
