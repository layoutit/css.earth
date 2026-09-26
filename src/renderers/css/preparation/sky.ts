/** Static PolyCSS cube geometry in physical ICRF axes; the renderer owns its one axis reflection. */
import { compileVolumeLeaf } from './volume.js';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { BakedSky } from '../../../preparation/sky/bake.js';
import type { PreparedCssSky } from '@cssearth/renderer/sky/types.ts';
import { validatePreparedCssSky } from '@cssearth/renderer/sky/validation.ts';
const RADIUS_UNITS = 1, CSS_PIXELS_PER_UNIT = 50;
function compileFaces(faces: BakedSky['faces']): PreparedCssSky['faces'] {
  return faces.map((face, index) => {
    const polygon: Polygon = { vertices: face.vertices, uvs: face.uvs, texture: face.texturePath,
      textureImageSource: { url: face.texturePath, width: face.widthPx, height: face.heightPx },
      texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
    const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: CSS_PIXELS_PER_UNIT, layerElevation: CSS_PIXELS_PER_UNIT, seamBleed: 0 });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    if (!geometry) throw new TypeError(`PolyCSS could not prepare sky face ${face.id}.`);
    // A face is drawn like any prepared image leaf: PolyCSS gave a 1536 px face a 1536 px box, which WebKit backed at
    // 4608 px on a DPR 3 phone (85 MB per face).
    return { id: face.id, texturePath: face.texturePath, widthPx: face.widthPx, heightPx: face.heightPx,
      forwardIcrf: face.forwardIcrf, rightIcrf: face.rightIcrf, upIcrf: face.upIcrf, ...compileVolumeLeaf(geometry, face.widthPx) };
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
