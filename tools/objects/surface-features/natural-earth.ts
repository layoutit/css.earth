// Natural Earth layers as surface-feature rows. Natural Earth (public domain) ships populated places, physical
// regions, marine areas, rivers and lakes as shapefiles with English names, a scale rank and a Wikidata id; this adapter
// turns each pinned layer into rows shaped like the Gazetteer attribute table so the shared preparation ranks, anchors,
// outlines and indexes them without a second pipeline. Places have no published size: they are unsized points ranked by
// population; regions carry their bounding box as the extent; rivers carry their centreline as an open trace.
import { parseDbf } from './dbf.js';
import { parseShpRecords } from './shp.js';
import { unzipMember } from './index.js';
import { resolve } from 'node:path';

export interface NaturalEarthLayer {
  readonly id: string; readonly archive: string; readonly attributes: string; readonly shapes: string;
  /** Feature class column and the label kind / two-letter code for each class value; unlisted classes are skipped. */
  readonly classField: string; readonly classes: Readonly<Record<string, { readonly code: string; readonly type: string }>>;
  readonly nameField: string; readonly idField: string; readonly wikidataField: string | null;
  /** Rank column and its sense: `descending` ranks larger values first (population); `ascending` ranks smaller values first
   * (Natural Earth scale rank 0–10, mapped to a priority of 10^(7 − rank) so rank-0 oceans and continents sit with the largest cities). */
  readonly rankField: string | null; readonly rankOrder: 'descending' | 'ascending'; readonly maximum: number | null;
  /** Natural Earth's minimum web-map zoom column (0–10) for the name; when absent the scale rank stands in. */
  readonly zoomField: string | null;
}
export interface NaturalEarthConfig { readonly layers: readonly NaturalEarthLayer[]; }
export interface NaturalEarthRow {
  readonly id: string; readonly name: string; readonly cleanName: string; readonly type: string; readonly code: string;
  readonly priority: number; readonly centerLon: number; readonly centerLat: number;
  readonly extent: { readonly minLon: number; readonly maxLon: number; readonly minLat: number; readonly maxLat: number } | null;
  /** Open polylines (rivers) in longitude/latitude degrees; null for points and areas. */
  readonly paths: readonly (readonly (readonly [number, number])[])[] | null;
  readonly link: string; readonly origin: string; readonly layer: string;
  /** Share of the zoom range (0 = whole globe, 1 = closest) from which the name is shown. */
  readonly zoomShare: number;
}

