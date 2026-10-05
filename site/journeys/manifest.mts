/** The preserved manifest ID contract; coverage credits only qualified journey/profile pairs. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { observedFor, qualifications, type QualifiedObservation } from './qualification.mts';
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
export function coverage(journeys: readonly RegisteredJourney[], ids: readonly string[], profile?: string, evidence: readonly QualifiedObservation[] = qualifications()) {
  const reached = new Set(journeys.flatMap(journey => Object.entries(journey.status).flatMap(([candidate, status]) =>
    status === 'qualified' && (!profile || profile === candidate) ? observedFor(journey, candidate, evidence) : [])));
  return Object.fromEntries(['capability', 'handler', 'control'].map(kind => [kind, {
    reached: ids.filter(id => id.startsWith(kind + ':') && reached.has(id)),
    unreached: ids.filter(id => id.startsWith(kind + ':') && !reached.has(id)),
  }]));
}

export interface Exemption { id: string; reason: string }
/** S0-reviewed exclusions only; new exclusions require review before changing the committed list. */
export function parseUnreachable(input: unknown): Exemption[] {
  if (!Array.isArray(input)) {
    if (!input || typeof input !== 'object' || !('reviewed' in input) || !('proposed' in input)
      || !Array.isArray(input.proposed) || Object.keys(input).some(key => !['reviewed', 'proposed'].includes(key))) throw new TypeError('Invalid unreachable sections');
    const reviewed = parseUnreachable(input.reviewed);
    const proposed = input.proposed.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || !('evidence' in entry) || typeof entry.evidence !== 'string' || !entry.evidence.trim()
        || Object.keys(entry).some(key => !['id', 'reason', 'evidence'].includes(key))) throw new TypeError('Proposed exclusion needs exact evidence');
      const [validated] = parseUnreachable([{ id: Reflect.get(entry, 'id'), reason: Reflect.get(entry, 'reason') }]);
      if (!validated) throw new TypeError('Missing proposal');
      return validated;
    });
    if (new Set([...reviewed, ...proposed].map(row => row.id)).size !== reviewed.length + proposed.length) throw new TypeError('Duplicate unreachable id');
    return reviewed;
  }
  const entries = input.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('id' in entry) || typeof entry.id !== 'string'
      || !('reason' in entry) || typeof entry.reason !== 'string' || !entry.reason.trim()
      || /[\r\n]/u.test(entry.reason) || Object.keys(entry).some(key => !['id', 'reason', 'evidence'].includes(key))
      || ('evidence' in entry && (typeof entry.evidence !== 'string' || !entry.evidence.trim())))
      throw new TypeError('Invalid unreachable entry: expected id and one-line reason');
    return { id: entry.id, reason: entry.reason };
  });
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new TypeError('Duplicate unreachable id');
  return entries;
}
export async function unreachableIds(): Promise<Exemption[]> {
  const input: unknown = JSON.parse(await readFile(resolve(import.meta.dirname, 'unreachable.json'), 'utf8'));
  return parseUnreachable(input);
}
export function coverageGate(journeys: readonly RegisteredJourney[], ids: readonly string[], exemptions: readonly Exemption[], profile?: string, evidence: readonly QualifiedObservation[] = qualifications()) {
  validateExercises(journeys, ids);
  const report = coverage(journeys, ids, profile, evidence);
  // An exemption cannot conceal a qualified exercise in any profile, even in a profile-specific report.
  const driven = new Set(Object.values(coverage(journeys, ids, undefined, evidence)).flatMap(kind => kind.reached));
  for (const entry of exemptions) {
    if (!ids.includes(entry.id)) throw new Error(`Unknown unreachable manifest id ${entry.id}`);
    if (driven.has(entry.id)) throw new Error(`Qualified journey reaches exempt id ${entry.id}`);
  }
  const exempt = new Set(exemptions.map(entry => entry.id));
  const missing = Object.values(report).flatMap(kind => kind.unreached).filter(id => !exempt.has(id));
  const counts = ['control', 'handler', 'capability'].map(kind => {
    const row = report[kind]!;
    return `${kind === 'control' ? 'controls driven' : kind === 'handler' ? 'handlers' : 'capabilities'} ${row.reached.length}/${row.reached.length + row.unreached.length}`;
  }).join(' | ') + ` | exempt ${exempt.size}`;
  return { report, missing, counts, passed: missing.length === 0 };
}
