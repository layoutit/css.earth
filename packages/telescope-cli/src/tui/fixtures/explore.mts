import type { ExplorationChoice } from '../../exploration.mts';
import type { SavedExploration } from '../explore.mts';

export const exploreChoice: ExplorationChoice = {
  pick: 1, key: 'one', state: 'qualify', telescope: 'ALMA', mode: 'cube', observation: 'uid://A/B/C.source.Star.spw.1', program: 'one',
  reference: { kind: 'indexed-observation', telescope: 'ALMA', mode: 'cube', observation: 'one', programme: 'one' },
  display: { instrument: 'ALMA', observationTime: { startIso: '2025-01-02T03:04:05.000Z', endIso: null }, productKind: 'cube',
    wavelengthsMicrometres: [2300, 2400], advertisedKilobytes: 1024, metadataBasis: 'advertised' },
  familyEvidence: { schema: 'cssearth-observation-family-evidence@1', families: ['F01'], status: 'mapped', sourceTerm: 'cube', vocabulary: 'fixture', vocabularyVersion: '1', owner: { kind: 'archive-adapter', id: 'fixture', evidence: 'fixture' } },
  reason: 'fixture', limitations: [],
};
export function exploreSession(): SavedExploration {
  const choices = [exploreChoice, { ...exploreChoice, pick: 2, key: 'two', telescope: 'ESO', display: { ...exploreChoice.display, instrument: 'UVES', observationTime: { startIso: null, endIso: null }, productKind: 'spectrum' } }];
  return { schema: 'cssearth-telescope-exploration@1', createdAt: '2026-10-15T00:00:00Z', arguments: ['star'], target: 'star', choices, directory: '/run',
    answer: { schema: 'cssearth-telescope-exploration@1', request: { target: 'star' }, target: 'star', choices,
      targetResolution: { status: 'resolved', requested: 'star', canonical: { id: 'star', name: 'Star' }, matchedBy: 'id' },
      outcome: { selection: 'available', coverage: 'incomplete' }, unresolved: [], unsupported: [], issues: [], coverage: [],
      services: [{ service: 'Keck', state: 'unavailable', scope: 'fixture', reason: 'timed out' }] } };
}
