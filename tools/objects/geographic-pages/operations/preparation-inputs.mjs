/** Project-relative source identities for a newly authored geometry release. */
export function geographicPreparationInputs(context) {
  return [context.relativeProject(context.preparedPath('scene.json')),
    ...['wmts-page-geometry','wmts-polar-geometry','wms-page-geometry','page-geometry','prepare-wmts-tree','encode-prepared-block'].map(name=>`tools/objects/geographic-pages/${name}.mjs`),
    'src/platform/prepared-map/prepared-block.mjs','src/platform/prepared-map/prepared-block-transport.mjs',
    'tools/objects/geographic-pages/operations/refine-wmts-stubs.mjs'];
}
