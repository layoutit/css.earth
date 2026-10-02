import { PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA, PREPARED_WORLD_SYSTEM_SCHEMA } from './world-schemas.js';
import { checks, failure } from '@cssearth/core';

const { array, positive, record, text, unique } = checks(failure('Prepared presentation: '));

/** `world-context-summary.json` and each `world-systems/<star id>.json` write what many bodies repeat once
 * (`summarizeWorldContext` in @cssearth/bake). These put each body back in the shape `parsePreparedWorldContextSummary`
 * and `parsePreparedWorldSystem` check:
 * - `bodies` is one column per field, a body's value at its index and `null` where it has none.
 * - A body names its system and discovery record by their place in its file's `systemNames` and `discoveries`.
 * - A billboard writes only what differs from its file's `billboard`, the size, focal length and distance (in body radii)
 *   most billboards share; its address is its own world billboard, `/scenes/<id>/<id>-billboard.webp`, unless it says otherwise.
 * - An orbit without a centre is centred on its parent's prepared position (a body's or a named orbit centre's), and
 *   `lod: true` gives its detail levels the orbit's own bounds. */
export function expandWorldContextSummary(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const input = record(value, 'world context summary');
  // A value without the tables (a copy of a parsed summary a caller changed) is already in that shape, for the checks to read.
  if (input.schema !== PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA || input.systemNames === undefined) return value;
  const { systemNames, discoveries, billboard, bodies, deferred, ...rest } = input;
  const tables = readTables({ systemNames, discoveries, billboard }, 'world context summary');
  const rows = transpose(bodies, 'world context summary bodies');
  const placed = new Map<string, unknown>([...[rest.focus, ...rows].map(row => {
    const body = record(row, 'world context summary body');
    return [String(body.id), body.positionM] as const;
  }), ...centres(rest.orbitCenters, 'world context summary')]);
  return { ...rest, focus: expandBody(rest.focus, tables, placed, 'world context summary focus'),
    bodies: rows.map((row, index) => expandBody(row, tables, placed, `world context summary body ${index}`)),
    ...(deferred === undefined ? {} : { deferred: transpose(deferred, 'world context summary deferred').map((row, index) => {
      const where = `world context summary deferred ${index} ${String(row.id)}`, { system, discovery, ...kept } = row;
      return { ...kept, ...(system === undefined ? {} : { systemName: listed(tables.systemNames, system, `${where} system`) }),
        ...(discovery === undefined ? {} : { discovery: listed(tables.discoveries, discovery, `${where} discovery`) }) };
    }) }) };
}

/** One system's file in the shape `parsePreparedWorldSystem` checks. `placed` gives each body the world context already
 * holds (its star, at least), for an orbit centred on it. */
export function expandWorldSystem(value: unknown, placed: (id: string) => unknown): Record<string, unknown> {
  const input = record(value, 'world system', ['schema', 'id', 'systemNames', 'discoveries', 'billboard', 'orbitCenters', 'orbitBanks', 'bodies']);
  const where = `world system ${String(input.id)}`;
  if (input.schema !== PREPARED_WORLD_SYSTEM_SCHEMA) throw new TypeError(`${where} is ${String(input.schema)}, not ${PREPARED_WORLD_SYSTEM_SCHEMA}.`);
  const { systemNames, discoveries, billboard, bodies, ...rest } = input;
  const tables = readTables({ systemNames, discoveries, billboard }, where);
  const rows = transpose(bodies, `${where} bodies`);
  const own = new Map<string, unknown>([...rows.map(row => [String(row.id), row.positionM] as const), ...centres(rest.orbitCenters, where)]);
  const positions = { get: (id: string) => own.has(id) ? own.get(id) : placed(id) };
  return { ...rest, bodies: rows.map((row, index) => expandBody(row, tables, positions, `${where} body ${index}`)) };
}

type Tables = { readonly systemNames: readonly string[]; readonly discoveries: readonly Readonly<Record<string, unknown>>[];
  readonly billboard: Readonly<Record<string, unknown>> };
