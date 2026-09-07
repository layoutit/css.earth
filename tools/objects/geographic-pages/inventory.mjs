import { requireGeographicScope, preparedEntityLenses } from '../../../src/platform/geographic-lens-applicability.mjs';
import { requireGeographicLensReference } from '../../../src/platform/geographic-lens-contract.mjs';

export function prepareGeographicInventory(source, prepared, { namespace, publicBase }) {
  if (source.schema !== 'cssearth-observation-inventory@1' || source.objectId !== namespace ||
      !Array.isArray(source.datasets) || new Set(source.datasets.map(entry => entry.id)).size !== source.datasets.length) {
    throw new Error('Invalid observation inventory.');
  }
  const inventory = [], assets = new Set();
  for (const entry of source.datasets) {
    requireGeographicScope(entry.scope);
    const result = prepared.get(entry.id);
    if (entry.scope.objectId !== namespace || !result || result.descriptor.id !== entry.id) {
      throw new Error('Prepared observation identity differs from its declared scope.');
    }
    const lens = requireGeographicLensReference(result.descriptor, publicBase);
    if (!Array.isArray(result.assets) || !result.assets.includes(lens.package.url) || !result.assets.includes(lens.thumbnailUrl)) {
      throw new Error('Observation asset inventory is incomplete.');
    }
    for (const url of result.assets) {
      if (!url.startsWith(publicBase) || url.includes('..') || url.includes('?')) throw new Error('Observation asset scope is invalid.');
      assets.add(url);
    }
    inventory.push({ scope: entry.scope, lens });
  }
  return { inventory, rootLenses: preparedEntityLenses(inventory, namespace, namespace), assets: [...assets].sort() };
}
