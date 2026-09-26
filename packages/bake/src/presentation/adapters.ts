import type { PreparedMaterialTrack } from '@cssearth/renderer/rendering/prepared-material.ts';
import type { PreparedSelectionNavigation } from '@cssearth/renderer/rendering/prepared-presentation.ts';
import { createPreparedNodeTree } from './prepared-node-tree.ts';
import { prepareCssomDeclarationReads } from './prepared-cssom.ts';
import type { PresentationDraft } from './types.ts';
export type { PreparedNode } from './prepared-node-tree.ts';
export type NodeBuilder = ReturnType<typeof createPreparedNodeTree>;

/** What the caller supplies: the material tracks, the prepared-presentation contract and the lens navigation are owned by
 * the preparation tools and the platform, which pass their implementations in. */
export interface PresentationHostAdapters {
  prepareMaterialTracks(draft: PresentationDraft): PreparedMaterialTrack[];
  requirePreparedPresentation(input: unknown, options: { controls: unknown }): unknown;
  prepareLensNavigation(bodyId: string, focus: unknown, camera: unknown): PreparedSelectionNavigation;
}

/** The host's adapters with this package's retained node tree and offline CSSOM reads. */
export function presentationAdapters(host: PresentationHostAdapters) {
  return {
    createPreparedNodeTree, prepareCssomDeclarationReads,
    prepareMaterialTracks: host.prepareMaterialTracks, requirePreparedPresentation: host.requirePreparedPresentation,
    prepareLensNavigation: host.prepareLensNavigation,
  };
}
export type PresentationAdapters = ReturnType<typeof presentationAdapters>;
