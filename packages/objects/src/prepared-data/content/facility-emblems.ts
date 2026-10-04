/** Facility emblem wire records; source resolution and image byte inspection stay with callers. */
import { requireString } from '@cssearth/core';
import { explorationArray, explorationRecord } from '../../provenance/exploration-catalog.js';
import { parseExplorationImage, type ExplorationImage, type ExplorationSubject } from '../../provenance/prepared-exploration.js';
import type { SourceBinding } from '../../sources/catalog.js';

export const FACILITY_EMBLEMS_SCHEMA = 'cssearth-facility-emblems@3';

export interface FacilityEmblemSource {
  readonly credit: string;
  readonly sourceUrl: string;
  readonly [key: string]: unknown;
}
export interface FacilityEmblemEntry {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly source: FacilityEmblemSource;
  readonly sourceBinding: SourceBinding;
  readonly subject?: ExplorationSubject;
  readonly preparation?: Record<string, unknown>;
}
export interface FacilityEmblemLibrary {
  readonly schema: typeof FACILITY_EMBLEMS_SCHEMA;
  readonly normalBuildPolicy: string;
  readonly entries: readonly FacilityEmblemEntry[];
}

/** Source fields the emblem writer promises, retaining all catalogued metadata. */
export function readFacilityEmblemSource(value: unknown): FacilityEmblemSource {
  const source = explorationRecord(value);
  return { ...source, credit: requireString(source.credit, 'artwork credit'), sourceUrl: requireString(source.sourceUrl, 'artwork source URL') };
}

/** Envelope admission precedes per-entry source resolution, preserving artwork diagnostic order. */
export function parseFacilityEmblemLibrary(input: unknown): { schema: typeof FACILITY_EMBLEMS_SCHEMA; entries: readonly Record<string, unknown>[] } {
  const library = explorationRecord(input);
  if (library.schema !== FACILITY_EMBLEMS_SCHEMA) throw new TypeError('Unsupported artwork library.');
  return { schema: FACILITY_EMBLEMS_SCHEMA, entries: explorationArray(library.entries, explorationRecord) };
}

/** The structural artwork projection runs after the caller resolves and checks the source binding. */
export function parseFacilityEmblemImage(image: Record<string, unknown>, source: Record<string, unknown>): ExplorationImage {
  return parseExplorationImage({ id: image.id, src: image.src,
    width: image.width, height: image.height, bytes: image.bytes,
    kind: 'emblem', sourceUrl: source.sourceUrl, credit: source.credit,
    ...(image.subject === undefined ? {} : { subject: image.subject }) });
}
