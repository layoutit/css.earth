import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { sourceArray, sourceDate, sourceDigest, sourceId, sourceObject, sourcePath, sourceText, sourceUrl } from '../src/platform/source-catalog.mts';
import type { SourceResolver } from '../src/platform/source-catalog.mts';
import type { Fact } from './objects/content/types.js';
import { orderFacts } from '../site/fact-order.mts';

/** The same citation checks apply to full preparation, facts-only edits and Sources. */
export function parseFactsheet(panel: unknown) {
  const value = sourceObject(panel);
  const fact = (raw: unknown): Fact => {
    const row = sourceObject(raw, ['id', 'label', 'value', 'source']);
    const result: Fact = { id: sourceId(row.id), label: sourceText(row.label), value: sourceText(row.value) };
    if (row.source !== undefined) {
      const source = sourceObject(row.source, ['catalogueId', 'url', 'label', 'checked', 'path', 'locator']);
      const path = source.path === undefined ? undefined : sourcePath(source.path);
      if (path && !path.startsWith('source/')) throw new TypeError('Fact evidence must be inside the body source directory.');
      result.source = {
        catalogueId: sourceId(source.catalogueId), url: sourceUrl(source.url), label: sourceText(source.label),
        checked: sourceDate(source.checked, true),
        ...(path === undefined ? {} : { path }),
        ...(source.locator === undefined ? {} : { locator: sourceText(source.locator) }),
      };
    }
    return result;
  };
  const facts = [...sourceArray(value.facts, fact)], moreFacts = [...sourceArray(value.moreFacts ?? [], fact)];
  orderFacts(facts, moreFacts);
  return { facts, moreFacts };
}

export async function verifyFactsheetSources(panel: unknown, {
  objectDirectory, manifest, sources,
  read = (path: string) => readFile(resolve(objectDirectory, path)),
}: {
  objectDirectory: string; manifest?: unknown; sources?: SourceResolver;
  read?: (path: string) => Promise<Buffer>;
}) {
  const parsed = parseFactsheet(panel), cited = [...parsed.facts, ...parsed.moreFacts].filter(fact => fact.source);
  if (!cited.length) return parsed;
  const records = sourceObject(manifest ?? JSON.parse((await read('source/manifest.json')).toString('utf8')));
  const entries = ['inputs', 'documents', 'generatedIntermediates'].flatMap(section => sourceArray(records[section] ?? [], sourceObject));
  const checked = new Set<string>();
  const root = await realpath(resolve(objectDirectory, 'source'));
  for (const fact of cited) {
    const citation = fact.source!;
    if (sources && !Object.hasOwn(sources, citation.catalogueId)) throw new TypeError(`Unknown fact source: ${citation.catalogueId}.`);
    if (!citation.path || checked.has(citation.path)) continue;
    const matches = entries.filter(entry => `source/${entry.path}` === citation.path);
    assert.equal(matches.length, 1, `${fact.id}: fact evidence needs one manifest entry: ${citation.path}`);
    const entry = matches[0]!;
    const path = await realpath(resolve(objectDirectory, citation.path)), offset = relative(root, path);
    assert.ok(offset && offset !== '..' && !offset.startsWith('../'), 'Fact evidence escapes the body source directory.');
    const bytes = await read(citation.path);
    assert.equal(bytes.length, entry.expectedBytes, `${fact.id}: fact evidence byte count differs`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sourceDigest(entry.expectedSha256), `${fact.id}: fact evidence pin differs`);
    checked.add(citation.path);
  }
  return parsed;
}