const text = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value) throw new TypeError(`${label} must be a non-empty string.`); return value; };
const record = (value: unknown, label: string): Record<string, unknown> => { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`); return value as Record<string, unknown>; };
const relativePath = (value: unknown, label: string): string => { const path = text(value, label); if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError(`${label} must stay inside the source directory.`); return path; };

export function parseNaturalEarthConfig(value: unknown): NaturalEarthConfig {
  const input = record(value, 'naturalEarth');
  if (!Array.isArray(input.layers) || !input.layers.length) throw new TypeError('naturalEarth.layers must list at least one layer.');
  const layers = input.layers.map((item, index) => {
    const layer = record(item, `naturalEarth.layers[${index}]`);
    const classes = Object.fromEntries(Object.entries(record(layer.classes, `layers[${index}].classes`)).map(([key, entry]) => {
      const cls = record(entry, `layers[${index}].classes.${key}`);
      const code = text(cls.code, `layers[${index}].classes.${key}.code`);
      if (!/^[A-Z]{2}$/u.test(code)) throw new TypeError(`layers[${index}].classes.${key}.code must be two capital letters.`);
      return [key, Object.freeze({ code, type: text(cls.type, `layers[${index}].classes.${key}.type`) })];
    }));
    if (!Object.keys(classes).length) throw new TypeError(`layers[${index}].classes must map at least one feature class.`);
    const maximum = layer.maximum === undefined ? null : layer.maximum;
    if (maximum !== null && (!Number.isSafeInteger(maximum) || (maximum as number) < 1)) throw new TypeError(`layers[${index}].maximum must be a positive integer.`);
    return Object.freeze({
      id: text(layer.id, `layers[${index}].id`), archive: relativePath(layer.archive, `layers[${index}].archive`),
      attributes: relativePath(layer.attributes, `layers[${index}].attributes`), shapes: relativePath(layer.shapes, `layers[${index}].shapes`),
      classField: text(layer.classField, `layers[${index}].classField`), classes: Object.freeze(classes),
      nameField: text(layer.nameField, `layers[${index}].nameField`), idField: text(layer.idField, `layers[${index}].idField`),
      wikidataField: layer.wikidataField === null ? null : text(layer.wikidataField, `layers[${index}].wikidataField`),
      rankField: layer.rankField === null ? null : text(layer.rankField, `layers[${index}].rankField`), rankOrder: layer.rankOrder === 'ascending' ? 'ascending' : 'descending', maximum: maximum as number | null,
      zoomField: layer.zoomField === null || layer.zoomField === undefined ? null : text(layer.zoomField, `layers[${index}].zoomField`),
    });
  });
  const ids = new Set(layers.map(layer => layer.id));
  if (ids.size !== layers.length) throw new TypeError('naturalEarth layer ids repeat.');
  return Object.freeze({ layers: Object.freeze(layers) });
}

const wrap = (longitude: number) => ((longitude % 360) + 360) % 360;

/** Load every configured layer into rows. Longitudes become positive-east 0–360; ids are the Natural Earth ids. */
export function loadNaturalEarthRows(sourceDirectory: string, directory: string, config: NaturalEarthConfig): NaturalEarthRow[] {
  const rows: NaturalEarthRow[] = [];
  for (const layer of config.layers) {
    const archive = resolve(sourceDirectory, directory, layer.archive);
    const table = parseDbf(unzipMember(archive, layer.attributes), 'utf-8');
    const shapes = parseShpRecords(unzipMember(archive, layer.shapes));
    if (shapes.records.length !== table.rows.length) throw new TypeError(`Natural Earth layer ${layer.id}: ${shapes.records.length} shapes for ${table.rows.length} rows.`);
    const candidates: NaturalEarthRow[] = [];
    table.rows.forEach((row, index) => {
      const shape = shapes.records[index];
      if (!shape) return;
      const cls = row[layer.classField]?.replace(/\0+$/u, '') ?? '';
      const mapped = layer.classes[cls];
      if (!mapped) return;
      const name = (row[layer.nameField] ?? '').replace(/\0+$/u, '').trim();
      if (!name) return;
      const id = (row[layer.idField] ?? '').replace(/\0+$/u, '').trim();
      if (!/^[0-9]+$/u.test(id)) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} has no numeric id.`);
      const wikidata = layer.wikidataField === null ? '' : (row[layer.wikidataField] ?? '').replace(/\0+$/u, '').trim();
      const rank = layer.rankField === null ? 0 : Number(row[layer.rankField]);
      if (!Number.isFinite(rank)) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} has no numeric rank.`);
      const priority = layer.rankOrder === 'ascending' ? 10 ** (7 - rank) : rank;
      // Cartographic discovery: Natural Earth shows a name from its minimum web-map zoom level (0–10, or the scale rank where the
      // layer has none). The whole-globe view sits at about 0.43 of this project's zoom range and the closest view at 1, so level 5
      // maps to the closest view: continents, oceans and the rank-1 regions (level ≤ 2) belong to the globe, level-3 and level-4
      // names arrive as the camera closes in, and finer names wait for the last stretch.
      const zoomLevel = layer.zoomField === null ? (layer.rankOrder === 'ascending' ? rank : Number.NaN) : Number((row[layer.zoomField] ?? '').replace(/\0+$/u, ''));
      const zoomShare = Number.isFinite(zoomLevel) ? Math.min(1, Math.max(0, zoomLevel / 5)) : 0;
      let centerLon: number, centerLat: number, extent: NaturalEarthRow['extent'] = null, paths: NaturalEarthRow['paths'] = null;
      if (shape.point) { [centerLon, centerLat] = shape.point; }
      else {
        const [minX, minY, maxX, maxY] = shape.box!;
        // Areas that straddle the antimeridian keep their box as stored (Natural Earth splits them); the centre is the box centre.
        centerLon = (minX + maxX) / 2; centerLat = (minY + maxY) / 2;
        extent = { minLon: wrap(minX), maxLon: wrap(maxX), minLat: minY, maxLat: maxY };
        if (shapes.shapeType === 3) paths = shape.parts.map((part: readonly (readonly [number, number])[]) => part.map(([x, y]: readonly [number, number]) => [wrap(x), y] as const));
      }
      if (Math.abs(centerLat) > 90) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} is out of range.`);
      candidates.push({ id, name, cleanName: name.normalize('NFD').replace(/[̀-ͯ]/gu, ''), type: mapped.type, code: mapped.code, priority,
        centerLon: wrap(centerLon), centerLat, extent, paths, link: wikidata ? `https://www.wikidata.org/wiki/${wikidata}` : `https://www.naturalearthdata.com/`, origin: '', layer: layer.id, zoomShare });
    });
    candidates.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, 'en'));
    rows.push(...(layer.maximum === null ? candidates : candidates.slice(0, layer.maximum)));
  }
  return rows;
}
