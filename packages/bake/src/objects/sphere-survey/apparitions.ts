/**
 * Which apparitions a survey dataset can cast, and what each would add.
 *
 *   node packages/bake/cli/sphere-survey-apparitions.mts [object-id …]   audit every shipped survey dataset, or the ones named
 *
 * Deconvolved frames carry no calibrated level, so the level fit places an apparition only through surface it shares with
 * another at moderate angles (`observingSeasons` in the controlled-camera format). Whether it can is decided here from
 * geometry, before any pixel is read: each released frame's view of the dataset mesh, from the release's rotation record and
 * JPL Horizons at the start its file name states, and for frames of different apparitions the surface both see within the
 * fit's angle limit, counted in the display samples the fit compares. An apparition joins the dataset when one of its frames
 * shares at least the fit's minimum pair count with a frame the dataset already casts; the fit then decides from the pixels.
 *
 * The audit runs the same geometry for the datasets in the repository with the Sun limits the dataset photometry states, and
 * reports each apparition's share of the surface and what it adds. A face counts when its centre faces the camera and the
 * Sun within the limits and nothing hides it from the camera; the prepared dataset's measured coverage is printed beside the
 * model's for the frames it casts, as the model's check.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { horizonsTables, qualifiedFace, shadingNormal, horizonsRows, observerRowValues } from '../layers/terrestrial/index.ts';
import type { SourceMesh } from '../geometry/index.ts';
import { observerCamera, type BodyOrientation } from '../cameras/index.ts';
import { lamText, parseFrameListing, type LamFrame } from './lam.ts';

const DEGREE = Math.PI / 180;
type Vector = readonly [number, number, number];
type Mesh = Pick<SourceMesh, 'positions' | 'indices' | 'intersect' | 'faceProvenance' | 'constraintFlags'>;
/** A frame's view in the body frame: unit vectors toward the observer and the Sun, and the sub-observer latitude. */
export interface FrameView { observer: Vector; sun: Vector; latitude: number; rangeKm: number }

/** A body-frame direction from a camera's stated latitude and west longitude. */
export const bodyDirection = (latitude: number, westLongitude: number): Vector =>
  [Math.cos(latitude * DEGREE) * Math.cos(-westLongitude * DEGREE), Math.cos(latitude * DEGREE) * Math.sin(-westLongitude * DEGREE), Math.sin(latitude * DEGREE)];

/** Every face of the dataset mesh with its area, centre and surface normal there, and whether the mesh constrains it. */
export function meshFaces(mesh: Mesh) {
  const normalAt = shadingNormal(mesh);
  return mesh.indices.map((face, id) => {
    const [a, b, c] = face.map(vertex => mesh.positions[vertex]), u = [0, 1, 2].map(k => b[k] - a[k]), v = [0, 1, 2].map(k => c[k] - a[k]);
    const facet = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(...facet);
    const centre = [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3);
    return { area: length / 2, centre, normal: normalAt(id, centre), lift: facet.map(n => n / length), qualified: qualifiedFace(mesh, id) };
  });
}
export type MeshFaces = ReturnType<typeof meshFaces>;

/** The faces a view sees within an angle limit: facing the camera and the Sun, and hidden from the camera by nothing. */
export function seenFaces(faces: MeshFaces, mesh: Mesh, view: FrameView, limitDegrees: number) {
  const seen = new Uint8Array(faces.length), limit = Math.cos(limitDegrees * DEGREE);
  faces.forEach((face, id) => {
    if (!face.qualified) return;
    const n = face.normal, emission = n[0] * view.observer[0] + n[1] * view.observer[1] + n[2] * view.observer[2], incidence = n[0] * view.sun[0] + n[1] * view.sun[1] + n[2] * view.sun[2];
    if (emission < limit || incidence < limit) return;
    // A centimetre above the face, so the ray toward the camera does not find the face it leaves.
    if (!mesh.intersect(face.centre.map((x, k) => x + face.lift[k] * .01), view.observer)) seen[id] = 1;
  });
  return seen;
}

/** The share of the mesh's area that some of the given views see. */
export function coveredShare(faces: MeshFaces, seen: readonly Uint8Array[]) {
  let covered = 0, total = 0;
  faces.forEach((face, id) => { total += face.area; if (seen.some(mask => mask[id])) covered += face.area; });
  return covered / total;
}

/** The share of the mesh's area both views see. */
function sharedShare(faces: MeshFaces, a: Uint8Array, b: Uint8Array) {
  let shared = 0, total = 0;
  faces.forEach((face, id) => { total += face.area; if (a[id] && b[id]) shared += face.area; });
  return shared / total;
}

