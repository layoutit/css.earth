import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceObject, sourceArray, sourceUrl } from '../src/platform/source-catalog.mts';
export interface SceneSource { label: string; role: string; href: string; description: string; credit?: string; }
import { SOURCE_CATALOGUE, sourceHref } from './sources-catalog.mts';
// Shared context is indexed once by its owner. Footer placement does not create
// an observation edge for every body on which that context can appear.
const sharedSources = Object.freeze(SOURCE_CATALOGUE.usage.edges.filter(use => use.kind === 'shared-context').map(use => Object.freeze({
  label: use.consumerLabel, role: use.consumerId, credit: use.credit,
  href: sourceHref(use.catalogueId), description: use.limitations.join(' '),
})));
// Explicit presentation aliases live beside the context that replaces them.
// They never contribute an identity or observation edge to the source graph.
const footerAliases = new Map<string,string>();
for (const use of SOURCE_CATALOGUE.usage.edges.filter(use => use.kind === 'shared-context')) {
  const owner = sourceObject(JSON.parse(await readFile(resolve(process.cwd(),use.ownerPath),'utf8')));
  for (const alias of sourceArray(sourceObject(owner.catalogueDisplay).footerAliases ?? [],sourceUrl)) {
    const key = normalizedHref(alias), target = normalizedHref(sourceHref(use.catalogueId));
    if (footerAliases.has(key) && footerAliases.get(key) !== target) throw new TypeError('Ambiguous shared footer alias.');
    footerAliases.set(key,target);
  }
}

/** Preserve object sources and append the shared environments once per source. */
export function sceneSources(resources: readonly SceneSource[] = []) {
  const result = new Map<string, SceneSource>();
  for (const resource of [...resources, ...sharedSources]) {
    // Shared world context suppresses the retired photographic sky leaves.
    // Other ESO sources and object-specific OpenSpace credits remain valid.
    if (isSupersededPanorama(resource.href)) continue;
    const key = sourceKey(resource.href);
    result.set(key, { ...result.get(key), ...resource });
  }
  return [...result.values()];
}

function isSupersededPanorama(href: string) {
  const url = new URL(href);
  return url.hostname.replace(/^www\./u, '') === 'eso.org' &&
    url.pathname.replace(/\/+$/u, '') === '/public/images/eso0932a';
}

function normalizedHref(href: string) {
  const url = new URL(href); url.hash = ''; return url.href.replace(/\/$/u, '');
}
function sourceKey(href: string) {
  const normalized = normalizedHref(href); return footerAliases.get(normalized) ?? normalized;
}
