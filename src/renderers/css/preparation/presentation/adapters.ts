import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export type { PreparedNode } from '../../../../../tools/prepared/prepared-node-tree.mts';
export type NodeBuilder = ReturnType<typeof import('../../../../../tools/prepared/prepared-node-tree.mts').createPreparedNodeTree>;

/** Offline adapters retain the types of their checked implementation owners. */
export async function loadPresentationAdapters() {
  const url = (file: string) => pathToFileURL(resolve(file)).href;
  const [tree, cssom, materials, contract, focus] = await Promise.all([
    import(url('tools/prepared/prepared-node-tree.mts')) as Promise<typeof import('../../../../../tools/prepared/prepared-node-tree.mts')>,
    import(url('tools/prepared/prepared-cssom.mts')) as Promise<typeof import('../../../../../tools/prepared/prepared-cssom.mts')>,
    import(url('tools/prepare/prepare-materials.mts')) as Promise<typeof import('../../../../../tools/prepare/prepare-materials.mts')>,
    import(url('src/platform/prepared-presentation-contract.mts')) as Promise<typeof import('../../../../platform/prepared-presentation-contract.mts')>,
    import(url('tools/objects/terrestrial-layers/scientific-focus.mts')) as Promise<typeof import('../../../../../tools/objects/terrestrial-layers/scientific-focus.mts')>,
  ]);
  return {
    createPreparedNodeTree: tree.createPreparedNodeTree, prepareCssomDeclarationReads: cssom.prepareCssomDeclarationReads,
    prepareMaterialTracks: materials.prepareMaterialTracks, requirePreparedPresentation: contract.requirePreparedPresentation,
    prepareLensNavigation: focus.prepareScientificNavigation,
  };
}
export type PresentationAdapters = Awaited<ReturnType<typeof loadPresentationAdapters>>;
