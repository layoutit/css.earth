import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { array, number, optional, requireRecord, shape, text } from '@cssearth/core';
import type { ClosestSurfacePoint, SourceMesh } from '../geometry/index.ts';
import { parseCategory } from './source-records.ts';

/** A published catalogue of surface circles: one row per feature with a body-fixed centre and a published diameter
 * (the Roberts Eros ponds catalogue: 334 ponds, centres on the Gaskell SPC shape, Thomas's characteristic diameters).
 * The circle is the set of source-surface points within half the published diameter of the centre, straight-line
 * distance, after the centre is projected onto the rendered source mesh. It is the catalogue's characteristic size,
 * never an outline. With two categories, 1 is inside a circle and 0 is surface outside every circle. A dataset drawn over an
 * underlay has one category: 0 inside, and surface outside every circle is missing so the underlay shows. Nothing is interpolated. */
const local = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..');
const parseField = shape({ name: text, unit: text });
export const parseCircleCatalogueDataset = shape({
  format: text, path: text, labelPath: text, meshPath: text, sampling: text, displaySampling: text,
  categories: array(parseCategory), underlay: optional(requireRecord),
  table: shape({ expectedRecords: number, metersPerUnit: number, fields: array(parseField),
    idField: text, centerFields: array(text), diameterField: text, latitudeField: text, longitudeField: text, distanceField: text,
    consistency: shape({ angleDegrees: number, distanceMeters: number }) }),
  registration: shape({ maximumDistanceMeters: number }),
  surfaceSampling: shape({ method: text, maximumDistanceMeters: number }),
});
type CircleDataset = ReturnType<typeof parseCircleCatalogueDataset>;

