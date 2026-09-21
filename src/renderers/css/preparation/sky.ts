/** Static PolyCSS cube geometry in physical ICRF axes; the renderer owns its one axis reflection. */
import { compileLeafBounds } from './leaf-bounds.js';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { BakedSky } from '../../../preparation/sky/bake.js';
import type { PreparedCssSky } from '../sky/types.js';
import { validatePreparedCssSky } from '../sky/validation.js';
const RADIUS_UNITS = 1, CSS_PIXELS_PER_UNIT = 50;
/** WebKit backs a 3D layer at its CSS size times the device pixel ratio. PolyCSS sizes a leaf at its texture's pixel
 * size, so a 1536 px face was backed at 4608 px on a DPR 3 phone (85 MB per face). Built at half size with a doubled
 * matrix scale, a face projects identically and its backing holds every texel at DPR 2 and above. */
const FACE_CSS_DENSITY = 2;
const scaled = (values: readonly number[]) => values.map(value => value / FACE_CSS_DENSITY);
function denseMatrix(matrix: string): string {
  const values = matrix.split(',').map(Number);
  if (values.length !== 16 || !values.every(Number.isFinite)) throw new TypeError('PolyCSS sky face matrix is not a finite matrix3d.');
  // Column-major matrix3d: scaling the local x and y axes scales the first two columns.
  return values.map((value, index) => index < 8 ? value * FACE_CSS_DENSITY : value).join(',');
}
function compileFaces(faces: BakedSky['faces']): PreparedCssSky['faces'] {
  return faces.map((face, index) => {
    const polygon: Polygon = { vertices: face.vertices, uvs: face.uvs, texture: face.texturePath,
      textureImageSource: { url: face.texturePath, width: face.widthPx, height: face.heightPx },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
    const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: CSS_PIXELS_PER_UNIT, layerElevation: CSS_PIXELS_PER_UNIT, seamBleed: 0 });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    if (!geometry) throw new TypeError(`PolyCSS could not prepare sky face ${face.id}.`);
    const matrix = denseMatrix(geometry.matrix), [width, height] = scaled([geometry.leafWidth, geometry.leafHeight]);
    return { id: face.id, texturePath: face.texturePath, widthPx: face.widthPx, heightPx: face.heightPx,
      forwardIcrf: face.forwardIcrf, rightIcrf: face.rightIcrf, upIcrf: face.upIcrf,
      boundsCssPixels: compileLeafBounds(matrix, width!, height!),
      style: { width: `${width}px`, height: `${height}px`, transform: `matrix3d(${matrix})`,
        backgroundSize: scaled(geometry.backgroundSize).map(n => `${n}px`).join(' '), backgroundPosition: scaled(geometry.backgroundPosition).map(n => `${n}px`).join(' ') } };
  });
}
export function compileCssSky(baked: BakedSky, frame: DensityVolumeFrame) {
  const resource = (face: BakedSky['faces'][number]) => ({ path: face.texturePath, width: face.widthPx, height: face.heightPx, bytes: face.bytes, sha256: face.sha256 });
  const resources = [...baked.faces.map(resource), ...(baked.nearFaces ?? []).map(resource)];
  const sky: PreparedCssSky = { schema: 'cssearth-css-sky@1', referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, radiusUnits: RADIUS_UNITS,
    ...(baked.parallax ? { parallax: { originM: [...baked.parallax.originM] as [number, number, number],
      metersPerCssPixel: baked.parallax.radiusM / (RADIUS_UNITS * CSS_PIXELS_PER_UNIT) } } : {}),
    faces: compileFaces(baked.faces),
    // The near cube shares every face's geometry; only its image differs.
    ...(baked.nearFaces && baked.stars ? { nearFaces: compileFaces(baked.nearFaces), stars: baked.stars } : {}),
    provenance: baked.provenance, approximation: baked.approximation };
  validatePreparedCssSky(sky, resources); return { sky, resources };
}
