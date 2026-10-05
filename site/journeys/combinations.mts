/** Compare actual qualified witnesses against the preserved S0 capability/startup universe. */
import { readFile } from 'node:fs/promises';
import { observedFor, qualifications, signature, type QualifiedObservation } from './qualification.mts';
import type { RegisteredJourney } from './registry.mts';
export interface CombinationContract { expected: number; combinations: string[]; representatives: { id: string; capabilities: string[]; startupPaths: string[] }[] }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0); }
export function parseCombinations(input: unknown): CombinationContract {
  if (!input || typeof input !== 'object' || !('expected' in input) || input.expected !== 159 || !('combinations' in input) || !strings(input.combinations)
    || new Set(input.combinations).size !== 159 || !('representatives' in input) || !Array.isArray(input.representatives)) throw new Error('Invalid S0 combination universe');
  const representatives = input.representatives.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !('capabilities' in row) || !strings(row.capabilities)
      || !('startupPaths' in row) || !strings(row.startupPaths)) throw new Error('Invalid representative combinations');
    return { id: row.id, capabilities: row.capabilities, startupPaths: row.startupPaths };
  });
  if (representatives.length !== 13 || new Set(representatives.map(row => row.id)).size !== 13) throw new Error('Expected thirteen representatives');
  const owned = new Set(representatives.flatMap(row => row.capabilities.flatMap(capability => row.startupPaths.map(path => `${capability} | ${path}`))));
  if (owned.size !== 159 || input.combinations.some(value => !owned.has(value))) throw new Error('S0 ownership does not close the universe');
  return { expected: 159, combinations: input.combinations, representatives };
}
export async function combinationContract() {
  const input: unknown = JSON.parse(await readFile(new URL('./object-combinations.json', import.meta.url), 'utf8'));
  return parseCombinations(input);
}
export function combinationReport(journeys: readonly RegisteredJourney[], contract: CombinationContract, evidence: readonly QualifiedObservation[] = qualifications(), profile?: string) {
  const witnessed = new Set(evidence.filter(row => {
    const journey = journeys.find(journey => journey.id === row.journey);
    return journey && (!profile || row.profile === profile) && journey.status[row.profile] === 'qualified'
      && row.signature === signature(journey) && observedFor(journey, row.profile, evidence).length > 0;
  }).flatMap(row => row.combinations ?? []));
  const representatives = contract.representatives.map(row => {
    const expected = row.capabilities.flatMap(capability => row.startupPaths.map(path => `${capability} | ${path}`));
    return { representative: row.id, reached: expected.filter(value => witnessed.has(`${row.id} | ${value}`)),
      unreached: expected.filter(value => !witnessed.has(`${row.id} | ${value}`)) };
  });
  for (const value of witnessed) if (!representatives.some(row => value.startsWith(row.representative + ' | ')
    && [...row.reached, ...row.unreached].includes(value.slice(row.representative.length + 3)))) throw new Error('Observation outside S0 universe: ' + value);
  const reached = contract.combinations.filter(value => representatives.some(row => row.reached.includes(value)));
  return { counts: `combinations ${reached.length}/${contract.expected}`, reached,
    unreached: contract.combinations.filter(value => !reached.includes(value)), representatives };
}
