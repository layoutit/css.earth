/** Project-relative source identities for a newly authored geometry release. */
import type { OperationContext } from './context.mts';
export function geographicPreparationInputs(context: OperationContext) {
  return [context.relativeProject(context.preparedPath('scene.json')),
    ...['wmts-page-geometry','wmts-polar-geometry','wms-page-geometry','page-geometry','prepare-wmts-tree','encode-prepared-block'].map(name=>`tools/objects/geographic-pages/${name}.mts`),
    'src/platform/prepared-map/prepared-block.mts','src/platform/prepared-map/prepared-block-transport.mts',
    'tools/objects/geographic-pages/operations/refine-wmts-stubs.mts'];
}
