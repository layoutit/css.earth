/**
 * Levels and radial profile for an entry the site ships (a plate bank or a volume dataset bank), through the same
 * statistics a saved lab reconstruction uses (`dataset-levels.ts`, `dataset-radial.ts`).
 *
 *  - SOURCE  = the photograph the Original control shows (a plate's original or star-free copy, or a volume dataset's
 *              registered original), on a grid over the photograph itself, its sky pedestal removed as there.
 *  - RENDER  = the bank's prepared far picture (`prepared/backing.json`): its slices or its dataset's impostor seen from
 *              the Sun and composited over black as the page composites them, laid on the photograph through both
 *              planes' prepared CSS transforms. It is the page's own picture, at its own (coarse) resolution.
 *  - MASK    = the photograph's coverage (its alpha, where it has one).
 *
 * The radial centre is the recipe's target (for Cassiopeia A, the Thorstensen et al. 2001 expansion centre) or else the
 * bank frame's origin. Nothing is written; nothing is rendered.
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { datasetLevelStatistics, type DatasetLevelGrid, type DatasetLevelPairs, type DatasetLevels } from './dataset-levels.ts';
import { radialProfileStatistics, RADIAL_BINS, type DatasetRadialProfile } from './dataset-radial.ts';
import { differenceField, differenceMap } from './dataset-difference.ts';
import { platePhotographCorners } from '../workflows/plates/photograph-corners.ts';
import { volumeOriginal } from '../workflows/volumes/volume-original.ts';
import { prepareOverlayGeometry } from '../../adapters/renderer/overlay-geometry.ts';
import { skyPlanePoint } from '../../adapters/renderer/sky-plane.ts';

export interface SiteDiagnosticsRequest { kind: 'plates' | 'volume'; object: string; dataset: string; picture: 'original' | 'starless' }
/** The grid's longer side, in cells. */
const GRID = 384;
const CSS_PER_UNIT = 50;

export function readSiteDiagnosticsRequest(query: URLSearchParams): SiteDiagnosticsRequest {
  const kind = query.get('kind'), object = query.get('object') ?? '', dataset = query.get('dataset') ?? '', picture = query.get('picture') ?? 'original';
  if (kind !== 'plates' && kind !== 'volume') throw new TypeError('Name the entry kind: plates or volume.');
  if (!/^src\/objects\/[a-z0-9][a-z0-9-]*$/.test(object)) throw new TypeError('Name a site object directory.');
  if (dataset && !/^[a-z0-9][a-z0-9-]*$/.test(dataset)) throw new TypeError('Invalid dataset name.');
  if (picture !== 'original' && picture !== 'starless') throw new TypeError('Name the picture: original or starless.');
  return { kind, object, dataset, picture };
}
export const siteDiagnosticsId = (request: SiteDiagnosticsRequest) => `${request.object.split('/').at(-1)}:${request.dataset || 'default'}:${request.picture}`;

function matrixOf(transform: string): number[] {
  const values = /^matrix3d\(([^)]+)\)$/.exec(transform.trim())?.[1]?.split(',').map(Number);
  if (!values || values.length !== 16 || !values.every(Number.isFinite)) throw new TypeError(`Not a prepared matrix3d: ${transform.slice(0, 60)}`);
  return values;
}
/** The 3×3 homography a z = 0 leaf's matrix3d applies to its texel (u, v): CSS x, y and w. */
const homography = (m: readonly number[]) => [[m[0]!, m[4]!, m[12]!], [m[1]!, m[5]!, m[13]!], [m[3]!, m[7]!, m[15]!]];
function invert3([[a, b, c], [d, e, f], [g, h, i]]: number[][]): number[][] {
  const A = e! * i! - f! * h!, B = f! * g! - d! * i!, C = d! * h! - e! * g!, det = a! * A + b! * B + c! * C;
  if (!(Math.abs(det) > 0)) throw new TypeError('A prepared plane is degenerate.');
  return [[A / det, (c! * h! - b! * i!) / det, (b! * f! - c! * e!) / det], [B / det, (a! * i! - c! * g!) / det, (c! * d! - a! * f!) / det],
    [C / det, (b! * g! - a! * h!) / det, (a! * e! - b! * d!) / det]];
}
const apply = (h: number[][], x: number, y: number): [number, number] => {
  const w = h[2]![0]! * x + h[2]![1]! * y + h[2]![2]!;
  return [(h[0]![0]! * x + h[0]![1]! * y + h[0]![2]!) / w, (h[1]![0]! * x + h[1]![1]! * y + h[1]![2]!) / w];
};
const rayOf = (raDeg: number, decDeg: number) => {
  const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};

