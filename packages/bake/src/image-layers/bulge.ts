import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import type { ImageLayerRecipe, Vec3 } from './config.ts';
import { imageLayerDisc, norm, rad } from './disc.ts';

/** A galaxy's bulge as a published bulge-plus-disc fit of its sky light: a Sérsic bulge and an exponential disc, each on
 * elliptical isophotes sharing one position angle (Dorman et al. 2013, Sect. 4.1.1, eqs. 1-4). The fit gives, at any
 * sky position, the bulge's share of the light; the photograph's light there is split by that share, and the bulge's part
 * is spread through an oblate spheroid instead of the disc, so it stays round seen from any side. */
export type ImageLayerBulge = NonNullable<ImageLayerRecipe['geometry']['bulge']>;

/** The Sérsic constant as the fit used it: A_n = 1.9992 n - 0.3271 (Capaccioli 1989, in Dorman et al. 2013 eq. 1). */
const sersicB = (n: number) => 1.9992 * n - 0.3271;

export function imageLayerBulgeModel(recipe: Pick<ImageLayerRecipe, 'target' | 'geometry'>) {
  const bulge = recipe.geometry.bulge;
  if (!bulge) throw new TypeError('The recipe has no geometry.bulge.');
  const disc = imageLayerDisc(recipe), pa = rad(recipe.geometry.lineOfNodesPaDeg), inclination = rad(recipe.geometry.inclinationDeg);
  const n = bulge.sersicIndex, b = sersicB(n), re = bulge.halfLightRadiusKpc;
  // Surface brightness in magnitudes per square arcsecond, as linear intensity.
  const bulgeIb = 10 ** (-0.4 * bulge.surfaceBrightnessAtHalfLight), discI0 = 10 ** (-0.4 * bulge.disc.centralSurfaceBrightness);
  // Elliptical radius on the sky (Dorman et al. 2013, eq. 2): R sqrt(cos² ΔPA + sin² ΔPA / (1 - ε)²).
  const elliptical = (major: number, minor: number, ellipticity: number) => Math.hypot(major, minor / (1 - ellipticity));
  const lineNodes: Vec3 = [Math.sin(pa), Math.cos(pa), 0], diskMinor = norm(cross(disc.diskNormal, lineNodes));
  // The fit's own position angle, which may differ from the disc's line of nodes.
  const fitPa = rad(bulge.positionAngleDeg);
  /** The bulge's share of the fitted light at a sky offset from the centre: kpc at the galaxy's distance, east and north. */
  const share = (east: number, north: number) => {
    const major = east * Math.sin(fitPa) + north * Math.cos(fitPa), minor = -east * Math.cos(fitPa) + north * Math.sin(fitPa);
    const rb = elliptical(major, minor, bulge.skyEllipticity), rd = elliptical(major, minor, bulge.disc.skyEllipticity);
    const sb = bulgeIb * Math.exp(-b * ((rb / re) ** (1 / n) - 1)), sd = discI0 * Math.exp(-rd / bulge.disc.scaleLengthKpc);
    return sb / (sb + sd);
  };
  /** The fitted surface brightness of the bulge and the disc at a sky offset (east, north, kpc), as linear intensity. */
  const light = (east: number, north: number) => {
    const major = east * Math.sin(fitPa) + north * Math.cos(fitPa), minor = -east * Math.cos(fitPa) + north * Math.sin(fitPa);
    const rb = elliptical(major, minor, bulge.skyEllipticity), rd = elliptical(major, minor, bulge.disc.skyEllipticity);
    return { bulge: bulgeIb * Math.exp(-b * ((rb / re) ** (1 / n) - 1)), disc: discI0 * Math.exp(-rd / bulge.disc.scaleLengthKpc) };
  };
  // The oblate spheroid that projects to the fitted sky ellipticity at the disc's inclination:
  // q_sky² = cos² i + q0² sin² i.
  const qSky = 1 - bulge.skyEllipticity, q0Squared = (qSky * qSky - Math.cos(inclination) ** 2) / Math.sin(inclination) ** 2;
  if (!(q0Squared > 0 && q0Squared <= 1)) {
    throw new RangeError(`${JSON.stringify(bulge.source)}: a bulge sky ellipticity of ${bulge.skyEllipticity} cannot come from an oblate spheroid seen at inclination ${recipe.geometry.inclinationDeg}° (q0² = ${q0Squared}).`);
  }
  const q0 = Math.sqrt(q0Squared);
  // The deprojected Sérsic density (Prugniel & Simien 1997; p from Lima Neto et al. 1999), up to a constant.
  const p = 1 - 0.6097 / n + 0.05463 / (n * n), core = re / 100;
  /** Relative bulge density at a point in the galaxy's local frame (kpc from the centre, east/north/sight-line axes). */
  const density = (point: Vec3) => {
    const x = dot(point, lineNodes), y = dot(point, diskMinor), z = dot(point, disc.diskNormal);
    const m = Math.max(core, Math.hypot(x, y, z / q0)) / re;
    return m ** -p * Math.exp(-b * m ** (1 / n));
  };
  /** A local-frame point as its sky offset from the centre (kpc east and north at the galaxy's distance), for the share. */
  const skyOffset = (point: Vec3): [number, number] => {
    const scale = disc.distanceKpc / (disc.distanceKpc + point[2]);
    return [point[0] * scale, point[1] * scale];
  };
  return { bulge, q0, share, light, density, skyOffset, lineNodes, diskMinor, disc };
}
