// Natural Earth layers as surface-feature rows. Natural Earth (public domain) ships countries, populated places, physical
// regions, marine areas, rivers and lakes as shapefiles with English names, a scale rank and a Wikidata id; this adapter
// turns each pinned layer into rows shaped like the Gazetteer attribute table so the shared preparation ranks, anchors,
// outlines and indexes them without a second pipeline. Places have no published size: they are unsized points; countries
// use Natural Earth's label point; regions carry their bounding box as the extent; rivers carry their centreline as an open trace.
import { parseDbf } from './dbf.js';
import { parseShpRecords } from './shp.js';
import { unzipMember } from './archive.js';
import { resolve } from 'node:path';

export interface NaturalEarthClass {
  readonly code: string; readonly type: string;
  /** Whether names of this class label the map by default; other names stay searchable. */
  readonly map: boolean;
  /** Label order across layers: a higher tier is admitted first, before any rank within its layer. */
  readonly tier: number;
  /** The earliest zoom share for every name of the class, whatever Natural Earth's own minimum zoom allows. */
  readonly minimumZoomShare: number;
}
export interface NaturalEarthLayer {
  readonly id: string; readonly archive: string; readonly attributes: string; readonly shapes: string;
  /** Feature class column and the label kind / two-letter code for each class value; unlisted classes are skipped. */
  readonly classField: string; readonly classes: Readonly<Record<string, NaturalEarthClass>>;
  readonly nameField: string; readonly idField: string; readonly wikidataField: string | null;
  /** Rank column and its sense within a tier: `descending` ranks larger values first (population); `ascending` ranks smaller
   * values first (Natural Earth scale or label rank 0–10, mapped to a priority of 10^(7 − rank)). */
  readonly rankField: string | null; readonly rankOrder: 'descending' | 'ascending'; readonly maximum: number | null;
  /** Natural Earth's minimum web-map zoom column for the name; when absent the scale rank stands in. */
  readonly zoomField: string | null;
  /** Natural Earth's label point columns: the label anchors there, with no extent, instead of at the shape. */
  readonly pointFields: { readonly longitude: string; readonly latitude: string } | null;
}
/** Web-map zoom levels matched to this body's camera range: the farthest and closest views show the Earth at the scale
 * of these levels, so a name's minimum zoom maps linearly onto the logarithmic zoom share. */
export interface NaturalEarthDiscovery { readonly farthestZoomLevel: number; readonly closestZoomLevel: number; readonly mapMaximumZoomLevel: number; }
export interface NaturalEarthConfig {
  readonly layers: readonly NaturalEarthLayer[]; readonly discovery: NaturalEarthDiscovery;
  /** Individually named features that label the map although their class does not. */
  readonly highlights: { readonly tier: number; readonly ids: readonly string[] } | null;
}
export interface NaturalEarthRow {
  readonly id: string; readonly name: string; readonly cleanName: string; readonly type: string; readonly code: string;
  readonly priority: number; readonly centerLon: number; readonly centerLat: number;
  readonly extent: { readonly minLon: number; readonly maxLon: number; readonly minLat: number; readonly maxLat: number } | null;
  /** Open polylines (rivers) in longitude/latitude degrees; null for points and areas. */
  readonly paths: readonly (readonly (readonly [number, number])[])[] | null;
  readonly link: string; readonly origin: string; readonly layer: string;
  /** Share of the zoom range (0 = whole globe, 1 = closest) from which the name is shown. */
  readonly zoomShare: number;
  /** Found by search and labelled when selected, never by default. */
  readonly searchOnly: boolean;
}

const TIER_SCALE = 1e9;
const text = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value) throw new TypeError(`${label} must be a non-empty string.`); return value; };
const record = (value: unknown, label: string): Record<string, unknown> => { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`); return value as Record<string, unknown>; };
const relativePath = (value: unknown, label: string): string => { const path = text(value, label); if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError(`${label} must stay inside the source directory.`); return path; };
const finite = (value: unknown, label: string): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`); return value; };
const tier = (value: unknown, label: string): number => { if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 99) throw new TypeError(`${label} must be an integer tier from 0 to 99.`); return value as number; };

