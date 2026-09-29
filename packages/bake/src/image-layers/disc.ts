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
