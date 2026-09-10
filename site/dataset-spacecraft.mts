import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';
export interface SpacecraftMission { readonly id: string; readonly facts: readonly { label: string; detail?: string }[]; }
import { productSourceIds, validateObjectProvenance } from '../src/platform/object-provenance.mts';

/** Resolve capture platforms through source-to-product lineage, at build time. */
export function datasetSpacecraft<T extends SpacecraftMission>(provenance: ProvenanceDocument | null | undefined, lensId: string, catalog: Readonly<Record<string, T>>) {
  if (!provenance) return [];
  validateObjectProvenance(provenance);
  const products = provenance.products.filter(product => product.lensIds?.includes(lensId));
  const sources = new Map(provenance.sources.map(source => [source.id, source]));
  const ids = new Set<string>();
  for (const product of products) {
    const interpretation = product.interpretation ?? {};
    // A captured outer texture is not evidence for a schematic interior or a
    // synthetic spectral response that happens to consume that texture.
    if (['schematic-interior', 'illustrative-model', 'modeled-noise'].includes(interpretation.kind ?? "")
        || interpretation.sourceKind === 'schematic-morphology-illustration') continue;
    for (const id of productSourceIds(provenance, product.id)) {
      for (const spacecraftId of sources.get(id)?.capture?.spacecraftIds ?? []) ids.add(spacecraftId);
    }
  }
  return [...ids].map(id => {
    const spacecraft = catalog[id];
    if (!spacecraft) throw new TypeError(`Unknown source spacecraft: ${id}.`);
    return spacecraft;
  });
}

/** The body's mission tab combines its dataset lineage without repeating missions. */
export function objectSpacecraft<T extends SpacecraftMission>(provenance: ProvenanceDocument | null | undefined, catalog: Readonly<Record<string, T>>) {
  if (!provenance) return [];
  validateObjectProvenance(provenance);
  const lensIds = new Set(provenance.products.flatMap(product => product.lensIds ?? []));
  const missions = new Map<string, T>();
  for (const lensId of lensIds) {
    for (const mission of datasetSpacecraft(provenance, lensId, catalog)) {
      missions.set(mission.id, mission);
    }
  }
  return [...missions.values()];
}

/** Group prepared missions by their credited agencies, including joint missions. */
export function spacecraftAgencies<T extends SpacecraftMission>(missions: readonly T[]) {
  const agencies = new Map<string, Map<string, T>>();
  for (const mission of missions) {
    const credit = mission.facts.find(fact => fact.label === 'Mission')?.detail;
    if (typeof credit !== 'string' || !credit.trim()) {
      throw new TypeError(`Mission ${mission.id} has no credited agency.`);
    }
    for (const agency of credit.split(/\s*\/\s*/)) {
      if (!agencies.has(agency)) agencies.set(agency, new Map());
      agencies.get(agency)!.set(mission.id, mission);
    }
  }
  return [...agencies].map(([name, missions]) => ({ name, missions: [...missions.values()] }));
}
