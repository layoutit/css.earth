import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export type { PreparedNode } from '../../../../../tools/prepared-node-tree.mts';
export type NodeBuilder = ReturnType<typeof import('../../../../../tools/prepared-node-tree.mts').createPreparedNodeTree>;

/** Offline adapters retain the types of their checked implementation owners. */
export async function loadPresentationAdapters() {
  const url = (file: string) => pathToFileURL(resolve(file)).href;
  const [tree, cssom, catalogue, solar, materials, contract, markers, focus] = await Promise.all([
    import(url('tools/prepared-node-tree.mts')) as Promise<typeof import('../../../../../tools/prepared-node-tree.mts')>,
    import(url('tools/prepared-cssom.mts')) as Promise<typeof import('../../../../../tools/prepared-cssom.mts')>,
    import(url('src/platform/prepare-catalogue-stars.mts')) as Promise<typeof import('../../../../platform/prepare-catalogue-stars.mts')>,
    import(url('tools/objects/solar-system-presentation.mts')) as Promise<typeof import('../../../../../tools/objects/solar-system-presentation.mts')>,
    import(url('tools/prepare-materials.mts')) as Promise<typeof import('../../../../../tools/prepare-materials.mts')>,
    import(url('src/platform/prepared-presentation-contract.mts')) as Promise<typeof import('../../../../platform/prepared-presentation-contract.mts')>,
    import(url('site/prepared-navigation-markers.mjs')) as Promise<typeof import('../../../../../site/prepared-navigation-markers.mjs')>,
    import(url('tools/objects/terrestrial-layers/scientific-focus.mts')) as Promise<typeof import('../../../../../tools/objects/terrestrial-layers/scientific-focus.mts')>,
  ]);
  return {
    createPreparedNodeTree: tree.createPreparedNodeTree, prepareCssomDeclarationReads: cssom.prepareCssomDeclarationReads,
    prepareCatalogueStars: catalogue.prepareCatalogueStars, prepareSolarSystemPresentation: solar.prepareSolarSystemPresentation,
    prepareMaterialTracks: materials.prepareMaterialTracks, requirePreparedPresentation: contract.requirePreparedPresentation,
    navigationMarkers: markers.PREPARED_NAVIGATION_MARKERS, prepareLensNavigation: focus.prepareScientificNavigation,
  };
}
export type PresentationAdapters = Awaited<ReturnType<typeof loadPresentationAdapters>>;
