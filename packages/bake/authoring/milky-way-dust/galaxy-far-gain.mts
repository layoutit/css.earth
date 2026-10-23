import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { cameraPoseToReferenceFrame, presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { PreparedCssVolume } from '@cssearth/objects';
import { axisWeights, preparedVolumeCameraTransform } from '../../../renderer/src/volume/prepared-volume-projection.ts';
import { mergedOpticalOpacity } from '../../../renderer/src/volume/optical-opacity.ts';
import { decodeLightImage, integratedStackLight, projectLightImage } from './galaxy-far-projection.mts';

/** Fit actual projected columns, including their depth-dependent overlap. Calibration samples the positive octant
 * at 2.5-degree pole intervals along the two principal meridians and their bisector. It is a finite-distance fit:
 * distance 6.25 long frame extents, focal 900px. This does not qualify every azimuth, distance or reverse-side order.
 * Gain alone is the runtime input; multiple azimuths at equal gain share a least-squares total-light coefficient. */
export async function fitProjectedGalaxyGain(volume: PreparedCssVolume, prepared: string): Promise<NonNullable<PreparedCssVolume['farPlanes']>['gainBlend']> {
  const directory = pathToFileURL(resolve(prepared) + '/'), axes = ['z'] as const;
  const slabs = await Promise.all(axes.map(axis => Promise.all(volume.stacks.find(stack => stack.axis === axis)!.leaves.map(leaf => decodeLightImage(leaf, directory)))));
  const pictures = await Promise.all(axes.map(axis => Promise.all(volume.farPlanes!.stacks.find(stack => stack.axis === axis)!.leaves.map(leaf => decodeLightImage(leaf, directory)))));
  const { min, max } = volume.frame.boundsUnits;
  const centre = min.map((value, index) => (value + max[index]!) / 2);
  const distance = 6.25 * Math.max(...max.map((value, index) => value - min[index]!));
  const fits = axes.map(() => new Map<number, { numerator: number; denominator: number }>());
  // Include the slab saturation boundary; gains above 3 still matter because projected overlap continues changing.
  const poles = [...new Set([...Array.from({ length: 37 }, (_, index) => index * 2.5), Math.acos(1 / 3) * 180 / Math.PI])].sort((a, b) => a - b);
  for (const azimuth of [0, 45, 90]) for (const pole of poles) {
    const phi = azimuth * Math.PI / 180, theta = pole * Math.PI / 180;
    const orientationXyzw = [-Math.sin(phi) * Math.sin(theta / 2), Math.cos(phi) * Math.sin(theta / 2), 0, Math.cos(theta / 2)] as const;
    const positionM = [centre[0]! + distance * Math.sin(theta) * Math.cos(phi), centre[1]! + distance * Math.sin(theta) * Math.sin(phi), centre[2]! + distance * Math.cos(theta)].map(value => value * volume.frame.metersPerUnit);
    const publication = { world: { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      pose: cameraPoseToReferenceFrame({ positionM: [positionM[0]!, positionM[1]!, positionM[2]!], orientationXyzw }, volume.frame) },
    viewport: { widthPixels: 1440, heightPixels: 900, focalPixels: 900, principalOffsetPixels: [0, 0] as const } };
    const strengths = axisWeights(presentPhysicalPoseInVolume(publication.world.pose, volume.frame), volume.stacks, volume.frame.boundsUnits);
    const view = preparedVolumeCameraTransform(publication, volume.frame);
    for (const [axis, strength] of strengths.entries()) {
      if (strength.weight <= 0) continue;
      if (axis !== 2) continue;
      const slot = 0;
      const gain = Math.round(strength.opticalGain * 1e10) / 1e10;
      const projected = pictures[slot]!.map(image => projectLightImage(image, view));
      const low = integratedStackLight(projected, [.999, .001], view.focalPixels, 2);
      const high = integratedStackLight(projected, [.999, .999], view.focalPixels, 2);
      const target = integratedStackLight(slabs[slot]!.map(image => projectLightImage(image, view)), mergedOpticalOpacity(strength.opticalGain), view.focalPixels, 2);
      const slope = (high - low) / .998;
      const fit = fits[slot]!.get(gain) ?? { numerator: 0, denominator: 0 };
      fit.numerator += slope * (target - low + .001 * slope); fit.denominator += slope ** 2;
      fits[slot]!.set(gain, fit);
    }
  }
  return axes.map((axis, index) => {
    const samples: [number, number][] = [...fits[index]!].sort(([a], [b]) => a - b).map(([gain, fit]) =>
      [gain, Math.min(.999, Math.max(.001, fit.denominator > 0 ? fit.numerator / fit.denominator : .001))]);
    const last = samples.at(-1)!;
    if (last[0] < 3) samples.push([3, last[1]]);
    return { axis, samples };
  });
}
