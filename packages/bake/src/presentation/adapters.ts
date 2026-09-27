import type { PreparedMaterialTrack } from '@cssearth/renderer/rendering/prepared-material.ts';
import type { PreparedSelectionNavigation } from '@cssearth/renderer/rendering/prepared-presentation.ts';
import { createPreparedNodeTree } from './prepared-node-tree.ts';
import { prepareCssomDeclarationReads } from './prepared-cssom.ts';
import type { PresentationDraft } from './types.ts';
export type { PreparedNode } from './prepared-node-tree.ts';
export type NodeBuilder = ReturnType<typeof createPreparedNodeTree>;

/** What the caller supplies: the material tracks and the lens navigation are owned by the preparation tools, which pass
 * their implementations in. */
export interface PresentationHostAdapters {
  prepareMaterialTracks(draft: PresentationDraft): PreparedMaterialTrack[];
  prepareLensNavigation(bodyId: string, focus: unknown, camera: unknown): PreparedSelectionNavigation;
}

/** The host's adapters with this package's retained node tree and offline CSSOM reads. */
export function presentationAdapters(host: PresentationHostAdapters) {
  return {
    createPreparedNodeTree, prepareCssomDeclarationReads,
    prepareMaterialTracks: host.prepareMaterialTracks,
    prepareLensNavigation: host.prepareLensNavigation,
  };
}
export type PresentationAdapters = ReturnType<typeof presentationAdapters>;