export function validateCircleCatalogue(value: unknown, terrainValue: unknown) {
  const dataset = parseCircleCatalogueDataset(value);
  const terrain = shape({ path: text, simplification: shape({ maximumErrorMeters: number }) })(terrainValue);
  const t = dataset.table, names = t.fields.map(field => field.name), s = dataset.surfaceSampling;
  const named = [t.idField, ...t.centerFields, t.diameterField, t.latitudeField, t.longitudeField, t.distanceField];
  if (dataset.format !== 'circle-catalogue' || ![dataset.path, dataset.labelPath, dataset.meshPath].every(local) || dataset.meshPath !== terrain.path ||
      !Number.isSafeInteger(t.expectedRecords) || t.expectedRecords < 1 || !(t.metersPerUnit > 0) ||
      t.centerFields.length !== 3 || new Set(names).size !== names.length || named.some(name => !names.includes(name)) ||
      !(t.consistency.angleDegrees > 0) || !(t.consistency.distanceMeters > 0) ||
      !(dataset.registration.maximumDistanceMeters > 0) ||
      s.method !== 'closest-source-point' || !(s.maximumDistanceMeters > 0) || s.maximumDistanceMeters > terrain.simplification.maximumErrorMeters ||
      dataset.sampling !== 'nearest' || dataset.displaySampling !== 'nearest' || dataset.categories.length !== (dataset.underlay ? 1 : 2) ||
      dataset.categories.some(c => !c.value || !c.label || !/^#[0-9a-f]{6}$/i.test(c.color)) ||
      new Set(dataset.categories.map(c => c.value)).size !== dataset.categories.length) {
    throw new TypeError(`${dataset.path}: a surface circle catalogue needs ${dataset.underlay ? 'one category over its underlay' : 'two categories'}, nearest sampling, its rendered mesh and a sampling distance within ${terrain.simplification.maximumErrorMeters} m.`);
  }
  return dataset;
}

const tag = (xml: string, name: string) => new RegExp('<' + name + '(?:\\s[^>]*)?>([^<]+)</' + name + '>').exec(xml)?.[1]?.trim();

/** A PDS4 Table_Delimited label must describe exactly the recipe's file, record count and named fields with their units. */
export function checkDelimitedLabel(xml: string, dataset: CircleDataset) {
  const fields = [...xml.matchAll(/<Field_Delimited>([\s\S]*?)<\/Field_Delimited>/g)].map(m => ({ name: tag(m[1]!, 'name'), unit: tag(m[1]!, 'unit') }));
  if (tag(xml, 'file_name') !== basename(dataset.path) || tag(xml, 'records') !== String(dataset.table.expectedRecords) ||
      tag(xml, 'field_delimiter') !== 'Comma' || tag(xml, 'record_delimiter') !== 'Carriage-Return Line-Feed' ||
      tag(xml, 'fields') !== String(dataset.table.fields.length) || fields.length !== dataset.table.fields.length ||
      fields.some((field, i) => field.name !== dataset.table.fields[i]!.name || field.unit !== dataset.table.fields[i]!.unit)) {
    throw new Error(`${dataset.labelPath}: the PDS label differs from the circle catalogue recipe.`);
  }
}

/** Rows keep the catalogue's own numbers; the Cartesian centre must reproduce its printed latitude, longitude and distance. */
export function parseCircleRows(csv: string, dataset: CircleDataset) {
  const t = dataset.table, column = (name: string) => t.fields.findIndex(field => field.name === name);
  if (!csv.endsWith('\r\n') || csv.replace(/\r\n/g, '').includes('\n')) throw new Error(`${dataset.path}: records must end in CRLF.`);
  const lines = csv.slice(0, -2).split('\r\n');
  if (lines.length !== t.expectedRecords) throw new Error(`${dataset.path}: ${lines.length} records, the label states ${t.expectedRecords}.`);
  const ids = new Set<number>();
  return lines.map((line, row) => {
    const cells = line.split(',');
    if (cells.length !== t.fields.length || cells.some(cell => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(cell))) throw new Error(`${dataset.path}: malformed record ${row + 1}.`);
    const value = (name: string) => Number(cells[column(name)]);
    const id = value(t.idField), center = t.centerFields.map(name => value(name) * t.metersPerUnit);
    const diameterMeters = value(t.diameterField) * t.metersPerUnit;
    if (!Number.isSafeInteger(id) || ids.has(id) || !(diameterMeters > 0)) throw new Error(`${dataset.path}: record ${row + 1} needs a distinct id and a positive diameter.`);
    ids.add(id);
    const radius = Math.hypot(...center), latitude = Math.asin(center[2]! / radius) * 180 / Math.PI;
    const longitude = (Math.atan2(center[1]!, center[0]!) * 180 / Math.PI + 360) % 360;
    const dLon = Math.abs(longitude - ((value(t.longitudeField) % 360) + 360) % 360), angle = Math.max(Math.abs(latitude - value(t.latitudeField)), Math.min(dLon, 360 - dLon));
    const distance = Math.abs(radius - value(t.distanceField) * t.metersPerUnit);
    if (angle > t.consistency.angleDegrees || distance > t.consistency.distanceMeters) {
      throw new Error(`${dataset.path}: record ${id} centre disagrees with its printed latitude, longitude or distance (${angle.toFixed(5)}°, ${distance.toFixed(3)} m).`);
    }
    return { id, row, center, diameterMeters };
  });
}

export function createCircleCatalogue(rows: ReturnType<typeof parseCircleRows>, dataset: CircleDataset, mesh: SourceMesh) {
  const accepted: { id: number; point: readonly number[]; radius: number }[] = [], withheld: number[] = [], distances: number[] = [];
  for (const row of rows) {
    const hit = mesh.closestPoint(row.center, dataset.registration.maximumDistanceMeters);
    if (!hit) { withheld.push(row.id); continue; }
    distances.push(hit.distanceMeters);
    accepted.push({ id: row.id, point: hit.point, radius: row.diameterMeters / 2 });
  }
  const presence = dataset.categories.length === 1, cellSize = Math.max(...accepted.map(circle => circle.radius)) * 2, cells = new Map<string, typeof accepted>();
  const key = (p: readonly number[]) => p.map(n => Math.floor(n / cellSize)).join(',');
  for (const circle of accepted) {
    const low = circle.point.map(n => Math.floor((n - circle.radius) / cellSize)), high = circle.point.map(n => Math.floor((n + circle.radius) / cellSize));
    for (let x = low[0]!; x <= high[0]!; x++) for (let y = low[1]!; y <= high[1]!; y++) for (let z = low[2]!; z <= high[2]!; z++) {
      const k = `${x},${y},${z}`; if (!cells.has(k)) cells.set(k, []); cells.get(k)!.push(circle);
    }
  }
  /** Inside the circle whose edge is proportionally farthest away; the lower catalogue id breaks a tie. */
  function classify(hit: ClosestSurfacePoint) {
    let selected: (typeof accepted)[number] | undefined, best = Infinity;
    for (const circle of cells.get(key(hit.point)) ?? []) {
      const score = Math.hypot(...hit.point.map((n, i) => n - circle.point[i]!)) / circle.radius;
      if (score <= 1 && (score < best || (score === best && selected && circle.id < selected.id))) { selected = circle; best = score; }
    }
    if (presence) return selected ? { ...hit, value: 0, sourceCell: selected.id } : null;
    return { ...hit, value: selected ? 1 : 0, sourceCell: selected?.id ?? 0 };
  }
  function samplePoint(point: readonly number[]) {
    const hit = mesh.closestPoint(point, dataset.surfaceSampling.maximumDistanceMeters);
    return hit && classify(hit);
  }
  const sorted = [...distances].sort((a, b) => a - b);
  return {
    samplePoint,
    sample(longitude: number, latitude: number) {
      const hit = mesh.hit(longitude, latitude, true);
      if (!hit) return null;
      const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
      return samplePoint([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)].map(n => n * hit.radius))?.value ?? null;
    },
    report: { sourceFormat: dataset.format, sourceTable: basename(dataset.path), sourceMesh: dataset.meshPath, records: rows.length,
      acceptedCircles: accepted.length, withheldCircles: withheld,
      centreRegistrationMeters: { median: sorted[Math.floor(sorted.length / 2)] ?? null, maximum: sorted.at(-1) ?? null, limit: dataset.registration.maximumDistanceMeters },
      diameterMeters: { minimum: Math.min(...rows.map(r => r.diameterMeters)), maximum: Math.max(...rows.map(r => r.diameterMeters)) },
      registration: 'Each catalogued centre is projected to the closest point of the rendered source mesh within the stated limit; a texel takes the closest full-source surface point and is inside a circle when its straight-line distance to that projected centre is at most half the published diameter.',
      policy: 'Published characteristic diameter drawn as a circle on the source surface; not an outline. ' + (presence
        ? 'Surface outside every catalogued circle is missing and shows the underlay; that is not proof that no feature exists.'
        : 'Category 0 is surface outside every catalogued circle, not proof that no feature exists.') },
  };
}

export async function loadCircleCatalogue(root: string, value: unknown, mesh?: SourceMesh | null) {
  const dataset = parseCircleCatalogueDataset(value);
  if (!mesh?.closestPoint || !mesh.hit) throw new Error('A surface circle catalogue needs the complete rendered source mesh.');
  const [csv, xml] = await Promise.all([readFile(resolve(root, dataset.path), 'latin1'), readFile(resolve(root, dataset.labelPath), 'utf8')]);
  checkDelimitedLabel(xml, dataset);
  return createCircleCatalogue(parseCircleRows(csv, dataset), dataset, mesh);
}
