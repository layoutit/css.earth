import { GEOGRAPHIC_LENS_CAPACITY, requireGeographicScope, geographicScopeIncludes } from "./geographic-lens-contract.mjs";

// A source's prepared scope is independent of the current viewport containing
// data. Entity kinds never enter runtime eligibility or dataset identity.
// Preparation selects references, not source pixels or geometry. The directory
// interns descriptors so a global observation has one package across all places.
export function preparedEntityLenses(inventory, objectId, entityId) {
  const lenses = inventory.filter(entry => geographicScopeIncludes(requireGeographicScope(entry.scope), objectId, entityId))
    .map(entry => entry.lens);
  if (lenses.length > GEOGRAPHIC_LENS_CAPACITY || new Set(lenses.map(lens => lens.id)).size !== lenses.length) {
    throw new Error("Prepared entity observations exceed the shared card capacity.");
  }
  return lenses;
}

export { requireGeographicScope } from "./geographic-lens-contract.mjs";