function readTables(input: Record<string, unknown>, where: string): Tables {
  const systemNames = array(input.systemNames, `${where} systemNames`).map((name, index) => text(name, `${where} systemNames[${index}]`));
  unique(systemNames, `${where} systemNames`);
  const discoveries = array(input.discoveries, `${where} discoveries`)
    .map((entry, index) => Object.freeze({ ...record(entry, `${where} discoveries[${index}]`) }));
  return { systemNames, discoveries, billboard: record(input.billboard, `${where} billboard`, ['size', 'focalPixels', 'distanceRadii']) };
}
function listed<T>(table: readonly T[], at: unknown, label: string): T {
  const entry = typeof at === 'number' && Number.isInteger(at) ? table[at] : undefined;
  if (entry === undefined) throw new TypeError(`${label} is ${JSON.stringify(at)}, not an index into its ${table.length}-entry table.`);
  return entry;
}
function centres(value: unknown, where: string) {
  return Object.entries(value === undefined ? {} : record(value, `${where} orbitCenters`))
    .map(([id, centre]) => [id, record(centre, `${where} orbit centre ${id}`).positionM] as const);
}
function expandBody(row: unknown, tables: Tables, placed: { get(id: string): unknown }, where: string) {
  const { system, discovery, billboard, orbit, ...kept } = record(row, where);
  const id = String(kept.id), radiusM = kept.radiusM;
  return { ...kept,
    ...(system === undefined ? {} : { systemName: listed(tables.systemNames, system, `${where} ${id} system`) }),
    ...(discovery === undefined ? {} : { discovery: listed(tables.discoveries, discovery, `${where} ${id} discovery`) }),
    ...(billboard === undefined ? {} : { billboard: (() => {
      const drawn = record(billboard, `${where} ${id} billboard`, ['url', 'size', 'focalPixels', 'distanceM']), shared = tables.billboard;
      const part = (name: 'size' | 'focalPixels') => {
        const own = drawn[name] ?? shared[name];
        if (own === undefined) throw new TypeError(`${where} ${id} billboard leaves out its ${name}, and its file's billboard names none.`);
        return own;
      };
      if (drawn.distanceM === undefined && (shared.distanceRadii === undefined || typeof radiusM !== 'number')) {
        throw new TypeError(`${where} ${id} billboard leaves out its distance, and its file's billboard names no distanceRadii.`);
      }
      return { url: drawn.url ?? `/scenes/${id}/${id}-billboard.webp`, size: part('size'), focalPixels: part('focalPixels'),
        distanceM: drawn.distanceM ?? (radiusM as number) * positive(shared.distanceRadii, `${where} billboard distanceRadii`) };
    })() }),
    ...(orbit === undefined ? {} : { orbit: (() => {
      const path = record(orbit, `${where} ${id} orbit`);
      const centre = path.centerPositionM ?? placed.get(String(path.centerBodyId));
      if (centre === undefined) throw new TypeError(`${where} ${id} orbit leaves out its centre, and its parent ${String(path.centerBodyId)} is not placed.`);
      return { ...path, centerPositionM: centre, ...(path.lod === true ? { lod: { bounds: path.bounds } } : {}) };
    })() }) };
}

/** A file's body columns as one record per body: a column's `null` is a field that body does not have. */
function transpose(value: unknown, where: string): Record<string, unknown>[] {
  const columns = Object.entries(record(value, where)).map(([field, column]) => [field, array(column, `${where}.${field}`)] as const);
  const length = columns[0]?.[1].length ?? 0;
  for (const [field, column] of columns) if (column.length !== length) throw new TypeError(`${where}.${field} has ${column.length} entries, not ${length}.`);
  return Array.from({ length }, (_, index) => {
    const row: Record<string, unknown> = {};
    for (const [field, column] of columns) if (column[index] !== null) row[field] = column[index];
    return row;
  });
}
