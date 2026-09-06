import { GEOGRAPHIC_LENS_CAPACITY, requireGeographicScope, geographicScopeIncludes } from "./geographic-lens-contract.mjs";

// Each card explicitly owns its observations. Dataset extent and parentage do
// not grant ownership. Preparation interns package references independently of
// card identity; entity kinds never enter runtime eligibility.
export function preparedEntityLenses(inventory, objectId, entityId) {
  const lenses = inventory.filter(entry => geographicScopeIncludes(requireGeographicScope(entry.scope), objectId, entityId))
    .map(entry => entry.lens);
  if (lenses.length > GEOGRAPHIC_LENS_CAPACITY || new Set(lenses.map(lens => lens.id)).size !== lenses.length) {
    throw new Error("Prepared entity observations exceed the shared card capacity.");
  }
  return lenses;
}

export { requireGeographicScope } from "./geographic-lens-contract.mjs";
