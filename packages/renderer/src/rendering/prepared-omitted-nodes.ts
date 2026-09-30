import type { PreparedTree, PreparedVariant } from './prepared-presentation.js';

/** The alternative mesh a leaf belongs to: its display reads `var(--<id>-<profile>-display, none)`. A body with several
 * shape models (67P, Bennu, Psyche and 38 others) carries one such profile per model; a selection shows one of them. */
export function meshProfile(style: string | null | undefined): string | null {
  return /display:\s*var\((--[\w-]+-display)\b/u.exec(style ?? '')?.[1] ?? null;
}

/** The mesh profiles a selection hides: the display variables its writes set to `none`. */
export function hiddenMeshProfiles(variant: PreparedVariant | undefined): Set<string> {
  return new Set((variant?.writes ?? []).flatMap(write => write.kind === 'style' && write.name.startsWith('--') &&
    write.name.endsWith('-display') && write.value === 'none' ? [write.name] : []));
}

/** The nodes a selection leaves out of the page: the descendants of every subtree it hides (`hiddenSubtrees`), and the
 * leaves of every alternative mesh it hides. The server omits them from its markup, the first-view transport keeps their
 * records whole, and a mount creates them without attaching the mesh leaves: only the mesh the dataset draws on is
 * mounted (`commitSelection` swaps meshes when the dataset changes). */
export function omittedPreparedNodes(tree: PreparedTree, variant: PreparedVariant | undefined): Set<number> {
  const hidden = new Set(variant?.hiddenSubtrees ?? []), profiles = hiddenMeshProfiles(variant), omitted = new Set<number>();
  tree.nodes.forEach((record, index) => {
    if (hidden.has(record.parent) || omitted.has(record.parent)) omitted.add(index);
    else { const profile = meshProfile(record.style); if (profile && profiles.has(profile)) omitted.add(index); }
  });
  return omitted;
}
