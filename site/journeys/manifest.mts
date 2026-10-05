/** The preserved manifest ID contract; coverage credits only qualified journey/profile pairs. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RegisteredJourney } from './registry.mts';
export function parseManifest(input: unknown): { schema: 'plan7-s0-w2-manifest@1'; ids: string[] } {
  if (!input || typeof input !== 'object' || !('schema' in input) || input.schema !== 'plan7-s0-w2-manifest@1'
    || !('ids' in input) || !Array.isArray(input.ids) || Object.keys(input).some(key => !['schema', 'ids'].includes(key)))
    throw new TypeError('Invalid manifest ID contract');
  const ids = input.ids.map((value: unknown) => {
    if (typeof value !== 'string' || !/^(?:capability|handler|control):[^\s]+$/u.test(value)) throw new TypeError('Invalid manifest ID');
    return value;
  });
  if (new Set(ids).size !== ids.length || !ids.length) throw new TypeError('Duplicate or empty manifest IDs');
  return { schema: input.schema, ids };
}
export async function manifestIds() {
  const input: unknown = JSON.parse(await readFile(resolve(import.meta.dirname, 'manifest-ids.json'), 'utf8'));
  return parseManifest(input).ids;
}
export function validateExercises(journeys: readonly { id: string; exercises: string[] }[], ids: readonly string[]) {
  const known = new Set(ids);
  for (const journey of journeys) for (const id of journey.exercises) if (!known.has(id)) throw new Error(`${journey.id}: unknown manifest exercise ${id}`);
}
export function coverage(journeys: readonly RegisteredJourney[], ids: readonly string[], profile: string) {
  const reached = new Set(journeys.filter(journey => journey.status[profile] === 'qualified').flatMap(journey => journey.exercises));
  return Object.fromEntries(['capability', 'handler', 'control'].map(kind => [kind, {
    reached: ids.filter(id => id.startsWith(kind + ':') && reached.has(id)),
    unreached: ids.filter(id => id.startsWith(kind + ':') && !reached.has(id)),
  }]));
}
