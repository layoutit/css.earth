import type {createPreparedNodeTree,PreparedNode} from '../../prepared/prepared-node-tree.mts';
import type {PreparedMaterialTrack,PreparedMaterialSelection} from '@cssearth/renderer/rendering/prepared-material.ts';
import type {PreparedViewBinding} from '@cssearth/renderer/rendering/prepared-presentation.ts';
interface LightingContext {builder:ReturnType<typeof createPreparedNodeTree>;root:PreparedNode;axes:readonly number[];config:{displayRadius:number};scene:{systemTransform:string;camera:{initialScenePitchDegrees:number;defaultControlYawDegrees:number}};
  /** The published lighting image's pixel size, measured from its file. */
  image:{width:number;height:number};objectId:string;}
import { BASE_TILE } from '@layoutit/polycss';
import { leafRasterScale } from '../../../src/platform/projective-surface-raster.mts';
import { readPreparedMatrix4, preparedRotationMatrix4, multiplyPreparedMatrix4, invertPreparedAffineMatrix4 } from '@cssearth/core';

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translation = (x:number, y:number, z:number) => Object.assign(identity(), { 12: x, 13: y, 14: z });

/** The prepared full-phase disc uses the existing ellipsoid material contract.
 * Its plane stays in the retained 3D scene so foreground rings can occlude it.
 * This is illustrative curvature shading, not a measured reflectance model.
 */
export function prepareShapeLighting({ builder: b, root, axes, config, scene, image, objectId }:LightingContext) {
  if (image.width !== image.height) throw new TypeError(`${objectId}: the shape lighting image must be square, not ${image.width}×${image.height} px.`);
  // Keep the CSS leaf at texture size: a world-sized leaf exceeds Chrome's raster extent even when the camera later scales it
  // down. The image fills the leaf at two texels per CSS pixel (leafRasterScale), since WebKit backs the leaf at its box size
  // whatever its transform. Every value below follows `width`, so the plate still covers the same projected disc.
  const radius = config.displayRadius * BASE_TILE, width = image.width * leafRasterScale(image.width, image.width, 1), half = width / 2;
  const counter = b.mesh('shape-model-lighting-counter');
  const leaf = b.element('s', 'shape-model-lighting', `width:${width}px;height:${width}px`);
  b.append(root, counter); b.append(counter, leaf);
  const bodyMeshMatrix = identity();
  // PolyCSS maps world Y to CSS X and world X to CSS Y.
  bodyMeshMatrix[0] = axes[1] / axes[0];
  const systemTransform = `matrix3d(${identity().join(',')})`;
  // Counter-rotation is relative to the prepared view, not the camera's axes.
  const reference = multiplyPreparedMatrix4(
    preparedRotationMatrix4('x', scene.camera.initialScenePitchDegrees),
    preparedRotationMatrix4('y', scene.camera.defaultControlYawDegrees));
  const pixelsToScene = identity();
  pixelsToScene[0] = pixelsToScene[5] = radius / half;
  const projection = {
    equatorialRadius: radius, polarRadius: radius * axes[2] / axes[0], coverageScale: 1,
    bodySystemMatrix: readPreparedMatrix4(scene.systemTransform), bodyMeshMatrix,
    materialSystemMatrix: identity(), materialMeshMatrix: identity(),
    baseProjection: multiplyPreparedMatrix4(invertPreparedAffineMatrix4(reference),
      multiplyPreparedMatrix4(translation(-radius, -radius, radius * 1.001), pixelsToScene)),
    centerTranslation: translation(half, half, 0),
    inverseCenterTranslation: translation(-half, -half, 0),
  };
  const address = { resource: 'lighting', frame: 0, row: null,
    backgroundPosition: '0px 0px', backgroundSize: `${width}px ${width}px` };
  return { counter, leaf,
    track: (target:number):PreparedMaterialTrack & {frame:PreparedMaterialTrack["frame"] & {count:number}} => ({ id: 'curvature', target, frame: { count: 1, thresholds: [], indices: [0] }, defaultFrame: 0,
      banks: [{ id: 'full-phase', frames: [address], default: null, fixed: address }],
      rotation: { kind: 'ellipsoid', width, height: width, projection, systemTransform,
        reference: 'prepared', baseDegrees: 0, zeroAtPole: false },
      frameAttribute: null, modeAttribute: null, quoted: true }),
    selection: { track: 'curvature', bank: 'full-phase', mode: 'fixed', fixedMode: 'full-phase',
      enabled: true, rotationEnabled: false, frameOverride: null, clearWhenHidden: false } satisfies PreparedMaterialSelection,
    binding: (target:number):PreparedViewBinding => ({ kind: 'counter-rotation', target, systemTransform: null }),
  };
}
