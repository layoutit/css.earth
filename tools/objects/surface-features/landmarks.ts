import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeVtkCategories } from '../terrestrial-layers/vtk-categories.mts';
import { createIndexedShape } from '../terrestrial-layers/obj-shape.mts';
import { normalizeSearchText } from './catalog.js';
import { projectRadial, surfaceDirection } from './geometry.js';
import type { PreparedSurfaceFeature, SurfaceFeatureAxes } from './catalog.js';
import type { SurfaceFeaturePreparationContext } from './index.js';

type Vec = readonly [number, number, number];
const record = (v: unknown, at: string): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError(`${at} must be an object.`); return v as Record<string, unknown>; };
const text = (v: unknown, at: string): string => { if (typeof v !== 'string' || !v.trim()) throw new TypeError(`${at} must be text.`); return v; };
const number = (v: unknown, at: string): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${at} must be finite.`); return v; };
const vector = (v: unknown, at: string): Vec => { if (!Array.isArray(v) || v.length !== 3) throw new TypeError(`${at} must have three components.`); return [number(v[0], at), number(v[1], at), number(v[2], at)]; };
const path = (v: unknown): string => { const p = text(v, 'landmark path'); if (p.startsWith('/') || p.split('/').some(s => !s || s === '..') || p.includes('\\')) throw new TypeError('Landmark paths must stay in the source tree.'); return p; };
const url = (v: unknown): string => { const u = text(v, 'landmark source URL'); if (!/^https:\/\//u.test(u)) throw new TypeError('Landmarks need an HTTPS source.'); return u; };
const positive = (v: unknown, at: string): number => { const n = number(v, at); if (!(n > 0)) throw new TypeError(`${at} must be positive.`); return n; };
const integer = (v: unknown, at: string): number => { const n = number(v, at); if (!Number.isSafeInteger(n) || n < 0) throw new TypeError(`${at} must be a nonnegative integer.`); return n; };
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const length = (v: readonly number[]) => Math.hypot(...v);
const unit = (v: Vec): Vec => { const n = length(v); if (!n) throw new TypeError('Landmark at body origin.'); return [v[0] / n, v[1] / n, v[2] / n]; };
const rounded = (v: readonly number[], digits = 6): Vec => [0, 1, 2].map(i => Number(v[i]!.toFixed(digits))) as unknown as Vec;

export function parseLandmarks(value: unknown) {
  const doc = record(value, 'landmarks');
  if (doc.schema !== 'cssearth-surface-landmarks@1') throw new TypeError('Unsupported landmarks schema.');
  const source = text(doc.source, 'landmarks source'), frame = text(doc.frame, 'landmarks frame');
  const ids = new Set<string>();
  if (!Array.isArray(doc.entries) || !doc.entries.length) throw new TypeError('Landmarks must list entries.');
  const entries = doc.entries.map((v, i) => {
    const e = record(v, `landmark ${i}`), p = record(e.position, 'landmark position'), s = record(e.reference, 'landmark reference');
    const id = text(e.id, 'landmark id');
    if (!/^8\d{7}$/u.test(id) || ids.has(id)) throw new TypeError('Landmarks need distinct stable ids in the 80000000–89999999 range.');
    ids.add(id);
    const kind = text(e.kind, 'landmark kind'); if (kind !== 'point' && kind !== 'region') throw new TypeError('Landmark kind must be point or region.');
    if ([p.regionId !== undefined, p.pointMeters !== undefined, p.longitudeDeg !== undefined || p.latitudeDeg !== undefined].filter(Boolean).length !== 1) throw new TypeError('Landmarks must specify one position frame.');
    let position: { regionId: number } | { pointMeters: Vec; maximumDistanceMeters: number } | { longitudeDeg: number; latitudeDeg: number };
    if (p.regionId !== undefined) position = { regionId: integer(p.regionId, 'region id') };
    else if (p.pointMeters !== undefined) position = { pointMeters: vector(p.pointMeters, 'source point'), maximumDistanceMeters: positive(p.maximumDistanceMeters, 'position maximum distance') };
    else {
      const longitudeDeg = number(p.longitudeDeg, 'longitude'), latitudeDeg = number(p.latitudeDeg, 'latitude');
      if (longitudeDeg < 0 || longitudeDeg >= 360 || Math.abs(latitudeDeg) > 90) throw new TypeError('Landmark coordinates out of range.');
      position = { longitudeDeg, latitudeDeg };
    }
    if (e.normal !== undefined && (e.normal !== 'surface' || !('pointMeters' in position))) throw new TypeError('Surface normals require a Cartesian landmark on the display mesh.');
    const minimumZoomShare = number(e.minimumZoomShare, 'landmark zoom');
    if (minimumZoomShare < 0 || minimumZoomShare > 1) throw new TypeError('Landmark zoom out of range.');
    const description = text(e.description, 'landmark description'), qualification = text(e.qualification, 'landmark qualification');
    if (`${description} ${qualification}`.length > 400) throw new TypeError('Landmark caption exceeds the shared 400-character limit.');
    return { id, name: text(e.name, 'landmark name'), kind: kind as 'point' | 'region', type: text(e.type, 'landmark type'), position, minimumZoomShare, normal: e.normal === 'surface' ? 'surface' as const : 'radial' as const,
      description, qualification,
      reference: { title: text(s.title, 'reference title'), url: url(s.url), credit: text(s.credit, 'reference credit') } };
  });
  const vtkInput = doc.vtk === undefined ? null : record(doc.vtk, 'landmarks VTK');
  const vtk = vtkInput ? { path: path(vtkInput.path), bytes: integer(vtkInput.bytes, 'VTK bytes'),
    grid: record(vtkInput.grid, 'VTK grid'), maximumDistanceMeters: positive(vtkInput.maximumDistanceMeters, 'VTK maximum distance') } : null;
  if (entries.some(e => 'regionId' in e.position) && !vtk) throw new TypeError('Mapped regions need their pinned source mesh.');
  return { source, frame, entries, vtk };
}

/** Mission geography is independent of IAU nomenclature. Coordinates cite their own frame; mapped regions
 * choose a representative point on the unchanged display mesh, checked against the released cell labels.
 * A representative point is neither an official region centre nor an invented circular boundary. */
export async function prepareLandmarks(value: unknown, context: SurfaceFeaturePreparationContext, axes: SurfaceFeatureAxes, leftEdge: number) {
  const doc = parseLandmarks(value), hit = context.hitMesh;
  if (!hit && (!(context.referenceSphere || context.surface) || doc.vtk || doc.entries.some(e => !('longitudeDeg' in e.position)))) throw new TypeError('Landmarks require the prepared picking mesh, or an explicit sphere or rendered ellipsoid with geographic coordinates.');
  const unitsPerMeter = context.meshRadiusUnits / (context.radiusKm * 1000);
  if (leftEdge !== 0 && (doc.vtk || doc.entries.some(e => 'pointMeters' in e.position))) throw new TypeError('Cartesian landmarks require an explicit zero-longitude surface frame.');
  const native = (v: readonly number[]): Vec => [dot(v, axes.prime) / unitsPerMeter, dot(v, axes.east) / unitsPerMeter, dot(v, axes.north) / unitsPerMeter];
  const prepared = (v: readonly number[]): Vec => [0, 1, 2].map(i => (v[0]! * axes.prime[i]! + v[1]! * axes.east[i]! + v[2]! * axes.north[i]!) * unitsPerMeter) as unknown as Vec;
  const positions = hit?.triangles.flatMap(triangle => triangle.map(p => [...native(p)]));
  const preparedMesh = hit && positions ? createIndexedShape(positions, hit.triangles.map((_, i) => [3 * i, 3 * i + 1, 3 * i + 2]), { metersPerUnit: 1, expectedVertices: positions.length, expectedFaces: hit.triangles.length }) : null;
  const regions = new Map<number, { anchor: Vec; sourceFace: number; displayFace: number; distanceMeters: number; score: number }>();
  if (doc.vtk) {
    if (!hit || !preparedMesh) throw new TypeError('Mapped regions require the prepared picking mesh.');
    const bytes = await readFile(resolve(context.sourceDirectory, doc.vtk.path));
    // The mesh's size and its declared grid (expected vertices and faces, checked on decoding) identify it; no hash is kept.
    if (bytes.length !== doc.vtk.bytes) throw new TypeError(`Landmark region mesh ${doc.vtk.path} is ${bytes.length} bytes; landmarks.json records ${doc.vtk.bytes}.`);
    const decoded = decodeVtkCategories(bytes.toString('utf8'), doc.vtk.grid);
    const sourceMesh = createIndexedShape(decoded.positions, decoded.indices, { metersPerUnit: 1, expectedVertices: decoded.positions.length, expectedFaces: decoded.indices.length });
    const means = new Map<number, { sum: number[]; weight: number }>();
    decoded.indices.forEach((indices, i) => {
      const [a, b, c] = indices.map(j => decoded.positions[j]!);
      const ab = b!.map((n, j) => n - a![j]!), ac = c!.map((n, j) => n - a![j]!);
      const area = Math.hypot(ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!) / 2;
      const id = decoded.values[i]!, mean = means.get(id) ?? { sum: [0, 0, 0], weight: 0 };
      for (let j = 0; j < 3; j++) mean.sum[j]! += (a![j]! + b![j]! + c![j]!) / 3 * area;
      mean.weight += area; means.set(id, mean);
    });
    hit.triangles.forEach((triangle, displayFace) => {
      const anchor = rounded([0, 1, 2].map(j => triangle.reduce((sum, p) => sum + p[j]!, 0) / 3));
      const point = native(anchor), closest = sourceMesh.closestPoint(point, doc.vtk!.maximumDistanceMeters);
      if (!closest) return;
      const id = decoded.values[closest.faceId]!, mean = means.get(id)!;
      // Keep the label away from mapped boundaries: the three vertices must map to the same region too.
      if (triangle.some(p => { const q = sourceMesh.closestPoint(native(p), doc.vtk!.maximumDistanceMeters); return !q || decoded.values[q.faceId] !== id; })) return;
      const score = point.reduce((sum, n, j) => sum + (n - mean.sum[j]! / mean.weight) ** 2, 0);
      if (!regions.has(id) || regions.get(id)!.score > score) regions.set(id, { anchor, sourceFace: closest.faceId, displayFace, distanceMeters: closest.distanceMeters, score });
    });
    // Small mapped regions can occupy part of a coarse display triangle. Try source-cell centres,
    // then require the projected display point to map back inside the same source region.
    // This places a point only; it does not label the whole coarse triangle as that terrain.
    for (const entry of doc.entries) {
      if (!('regionId' in entry.position) || regions.has(entry.position.regionId)) continue;
      const id = entry.position.regionId, mean = means.get(id);
      if (!mean) throw new TypeError(`Unknown mapped region ${id}.`);
      const candidates = decoded.indices.flatMap((indices, sourceFace) => {
        if (decoded.values[sourceFace] !== id) return [];
        const point = [0, 1, 2].map(j => indices.reduce((sum, k) => sum + decoded.positions[k]![j]!, 0) / 3);
        return [{ point, sourceFace, score: point.reduce((sum, n, j) => sum + (n - mean.sum[j]! / mean.weight) ** 2, 0) }];
      }).sort((a, b) => a.score - b.score || a.sourceFace - b.sourceFace);
      for (const candidate of candidates) {
        const displayed = preparedMesh.closestPoint(candidate.point, doc.vtk.maximumDistanceMeters);
        if (!displayed) continue;
        const back = sourceMesh.closestPoint(displayed.point, doc.vtk.maximumDistanceMeters);
        if (!back || decoded.values[back.faceId] !== id) continue;
        regions.set(id, { anchor: prepared(displayed.point), sourceFace: back.faceId, displayFace: displayed.faceId, distanceMeters: back.distanceMeters, score: candidate.score });
        break;
      }
    }
  }
  const evidence: { id: string; sourceFace?: number; displayFace?: number; distanceMeters?: number; regionId?: number }[] = [];
  const features: PreparedSurfaceFeature[] = doc.entries.map(e => {
    let anchor: Vec, longitudeDeg: number, latitudeDeg: number, surfaceNormal: Vec | undefined, geodetic = false;
    if ('regionId' in e.position) {
      const selected = regions.get(e.position.regionId);
      if (!selected) throw new TypeError(`No interior display triangle maps to ${e.name}; do not substitute a sphere point.`);
      anchor = selected.anchor;
      evidence.push({ id: e.id, regionId: e.position.regionId, sourceFace: selected.sourceFace, displayFace: selected.displayFace, distanceMeters: Number(selected.distanceMeters.toFixed(3)) });
    } else if ('pointMeters' in e.position) {
      if (!preparedMesh) throw new TypeError('Cartesian landmarks require the prepared picking mesh.');
      const closest = preparedMesh.closestPoint(e.position.pointMeters, e.position.maximumDistanceMeters);
      if (!closest) throw new TypeError(`No display surface within the source-position budget for ${e.name}.`);
      anchor = prepared(closest.point);
      // Image-plane DEMs have an arbitrary translated origin. Its radial direction can
      // point through the rear completion; use the unchanged observed facet's normal
      // for label facing and the existing flight contract when the source opts in.
      if (e.normal === 'surface') surfaceNormal = unit(prepared(closest.normal));
      evidence.push({ id: e.id, displayFace: closest.faceId, distanceMeters: Number(closest.distanceMeters.toFixed(3)) });
    } else {
      const direction = surfaceDirection(e.position.longitudeDeg, e.position.latitudeDeg, axes, leftEdge);
      if (!hit && context.surface) {
        // A rendered ellipsoid casts geodetic coordinates through the same sampler as its other names.
        const [x, y, z] = context.surface.onSurface(direction);
        anchor = [x, y, z]; geodetic = true;
        // Facing uses the map direction, as for the Natural Earth names cast through the same sampler.
        surfaceNormal = [direction[0], direction[1], direction[2]];
      } else {
        const radius = hit ? projectRadial(hit.triangles, direction) : context.referenceSphere ? context.meshRadiusUnits : null;
        if (radius === null) throw new TypeError(`No display surface at ${e.name}.`);
        anchor = [direction[0] * radius, direction[1] * radius, direction[2] * radius];
      }
      evidence.push({ id: e.id });
    }
    const body = native(anchor);
    // A geodetic sampler keeps the published coordinates: the anchor's geocentric direction would shift the latitude.
    longitudeDeg = geodetic && 'longitudeDeg' in e.position ? e.position.longitudeDeg : ((Math.atan2(body[1], body[0]) * 180 / Math.PI + leftEdge) % 360 + 360) % 360;
    latitudeDeg = geodetic && 'latitudeDeg' in e.position ? e.position.latitudeDeg : Math.asin(body[2] / length(body)) * 180 / Math.PI;
    return { id: e.id, name: e.name, kind: e.kind, type: e.type, code: 'RE', diameterKm: 0, longitudeDeg, latitudeDeg,
      anchorUnits: rounded(anchor, 3), normal: rounded(surfaceNormal ?? unit(anchor)), radiusUnits: 0,
      outline: { kind: 'circle', center: rounded(anchor, 3), east: [0, 0, 0], north: [0, 0, 0] },
      searchNames: [normalizeSearchText(e.name)], searchContext: normalizeSearchText(e.type),
      origin: '', approved: '', quad: 'mission-geography', link: e.reference.url, credit: e.reference.credit,
      note: { text: `${e.description} ${e.qualification}`, title: e.reference.title, url: e.reference.url, credit: '' }, minimumZoomShare: e.minimumZoomShare };
  });
  return { features, evidence, source: doc.source, frame: doc.frame };
}