export function parseNaturalEarthConfig(value: unknown): NaturalEarthConfig {
  const input = record(value, 'naturalEarth');
  if (!Array.isArray(input.layers) || !input.layers.length) throw new TypeError('naturalEarth.layers must list at least one layer.');
  const layers = input.layers.map((item, index) => {
    const layer = record(item, `naturalEarth.layers[${index}]`);
    const classes = Object.fromEntries(Object.entries(record(layer.classes, `layers[${index}].classes`)).map(([key, entry]) => {
      const cls = record(entry, `layers[${index}].classes.${key}`);
      const code = text(cls.code, `layers[${index}].classes.${key}.code`);
      if (!/^[A-Z]{2}$/u.test(code)) throw new TypeError(`layers[${index}].classes.${key}.code must be two capital letters.`);
      if (typeof cls.map !== 'boolean') throw new TypeError(`layers[${index}].classes.${key}.map must say whether the class labels the map.`);
      const floor = cls.minimumZoomShare === undefined ? 0 : finite(cls.minimumZoomShare, `layers[${index}].classes.${key}.minimumZoomShare`);
      if (floor < 0 || floor > 1) throw new TypeError(`layers[${index}].classes.${key}.minimumZoomShare must lie between 0 and 1.`);
      return [key, Object.freeze({ code, type: text(cls.type, `layers[${index}].classes.${key}.type`), map: cls.map, tier: tier(cls.tier ?? 0, `layers[${index}].classes.${key}.tier`), minimumZoomShare: floor })];
    }));
    if (!Object.keys(classes).length) throw new TypeError(`layers[${index}].classes must map at least one feature class.`);
    const maximum = layer.maximum === undefined ? null : layer.maximum;
    if (maximum !== null && (!Number.isSafeInteger(maximum) || (maximum as number) < 1)) throw new TypeError(`layers[${index}].maximum must be a positive integer.`);
    const points = layer.pointFields === undefined || layer.pointFields === null ? null : record(layer.pointFields, `layers[${index}].pointFields`);
    return Object.freeze({
      id: text(layer.id, `layers[${index}].id`), archive: relativePath(layer.archive, `layers[${index}].archive`),
      attributes: relativePath(layer.attributes, `layers[${index}].attributes`), shapes: relativePath(layer.shapes, `layers[${index}].shapes`),
      classField: text(layer.classField, `layers[${index}].classField`), classes: Object.freeze(classes),
      nameField: text(layer.nameField, `layers[${index}].nameField`), idField: text(layer.idField, `layers[${index}].idField`),
      wikidataField: layer.wikidataField === null ? null : text(layer.wikidataField, `layers[${index}].wikidataField`),
      rankField: layer.rankField === null ? null : text(layer.rankField, `layers[${index}].rankField`), rankOrder: layer.rankOrder === 'ascending' ? 'ascending' : 'descending', maximum: maximum as number | null,
      zoomField: layer.zoomField === null || layer.zoomField === undefined ? null : text(layer.zoomField, `layers[${index}].zoomField`),
      pointFields: points ? Object.freeze({ longitude: text(points.longitude, `layers[${index}].pointFields.longitude`), latitude: text(points.latitude, `layers[${index}].pointFields.latitude`) }) : null,
    });
  });
  const ids = new Set(layers.map(layer => layer.id));
  if (ids.size !== layers.length) throw new TypeError('naturalEarth layer ids repeat.');
  const discoveryInput = record(input.discovery, 'naturalEarth.discovery');
  const discovery = Object.freeze({ farthestZoomLevel: finite(discoveryInput.farthestZoomLevel, 'discovery.farthestZoomLevel'),
    closestZoomLevel: finite(discoveryInput.closestZoomLevel, 'discovery.closestZoomLevel'), mapMaximumZoomLevel: finite(discoveryInput.mapMaximumZoomLevel, 'discovery.mapMaximumZoomLevel') });
  if (!(discovery.closestZoomLevel > discovery.farthestZoomLevel) || discovery.mapMaximumZoomLevel < discovery.closestZoomLevel) throw new TypeError('naturalEarth.discovery zoom levels must increase from farthest to closest to the map maximum.');
  const highlightsInput = input.highlights === undefined ? null : record(input.highlights, 'naturalEarth.highlights');
  const highlightIds = highlightsInput ? highlightsInput.ids : null;
  if (highlightIds !== null && (!Array.isArray(highlightIds) || !highlightIds.length || highlightIds.some(id => typeof id !== 'string' || !/^[0-9]+$/u.test(id)) || new Set(highlightIds).size !== highlightIds.length)) {
    throw new TypeError('naturalEarth.highlights.ids must list distinct Natural Earth ids.');
  }
  const highlights = highlightsInput ? Object.freeze({ tier: tier(highlightsInput.tier, 'highlights.tier'), ids: Object.freeze([...highlightIds as string[]]) }) : null;
  return Object.freeze({ layers: Object.freeze(layers), discovery, highlights });
}

const wrap = (longitude: number) => ((longitude % 360) + 360) % 360;
const field = (row: Readonly<Record<string, string | undefined>>, name: string) => (row[name] ?? '').replace(/\0+$/u, '').trim();

/** Natural Earth's minimum zoom as a share of the camera's logarithmic zoom range. */
export function naturalEarthZoomShare(level: number, discovery: NaturalEarthDiscovery): number {
  return Math.min(1, Math.max(0, (level - discovery.farthestZoomLevel) / (discovery.closestZoomLevel - discovery.farthestZoomLevel)));
}