interface Photo { path: string; widthPx: number; heightPx: number; matrix: number[]; label: string }
async function photoOf(root: string, request: SiteDiagnosticsRequest, frame: DensityVolumeFrame): Promise<Photo> {
  if (request.kind === 'plates') {
    const plate = await platePhotographCorners(resolve(root, request.object), request.picture);
    const geometry = prepareOverlayGeometry(plate.corners.map(ray => skyPlanePoint(ray, frame)), plate.widthPx, plate.heightPx);
    return { path: `${request.object}/source/${plate.file}`, widthPx: plate.widthPx, heightPx: plate.heightPx, matrix: geometry.matrix.split(',').map(Number), label: plate.file };
  }
  if (request.picture !== 'original') throw new TypeError('A site volume dataset has only its original photograph.');
  const { texture, catalogue } = await volumeOriginal(root, request.object, request.dataset) as { texture: string; catalogue: { overlays: { widthPx: number; heightPx: number; texturePath?: string; style: { transform: string } }[] } };
  const overlay = catalogue.overlays[0];
  if (!overlay) throw new TypeError(`${request.object} ${request.dataset}: no registered original.`);
  return { path: texture, widthPx: overlay.widthPx, heightPx: overlay.heightPx, matrix: matrixOf(overlay.style.transform), label: texture.split('/').at(-1) ?? texture };
}

/** The photograph and the bank's far picture on one grid over the photograph, and the object's centre on that grid. */
export async function siteLevelGrid(root: string, request: SiteDiagnosticsRequest): Promise<{ grid: DatasetLevelGrid; pairs: DatasetLevelPairs;
  centre: { x: number; y: number }; centreBasis: string; photo: string; render: string }> {
  const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const backing = await json(`${request.object}/prepared/backing.json`).catch(() => { throw new TypeError(`${request.object} publishes no far picture (prepared/backing.json) to compare against.`); });
  if (!isRecord(backing) || !isRecord(backing.frame) || !isRecord(backing.leaf) || !isRecord(backing.leaf.style)) throw new TypeError('Unreadable prepared backing.');
  const frame = backing.frame as unknown as DensityVolumeFrame, style = backing.leaf.style as { width: string; height: string; transform: string };
  const datasets = isRecord(backing.datasets) ? backing.datasets : {};
  const texture = typeof datasets[request.dataset] === 'string' ? datasets[request.dataset] as string : String(backing.leaf.texturePath);
  if (request.dataset && Object.keys(datasets).length && typeof datasets[request.dataset] !== 'string') throw new TypeError(`The far picture has no ${request.dataset} view.`);
  const back = matrixOf(style.transform);
  if (back[3] !== 0 || back[7] !== 0) throw new TypeError('The far picture is not an affine plane.');
  const toBack = invert3(homography(back)), backWidth = Number.parseFloat(style.width), backHeight = Number.parseFloat(style.height);
  const photo = await photoOf(root, request, frame), toPhoto = invert3(homography(photo.matrix)), fromPhoto = homography(photo.matrix);
  const scale = GRID / Math.max(photo.widthPx, photo.heightPx), width = Math.max(2, Math.round(photo.widthPx * scale)), height = Math.max(2, Math.round(photo.heightPx * scale));
  const source = await sharp(await readFile(resolve(root, photo.path))).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const render = await sharp(await readFile(resolve(root, request.object, 'prepared', texture))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rw = render.info.width, rh = render.info.height;
  const sample = (x: number, y: number, c: number) => render.data[(Math.min(rh - 1, Math.max(0, y)) * rw + Math.min(rw - 1, Math.max(0, x))) * 4 + c]!;
  const pixels = width * height, mask = new Uint8Array(pixels), rgb = new Float64Array(pixels * 3), drawn = new Float64Array(pixels * 3);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const p = j * width + i;
    for (let c = 0; c < 3; c++) rgb[p * 3 + c] = source[p * 4 + c]!;
    mask[p] = source[p * 4 + 3]! >= 250 ? 1 : 0;
    // Grid cell → photograph texel → CSS scene point → far-picture texel; bilinear in the far picture.
    const [x, y] = apply(fromPhoto, (i + .5) / width * photo.widthPx, (j + .5) / height * photo.heightPx);
    const [s, t] = apply(toBack, x, y), u = s / backWidth * rw - .5, v = t / backHeight * rh - .5;
    if (u < -.5 || v < -.5 || u > rw - .5 || v > rh - .5) continue;
    const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
    const at = (dx: number, dy: number, c: number) => sample(ix + dx, iy + dy, c) * sample(ix + dx, iy + dy, 3) / 255;
    for (let c = 0; c < 3; c++)
      drawn[p * 3 + c] = at(0, 0, c) * (1 - fx) * (1 - fy) + at(1, 0, c) * fx * (1 - fy) + at(0, 1, c) * (1 - fx) * fy + at(1, 1, c) * fx * fy;
  }
  const covered: number[] = [];
  for (let p = 0; p < pixels; p++) if (mask[p]) covered.push(p);
  if (!covered.length) throw new TypeError('The photograph has no covered pixels.');
  const sky = [0, 1, 2].map(c => { const values = covered.map(p => rgb[p * 3 + c]!).sort((a, b) => a - b); return values[Math.floor(values.length * .05)]!; });
  const sourceLevels = new Float64Array(covered.length * 3), renderLevels = new Float64Array(covered.length * 3);
  covered.forEach((p, k) => { for (let c = 0; c < 3; c++) { sourceLevels[k * 3 + c] = Math.max(0, rgb[p * 3 + c]! - sky[c]!); renderLevels[k * 3 + c] = drawn[p * 3 + c]!; } });
  // The object's centre: the recipe's target where a plate recipe names one, else the frame origin (CSS 0, 0).
  const recipe = request.kind === 'plates' ? await json(`${request.object}/source/recipe.json`).catch(() => null) : null;
  const target = isRecord(recipe) && isRecord(recipe.target) && typeof recipe.target.centerRaDeg === 'number' && typeof recipe.target.centerDecDeg === 'number' ? recipe.target : null;
  const local = target ? skyPlanePoint(rayOf(target.centerRaDeg as number, target.centerDecDeg as number), frame) : [0, 0, 0];
  const [cu, cv] = apply(toPhoto, local[1]! * CSS_PER_UNIT, local[0]! * CSS_PER_UNIT);
  const projection = new Uint8Array(pixels);
  return { grid: { width, height, projection, source: rgb, mask }, pairs: { covered, sky, source: sourceLevels, render: renderLevels },
    centre: { x: cu / photo.widthPx * width - .5, y: cv / photo.heightPx * height - .5 },
    centreBasis: target ? `the recipe target (${(target.centerRaDeg as number).toFixed(5)}°, ${(target.centerDecDeg as number).toFixed(5)}°)` : 'the bank frame’s origin',
    photo: photo.label, render: texture };
}

