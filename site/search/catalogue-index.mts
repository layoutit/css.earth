import { isRecord } from '@cssearth/core';

/** One search result row as the find function sends it: what the row shows and where it leads. */
export interface CatalogueRow {
  readonly kind: 'scene' | 'prepared-focus';
  readonly id: string;
  readonly name: string;
  readonly classificationName: string;
  readonly route: string;
  readonly detail: Readonly<{
    text: string;
    title: string;
    ariaLabel: string;
    value?: string;
    unit?: string;
  }>;
  readonly source: Readonly<{ subject: string; document: string; label: string }>;
  readonly marker: Readonly<
    { kind: 'scene'; id: string; color: string }
    | { kind: 'focus'; thumbnail: string | null }
  >;
}

/** A catalogue entry with the fields the find function matches and orders by; they never leave the server. */
export interface CatalogueIndexEntry extends CatalogueRow {
  readonly searchNames: readonly string[];
  readonly classification: string;
  readonly systemName: string;
  readonly illustration: boolean;
  /** A catalogue galaxy its source has not confirmed; see PreparedFocusObject.candidate. */
  readonly candidate: boolean;
  readonly distanceMeters: number;
}

export interface CatalogueIndex {
  readonly schema: 'cssearth-catalogue-index@1';
  readonly entries: readonly CatalogueIndexEntry[];
}

const text = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value) throw new TypeError(`Invalid catalogue ${label}.`);
  return value;
};

/** Validate one row of a find response before it reaches the retained result list. */
export function parseCatalogueRow(input: unknown, index: number): CatalogueRow {
  if (!isRecord(input) || (input.kind !== 'scene' && input.kind !== 'prepared-focus') || !isRecord(input.detail)
      || !isRecord(input.source) || !isRecord(input.marker)) {
    throw new TypeError(`Invalid object catalogue row: ${index}.`);
  }
  const detail = {
    text: text(input.detail.text, 'detail text'),
    title: text(input.detail.title, 'detail title'),
    ariaLabel: text(input.detail.ariaLabel, 'detail label'),
    ...(input.detail.value === undefined ? {} : { value: text(input.detail.value, 'detail value') }),
    ...(input.detail.unit === undefined ? {} : { unit: text(input.detail.unit, 'detail unit') }),
  };
  if ((detail.value === undefined) !== (detail.unit === undefined)) throw new TypeError(`Catalogue detail parts are incomplete: ${index}.`);
  const marker = input.marker.kind === 'scene'
    ? { kind: 'scene' as const, id: text(input.marker.id, 'marker id'), color: text(input.marker.color, 'marker color') }
    : input.marker.kind === 'focus' && (input.marker.thumbnail === null || typeof input.marker.thumbnail === 'string')
      ? { kind: 'focus' as const, thumbnail: input.marker.thumbnail }
      : null;
  if (!marker) throw new TypeError(`Invalid object catalogue marker: ${index}.`);
  if ((input.kind === 'scene') !== (marker.kind === 'scene')) throw new TypeError(`Object catalogue marker kind changed: ${index}.`);
  return Object.freeze({
    kind: input.kind,
    id: text(input.id, 'id'),
    name: text(input.name, 'name'),
    classificationName: text(input.classificationName, 'classification name'),
    route: text(input.route, 'route'),
    detail: Object.freeze(detail),
    source: Object.freeze({
      subject: text(input.source.subject, 'source subject'),
      document: text(input.source.document, 'source document'),
      label: text(input.source.label, 'source label'),
    }),
    marker: Object.freeze(marker),
  });
}

/** Validate the built catalogue the find function reads (`pages/catalogue/index.json.ts`). */
export function parseCatalogueIndex(value: unknown): CatalogueIndex {
  if (!isRecord(value) || value.schema !== 'cssearth-catalogue-index@1' || !Array.isArray(value.entries)) {
    throw new TypeError('Invalid object catalogue index.');
  }
  const entries = value.entries.map((input: unknown, index): CatalogueIndexEntry => {
    const row = parseCatalogueRow(input, index);
    if (!isRecord(input) || typeof input.illustration !== 'boolean' || typeof input.candidate !== 'boolean' || !Array.isArray(input.searchNames)
        || !input.searchNames.every(name => typeof name === 'string') || typeof input.distanceMeters !== 'number' || !Number.isFinite(input.distanceMeters)) {
      throw new TypeError(`Invalid object catalogue entry: ${index} (${row.id}).`);
    }
    return Object.freeze({ ...row, searchNames: Object.freeze([...input.searchNames as string[]]), classification: text(input.classification, 'classification'),
      systemName: text(input.systemName, 'system name'), illustration: input.illustration, candidate: input.candidate, distanceMeters: input.distanceMeters });
  });
  return Object.freeze({ schema: value.schema, entries: Object.freeze(entries) });
}

/** The wire row of an entry: its search fields stay on the server. */
export function catalogueRow({ kind, id, name, classificationName, route, detail, source, marker }: CatalogueIndexEntry): CatalogueRow {
  return { kind, id, name, classificationName, route, detail, source, marker };
}