export interface LinkRule { gateDegrees: number; minimumPairs: number; displaySamples: number }
export interface ApparitionLink { apparition: number; cast: boolean; sharedSamples: number | null }

/**
 * Which apparitions join the anchor. Joining is transitive: an apparition that shares enough surface with any apparition
 * already cast joins, until none is left that does. `sharedSamples` is the most display samples one of its frames shares
 * with a cast frame at the fit's angle limit, null for the anchor itself.
 */
export function apparitionLinks(faces: MeshFaces, mesh: Mesh, views: readonly { apparition: number; view: FrameView }[], anchor: number, rule: LinkRule): ApparitionLink[] {
  const gated = views.map(({ view }) => seenFaces(faces, mesh, view, rule.gateDegrees)), count = Math.max(...views.map(entry => entry.apparition)) + 1;
  const cast = new Set([anchor]), best = Array<number>(count).fill(0);
  for (let joined = true; joined;) {
    joined = false;
    for (let apparition = 0; apparition < count; apparition++) {
      if (cast.has(apparition)) continue;
      for (const [i, a] of views.entries()) if (a.apparition === apparition) for (const [j, b] of views.entries()) if (cast.has(b.apparition))
        best[apparition] = Math.max(best[apparition], Math.round(sharedShare(faces, gated[i], gated[j]) * rule.displaySamples));
      if (best[apparition] >= rule.minimumPairs) { cast.add(apparition); joined = true; }
    }
  }
  return Array.from({ length: count }, (_, apparition) => ({ apparition, cast: cast.has(apparition), sharedSamples: apparition === anchor ? null : best[apparition] }));
}

const jd = (start: string) => Date.parse(`${start}Z`) / 86_400_000 + 2440587.5;

/**
 * Every released frame's view from its listed start: the rotation the record states, and the Horizons observer and
 * heliocentric rows at that start, kept in the downloads folder so a rerun asks Horizons once.
 */
export async function listedViews(frames: readonly LamFrame[], orientation: BodyOrientation, command: string, downloads: string) {
  const starts = frames.map(frame => jd(frame.start)), cachePath = resolve(downloads, 'horizons-release.json');
  const cache = await readFile(cachePath, 'utf8').then(text => requireRecord(JSON.parse(text)), () => null);
  const tables = cache && JSON.stringify(cache.starts) === JSON.stringify(starts) ? { observer: requireString(cache.observer), heliocentric: requireString(cache.heliocentric) }
    : await horizonsTables(command, starts);
  await mkdir(downloads, { recursive: true });
  await writeFile(cachePath, JSON.stringify({ starts, ...tables }));
  const observer = horizonsRows(tables.observer), vectors = horizonsRows(tables.heliocentric).filter(line => line.trimStart().startsWith('X ='));
  // Horizons answers one row per distinct start, in time order.
  const epochs = [...new Set(starts)].sort((a, b) => a - b);
  if (observer.length !== epochs.length || vectors.length !== epochs.length) throw new Error('The release tables do not cover every listed start.');
  return frames.map((frame, index) => {
    const row = epochs.indexOf(starts[index]), { rightAscension, declination, rangeAu } = observerRowValues(observer[row]);
    const [x, y, z] = (vectors[row].match(/-?\d+\.\d+(?:E[+-]\d+)?/g) ?? []).map(Number), distance = Math.hypot(x, y, z);
    const camera = observerCamera({ epochJd: starts[index], targetRightAscensionDegrees: rightAscension, targetDeclinationDegrees: declination, rangeAu,
      sunRightAscensionDegrees: (Math.atan2(-y, -x) / DEGREE + 360) % 360, sunDeclinationDegrees: Math.asin(-z / distance) / DEGREE, pixelAngleMicroradians: 1, center: [0, 0] }, orientation);
    return { observer: bodyDirection(camera.observerLatitude, camera.observerWestLongitude), sun: bodyDirection(camera.sunLatitude, camera.sunWestLongitude),
      latitude: camera.observerLatitude, rangeKm: camera.rangeKm } satisfies FrameView;
  });
}

/** The release's listing of a body's deconvolved frames, fetched once into the downloads folder. */
export async function releasedFrames(url: string, downloads: string) {
  const path = resolve(downloads, 'listing.html');
  const html = await readFile(path, 'utf8').catch(async () => { const text = await lamText(url); await mkdir(downloads, { recursive: true }); await writeFile(path, text); return text; });
  return parseFrameListing(html, url).filter(frame => frame.camera === 1);
}
