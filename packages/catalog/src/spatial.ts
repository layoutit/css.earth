import type { SpatialCitation, SpatialCatalogSource } from '@cssearth/objects';

/** Stable crosswalk from an upstream bibliography key to the existing Sources namespace. */
export function spatialPublicationId(reference: string): string {
  const id = reference.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/-$/u, '');
  if (!id || !/^[a-z0-9]/u.test(id)) throw new TypeError('Invalid bibliography identity.');
  return `publication-${id}`;
}

export function resolveSpatialCitation(reference: string, sources: readonly SpatialCatalogSource[]): SpatialCitation | undefined {
  for (const source of sources) {
    const entry = source.references?.find(entry => entry.id === reference);
    if (entry) return entry;
  }
  // Prefer the longest source id when a reference includes a row/field locator.
  return sources.filter(source => reference === source.id || reference.startsWith(`${source.id}:`))
    .sort((a, b) => b.id.length - a.id.length)[0];
}
