import type { MissionRecord } from '../src/platform/exploration-catalog.mts';
/** Group individual missions by their explicit credited agencies. */
export function machineAgencies<T extends MissionRecord>(missions: readonly T[]) {
  const agencies = new Map<string, Map<string, T>>();
  for (const mission of missions) for (const agency of mission.agencyIds.value) {
    const entries = agencies.get(agency) ?? new Map<string, T>();
    entries.set(mission.id, mission); agencies.set(agency, entries);
  }
  return [...agencies].map(([name, missions]) => ({ name, missions: [...missions.values()] }));
}
