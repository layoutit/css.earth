// Spacecraft landing, touchdown and impact sites, and rover or crew traverses, as surface-feature rows. The per-body
// document is repository-authored: every coordinate quotes the public page it was read from (NASA NSSDCA, PDS, LROC,
// mission releases, papers) and the traverse paths are pinned data products (PDS PLACES localisation tables, LROC
// Apollo shapefiles). Sites are unsized points ranked like a 20 km feature; traverses are open traces.
import { parseDbf } from './dbf.js';
import { parseShpRecords } from './shp.js';
import { unzipMember } from './archive.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SURFACE_SITES_SCHEMA = 'cssearth-surface-sites@1';
export const SITE_KINDS = Object.freeze({ lander: { code: 'LS', type: 'Landing site' }, impact: { code: 'IM', type: 'Impact site' }, 'sample-site': { code: 'SS', type: 'Sample site' }, 'rover-traverse': { code: 'RT', type: 'Rover position' } } as const);
export type SiteKind = keyof typeof SITE_KINDS;
/** Sites rank among named features as if they were this large; a label policy sees them like a mid-sized crater. */
export const SITE_PRIORITY_KM = 20;

export interface SiteSource { readonly title: string; readonly url: string; readonly publisher: string; readonly rights: string; readonly rightsUrl: string; }
export interface SurfaceSite {
  readonly id: string; readonly name: string; readonly kind: SiteKind; readonly date: string; readonly facilityId: string | null;
  readonly latitudeDeg: number; readonly longitudeDegEast: number; readonly coordinateNote: string; readonly precisionNote: string | null;
  readonly naming: { readonly name: string; readonly authority: string; readonly gazetteerFeatureId: number | null } | null;
  readonly source: SiteSource; readonly quote: string;
}
export interface SurfaceTraverse {
  readonly id: string; readonly name: string; readonly facilityId: string | null; readonly date: string; readonly source: SiteSource;
  readonly path: { readonly file: string; readonly format: 'places-csv' | 'lroc-shapefile-zip'; readonly latitudeColumn?: string; readonly longitudeColumn?: string; readonly member?: string };
}
export interface SurfaceSites { readonly schema: typeof SURFACE_SITES_SCHEMA; readonly source: string; readonly retrievedAt: string; readonly sites: readonly SurfaceSite[]; readonly traverses: readonly SurfaceTraverse[]; }
export interface SiteRow {
  readonly id: string; readonly name: string; readonly type: string; readonly code: string; readonly kind: 'point' | 'linear'; readonly priority: number;
  readonly centerLon: number; readonly centerLat: number; readonly extent: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null;
  readonly paths: readonly (readonly (readonly [number, number])[])[] | null; readonly origin: string; readonly credit: string; readonly approved: string; readonly link: string;
  readonly note: { readonly text: string; readonly title: string; readonly url: string; readonly credit: string } | null; readonly facilityId: string | null;
}