export async function siteLevels(root: string, request: SiteDiagnosticsRequest): Promise<DatasetLevels> {
  const { grid, pairs, photo, render } = await siteLevelGrid(root, request);
  return { schema: 'cssearth-nebula-dataset-levels@1', resultId: siteDiagnosticsId(request), imageId: photo, modelResultId: request.object, sourceResultId: request.object,
    files: { projection: render, source: photo, coverage: photo }, grid: { width: grid.width, height: grid.height },
    ...datasetLevelStatistics(grid, undefined, pairs),
    note: 'Source: the photograph the Original control shows, sky pedestal removed. Render: the page’s own far picture of this bank (prepared/backing), ' +
      'composited over black and laid on the photograph through both prepared planes. It is the far view at its own resolution, not a capture of the close-up slices.' };
}
export async function siteRadial(root: string, request: SiteDiagnosticsRequest): Promise<DatasetRadialProfile> {
  const { grid, pairs, centre, centreBasis, photo } = await siteLevelGrid(root, request);
  return { schema: 'cssearth-nebula-dataset-radial@1', resultId: siteDiagnosticsId(request), imageId: photo, grid: { width: grid.width, height: grid.height },
    bins: RADIAL_BINS, ...radialProfileStatistics(grid, undefined, RADIAL_BINS, { pairs, centre }),
    note: `Azimuthally averaged luminance in radial bins about ${centreBasis}: the photograph against the page’s own far picture of this bank.` };
}
/** The render-minus-photograph map on the photograph's own grid, laid with the photograph's registered transform. The
 * render is the page's own picture, so there is no analytic delivery loss to divide out. */
export async function siteDifference(root: string, request: SiteDiagnosticsRequest) {
  const { grid, pairs, photo } = await siteLevelGrid(root, request);
  const field = differenceField(grid, { channelGain: null, toneCurve: null }, 1, pairs);
  return differenceMap(field, { field, width: grid.width, height: grid.height }, { resultId: siteDiagnosticsId(request), imageId: photo }, 1,
    'The render is the page’s own far picture, so it is not divided for delivery loss.',
    'Luminance of the page’s far picture of this bank minus the sky-removed photograph. Blue: render too dark. Red: too bright. Only meaningful from the Earth view.');
}
