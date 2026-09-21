/**
 * Bind an object's pinned inputs to the source catalogue. Every input needs a
 * catalogued binding and a record in `src/sources/<catalogueId>.json`. A record's
 * evidence names the manifest and the entry that cites it; git history holds the
 * rest. The binding's own evidence string still names the manifest revision that
 * introduced the entry, which exists only after that manifest is committed. Run
 * without `--evidence` to add missing bindings and records, commit the manifest,
 * then run with `--evidence <revision>` to pin the binding placeholders. Documents
 * cite records authored by hand, such as the publication behind a photometric
 * model record; each must exist. Existing records are never rewritten. The body's provenance record
 * pins the manifest's bytes, so the command line records it again whenever it
 * changed the manifest; a stale record otherwise fails the next preparation of
 * any body.
 */
import { access, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSourceCatalog } from '../src/platform/source-catalog.mts';
import { requireArray, requireRecord, requireString } from './source-values.mts';

export const PLACEHOLDER_REVISION = '0'.repeat(40);
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;

const exists = (path: string) => access(path).then(() => true, () => false);

export interface AuthoringOptions {
  root: string; objectId: string;
  /** Pin placeholder binding evidence to this manifest revision. */
  evidence?: string;
  write?: boolean;
}
export interface AuthoringResult { bindings: string[]; records: string[]; pinned: string[] }

/** Add missing bindings and records; pin placeholder binding evidence when a revision is given. */
export async function authorSourceRecords({ root, objectId, evidence, write = true }: AuthoringOptions): Promise<AuthoringResult> {
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new TypeError(`Invalid object id: ${objectId}`);
  const objectDirectory = resolve(root, 'src/objects', objectId), manifestPath = resolve(objectDirectory, 'source/manifest.json');
  const repositoryPath = relative(root, manifestPath).split('\\').join('/');
  const manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')), 'source manifest');
  const inputs = requireArray(manifest.inputs, 'manifest inputs').map(value => requireRecord(value, 'manifest input'));
  const content = await readFile(resolve(objectDirectory, 'source/content/object.json'), 'utf8').then(raw => requireRecord(JSON.parse(raw)), () => ({}) as Record<string, unknown>);
  const objectName = text(content.displayName) ?? text(content.title) ?? objectId.replace(/-/gu, ' ').replace(/\b[a-z]/gu, letter => letter.toUpperCase());
  const productIds = inputs.map(input => text(input.productId)), result: AuthoringResult = { bindings: [], records: [], pinned: [] };
  let manifestChanged = false;
  const pinned = evidence ? { revision: evidence } : null;
  if (pinned && !/^[a-f0-9]{40}$/u.test(pinned.revision)) throw new TypeError('Evidence revision must be a full 40-character commit hash.');

  for (const [index, input] of inputs.entries()) {
    const inputId = text(input.id) ?? requireString(input.path, 'input path').replace(/^.*\//u, '').replace(/\.[^.]+$/u, '');
    const locator = `/inputs/${index}`;
    if (input.sourceBinding === undefined) {
      const catalogueId = `source-${objectId}-${inputId.toLowerCase().replace(/[^a-z0-9-]+/gu, '-')}`;
      input.sourceBinding = { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence: `${repositoryPath}@${PLACEHOLDER_REVISION}#${locator}` }] };
      manifestChanged = true; result.bindings.push(inputId);
    }
    const binding = requireRecord(input.sourceBinding, 'source binding');
    if (binding.kind !== 'catalogued') continue;
    for (const value of requireArray(binding.references, 'binding references')) {
      const reference = requireRecord(value, 'binding reference'), catalogueId = requireString(reference.catalogueId, 'catalogue id');
      const recordPath = resolve(root, 'src/sources', `${catalogueId}.json`);
      if (pinned && String(reference.evidence).includes(PLACEHOLDER_REVISION)) {
        reference.evidence = `${repositoryPath}@${pinned.revision}#${locator}`; manifestChanged = true; result.pinned.push(catalogueId);
      }
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
  const arguments_ = process.argv.slice(2), evidenceIndex = arguments_.indexOf('--evidence');
  const evidence = evidenceIndex >= 0 ? arguments_[evidenceIndex + 1] : undefined;
  // Without --evidence, evidenceIndex + 1 is 0, which must not drop the object id.
  const ids = arguments_.filter((argument, index) => argument !== '--evidence' && (evidenceIndex < 0 || index !== evidenceIndex + 1));
  if (ids.length !== 1 || (evidenceIndex >= 0 && !evidence)) throw new TypeError('Usage: author-source-records <object-id> [--evidence <revision>]');
  const root = process.cwd(), manifestPath = resolve(root, 'src/objects', ids[0], 'source/manifest.json'), before = await readFile(manifestPath);
  const result = await authorSourceRecords({ root, objectId: ids[0], evidence });
  console.log(JSON.stringify(result, null, 1));
  if (result.bindings.length && !evidence) console.log(`Commit the manifest, then rerun with --evidence <revision> to pin ${result.bindings.length} binding(s).`);
  if (!before.equals(await readFile(manifestPath))) {
    // A volume package's provenance is the volume compiler's, not a body's.
    const presentation = await readFile(resolve(root, 'src/objects', ids[0], 'source/presentation.json'), 'utf8').then(text => JSON.parse(text) as { schema?: unknown }, () => null);
    if (presentation?.schema === 'cssearth-volume-presentation-source@1') {
      const { writeVolumeProvenance } = await import('./prepare-volume-provenance.mts');
      const { RUNTIME_ASSET_ORIGIN } = await import('./runtime-assets.mts');
      const results = await writeVolumeProvenance({ root, mirrorOrigin: RUNTIME_ASSET_ORIGIN });
      console.log(`Volume provenance recorded again for the changed manifest: ${results.length} volume packages.`);
    } else {
      const { recoverObjectProvenance } = await import('./prepare-provenance.mts');
      for (const outcome of await recoverObjectProvenance([ids[0]], { root })) console.log(`Provenance recorded again for the changed manifest: ${JSON.stringify(outcome)}`);
    }
  }
}
