/** Only measured 40-capture evidence for the current journey implementation can contribute coverage. */
import { variationsFor } from './harness/known-variations.mts';
import { isDeepStrictEqual } from 'node:util';
import { profiles } from './harness/profiles.mts';
import type { Trace } from './harness/trace.mts';
import { readFileSync } from 'node:fs';
import type { Journey } from './harness/api.mts';
export interface QualifiedObservation { journey: string; profile: string; signature: string; observed: string[]; captures: number; combinations?: string[]; evidence: string }
/** Current-lane evidence needs no ignored qualification receipt. */
export function parseRunObservations(input: unknown): QualifiedObservation[] {
  if (!Array.isArray(input)) throw new Error('Expected run observations');
  const rows = input.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('captures' in row) || typeof row.captures !== 'number' || !Number.isInteger(row.captures) || row.captures < 1 || row.captures > 20)
      throw new Error('Invalid run capture count');
    const [validated] = parseQualifications([{ ...row, captures: 40 }]);
    if (!validated) throw new Error('Missing run observation');
    return { ...validated, captures: row.captures };
  });
  if (new Set(rows.map(row => row.journey + '/' + row.profile)).size !== rows.length) throw new Error('Duplicate run pair');
  return rows;
}
export function signature(journey: Journey) {
  return JSON.stringify({ id: journey.id, recipe: journey.recipe ?? null, knownVariations: variationsFor(journey.id), exercises: journey.exercises, run: String(journey.run), orderings: journey.orderings ?? [] });
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
/** Recompute receipt credit from actual captures, never from summary claims alone. */
export function validateQualificationBatch(journey: Journey, profile: string, input: unknown, actual: readonly Trace[]) {
  if (!profiles[profile] || actual.length !== 10 || !input || typeof input !== 'object' || !('passed' in input) || input.passed !== true
    || !('repeat' in input) || input.repeat !== 10 || !('profile' in input) || input.profile !== profile
    || !('signature' in input) || input.signature !== signature(journey)) throw new Error('Missing exact instrumented ten-capture batch');
  for (const trace of actual) {
    const toolchain = trace.toolchain;
    if (trace.journey !== journey.id || trace.profile !== profile || !toolchain || typeof toolchain !== 'object' || Array.isArray(toolchain)
      || !isDeepStrictEqual(toolchain.profile, profiles[profile]) || trace.observations.errors.length
      || !isDeepStrictEqual(trace.exercises, journey.exercises)) throw new Error('Qualification capture has wrong identity, profile or errors');
    if (journey.exercises.some(id => !trace.observed?.includes(id))) throw new Error('Qualification capture loses a declared id');
  }
  const observed = (actual[0]?.observed ?? []).filter(id => actual.every(trace => trace.observed?.includes(id))).sort();
  const combinations = (actual[0]?.combinations ?? []).filter(value => actual.every(trace => trace.combinations?.includes(value))).sort();
  for (const [key, expected] of [['observed', observed], ['combinations', combinations]] as const) {
    const claimed: unknown = Reflect.get(input, key);
    if (!Array.isArray(claimed) || !claimed.every(value => typeof value === 'string') || new Set(claimed).size !== claimed.length
      || !isDeepStrictEqual([...claimed].sort(), expected)) throw new Error('Qualification summary differs from actual ' + key);
  }
  return { observed, combinations };
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
