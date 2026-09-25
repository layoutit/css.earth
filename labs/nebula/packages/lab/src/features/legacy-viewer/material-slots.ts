/** One owner for every write to the retained bank's texture slots: material toggles, lens swaps and density cutoffs. */
import type { CloudDensityFilter } from '@cssearth/bake/volume';

export type MaterialMode = 'neutral' | 'textured';
export const unfilteredCloud = (): CloudDensityFilter => ({ cutoff: 0, softness: .25, showRemoved: false });

export function createMaterialSlots() {
  let generation = 0, mode: MaterialMode = 'textured', loading = false;
  return {
    get mode() { return mode; },
    get loading() { return loading; },
    /** Starting any writer supersedes every earlier writer, whichever kind it was. */
    begin(kind: 'material' | 'cutoff'): number {
      if (kind === 'cutoff' && (loading || mode !== 'textured'))
        throw new Error(loading ? 'The prepared material is still loading.' : 'Switch to Textured before applying a density filter.');
      loading = kind === 'material';
      return ++generation;
    },
    current(token: number): boolean { return token === generation; },
    /** Commit a finished writer; a stale token changes nothing. */
    finish(token: number, committed?: MaterialMode): boolean {
      if (token !== generation) return false;
      loading = false; if (committed) mode = committed;
      return true;
    },
    /** A fresh scene mount owns new, unfiltered textured slots. */
    reset() { generation++; mode = 'textured'; loading = false; },
  };
}

/** Unfiltered textures replaced the slots: stars must follow the same unfiltered support for the displayed selection. */
export function resyncCloudSupport(stars: { setCloudSupport(filter: CloudDensityFilter, partIds: readonly string[]): void } | null,
  cloud: { selection(): readonly string[] } | null): CloudDensityFilter {
  const filter = unfilteredCloud();
  if (stars && cloud) stars.setCloudSupport(filter, cloud.selection());
  return filter;
}
