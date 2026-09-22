import type { GalaxyDistance, GalaxyRecipe, SourcePin } from './types.js';

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unknown ${label} field: ${key}`);
}
export function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be nonempty text.`);
  return value;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}
function positive(value: unknown, label: string): number {
  const result = finite(value, label); if (!(result > 0)) throw new TypeError(`${label} must be positive.`); return result;
}
function pin(value: unknown, label: string): SourcePin {
  const r = record(value, label); keys(r, ['path', 'bytes'], label);
  const path = text(r.path, label), bytes = positive(r.bytes, label);
  if (path.startsWith('/') || path.includes('\\') || path.split('/').some(v => ['..', '.', ''].includes(v)) || !Number.isSafeInteger(bytes)) throw new TypeError(`${label} must be a pinned contained path.`);
  return { path, bytes };
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length) throw new TypeError(`${label} must be a nonempty list.`);
  const result = value.map(v => text(v, label));
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must not repeat values.`);
  return result;
}
function id(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/.test(value)) throw new TypeError(`Invalid source identifier: ${value}`); return value;
}
function distance(value: unknown): GalaxyDistance {
  const r = record(value, 'Distance override'); keys(r, ['valuePc', 'minusPc', 'plusPc', 'method', 'sourceRef', 'uncertainty'], 'Distance override');
  const result: GalaxyDistance = { valuePc: positive(r.valuePc, 'Distance'), method: text(r.method, 'Distance method'), sourceRef: text(r.sourceRef, 'Distance source') };
  for (const key of ['minusPc', 'plusPc'] as const) if (r[key] !== undefined) result[key] = positive(r[key], key);
  if (result.minusPc !== undefined && result.minusPc >= result.valuePc) throw new TypeError('Distance lower error exceeds distance.');
  if (r.uncertainty !== undefined) {
    const u = record(r.uncertainty, 'Distance uncertainty'); keys(u, ['statisticalPc', 'systematicPc'], 'Distance uncertainty');
    result.uncertainty = { statisticalPc: positive(u.statisticalPc, 'Statistical error'), systematicPc: positive(u.systematicPc, 'Systematic error') };
  }
  return result;
}
export function parseGalaxyRecipe(value: unknown): GalaxyRecipe {
  const r = record(value, 'Galaxy recipe');
  keys(r, ['schema', 'frame', 'catalogue', 'archive', 'membershipTable', 'provenance', 'catalogueSourceId', 'membershipSourceId', 'archiveInputPrefix', 'eligibleTables', 'excludedDistanceMethods', 'hostRoots', 'membershipNames', 'detailObjects', 'distanceOverrides', 'description'], 'Galaxy recipe');
  if (r.schema !== 'cssearth-galaxy-catalog-source@1') throw new TypeError('Unsupported galaxy recipe schema.');
  const frame = record(r.frame, 'Frame'); keys(frame, ['referenceFrame', 'epochJdTt'], 'Frame');
  if (frame.referenceFrame !== 'sun-icrf') throw new TypeError('Galaxy astrometry requires Sun-origin ICRS axes.');
  const hostRoots = Object.fromEntries(Object.entries(record(r.hostRoots, 'Host roots')).map(([key, value]) => {
    if (value !== 'milky-way' && value !== 'andromeda') throw new TypeError('Unsupported Local Group subgroup.');
    return [id(key), value];
  })) as GalaxyRecipe['hostRoots'];
  const membershipNames = Object.fromEntries(Object.entries(record(r.membershipNames, 'Membership bindings')).map(([key, value]) => [id(key), text(value, 'Membership name')]));
  const detailObjects = Object.fromEntries(Object.entries(record(r.detailObjects, 'Detail objects')).map(([key, value]) => {
    const d = record(value, 'Detail'); keys(d, ['id', 'focusRadiusM'], 'Detail');
    return [id(key), { id: id(text(d.id, 'Detail identifier')), ...(d.focusRadiusM === undefined ? {} : { focusRadiusM: positive(d.focusRadiusM, 'Focus radius') }) }];
  }));
  if (new Set(Object.values(detailObjects).map(d => d.id)).size !== Object.keys(detailObjects).length) throw new TypeError('Detail object mappings must be unique.');
  const distanceOverrides = Object.fromEntries(Object.entries(record(r.distanceOverrides, 'Distance overrides')).map(([key, value]) => [id(key), distance(value)]));
  const archiveInputPrefix = text(r.archiveInputPrefix, 'Archive input prefix');
  if (archiveInputPrefix.startsWith('/') || archiveInputPrefix.includes('..') || !archiveInputPrefix.endsWith('/')) throw new TypeError('Invalid archive input prefix.');
  return { schema: r.schema, frame: { referenceFrame: frame.referenceFrame, epochJdTt: finite(frame.epochJdTt, 'Frame epoch') },
    catalogue: pin(r.catalogue, 'Catalogue'), archive: pin(r.archive, 'Archive'), membershipTable: pin(r.membershipTable, 'Membership table'), provenance: pin(r.provenance, 'Provenance'),
    catalogueSourceId: text(r.catalogueSourceId, 'Catalogue source identifier'), membershipSourceId: text(r.membershipSourceId, 'Membership source identifier'),
    archiveInputPrefix, eligibleTables: strings(r.eligibleTables, 'Eligible tables'), excludedDistanceMethods: strings(r.excludedDistanceMethods, 'Excluded methods'),
    hostRoots, membershipNames, detailObjects, distanceOverrides, description: text(r.description, 'Selection description') };
}
