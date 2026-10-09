import { isRecord } from '@cssearth/core';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

/** Lab-only comparison pictures for a plate object, kept in an object's ignored scratch: `src/objects/<owner>/.local/candidates/`
 * holds each picture as a PNG and an `index.json` that names the objects it serves and, for every picture, the sky
 * position (RA/Dec, degrees) of its top-left, top-right, bottom-right and bottom-left outer pixel edges from the
 * picture's own WCS, and the forward-shock circle in its pixels. Nothing here ships. */
const OBJECTS = 'src/objects', CANDIDATES = '.local/candidates';

export interface CandidatePicture {
  id: string; label: string; kind: string; credit: string; license: string; sourceUrl: string; registration: string;
  registered: boolean; approximate?: boolean; file: string; widthPx: number; heightPx: number; nativeWidthPx: number; nativeHeightPx: number;
  pixelArcsec: number; shownPixelArcsec: number; fieldArcsec: [number, number]; reachArcsec: number; reachRings: number;
  targetPixel: [number, number]; corners: [number, number][]; outline: [number, number][];
}

/** The ICRF unit vector of a sky position, as the bake's `imageLayerView` builds its rays. */
const unit = (raDeg: number, decDeg: number) => {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180, c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const pair = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every(finite);

function readCandidate(raw: unknown): CandidatePicture {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[a-z0-9-]+$/.test(raw.id) || typeof raw.file !== 'string' || !/^[a-z0-9-]+\.png$/.test(raw.file) ||
      typeof raw.label !== 'string' || typeof raw.credit !== 'string' || typeof raw.registered !== 'boolean' ||
      !finite(raw.widthPx) || !finite(raw.heightPx) || !Array.isArray(raw.outline) || !raw.outline.every(pair) ||
      (raw.registered && !(Array.isArray(raw.corners) && raw.corners.length === 4 && raw.corners.every(pair))))
    throw new TypeError('Invalid candidate picture record.');
  return raw as unknown as CandidatePicture;
}

/** The candidate set that names `object`, or null. */
export async function candidatePictures(root: string, object: string) {
  // The object's own set first, then any object's set that names it (Cas A's serves its MIRI sibling too).
  const own = object.replace(/^src\/objects\//, ''), objects = resolve(root, OBJECTS);
  const owners = [own, ...(await readdir(objects).catch(() => [])).filter(name => name !== own)];
  for (const owner of owners) {
    const directory = resolve(objects, owner, CANDIDATES);
    const raw: unknown = JSON.parse(await readFile(resolve(directory, 'index.json'), 'utf8').catch(() => 'null'));
    if (!isRecord(raw) || !Array.isArray(raw.objects) || !raw.objects.includes(object) || !Array.isArray(raw.candidates)) continue;
    return { group: owner, directory: relative(root, directory), target: raw.target, candidates: raw.candidates.map(readCandidate) };
  }
  return null;
}

/** One candidate laid as the Original control's plane: the corners' sight lines (unit vectors in the ICRF, the same
 * frame `imageLayerView` gives the bake's photograph). An unregistered picture is laid on the object's own photograph
 * frame instead, by `fallbackCorners`. */
export async function candidatePictureCorners(root: string, object: string, id: string, fallbackCorners: () => Promise<number[][]>) {
  const set = await candidatePictures(root, object);
  const picture = set?.candidates.find(item => item.id === id);
  if (!set || !picture) throw new TypeError(`No candidate picture ${id} for ${object}.`);
  const corners = picture.registered ? picture.corners.map(([ra, dec]) => unit(ra, dec)) : await fallbackCorners();
  return { id: picture.id, picture: 'candidate', file: picture.file, texturePath: `${set.directory}/${picture.file}`, widthPx: picture.widthPx, heightPx: picture.heightPx,
    credit: picture.credit, sourcePageUrl: picture.sourceUrl, corners,
    registrationNote: picture.registered ? `${picture.label}: placed by ${picture.registration}.` : `${picture.label}: no sky coordinates; laid on the published photograph's frame, unregistered.` };
}
