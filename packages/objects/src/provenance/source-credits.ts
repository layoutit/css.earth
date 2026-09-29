/** The short provider index each page's "Sources" link shows, computed once from the prepared source usage when the catalogue
 * is written (site/build/prepare/prepare-facilities.mts). The site reads this file instead of the whole catalogue: with batch 1 of the exoplanets
 * (2026-09-29) `site/prepared-sources.json` reached 41 MB, and importing it put the dev server and the site typecheck past 4 GB.
 * The complete author and institutional credits stay in each body's README, which the link opens. */
import { isRecord } from '@cssearth/core';
import type { SourceResolver } from '../sources/catalog.js';
import type { SourceUsage } from './source-usage.js';

export const SOURCE_CREDITS_SCHEMA = 'cssearth-prepared-source-credits@1';
export interface SourceCredits { readonly schema: typeof SOURCE_CREDITS_SCHEMA; readonly providers: Readonly<Record<string, readonly string[]>> }

const COMPACT_PROVIDERS = ['NASA', 'ESA', 'JPL', 'USGS', 'JAXA', 'CSA', 'ISRO', 'STScI', 'ESO', 'NOIRLab', 'NAOJ', 'AMNH', 'CDS', 'OpenSpace', 'DAMIT'];
const compactProvider = new RegExp(`\\b(?:${COMPACT_PROVIDERS.join('|')})\\b`, 'gu');

/** Each object's providers: the compact agency names its recorded credits contain (else the publisher or the credit itself),
 * then the shared context it lends to other objects, in usage order. */
export function sourceCredits(usage: SourceUsage, sources: SourceResolver): SourceCredits {
  const owners = new Set([...Object.keys(usage.byObject),
    ...usage.edges.flatMap(use => use.kind === 'shared-context' ? [/^src\/objects\/([^/]+)\//u.exec(use.ownerPath)?.[1] ?? ''] : []).filter(Boolean)]);
  const providers: Record<string, readonly string[]> = {};
  for (const objectId of [...owners].sort()) {
    const uses = (usage.byObject[objectId] ?? []).map(index => usage.edges[index]!);
    const names = [...new Set([
      ...uses.flatMap(use => {
        const publisher = sources[use.catalogueId]?.publisher;
        const credit = use.credit ?? publisher ?? '';
        return credit.match(compactProvider) ?? (publisher ? [publisher] : credit ? [credit] : []);
      }),
      ...usage.edges.filter(use => use.kind === 'shared-context' && use.ownerPath.startsWith(`src/objects/${objectId}/`)).map(use => use.consumerLabel),
    ])];
    if (names.length) providers[objectId] = Object.freeze(names);
  }
  return Object.freeze({ schema: SOURCE_CREDITS_SCHEMA, providers: Object.freeze(providers) });
}

export function parseSourceCredits(input: unknown): SourceCredits {
  if (!isRecord(input) || input.schema !== SOURCE_CREDITS_SCHEMA || !isRecord(input.providers)) throw new TypeError('Invalid prepared source credits.');
  const providers: Record<string, readonly string[]> = {};
  for (const [objectId, names] of Object.entries(input.providers)) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(objectId) || !Array.isArray(names) || !names.every(name => typeof name === 'string' && name))
      throw new TypeError(`Invalid prepared source credits for ${objectId}.`);
    providers[objectId] = Object.freeze([...names as string[]]);
  }
  return Object.freeze({ schema: SOURCE_CREDITS_SCHEMA, providers: Object.freeze(providers) });
}
