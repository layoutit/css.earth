/** Static PolyCSS cube geometry in physical ICRF axes; the renderer owns its one axis reflection. */
import { compileLeafBounds } from './leaf-bounds.js';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { BakedSky } from '../../../preparation/sky/bake.js';
import type { PreparedCssSky } from '../sky/types.js';
import { validatePreparedCssSky } from '../sky/validation.js';
export function compileCssSky(baked: BakedSky, frame: DensityVolumeFrame) {
  const radiusUnits = 1, cssPixelsPerUnit = 50;
  const resources = baked.faces.map(face => ({ path: face.texturePath, width: face.widthPx, height: face.heightPx, bytes: face.bytes, sha256: face.sha256 }));
  const sky: PreparedCssSky = { schema: 'cssearth-css-sky@1', referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, radiusUnits,
    ...(baked.parallax ? { parallax: { originM: [...baked.parallax.originM] as [number, number, number],
      metersPerCssPixel: baked.parallax.radiusM / (radiusUnits * cssPixelsPerUnit) } } : {}),
    faces: baked.faces.map((face, index) => {
      const polygon: Polygon = { vertices: face.vertices, uvs: face.uvs, texture: face.texturePath,
        textureImageSource: { url: face.texturePath, width: face.widthPx, height: face.heightPx },
        texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
      const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: cssPixelsPerUnit, layerElevation: cssPixelsPerUnit, seamBleed: 0 });
      const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
      if (!geometry) throw new TypeError(`PolyCSS could not prepare sky face ${face.id}.`);
      return { id: face.id, texturePath: face.texturePath, widthPx: face.widthPx, heightPx: face.heightPx,
        forwardIcrf: face.forwardIcrf, rightIcrf: face.rightIcrf, upIcrf: face.upIcrf,
        boundsCssPixels: compileLeafBounds(geometry.matrix, geometry.leafWidth, geometry.leafHeight),
        style: { width: `${geometry.leafWidth}px`, height: `${geometry.leafHeight}px`, transform: `matrix3d(${geometry.matrix})`,
          backgroundSize: geometry.backgroundSize.map(n => `${n}px`).join(' '), backgroundPosition: geometry.backgroundPosition.map(n => `${n}px`).join(' ') } };
    }), provenance: baked.provenance, approximation: baked.approximation };
  validatePreparedCssSky(sky, resources); return { sky, resources };
}
