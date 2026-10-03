import { isRecord } from '@cssearth/core';

/** One search result row as the find function sends it: an object, what its row shows and where it leads. A system's row
 * is drawn with its host's marker. */
export interface CatalogueRow {
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
  // `id`: the object whose marker the row shows (a system's host). `preview`: it has a prepared search thumbnail. `sprite`:
  // the styles of its sprite of the marker sheet.
  readonly marker: Readonly<{ id: string; color: string; preview?: true; sprite?: Readonly<{ style: string; innerStyle: string; ringStyle?: string }> }>;
}

/** A catalogue entry with the fields the find function matches and orders by; they never leave the server. */
export interface CatalogueIndexEntry extends CatalogueRow {
  readonly searchNames: readonly string[];
  readonly classification: string;
  readonly systemName: string;
  readonly illustration: boolean;
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
  if (!isRecord(input) || !isRecord(input.detail)
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
  const marker = { id: text(input.marker.id, 'marker id'), color: text(input.marker.color, 'marker color'),
    ...(input.marker.preview === true ? { preview: true as const } : {}),
    ...(isRecord(input.marker.sprite) ? { sprite: Object.freeze({ style: text(input.marker.sprite.style, 'marker sprite style'), innerStyle: text(input.marker.sprite.innerStyle, 'marker sprite inner style'),
      ...(input.marker.sprite.ringStyle === undefined ? {} : { ringStyle: text(input.marker.sprite.ringStyle, 'marker sprite ring style') }) }) } : {}) };
  return Object.freeze({
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
    if (!isRecord(input) || typeof input.illustration !== 'boolean' || !Array.isArray(input.searchNames)
        || !input.searchNames.every(name => typeof name === 'string') || typeof input.distanceMeters !== 'number' || !Number.isFinite(input.distanceMeters)) {
      throw new TypeError(`Invalid object catalogue entry: ${index} (${row.id}).`);
    }
    return Object.freeze({ ...row, searchNames: Object.freeze([...input.searchNames as string[]]), classification: text(input.classification, 'classification'),
      systemName: text(input.systemName, 'system name'), illustration: input.illustration, distanceMeters: input.distanceMeters });
  });
  return Object.freeze({ schema: value.schema, entries: Object.freeze(entries) });
}

/** The wire row of an entry: its search fields stay on the server. */
export function catalogueRow({ id, name, classificationName, route, detail, source, marker }: CatalogueIndexEntry): CatalogueRow {
  return { id, name, classificationName, route, detail, source, marker };
}
