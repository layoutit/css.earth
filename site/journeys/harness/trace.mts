/** Validated interchange for browser-journey observations; retains every payload value and sequence. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const families = ['network', 'dom', 'rendering', 'content', 'errors'] as const;
export type Family = typeof families[number];
export interface Observation { sequence: number; step: string; data: Json; screenshot?: string }
export interface Trace {
  schema: 'cssearth-journey@1';
  journey: string;
  profile: string;
  toolchain: Json;
  exercises: string[];
  observed?: string[];
  combinations?: string[];
  volatile?: Json[];
  chunkAmbiguities?: string[];
  observations: Record<Family, Observation[]>;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: expected an object`);
  return Object.fromEntries(Object.entries(value));
}
function keys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${path}.${key}: unknown field`);
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${path}: expected a nonempty string`);
  return value;
}
export function identity(value: unknown, path: string): string {
  const result = text(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(result)) throw new TypeError(`${path}: expected lowercase words separated by dashes`);
  return result;
}
export function json(value: unknown, path = '$'): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((entry: unknown, index) => json(entry, `${path}[${index}]`));
  const object = record(value, path);
  return Object.fromEntries(Object.entries(object).map(([key, entry]) => [key, json(entry, `${path}.${key}`)]));
}
function observations(value: unknown, family: Family): Observation[] {
  if (!Array.isArray(value)) throw new TypeError(`$.observations.${family}: expected an array`);
  let previous = -1;
  return value.map((input: unknown, index) => {
    const path = `$.observations.${family}[${index}]`, row = record(input, path);
    keys(row, ['sequence', 'step', 'data', 'screenshot'], path);
    const sequence = row.sequence;
    if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence <= previous) {
      throw new TypeError(`${path}.sequence: expected a strictly increasing nonnegative integer`);
    }
    previous = sequence;
    const observation: Observation = { sequence, step: text(row.step, `${path}.step`), data: json(row.data, `${path}.data`) };
    if (row.screenshot !== undefined) {
      const screenshot = text(row.screenshot, `${path}.screenshot`);
      if (family !== 'rendering' || !/^[a-z0-9]+(?:[-/][a-z0-9]+)*\.png$/u.test(screenshot)) {
        throw new TypeError(`${path}.screenshot: expected a relative PNG path in rendering`);
      }
      observation.screenshot = screenshot;
    }
    return observation;
  });
}
export function parseTrace(input: unknown): Trace {
  const value = record(input, '$');
  keys(value, ['schema', 'journey', 'profile', 'toolchain', 'exercises', 'observations', 'volatile', 'chunkAmbiguities', 'observed', 'combinations'], '$');
  if (value.schema !== 'cssearth-journey@1') throw new TypeError('$.schema: unsupported journey trace schema');
  const rows = record(value.observations, '$.observations');
  keys(rows, families, '$.observations');
  if (!Array.isArray(value.exercises) || !value.exercises.every((entry: unknown) => typeof entry === 'string' && entry.length > 0)) {
    throw new TypeError('$.exercises: expected manifest id strings');
  }
  return {
    schema: 'cssearth-journey@1', journey: identity(value.journey, '$.journey'), profile: identity(value.profile, '$.profile'),
    toolchain: json(value.toolchain, '$.toolchain'), exercises: value.exercises.map((entry: unknown) => text(entry, '$.exercises')),
    ...(value.combinations === undefined ? {} : { combinations: (() => {
      if (!Array.isArray(value.combinations) || !value.combinations.every(value => typeof value === 'string' && value.split(' | ').length === 3)
        || new Set(value.combinations).size !== value.combinations.length) throw new TypeError('Invalid observed combinations');
      return value.combinations;
    })() }),
    ...(value.observed === undefined ? {} : { observed: (() => {
      if (!Array.isArray(value.observed) || !value.observed.every(id => typeof id === 'string' && /^(?:control|handler|capability):/u.test(id))
        || new Set(value.observed).size !== value.observed.length) throw new TypeError('Invalid observed manifest ids');
      return value.observed;
    })() }),
    ...(value.volatile === undefined ? {} : { volatile: (() => { if (!Array.isArray(value.volatile)) throw new TypeError('$.volatile: expected declarations'); return value.volatile.map(entry => { const declaration = record(entry, '$.volatile[]'); for (const key of ['family', 'feature', 'subject', 'cause']) text(declaration[key], '$.volatile[].' + key); if (!families.some(family => family === declaration.family)) throw new TypeError('Invalid volatile family'); json(declaration.bound); return json(declaration); }); })() }),
    ...(value.chunkAmbiguities === undefined ? {} : { chunkAmbiguities: (() => {
      if (!Array.isArray(value.chunkAmbiguities) || !value.chunkAmbiguities.every(entry => typeof entry === 'string' && entry.startsWith('/_astro/')))
        throw new TypeError('Expected ambiguous build asset URLs');
      return value.chunkAmbiguities.map(entry => text(entry, '$.chunkAmbiguities'));
    })() }),
    observations: {
      network: observations(rows.network, 'network'), dom: observations(rows.dom, 'dom'),
      rendering: observations(rows.rendering, 'rendering'), content: observations(rows.content, 'content'), errors: observations(rows.errors, 'errors'),
    },
  };
}
