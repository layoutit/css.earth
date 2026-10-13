import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '@cssearth/engine';
import type { DensityVolumeFrame, VolumeSliceQuad, Vector3 } from '@cssearth/objects';

/** The sheets of a density grid's tilted recipe (nebula delivery `grids[].tilted`) in the grid's own frame. A tilted recipe
 * is light on another plane through the same origin, as the inner ring of a disc its stars have broken: a grid in a frame of
 * its own (`own`), with slabs across its z only. Each sheet is turned from that frame into the grid's (`host`) and joins
 * the grid's z stack as a tilted sheet, with slice indices from `firstSliceIndex`; its image stays under `tilted-<index>/`. */
export function tiltedSheetQuads(quads: readonly VolumeSliceQuad[], own: DensityVolumeFrame, host: DensityVolumeFrame, index: number, firstSliceIndex: number): VolumeSliceQuad[] {
  if (own.referenceFrame !== host.referenceFrame || own.epochJdTt !== host.epochJdTt || own.metersPerUnit !== host.metersPerUnit ||
      own.originM.some((value, axis) => value !== host.originM[axis]) || quads.some(quad => quad.axis !== 'z'))
    throw new TypeError('A tilted grid shares its grid\'s reference frame, unit and origin, and has slabs across its z only.');
  const toHost = transposeWorldRotation(worldRotationFromQuaternion(host.localToReferenceXyzw)), fromOwn = worldRotationFromQuaternion(own.localToReferenceXyzw);
  const turn = (point: Vector3): Vector3 => { const turned = rotateWorldPosition(toHost, rotateWorldPosition(fromOwn, point)); return [turned[0], turned[1], turned[2]]; };
  return quads.map((quad, order) => ({ ...quad, id: `z-tilted-${index}-${quad.sliceIndex}`, tilted: true as const, sliceIndex: firstSliceIndex + order,
    texturePath: `tilted-${index}/${quad.texturePath}`, center: turn(quad.center), normal: turn(quad.normal),
    vertices: [turn(quad.vertices[0]), turn(quad.vertices[1]), turn(quad.vertices[2]), turn(quad.vertices[3])] }));
}
