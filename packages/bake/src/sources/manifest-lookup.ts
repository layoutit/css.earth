/** What an object's source manifest declares, read without writing a script: its inputs, the files this repository
 * generates from them and its documents, narrowed by a search text, a kind or a consumer.
 * `packages/bake/cli/lookup/index.mts manifest` is the command. */
import { parseArgs } from 'node:util';
import type { SourceInput, SourceManifest } from '@cssearth/objects/node';
import { lookupObjectIds, lookupRows } from '../delivery/index.ts';

export const MANIFEST_KINDS = ['input', 'generated', 'document'] as const;
export type ManifestKind = typeof MANIFEST_KINDS[number];
export interface ManifestLookupOptions { ids: readonly string[]; search?: string; kind?: ManifestKind; consumer?: string; full: boolean; all: boolean; json: boolean }
export type ManifestLookupEntry = { kind: 'input'; entry: SourceInput } | { kind: 'generated'; entry: SourceManifest['generatedIntermediates'][number] }
  | { kind: 'document'; entry: SourceManifest['documents'][number] };
export interface ManifestLookup { id: string; total: number; counts: Record<ManifestKind, number>; entries: readonly ManifestLookupEntry[] }

export function manifestLookupOptions(args: readonly string[]): ManifestLookupOptions {
  const { values, positionals } = parseArgs({ args: [...args], strict: true, allowPositionals: true, options: {
    search: { type: 'string' }, kind: { type: 'string' }, consumer: { type: 'string' },
    full: { type: 'boolean', default: false }, all: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
  } });
  const kind = MANIFEST_KINDS.find(name => name === values.kind);
  if (values.kind !== undefined && !kind) throw new TypeError(`Choose a kind from ${MANIFEST_KINDS.join(', ')}.`);
  if (values.consumer !== undefined && kind !== undefined && kind !== 'input') throw new TypeError('Only inputs name consumers.');
  return { ids: lookupObjectIds(positionals), search: values.search, kind, consumer: values.consumer, full: values.full, all: values.all, json: values.json };
}

/** The manifest entries a lookup selects. The search reads every field of an entry, so an id, a path, an origin, a
 * credit or a bound catalogue record all find it. A consumer selects the inputs that feed it. */
export function manifestLookup(id: string, manifest: Readonly<SourceManifest>, { search, kind, consumer }: Pick<ManifestLookupOptions, 'search' | 'kind' | 'consumer'>): ManifestLookup {
  const text = search?.toLocaleLowerCase('en');
  const declared: ManifestLookupEntry[] = [...manifest.inputs.map(entry => ({ kind: 'input' as const, entry })),
    ...manifest.generatedIntermediates.map(entry => ({ kind: 'generated' as const, entry })), ...manifest.documents.map(entry => ({ kind: 'document' as const, entry }))];
  const entries = declared.filter(item => (!kind || item.kind === kind) && (consumer === undefined || item.kind === 'input' && item.entry.consumers.includes(consumer))
    && (!text || JSON.stringify(item.entry).toLocaleLowerCase('en').includes(text)));
  return { id, total: declared.length, entries,
    counts: { input: entries.filter(item => item.kind === 'input').length, generated: entries.filter(item => item.kind === 'generated').length, document: entries.filter(item => item.kind === 'document').length } };
}

/** A document's purpose is cut to this length on its line; `--full` prints it whole. */
const PURPOSE_LENGTH = 80;
export function formatManifestLookup(lookup: ManifestLookup, options: Pick<ManifestLookupOptions, 'search' | 'kind' | 'consumer' | 'full' | 'all'>) {
  const scope = [options.kind, options.consumer === undefined ? undefined : `for ${options.consumer}`, options.search === undefined ? undefined : `matching "${options.search}"`]
    .filter(part => part !== undefined).join(', ');
  const kinds = MANIFEST_KINDS.filter(kind => lookup.counts[kind]).map(kind => `${kind} ${lookup.counts[kind]}`).join(', ');
  const row = (item: ManifestLookupEntry) => {
    const line = item.kind === 'input' ? `input      ${item.entry.path}  [${item.entry.id}]  for ${item.entry.consumers.join(', ')}`
      : item.kind === 'generated' ? `generated  ${item.entry.path}  by ${item.entry.generator}`
        : `document   ${item.entry.path}${item.entry.purpose ? `  (${item.entry.purpose.length > PURPOSE_LENGTH ? `${item.entry.purpose.slice(0, PURPOSE_LENGTH)}…` : item.entry.purpose})` : ''}`;
    return options.full ? `${line}\n${JSON.stringify(item.entry, null, 2).replace(/^/gmu, '  ')}` : line;
  };
  return [`${lookup.id}: ${scope ? `${lookup.entries.length} of ${lookup.total} entries (${scope})` : `${lookup.total} entries`}${kinds ? `: ${kinds}` : ''}`,
    ...lookupRows(lookup.entries.map(row), options.all)].join('\n') + '\n';
}