/** Load every configured layer into rows. Longitudes become positive-east 0–360; ids are the Natural Earth ids. */
export function loadNaturalEarthRows(sourceDirectory: string, directory: string, config: NaturalEarthConfig): NaturalEarthRow[] {
  const rows: NaturalEarthRow[] = [];
  const highlighted = new Set(config.highlights?.ids ?? []), found = new Set<string>();
  for (const layer of config.layers) {
    const archive = resolve(sourceDirectory, directory, layer.archive);
    const table = parseDbf(unzipMember(archive, layer.attributes), 'utf-8');
    const shapes = parseShpRecords(unzipMember(archive, layer.shapes));
    if (shapes.records.length !== table.rows.length) throw new TypeError(`Natural Earth layer ${layer.id}: ${shapes.records.length} shapes for ${table.rows.length} rows.`);
    const candidates: NaturalEarthRow[] = [];
    table.rows.forEach((row, index) => {
      const shape = shapes.records[index];
      if (!shape) return;
      const mapped = layer.classes[field(row, layer.classField)];
      if (!mapped) return;
      const name = field(row, layer.nameField);
      if (!name) return;
      const id = field(row, layer.idField);
      if (!/^[0-9]+$/u.test(id)) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} has no numeric id.`);
      const wikidata = layer.wikidataField === null ? '' : field(row, layer.wikidataField);
      const rank = layer.rankField === null ? 0 : Number(field(row, layer.rankField));
      if (!Number.isFinite(rank)) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} has no numeric rank.`);
      const highlight = highlighted.has(id);
      if (highlight) found.add(id);
      // Natural Earth writes -99 for an unknown rank or population: such a name ranks last within its tier.
      const rankPriority = rank < 0 ? 0 : layer.rankOrder === 'ascending' ? 10 ** (7 - rank) : rank;
      if (!(rankPriority >= 0 && rankPriority < TIER_SCALE)) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} ranks outside one tier.`);
      const rowTier = highlight ? config.highlights!.tier : mapped.tier;
      // Cartographic discovery: a name appears once the camera shows the Earth at the scale of its Natural Earth minimum zoom.
      const zoomText = layer.zoomField === null ? '' : field(row, layer.zoomField);
      const zoomLevel = layer.zoomField === null ? (layer.rankOrder === 'ascending' ? rank : Number.NaN) : zoomText === '' ? Number.NaN : Number(zoomText);
      const zoomShare = Math.max(mapped.minimumZoomShare, Number.isFinite(zoomLevel) ? naturalEarthZoomShare(zoomLevel, config.discovery) : 0);
      const searchOnly = highlight ? false : !mapped.map || (Number.isFinite(zoomLevel) && zoomLevel > config.discovery.mapMaximumZoomLevel);
      let centerLon: number, centerLat: number, extent: NaturalEarthRow['extent'] = null, paths: NaturalEarthRow['paths'] = null;
      if (layer.pointFields) {
        // A label point places the name only; it establishes no boundary, so the feature draws no extent.
        centerLon = Number(field(row, layer.pointFields.longitude)); centerLat = Number(field(row, layer.pointFields.latitude));
        if (!Number.isFinite(centerLon) || !Number.isFinite(centerLat)) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} has no label point.`);
      } else if (shape.point) { [centerLon, centerLat] = shape.point; }
      else {
        const [minX, minY, maxX, maxY] = shape.box!;
        // Areas that straddle the antimeridian keep their box as stored (Natural Earth splits them); the centre is the box centre.
        centerLon = (minX + maxX) / 2; centerLat = (minY + maxY) / 2;
        extent = { minLon: wrap(minX), maxLon: wrap(maxX), minLat: minY, maxLat: maxY };
        if (shapes.shapeType === 3) paths = shape.parts.map((part: readonly (readonly [number, number])[]) => part.map(([x, y]: readonly [number, number]) => [wrap(x), y] as const));
      }
      if (Math.abs(centerLat) > 90) throw new TypeError(`Natural Earth layer ${layer.id}: ${name} is out of range.`);
      candidates.push({ id, name, cleanName: name.normalize('NFD').replace(/[̀-ͯ]/gu, ''), type: mapped.type, code: mapped.code, priority: rowTier * TIER_SCALE + rankPriority,
        centerLon: wrap(centerLon), centerLat, extent, paths, link: wikidata ? `https://www.wikidata.org/wiki/${wikidata}` : `https://www.naturalearthdata.com/`, origin: '', layer: layer.id, zoomShare, searchOnly });
    });
    candidates.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, 'en'));
    // Natural Earth splits some areas and rivers into parts with one name: only the first part labels the map.
    const labelled = new Set<string>();
    const kept = (layer.maximum === null ? candidates : candidates.slice(0, layer.maximum)).map(row => {
      if (row.searchOnly) return row;
      const key = `${row.code} ${row.name}`;
      if (labelled.has(key)) return { ...row, searchOnly: true };
      labelled.add(key);
      return row;
    });
    rows.push(...kept);
  }
  const missing = [...highlighted].filter(id => !found.has(id));
  if (missing.length) throw new TypeError(`Natural Earth highlights are not in a configured layer class: ${missing.join(', ')}.`);
  return rows;
}
