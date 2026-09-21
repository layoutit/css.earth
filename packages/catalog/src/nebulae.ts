import { validateSpatialPosition } from './spatial-relations.ts';
import type { PreparedGalaxyRecord, SpatialCatalogSource } from './spatial.js';

/** A sourced Galactic volume. The legacy nebula transport also carries stellar clusters;
 * the row kind preserves their scientific identity independently of the shared renderer. */
export interface PreparedNebulaRecord extends Pick<PreparedGalaxyRecord,
  'id' | 'name' | 'aliases' | 'positionM' | 'skyPosition' | 'distance' | 'status' | 'presentation'> {
  readonly kind: 'nebula' | 'globular-cluster';
  readonly detailedObjectId: string;
  readonly introduction: { readonly text: string; readonly sourceRefs: readonly string[] };
  readonly classification: { readonly name: string; readonly basis: string; readonly sourceRef: string };
}
export interface PreparedNebulaCatalog {
  readonly schema: 'cssearth-nebula-catalog@1';
  readonly frame: { readonly referenceFrame: string; readonly epochJdTt: number };
  readonly sources: readonly SpatialCatalogSource[];
  readonly objects: readonly PreparedNebulaRecord[];
}
export function isPreparedNebula(object: object): object is PreparedNebulaRecord {
  return 'kind' in object && (object.kind === 'nebula' || object.kind === 'globular-cluster');
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected nebula catalogue object.');
  return v as Record<string, unknown>;
};
const text = (v: unknown): string => { if (typeof v !== 'string' || !v.trim()) throw new TypeError('Expected nebula catalogue text.'); return v; };
const finite = (v: unknown): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Expected finite nebula value.'); return v; };
const positive = (v: unknown): number => { const n = finite(v); if (n <= 0) throw new TypeError('Expected positive nebula value.'); return n; };
const array = (v: unknown): readonly unknown[] => { if (!Array.isArray(v)) throw new TypeError('Expected nebula array.'); return v; };

/** A separate catalogue avoids misclassifying Galactic volumes as Local Group galaxies. */
export function parsePreparedNebulaCatalog(input: unknown): PreparedNebulaCatalog {
  const v = record(input), frame = record(v.frame), sources = array(v.sources), objects = array(v.objects);
  if (v.schema !== 'cssearth-nebula-catalog@1' || objects.length > 10000) throw new TypeError('Invalid nebula catalogue.');
  text(frame.referenceFrame); finite(frame.epochJdTt);
  const sourceIds = new Set<string>(), ids = new Set<string>(), details = new Set<string>();
  for (const value of sources) {
    const source = record(value), id = text(source.id);
    if (sourceIds.has(id) || !/^https:\/\//.test(text(source.url)) || !/^[a-f0-9]{64}$/.test(text(source.sha256)) ||
        !Number.isSafeInteger(positive(source.bytes))) throw new TypeError('Invalid nebula source pin.');
    sourceIds.add(id); text(source.citation);
  }
  const reference = (v: unknown) => { const id = text(v); if (![...sourceIds].some(source => id === source || id.startsWith(`${source}:`))) throw new TypeError('Unknown nebula source reference.'); };
  for (const value of objects) {
    const row = record(value), id = text(row.id), detail = text(row.detailedObjectId);
    if (!isPreparedNebula(row) || row.status !== 'confirmed' || ids.has(id) || details.has(detail) ||
        !/^[a-z][a-z0-9-]*$/.test(id) || !/^[a-z][a-z0-9-]*$/.test(detail)) throw new TypeError('Invalid nebula identity.');
    ids.add(id); details.add(detail); text(row.name); array(row.aliases).forEach(text);
    const introduction = record(row.introduction), introductionText = text(introduction.text);
    const introductionRefs = array(introduction.sourceRefs).map(text);
    if (introductionText.length > 180 || !introductionRefs.length || new Set(introductionRefs).size !== introductionRefs.length)
      throw new TypeError('Invalid nebula introduction.');
    introductionRefs.forEach(reference);
    const position = array(row.positionM); if (position.length !== 3) throw new TypeError('Nebula position requires three metre coordinates.'); position.forEach(finite);
    const sky = record(row.skyPosition), ra = finite(sky.raDeg), dec = finite(sky.decDeg);
    if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) throw new TypeError('Invalid nebula sky coordinates.'); reference(sky.sourceRef);
    const distance = record(row.distance); positive(distance.valuePc); text(distance.method); reference(distance.sourceRef);
    for (const key of ['minusPc', 'plusPc']) if (distance[key] !== undefined && finite(distance[key]) < 0) throw new TypeError('Negative nebula distance uncertainty.');
    if (distance.uncertainty !== undefined) {
      const uncertainty = record(distance.uncertainty);
      if (finite(uncertainty.statisticalPc) < 0 || finite(uncertainty.systematicPc) < 0) throw new TypeError('Negative nebula distance uncertainty.');
    }
    const classification = record(row.classification); text(classification.name); text(classification.basis); reference(classification.sourceRef);
    if (row.presentation !== undefined) positive(record(row.presentation).focusRadiusM);
  }
  const validated = input as PreparedNebulaCatalog;
  for (const row of validated.objects) validateSpatialPosition(validated.frame, row);
  return validated;
}