const text = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`); return value; };
const optionalText = (value: unknown, label: string): string | null => value === null || value === undefined ? null : text(value, label);
const finite = (value: unknown, label: string): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be finite.`); return value; };
const record = (value: unknown, label: string): Record<string, unknown> => { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`); return value as Record<string, unknown>; };
const relativePath = (value: unknown, label: string): string => { const path = text(value, label); if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError(`${label} must stay inside the source directory.`); return path; };
const date = (value: unknown, label: string): string => { const iso = text(value, label); if (!/^\d{4}(-\d{2}(-\d{2})?)?$/u.test(iso)) throw new TypeError(`${label} must be an ISO date.`); return iso; };
function parseSource(value: unknown, label: string): SiteSource {
  const input = record(value, label), rights = record(input.rights, `${label}.rights`);
  const url = text(input.url, `${label}.url`), rightsUrl = text(rights.evidenceUrl, `${label}.rights.evidenceUrl`);
  if (!/^https?:\/\//u.test(url) || !/^https?:\/\//u.test(rightsUrl)) throw new TypeError(`${label} needs http(s) URLs.`);
  return Object.freeze({ title: text(input.title, `${label}.title`), url, publisher: text(input.publisher, `${label}.publisher`), rights: text(rights.statement, `${label}.rights.statement`), rightsUrl });
}

export function parseSurfaceSites(value: unknown): SurfaceSites {
  const input = record(value, 'surface sites');
  if (input.schema !== SURFACE_SITES_SCHEMA) throw new TypeError('Unsupported surface sites schema.');
  const ids = new Set<string>();
  const sites = (Array.isArray(input.sites) ? input.sites : []).map((item, index) => {
    const site = record(item, `sites[${index}]`), label = `sites[${index}]`;
    const id = text(site.id, `${label}.id`); if (!/^[a-z0-9][a-z0-9-]*$/u.test(id) || ids.has(id)) throw new TypeError(`${label}.id must be a unique kebab id.`); ids.add(id);
    const kind = text(site.kind, `${label}.kind`); if (!Object.hasOwn(SITE_KINDS, kind)) throw new TypeError(`${label}.kind is unknown.`);
    const latitudeDeg = finite(site.latitudeDeg, `${label}.latitudeDeg`), longitudeDegEast = finite(site.longitudeDegEast, `${label}.longitudeDegEast`);
    if (Math.abs(latitudeDeg) > 90 || longitudeDegEast < 0 || longitudeDegEast >= 360) throw new TypeError(`${label} coordinates are out of range.`);
    const namingInput = site.naming === null || site.naming === undefined ? null : record(site.naming, `${label}.naming`);
    const naming = namingInput ? Object.freeze({ name: text(namingInput.name, `${label}.naming.name`), authority: text(namingInput.authority, `${label}.naming.authority`),
      gazetteerFeatureId: namingInput.gazetteerFeatureId === undefined || namingInput.gazetteerFeatureId === null ? null : finite(namingInput.gazetteerFeatureId, `${label}.naming.gazetteerFeatureId`) }) : null;
    return Object.freeze({ id, name: text(site.name, `${label}.name`), kind: kind as SiteKind, date: date(site.date, `${label}.date`), facilityId: optionalText(site.facilityId, `${label}.facilityId`),
      latitudeDeg, longitudeDegEast, coordinateNote: text(site.coordinateNote, `${label}.coordinateNote`), precisionNote: optionalText(site.precisionNote, `${label}.precisionNote`),
      naming, source: parseSource(site.source, `${label}.source`), quote: text(site.quote, `${label}.quote`) });
  });
  const traverses = (Array.isArray(input.traverses) ? input.traverses : []).map((item, index) => {
    const traverse = record(item, `traverses[${index}]`), label = `traverses[${index}]`, path = record(traverse.path, `${label}.path`);
    const id = text(traverse.id, `${label}.id`); if (!/^[a-z0-9][a-z0-9-]*$/u.test(id) || ids.has(id)) throw new TypeError(`${label}.id must be a unique kebab id.`); ids.add(id);
    const format = text(path.format, `${label}.path.format`);
    if (format !== 'places-csv' && format !== 'lroc-shapefile-zip') throw new TypeError(`${label}.path.format is unknown.`);
    return Object.freeze({ id, name: text(traverse.name, `${label}.name`), facilityId: optionalText(traverse.facilityId, `${label}.facilityId`), date: date(traverse.date, `${label}.date`), source: parseSource(traverse.source, `${label}.source`),
      path: Object.freeze({ file: relativePath(path.file, `${label}.path.file`), format: format as 'places-csv' | 'lroc-shapefile-zip',
        ...(path.latitudeColumn === undefined ? {} : { latitudeColumn: text(path.latitudeColumn, `${label}.path.latitudeColumn`) }),
        ...(path.longitudeColumn === undefined ? {} : { longitudeColumn: text(path.longitudeColumn, `${label}.path.longitudeColumn`) }),
        ...(path.member === undefined ? {} : { member: text(path.member, `${label}.path.member`) }) }) });
  });
  if (!sites.length && !traverses.length) throw new TypeError('Surface sites document lists nothing.');
  return Object.freeze({ schema: SURFACE_SITES_SCHEMA, source: text(input.source, 'sites source'), retrievedAt: date(input.retrievedAt, 'sites retrievedAt'), sites: Object.freeze(sites), traverses: Object.freeze(traverses) });
}

const wrap = (longitude: number) => ((longitude % 360) + 360) % 360;
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function spokenDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return day ? `${Number(day)} ${monthNames[Number(month) - 1]} ${year}` : month ? `${monthNames[Number(month) - 1]} ${year}` : year!;
}
const clip = (value: string, limit = 320) => value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;

/** A PDS PLACES localisation table: one row per pose in drive order; latitude and longitude columns are planetocentric degrees. */
function placesPath(csv: string, latitudeColumn: string, longitudeColumn: string): (readonly [number, number])[] {
  const lines = csv.split(/\r?\n/u).filter(line => line.trim());
  const header = lines[0]!.split(','), lat = header.indexOf(latitudeColumn), lon = header.indexOf(longitudeColumn);
  if (lat < 0 || lon < 0) throw new TypeError(`PLACES table lacks ${latitudeColumn}/${longitudeColumn}.`);
  const points: (readonly [number, number])[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(','), latitude = Number(cells[lat]), longitude = Number(cells[lon]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new TypeError('PLACES row has a non-numeric position.');
    const point = [wrap(longitude), latitude] as const;
    if (!points.length || points[points.length - 1]![0] !== point[0] || points[points.length - 1]![1] !== point[1]) points.push(point);
  }
  if (points.length < 2) throw new TypeError('PLACES table has fewer than two positions.');
  return points;
}
/** LROC Apollo path shapefiles: equidistant-cylindrical metres on the 1737.4 km sphere; the .prj names the central meridian. */
function lrocPaths(archive: string, member: string): (readonly [number, number])[][] {
  const projection = new TextDecoder().decode(unzipMember(archive, `${member}.PRJ`));
  const radius = Number(/SPHEROID\["[^"]+",\s*([\d.]+)/u.exec(projection)?.[1]), central = Number(/"Central_Meridian",\s*(-?[\d.]+)/u.exec(projection)?.[1] ?? '0');
  const parallel = Number(/"Standard_Parallel_1",\s*(-?[\d.]+)/u.exec(projection)?.[1] ?? '0');
  if (!(radius > 0) || !Number.isFinite(central) || !Number.isFinite(parallel) || !/Equidistant_Cylindrical/u.test(projection)) throw new TypeError('LROC path projection is not the expected equidistant cylindrical sphere.');
  const scale = 180 / Math.PI / radius, cosine = Math.cos(parallel * Math.PI / 180);
  const shapes = parseShpRecords(unzipMember(archive, `${member}.SHP`));
  parseDbf(unzipMember(archive, `${member}.DBF`));
  return shapes.records.filter((shape): shape is NonNullable<typeof shape> => shape !== null).flatMap(shape => shape.parts.map(part => part.map(([x, y]) => [wrap(central + x * scale / cosine), y * scale] as const)));
}

/** Rows for the shared preparation: sites as unsized points, traverses as open traces. Ids are numeric offsets. */
export function loadSiteRows(sourceDirectory: string, directory: string, sites: SurfaceSites, idBase = 90_000_000): SiteRow[] {
  const rows: SiteRow[] = [];
  // A quoted sentence reads as the note; a quoted table or CSV row (NSSDCA cells, PLACES rows) is replaced by a sentence built
  // from the same fields, so the caption stays readable while the pinned document keeps the verbatim row.
  const tabular = (quote: string) => /\|/u.test(quote) || /^[A-Z_]+,-?\d/u.test(quote) || (quote.split(',').length > 8 && !/[a-z]{4,}\s[a-z]{4,}/u.test(quote));
  const coordinates = (site: SurfaceSite) => `${Math.abs(site.latitudeDeg).toFixed(2)}° ${site.latitudeDeg < 0 ? 'S' : 'N'}, ${site.longitudeDegEast.toFixed(2)}° E`;
  const noteFor = (site: SurfaceSite) => ({
    text: clip(tabular(site.quote) ? `${site.name}: ${coordinates(site)} as published by ${site.source.publisher} (${site.source.title}).${site.precisionNote ? ` ${site.precisionNote}` : ''}` : site.quote),
    title: site.source.title, url: site.source.url, credit: '' });
  sites.sites.forEach((site, index) => {
    const kind = SITE_KINDS[site.kind];
    const who = site.facilityId ? site.name : site.name;
    const origin = `${kind.type} of ${who.replace(/ (impact|landing|lander|touchdown)( site)?$/iu, '')}, ${spokenDate(site.date)}${site.naming ? `; ${site.naming.authority.startsWith('IAU') ? 'IAU name' : 'informal name'} ${site.naming.name}` : ''}.`;
    rows.push({ id: String(idBase + index), name: site.name, type: kind.type, code: kind.code, kind: 'point', priority: SITE_PRIORITY_KM,
      centerLon: site.longitudeDegEast, centerLat: site.latitudeDeg, extent: null, paths: null, origin, credit: `${site.source.publisher}, ${site.date.slice(0, 4)}`,
      approved: site.date.length === 10 ? site.date : `${site.date}-01-01`.slice(0, 10), link: site.source.url, note: noteFor(site), facilityId: site.facilityId });
  });
  sites.traverses.forEach((traverse, index) => {
    const file = resolve(sourceDirectory, directory, traverse.path.file);
    const paths = traverse.path.format === 'places-csv'
      ? [placesPath(readFileSync(file, 'utf8'), traverse.path.latitudeColumn ?? 'planetocentric_latitude', traverse.path.longitudeColumn ?? 'longitude')]
      : lrocPaths(file, traverse.path.member ?? '');
    const all = paths.flat();
    const lons = all.map(point => point[0]), lats = all.map(point => point[1]);
    const extent = { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
    const start = paths[0]![0]!;
    rows.push({ id: String(idBase + 1000 + index), name: traverse.name, type: 'Traverse', code: 'RT', kind: 'linear', priority: SITE_PRIORITY_KM,
      centerLon: start[0], centerLat: start[1], extent, paths, origin: `Traverse of ${traverse.name.replace(/ traverse.*$/iu, '')}, from ${spokenDate(traverse.date)}.`,
      credit: `${traverse.source.publisher}, ${traverse.date.slice(0, 4)}`, approved: traverse.date.length === 10 ? traverse.date : `${traverse.date}-01-01`.slice(0, 10), link: traverse.source.url,
      note: { text: clip(`Path from ${traverse.source.title}.`), title: traverse.source.title, url: traverse.source.url, credit: '' }, facilityId: traverse.facilityId });
  });
  return rows;
}
