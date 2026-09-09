import { productSourceIds, validateObjectProvenance } from '../src/platform/object-provenance.mjs';

/** Resolve capture platforms through source-to-product lineage, at build time. */
export function datasetSpacecraft(provenance, lensId, catalog) {
  if (!provenance) return [];
  validateObjectProvenance(provenance);
  const products = provenance.products.filter(product => product.lensIds.includes(lensId));
  const sources = new Map(provenance.sources.map(source => [source.id, source]));
  const ids = new Set();
  for (const product of products) {
    const interpretation = product.interpretation ?? {};
    // A captured outer texture is not evidence for a schematic interior or a
    // synthetic spectral response that happens to consume that texture.
    if (['schematic-interior', 'illustrative-model', 'modeled-noise'].includes(interpretation.kind)
        || interpretation.sourceKind === 'schematic-morphology-illustration') continue;
    for (const id of productSourceIds(provenance, product.id)) {
      for (const spacecraftId of sources.get(id).capture?.spacecraftIds ?? []) ids.add(spacecraftId);
    }
  }
  return [...ids].map(id => {
    const spacecraft = catalog[id];
    if (!spacecraft) throw new TypeError(`Unknown source spacecraft: ${id}.`);
    return spacecraft;
  });
}
