export type Matrix = [number, number, number, number, number, number];
export type Point = [number, number];
export type LayerId = 'original' | 'diffuse' | 'stars';
export type ImageLayer = { path: string; width: number; height: number };
export interface Observation {
  id: string; label: string;
  source: { width: number; height: number; url: string; credit: string; page: string; stellarTreatment?: 'preserve'; coordinateOrigin?: 'authored-bright-star-seed' };
  layers: { original: ImageLayer; diffuse?: ImageLayer; stars?: ImageLayer };
  imageToFrame: Matrix;
  registration: { status: 'verified' | 'publisher' | 'transferred'; matchedStars: number; rmsPixels: number; maxResidualPixels: number;
    referenceId?: string; bridgeMatchedStars?: number;
    matches: { source: Point; frame: Point; heldOut: boolean }[] };
}
export interface Observations {
  id: string; frame: { width: number; height: number; fieldArcminutes: Point; centerIcrsDegrees: Point; northUp: true };
  images: Observation[];
}
export interface Adjustment { x: number; y: number; rotation: number; scale: number }
type RegisteredImage = { imageToFrame: Matrix; source: { width: number; height: number } };
export const unchanged: Adjustment = { x: 0, y: 0, rotation: 0, scale: 1 };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const string = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const point = (value: unknown): value is Point => Array.isArray(value) && value.length === 2 && value.every(finite);
const matrix = (value: unknown): value is Matrix => Array.isArray(value) && value.length === 6 && value.every(finite) && Math.abs(value[0] * value[3] - value[1] * value[2]) > 1e-12;
function layer(value: unknown): ImageLayer {
  if (!record(value) || !string(value.path) || value.path.startsWith('/') || value.path.split('/').includes('..') || !positive(value.width) || !positive(value.height)) throw new Error('Invalid observation image layer.');
  return { path: value.path, width: value.width, height: value.height };
}
export function readObservations(value: unknown): Observations {
  if (!record(value) || value.schema !== 'cssearth-nebula-observations@1' || !string(value.id) || !record(value.frame) || !Array.isArray(value.images) || value.images.length < 2) throw new Error('Invalid observation catalogue.');
  const f = value.frame;
  if (!positive(f.width) || !positive(f.height) || !point(f.fieldArcminutes) || !f.fieldArcminutes.every(positive) || !point(f.centerIcrsDegrees) || f.northUp !== true) throw new Error('Invalid common sky frame.');
  const ids = new Set<string>();
  const images = value.images.map((image: unknown): Observation => {
    if (!record(image) || !string(image.id) || ids.has(image.id) || !string(image.label) || !record(image.source) || !record(image.layers) || !matrix(image.imageToFrame) || !record(image.registration)) throw new Error('Invalid observation.');
    ids.add(image.id); const s = image.source, r = image.registration;
    if (!positive(s.width) || !positive(s.height) || !string(s.url) || !s.url.startsWith('https://') || !string(s.page) || !s.page.startsWith('https://') || !string(s.credit)) throw new Error('Invalid observation source.');
    if (!['verified', 'publisher', 'transferred'].includes(String(r.status)) || !finite(r.matchedStars) || r.matchedStars < 0 || !finite(r.rmsPixels) || r.rmsPixels < 0 || !finite(r.maxResidualPixels) || r.maxResidualPixels < 0 || (r.matches !== undefined && !Array.isArray(r.matches))) throw new Error('Invalid registration evidence.');
    if (s.stellarTreatment !== undefined && s.stellarTreatment !== 'preserve') throw new Error('Invalid stellar treatment.');
    if (s.coordinateOrigin !== undefined && s.coordinateOrigin !== 'authored-bright-star-seed') throw new Error('Invalid coordinate origin.');
    if (r.status === 'transferred' && (!string(r.referenceId) || !finite(r.bridgeMatchedStars) || r.bridgeMatchedStars < 45 || r.matchedStars !== 0 || !Array.isArray(r.matches) || r.matches.length !== 0)) throw new Error('Transferred registration requires honest bridge evidence.');
    const matches = (Array.isArray(r.matches) ? r.matches : []).map((match: unknown) => {
      if (!record(match) || !point(match.source) || !point(match.frame) || (match.heldOut !== undefined && typeof match.heldOut !== 'boolean')) throw new Error('Invalid registration star.');
      return { source: match.source, frame: match.frame, heldOut: match.heldOut === true };
    });
    return { id: image.id, label: image.label,
      source: { width: s.width, height: s.height, url: s.url, page: s.page, credit: s.credit, ...(s.stellarTreatment === 'preserve' ? { stellarTreatment: 'preserve' } : {}), ...(s.coordinateOrigin === 'authored-bright-star-seed' ? { coordinateOrigin: 'authored-bright-star-seed' } : {}) },
      imageToFrame: image.imageToFrame, layers: { original: layer(image.layers.original),
        ...(image.layers.diffuse === undefined ? {} : { diffuse: layer(image.layers.diffuse) }),
        ...(image.layers.stars === undefined ? {} : { stars: layer(image.layers.stars) }) },
      registration: { status: r.status === 'verified' ? 'verified' : r.status === 'transferred' ? 'transferred' : 'publisher', matchedStars: r.matchedStars, rmsPixels: r.rmsPixels, maxResidualPixels: r.maxResidualPixels, matches,
        ...(string(r.referenceId) ? { referenceId: r.referenceId } : {}), ...(finite(r.bridgeMatchedStars) ? { bridgeMatchedStars: r.bridgeMatchedStars } : {}) } };
  });
  return { id: value.id, frame: { width: f.width, height: f.height, fieldArcminutes: f.fieldArcminutes, centerIcrsDegrees: f.centerIcrsDegrees, northUp: true }, images };
}
export function transform(m: Matrix, p: Point): Point { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
/** A local inspection fit follows measured registration; it never replaces it. */
export function adjustedMatrix(image: RegisteredImage, frame: Observations['frame'], fit: Adjustment): Matrix {
  const m = image.imageToFrame, center = transform(m, [image.source.width / 2, image.source.height / 2]);
  const angle = fit.rotation * Math.PI / 180, c = Math.cos(angle) * fit.scale, s = Math.sin(angle) * fit.scale;
  const tx = center[0] + fit.x * frame.width / frame.fieldArcminutes[0] - c * center[0] + s * center[1];
  const ty = center[1] - fit.y * frame.height / frame.fieldArcminutes[1] - s * center[0] - c * center[1];
  return [c * m[0] - s * m[1], s * m[0] + c * m[1], c * m[2] - s * m[3], s * m[2] + c * m[3], c * m[4] - s * m[5] + tx, s * m[4] + c * m[5] + ty];
}
export function readAdjustment(value: unknown): Adjustment {
  if (!record(value) || !finite(value.x) || !finite(value.y) || !finite(value.rotation) || !positive(value.scale) || value.scale > 100 || Math.abs(value.x) > 1000 || Math.abs(value.y) > 1000 || Math.abs(value.rotation) > 360) return { ...unchanged };
  return { x: value.x, y: value.y, rotation: value.rotation, scale: value.scale };
}
export function imageCorners(image: RegisteredImage, matrix: Matrix): Point[] {
  return [[0, 0], [image.source.width, 0], [0, image.source.height], [image.source.width, image.source.height]].map(([x, y]) => transform(matrix, [x!, y!]));
}
export const observationFitStorageKey = (path: string, image: { id: string; source: { url: string } }) => `nebula-observation-fit@1:${path}:${image.id}:${image.source.url}`;
export function savedObservationFit(path: string, image: { id: string; source: { url: string } }): Adjustment {
  try { return readAdjustment(JSON.parse(localStorage.getItem(observationFitStorageKey(path, image)) ?? 'null')); } catch { return { ...unchanged }; }
}
