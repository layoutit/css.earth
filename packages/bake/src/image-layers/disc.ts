import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import type { ImageLayerRecipe, Vec3 } from './config.ts';

export const rad = (n: number): number => n * Math.PI / 180;
export const unit = (raDeg: number, decDeg: number): Vec3 => {
  const ra = rad(raDeg), dec = rad(decDeg), c = Math.cos(dec); return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
};
export const norm = (a: Vec3): Vec3 => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };

/** The inclined disc an image-layer bank is placed on: the target's sky basis (east, north, and the sight line to it)
 * and the disc normal in that basis, from the recipe's inclination and line of nodes. The layers and anything placed
 * on the same disc (catalogue dots) share this one construction. */
export function imageLayerDisc(recipe: Pick<ImageLayerRecipe, 'target' | 'geometry'>) {
  const inclination = rad(recipe.geometry.inclinationDeg), pa = rad(recipe.geometry.lineOfNodesPaDeg);
  const target = unit(recipe.target.centerRaDeg, recipe.target.centerDecDeg), north = norm([-Math.cos(rad(recipe.target.centerRaDeg)) * Math.sin(rad(recipe.target.centerDecDeg)), -Math.sin(rad(recipe.target.centerRaDeg)) * Math.sin(rad(recipe.target.centerDecDeg)), Math.cos(rad(recipe.target.centerDecDeg))]);
  const east = norm(cross(north, target));
  const diskNormal: Vec3 = [Math.sin(inclination) * Math.cos(pa), -Math.sin(inclination) * Math.sin(pa), Math.cos(inclination)];
  return { target, north, east, diskNormal, distanceKpc: recipe.target.distancePc / 1000 };
}

/** Distance from the Sun, in kpc, along the sight line to (ra, dec) to where it crosses the disc's midplane: the
 * image-layer bake's own intersection, so a point placed here lies on its layers' midplane. */
export function imageLayerDiscDistanceKpc(disc: ReturnType<typeof imageLayerDisc>, raDeg: number, decDeg: number): number {
  const ray = unit(raDeg, decDeg), local: Vec3 = [dot(ray, disc.east), dot(ray, disc.north), dot(ray, disc.target)];
  const t = dot(disc.diskNormal, [0, 0, disc.distanceKpc]) / dot(disc.diskNormal, local);
  if (!(t > 0)) throw new RangeError(`The sight line to RA ${raDeg}°, Dec ${decDeg}° never meets the disc in front of the Sun.`);
  return t;
}

/** The photograph's own sky projection: a gnomonic view centred on the observation, rotated by its north angle, over the
 * parent field of view, with an optional crop window of the parent. `ray` gives the ICRS sight line of crop coordinates
 * (u, v in [-1, 1], v up); `crop` is its inverse, for placing a sky position on the image. */
export function imageLayerView(recipe: Pick<ImageLayerRecipe, 'source' | 'observation'>) {
  const o = recipe.observation, theta = rad(o.northClockwiseDeg), obs = unit(o.centerRaDeg, o.centerDecDeg);
  const obsNorth = norm([-Math.cos(rad(o.centerRaDeg)) * Math.sin(rad(o.centerDecDeg)), -Math.sin(rad(o.centerRaDeg)) * Math.sin(rad(o.centerDecDeg)), Math.cos(rad(o.centerDecDeg))]);
  const obsEast = norm(cross(obsNorth, obs));
  const right: Vec3 = [0, 1, 2].map(i => obsNorth[i]! * Math.sin(theta) - obsEast[i]! * Math.cos(theta)) as Vec3;
  const up: Vec3 = [0, 1, 2].map(i => obsNorth[i]! * Math.cos(theta) + obsEast[i]! * Math.sin(theta)) as Vec3;
  const tanX = Math.tan(rad(o.fieldOfViewDeg[0]) / 2), tanY = Math.tan(rad(o.fieldOfViewDeg[1]) / 2);
  const window = recipe.source.parentPixelWindow, [ow, oh] = recipe.source.originalDimensions;
  const ray = (u: number, v: number): Vec3 => {
    let fullU = u, fullV = v;
    if (window) { const [x, y, w, h] = window; fullU = 2 * (x + (u + 1) * w / 2) / ow - 1; fullV = 1 - 2 * (y + (1 - v) * h / 2) / oh; }
    return norm([0, 1, 2].map(i => obs[i]! + right[i]! * fullU * tanX + up[i]! * fullV * tanY) as Vec3);
  };
  const crop = (raDeg: number, decDeg: number): [number, number] | null => {
    const sky = unit(raDeg, decDeg), along = dot(sky, obs);
    if (!(along > 0)) return null;
    const fullU = dot(sky, right) / along / tanX, fullV = dot(sky, up) / along / tanY;
    if (!window) return [fullU, fullV];
    const [x, y, w, h] = window;
    return [2 * ((fullU + 1) * ow / 2 - x) / w - 1, 1 - 2 * ((1 - fullV) * oh / 2 - y) / h];
  };
  return { ray, crop };
}
