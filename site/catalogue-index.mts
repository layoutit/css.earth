import { record } from './browser-types.mts';

export interface CatalogueIndexEntry {
  readonly kind: 'scene' | 'prepared-focus';
  readonly id: string;
  readonly name: string;
  readonly searchNames: readonly string[];
  readonly classification: string;
  readonly classificationName: string;
  readonly systemName: string;
  readonly route: string;
  readonly illustration: boolean;
  /** A catalogue galaxy its source has not confirmed; see PreparedFocusObject.candidate. */
  readonly candidate: boolean;
  readonly distanceMeters: number;
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

export interface CatalogueIndex {
  readonly schema: 'cssearth-catalogue-index@1';
  readonly entries: readonly CatalogueIndexEntry[];
}

const text = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value) throw new TypeError(`Invalid catalogue ${label}.`);
  return value;
};
const finite = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Invalid catalogue ${label}.`);
  return value;
};

export function parseCatalogueIndex(value: unknown): CatalogueIndex {
  if (!record(value) || value.schema !== 'cssearth-catalogue-index@1' || !Array.isArray(value.entries)) {
    throw new TypeError('Invalid object catalogue index.');
  }
  const entries = value.entries.map((input, index): CatalogueIndexEntry => {
    if (!record(input) || (input.kind !== 'scene' && input.kind !== 'prepared-focus') || !record(input.detail)
        || !record(input.source) || !record(input.marker) || typeof input.illustration !== 'boolean' || typeof input.candidate !== 'boolean' || !Array.isArray(input.searchNames)
        || !input.searchNames.every(name => typeof name === 'string')) {
      throw new TypeError(`Invalid object catalogue entry: ${index}.`);
    }
    const detail = {
      text: text(input.detail.text, 'detail text'),
      title: text(input.detail.title, 'detail title'),
      ariaLabel: text(input.detail.ariaLabel, 'detail label'),
      ...(input.detail.value === undefined ? {} : { value: text(input.detail.value, 'detail value') }),
      ...(input.detail.unit === undefined ? {} : { unit: text(input.detail.unit, 'detail unit') }),
    };
    if ((detail.value === undefined) !== (detail.unit === undefined)) throw new TypeError('Catalogue detail parts are incomplete.');
    const marker = input.marker.kind === 'scene'
      ? { kind: 'scene' as const, id: text(input.marker.id, 'marker id'), color: text(input.marker.color, 'marker color') }
      : input.marker.kind === 'focus' && (input.marker.thumbnail === null || typeof input.marker.thumbnail === 'string')
        ? { kind: 'focus' as const, thumbnail: input.marker.thumbnail }
        : null;
    if (!marker) throw new TypeError(`Invalid object catalogue marker: ${index}.`);
    if (input.kind !== marker.kind && !(input.kind === 'prepared-focus' && marker.kind === 'focus')) {
      throw new TypeError(`Object catalogue marker kind changed: ${index}.`);
    }
    return Object.freeze({
      kind: input.kind,
      id: text(input.id, 'id'),
      name: text(input.name, 'name'),
      searchNames: Object.freeze([...input.searchNames]),
      classification: text(input.classification, 'classification'),
      classificationName: text(input.classificationName, 'classification name'),
      systemName: text(input.systemName, 'system name'),
      route: text(input.route, 'route'),
      illustration: input.illustration,
      candidate: input.candidate,
      distanceMeters: finite(input.distanceMeters, 'distance'),
      detail: Object.freeze(detail),
      source: Object.freeze({
        subject: text(input.source.subject, 'source subject'),
        document: text(input.source.document, 'source document'),
        label: text(input.source.label, 'source label'),
      }),
      marker: Object.freeze(marker),
    });
  });
  return Object.freeze({ schema: value.schema, entries: Object.freeze(entries) });
}
