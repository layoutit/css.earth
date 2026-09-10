import { explorationRecord, explorationArray, explorationId, explorationText } from '../../src/platform/exploration-catalog.mts';
import { validateObjectProvenance, OBJECT_PROVENANCE_SCHEMA } from '../../src/platform/object-provenance.mts';

// This is the explicit @1 migration inventory, never a runtime association rule.
const individualVehicles = new Set(['messenger', 'cassini', 'dawn', 'galileo', 'hubble', 'juno', 'new-horizons', 'sdo',
  'voyager-1', 'voyager-2', 'lro', 'mro', 'odyssey', 'near-shoemaker', 'osiris-rex', 'hayabusa2', 'hayabusa', 'rosetta',
  'terra', 'suomi-npp', 'magellan', 'mars-global-surveyor']);
export function migrateProvenanceV1(input: unknown) {
  const document = explorationRecord(input);
  if (document.schema !== 'cssearth-object-provenance@1') return validateObjectProvenance(input);
  return validateObjectProvenance({ ...document, schema: OBJECT_PROVENANCE_SCHEMA,
    sources: explorationArray(document.sources, raw => {
      const source = explorationRecord(raw);
      if (source.capture === undefined) return source;
      const capture = explorationRecord(source.capture, ['spacecraftIds', 'evidence']);
      const evidence = explorationText(capture.evidence);
      return { ...source, capture: { attributions: explorationArray(capture.spacecraftIds, raw => {
        const id = explorationId(raw);
        if (id === 'grail') return { kind: 'mission', missionId: 'grail', evidence };
        if (id === 'viking') return { kind: 'unresolved', label: 'Viking orbiters', evidence,
          reason: 'The preserved source credits Viking collectively and does not identify which individual orbiter supplied these observations.' };
        if (!individualVehicles.has(id)) throw new TypeError(`Unmapped legacy capture: ${id}.`);
        return { kind: 'spacecraft', spacecraftId: id, missionId: id, evidence };
      }) } };
    }) });
}
