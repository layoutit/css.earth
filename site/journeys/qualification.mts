/** Only measured 40-capture evidence for the current journey implementation can contribute coverage. */
import { readFileSync } from 'node:fs';
import type { Journey } from './harness/api.mts';
export interface QualifiedObservation { journey: string; profile: string; signature: string; observed: string[]; captures: number; combinations?: string[]; evidence: string }
export function signature(journey: Journey) {
  return JSON.stringify({ id: journey.id, recipe: journey.recipe ?? null, exercises: journey.exercises, run: String(journey.run), orderings: journey.orderings ?? [] });
}
export function parseQualifications(input: unknown): QualifiedObservation[] {
  if (!Array.isArray(input)) throw new Error('Expected qualification evidence array');
  const rows = input.map((row: unknown): QualifiedObservation => {
    if (!row || typeof row !== 'object' || !('journey' in row) || typeof row.journey !== 'string' || !('profile' in row) || typeof row.profile !== 'string'
      || !('signature' in row) || typeof row.signature !== 'string' || !('observed' in row) || !Array.isArray(row.observed)
      || !row.observed.every(id => typeof id === 'string' && /^(?:handler|control|capability):/u.test(id)) || new Set(row.observed).size !== row.observed.length
      || !('captures' in row) || row.captures !== 40 || !('evidence' in row) || typeof row.evidence !== 'string') throw new Error('Invalid 40-capture evidence');
    const combinations = 'combinations' in row ? row.combinations : [];
    if (!Array.isArray(combinations) || !combinations.every(value => typeof value === 'string' && value.split(' | ').length === 3)) throw new Error('Invalid combination evidence');
    return { combinations, journey: row.journey, profile: row.profile, signature: row.signature, observed: row.observed, captures: row.captures, evidence: row.evidence };
  });
  if (new Set(rows.map(row => row.journey + '/' + row.profile)).size !== rows.length) throw new Error('Duplicate qualified pair');
  return rows;
}
export const qualificationFile = new URL('../../output/journeys/observed-qualification.json', import.meta.url);
export function qualifications(): QualifiedObservation[] {
  let text: string;
  try { text = readFileSync(qualificationFile, 'utf8'); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
  const input: unknown = JSON.parse(text);
  return parseQualifications(input);
}
export function observedFor(journey: Journey, profile: string, evidence: readonly QualifiedObservation[]) {
  return evidence.find(row => row.journey === journey.id && row.profile === profile && row.signature === signature(journey))?.observed ?? [];
}
