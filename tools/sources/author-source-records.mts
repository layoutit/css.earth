/**
 * Bind an object's inputs to the source catalogue, in one pass. Every input needs a catalogued binding and a record
 * in `src/sources/<catalogueId>.json`. A new binding says where its identity comes from: the entry's own origin and
 * product identifier. A new record names the manifest entry that cites it. Documents cite records authored by hand,
 * such as the publication behind a photometric model record; each must exist. Existing bindings and records are
 * never rewritten. Git history records when each was added.
 */
import { access, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSourceCatalog } from '../../src/platform/source-catalog.mts';
import { requireArray, requireRecord, requireString } from './source-values.mts';

/** What an authored binding rests on: the manifest entry it sits in. */
export const ENTRY_EVIDENCE = 'Origin and product identifier recorded on this manifest entry.';
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;

const exists = (path: string) => access(path).then(() => true, () => false);

export interface AuthoringOptions { root: string; objectId: string; write?: boolean }
export interface AuthoringResult { bindings: string[]; records: string[] }

/** Add missing bindings and records. */
export async function authorSourceRecords({ root, objectId, write = true }: AuthoringOptions): Promise<AuthoringResult> {
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new TypeError(`Invalid object id: ${objectId}`);
  const objectDirectory = resolve(root, 'src/objects', objectId), manifestPath = resolve(objectDirectory, 'source/manifest.json');
  const repositoryPath = relative(root, manifestPath).split('\\').join('/');
  const manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const inputs = requireArray(manifest.inputs, 'manifest inputs').map(value => requireRecord(value, 'manifest input'));
  const content = await readFile(resolve(objectDirectory, 'source/content/object.json'), 'utf8').then(raw => requireRecord(JSON.parse(raw)), () => ({}) as Record<string, unknown>);
  const objectName = text(content.displayName) ?? text(content.title) ?? objectId.replace(/-/gu, ' ').replace(/\b[a-z]/gu, letter => letter.toUpperCase());
  const productIds = inputs.map(input => text(input.productId)), result: AuthoringResult = { bindings: [], records: [] };
  let manifestChanged = false;

  for (const [index, input] of inputs.entries()) {
    const inputId = text(input.id) ?? requireString(input.path, 'input path').replace(/^.*\//u, '').replace(/\.[^.]+$/u, '');
    const locator = `/inputs/${index}`;
    if (input.sourceBinding === undefined) {
      const catalogueId = `source-${objectId}-${inputId.toLowerCase().replace(/[^a-z0-9-]+/gu, '-')}`;
      input.sourceBinding = { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence: ENTRY_EVIDENCE }] };
      manifestChanged = true; result.bindings.push(inputId);
    }
    const binding = requireRecord(input.sourceBinding, 'source binding');
    if (binding.kind !== 'catalogued') continue;
    for (const value of requireArray(binding.references, 'binding references')) {
      const reference = requireRecord(value, 'binding reference'), catalogueId = requireString(reference.catalogueId, 'catalogue id');
      const recordPath = resolve(root, 'src/sources', `${catalogueId}.json`);
      let record: Record<string, unknown> | undefined;
      if (await exists(recordPath)) {
        record = requireRecord(JSON.parse(await readFile(recordPath, 'utf8')), 'catalogue record');
      } else {
        const productId = text(input.productId), unique = productId !== undefined && productIds.filter(id => id === productId).length === 1;
        const origin = text(input.origin) ?? text(input.sourceUrl);
        if (!origin) throw new TypeError(`Input ${inputId} has no origin URL; a catalogue record needs a citation link.`);
        record = { id: catalogueId, kind: 'data-product', identityLevel: 'work', title: `${objectName} · ${inputId.replace(/[-_]+/gu, ' ')}`,
          identifiers: unique ? [{ type: 'pds4-lidvid', value: productId }] : [],
          links: origin ? [{ role: 'landing', url: origin, label: 'Source' }] : [],
          evidence: [{ path: repositoryPath, locator }], relations: [],
          statements: [...(text(input.credit) ? [{ kind: 'credit', text: text(input.credit), scope: `The ${inputId.replace(/[-_]+/gu, ' ')} input.`, evidence: 'Manifest credit field.' }] : []),
            ...(text(input.license) ? [{ kind: 'rights', text: text(input.license), scope: 'Redistributed display derivatives.', evidence: 'Manifest license field.' }] : [])] };
        result.records.push(catalogueId);
      }
      if (result.records.includes(catalogueId)) {
        parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records: [record] });
        if (write) await writeFile(recordPath, JSON.stringify(record, null, 2) + '\n');
      }
    }
  }
  // A document cites records authored by hand; each citation must reach one.
  {
    const documents = requireArray(manifest.documents ?? [], 'manifest documents').map(value => requireRecord(value, 'manifest document'));
    for (const document of documents) {
      if (document.sourceBinding === undefined) continue;
      const binding = requireRecord(document.sourceBinding, 'source binding');
      if (binding.kind !== 'catalogued') continue;
      for (const value of requireArray(binding.references, 'binding references')) {
        const catalogueId = requireString(requireRecord(value, 'binding reference').catalogueId, 'catalogue id');
        const recordPath = resolve(root, 'src/sources', `${catalogueId}.json`);
        if (!await exists(recordPath)) throw new TypeError(`Document ${requireString(document.path, 'document path')} cites ${catalogueId}, which has no catalogue record.`);
      }
    }
  }
  if (write && manifestChanged) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2);
  if (ids.length !== 1 || ids[0].startsWith('--')) throw new TypeError('Usage: author-source-records <object-id>');
  const root = process.cwd(), manifestPath = resolve(root, 'src/objects', ids[0], 'source/manifest.json'), before = await readFile(manifestPath);
  console.log(JSON.stringify(await authorSourceRecords({ root, objectId: ids[0] }), null, 1));
  // A body's provenance record is generated from its manifest on every checkout. A volume package's is still written by the volume compiler.
  const presentation = await readFile(resolve(root, 'src/objects', ids[0], 'source/presentation.json'), 'utf8').then(text => JSON.parse(text) as { schema?: unknown }, () => null);
  if (!before.equals(await readFile(manifestPath)) && presentation?.schema === 'cssearth-volume-presentation-source@1') {
    const { writeVolumeProvenance } = await import('../prepare/prepare-volume-provenance.mts');
    const { RUNTIME_ASSET_ORIGIN } = await import('../assets/runtime-assets.mts');
    const results = await writeVolumeProvenance({ root, mirrorOrigin: RUNTIME_ASSET_ORIGIN });
    console.log(`Volume provenance recorded again for the changed manifest: ${results.length} volume packages.`);
  }
}
