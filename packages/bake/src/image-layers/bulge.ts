import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import type { ImageLayerRecipe, Vec3 } from './config.ts';
import { imageLayerDisc, norm, rad } from './disc.ts';

/** A galaxy's bulge as a published bulge-plus-disc fit of its sky light: a Sérsic bulge and an exponential disc, each on
 * elliptical isophotes (Dorman et al. 2013, Sect. 4.1.1, eqs. 1-4, with one position angle; S4G's fits give each its own). The fit gives, at any
 * sky position, the bulge's share of the light; the photograph's light there is split by that share, and the bulge's part
 * is spread through an oblate spheroid instead of the disc, so it stays round seen from any side. */
export type ImageLayerBulge = NonNullable<ImageLayerRecipe['geometry']['bulge']>;

/** Modified Bessel functions I1 and K1 (Abramowitz & Stegun 1964, 9.8.3, 9.8.7 and 9.8.8), to about 1e-7. */
const besselI1 = (x: number) => { const t = (x / 3.75) ** 2; return x * (0.5 + t * (0.87890594 + t * (0.51498869 + t * (0.15084934 + t * (0.02658733 + t * (0.00301532 + t * 0.00032411)))))); };
export const besselK1 = (x: number): number => {
  if (x <= 2) { const t = x * x / 4; return Math.log(x / 2) * besselI1(x) + (1 + t * (0.15443144 + t * (-0.67278579 + t * (-0.18156897 + t * (-0.01919402 + t * (-0.00110404 + t * -0.00004686)))))) / x; }
  const t = 2 / x; return Math.exp(-x) / Math.sqrt(x) * (1.25331414 + t * (0.23498619 + t * (-0.0365562 + t * (0.01504268 + t * (-0.00780353 + t * (0.00325614 + t * -0.00068245))))));
};

/** The Sérsic constant as the fit used it: A_n = 1.9992 n - 0.3271 (Capaccioli 1989, in Dorman et al. 2013 eq. 1). */
const sersicB = (n: number) => 1.9992 * n - 0.3271;

export function imageLayerBulgeModel(recipe: Pick<ImageLayerRecipe, 'target' | 'geometry'>) {
  const bulge = recipe.geometry.bulge;
  if (!bulge) throw new TypeError('The recipe has no geometry.bulge.');
  // The spheroid is flattened along the galaxy's disc normal: the picture's own disc, or `galaxyDisc` where the picture
  // stands off it (a picture facing the Sun).
  const own = bulge.galaxyDisc, inclinationDeg = own?.inclinationDeg ?? recipe.geometry.inclinationDeg, paDeg = own?.lineOfNodesPaDeg ?? recipe.geometry.lineOfNodesPaDeg;
  const disc = imageLayerDisc(recipe), pa = rad(paDeg), inclination = rad(inclinationDeg);
  const spheroidNormal = own ? imageLayerDisc({ target: recipe.target, geometry: { ...recipe.geometry, inclinationDeg, lineOfNodesPaDeg: paDeg } }).diskNormal : disc.diskNormal;
  const n = bulge.sersicIndex, b = sersicB(n), re = bulge.halfLightRadiusKpc;
  // Surface brightness in magnitudes per square arcsecond, as linear intensity.
  const exponential = bulge.disc, bulgeIb = 10 ** (-0.4 * bulge.surfaceBrightnessAtHalfLight), discI0 = exponential ? 10 ** (-0.4 * exponential.centralSurfaceBrightness) : 0;
  // Elliptical radius on the sky (Dorman et al. 2013, eq. 2): R sqrt(cos² ΔPA + sin² ΔPA / (1 - ε)²).
  const elliptical = (major: number, minor: number, ellipticity: number) => Math.hypot(major, minor / (1 - ellipticity));
  const lineNodes: Vec3 = [Math.sin(pa), Math.cos(pa), 0], diskMinor = norm(cross(spheroidNormal, lineNodes));
  // The fit's own position angles (one for both components unless the disc has its own), which may differ from the
  // disc's line of nodes.
  const fitPa = rad(bulge.positionAngleDeg), discPa = rad(exponential?.positionAngleDeg ?? bulge.positionAngleDeg);
  const along = (east: number, north: number, pa: number) => [east * Math.sin(pa) + north * Math.cos(pa), -east * Math.cos(pa) + north * Math.sin(pa)] as const;
  const radii = (east: number, north: number) => ({ rb: elliptical(...along(east, north, fitPa), bulge.skyEllipticity), rd: exponential ? elliptical(...along(east, north, discPa), exponential.skyEllipticity) : 0 });
  // A fit with two exponential discs (S4G's two-disc models): the second disc's light is disc light too.
  const second = bulge.secondDisc, secondI0 = second ? 10 ** (-0.4 * second.centralSurfaceBrightness) : 0, secondPa = rad(second?.positionAngleDeg ?? exponential?.positionAngleDeg ?? bulge.positionAngleDeg);
  // A fitted bar is disc light as well: a modified Ferrers profile, I0 (1 - (r / radius)²)² inside its radius.
  const bar = bulge.bar, barI0 = bar ? 10 ** (-0.4 * bar.centralSurfaceBrightness) : 0;
  const barLight = (east: number, north: number) => {
    if (!bar) return 0;
    const r = elliptical(...along(east, north, rad(bar.positionAngleDeg)), bar.skyEllipticity) / bar.radiusKpc;
    return r < 1 ? barI0 * (1 - r * r) ** 2 : 0;
  };
  // An edge-on disc: I0 (r / hr) K1(r / hr) sech²(z / hz), r along its position angle and z across it; (r / hr) K1 tends to 1 at the centre.
  const edge = bulge.edgeDisc, edgeI0 = edge ? 10 ** (-0.4 * edge.centralSurfaceBrightness) : 0;
  const edgeLight = (east: number, north: number) => {
    if (!edge) return 0;
    const [major, minor] = along(east, north, rad(edge.positionAngleDeg)), r = Math.abs(major) / edge.scaleLengthKpc;
    return edgeI0 * (r < 1e-6 ? 1 : r * besselK1(r)) / Math.cosh(minor / edge.scaleHeightKpc) ** 2;
  };
  const discLight = (east: number, north: number, rd: number) => (exponential ? discI0 * Math.exp(-rd / exponential.scaleLengthKpc) : 0) + barLight(east, north) + edgeLight(east, north) +
    (second ? secondI0 * Math.exp(-elliptical(...along(east, north, secondPa), second.skyEllipticity) / second.scaleLengthKpc) : 0);
  /** The bulge's share of the fitted light at a sky offset from the centre: kpc at the galaxy's distance, east and north. */
  // A fit whose bulge falls off more slowly than its disc (a high Sérsic index) keeps a share far out, where that light
  // is the disc's; `extentKpc.fadeFrom` fades the share to nothing between it and `extentKpc.radius` on the sky.
  const fadeFrom = bulge.extentKpc.fadeFrom, reach = bulge.extentKpc.radius;
  // On the sky the fade follows the spheroid's own outline (its ellipse about the line of nodes, with the fitted axis
  // ratio), so every sight line that still carries bulge light passes through the spheroid that will hold it.
  const fade = (east: number, north: number) => {
    if (fadeFrom === undefined) return 1;
    const [major, minor] = along(east, north, pa), t = Math.max(0, Math.min(1, (reach - Math.hypot(major, minor / (1 - bulge.skyEllipticity))) / (reach - fadeFrom)));
    return t * t * (3 - 2 * t);
  };
  const share = (east: number, north: number) => {
    const { rb, rd } = radii(east, north);
    const sb = bulgeIb * Math.exp(-b * ((rb / re) ** (1 / n) - 1)), sd = discLight(east, north, rd);
    return sb / (sb + sd) * fade(east, north);
  };
  /** The fitted surface brightness of the bulge and the disc at a sky offset (east, north, kpc), as linear intensity. */
  const light = (east: number, north: number) => {
    const { rb, rd } = radii(east, north);
    return { bulge: bulgeIb * Math.exp(-b * ((rb / re) ** (1 / n) - 1)), disc: discLight(east, north, rd) };
  };
  // The oblate spheroid that projects to the fitted sky ellipticity at the disc's inclination:
  // q_sky² = cos² i + q0² sin² i.
  const qSky = 1 - bulge.skyEllipticity, q0Squared = (qSky * qSky - Math.cos(inclination) ** 2) / Math.sin(inclination) ** 2;
  if (!(q0Squared > 0 && q0Squared <= 1)) {
    throw new RangeError(`${JSON.stringify(bulge.source)}: a bulge sky ellipticity of ${bulge.skyEllipticity} cannot come from an oblate spheroid seen at inclination ${inclinationDeg}° (q0² = ${q0Squared}).`);
  }
  const q0 = Math.sqrt(q0Squared);
  // The deprojected Sérsic density (Prugniel & Simien 1997; p from Lima Neto et al. 1999), up to a constant.
  const p = 1 - 0.6097 / n + 0.05463 / (n * n), core = re / 100;
  /** Relative bulge density at a point in the galaxy's local frame (kpc from the centre, east/north/sight-line axes). */
  const density = (point: Vec3) => {
    const x = dot(point, lineNodes), y = dot(point, diskMinor), z = dot(point, spheroidNormal);
    // The spheroid ends on its own surface: with `extentKpc.fadeFrom` the density fades to nothing between that
    // spheroidal radius and `extentKpc.radius`, so the bulge's edge is a spheroid from every side and never the box of
    // slices that holds it.
    const spheroidal = Math.hypot(x, y, z / q0), m = Math.max(core, spheroidal) / re;
    const edge = fadeFrom === undefined ? 1 : Math.max(0, Math.min(1, (reach - spheroidal) / (reach - fadeFrom)));
    return m ** -p * Math.exp(-b * m ** (1 / n)) * edge * edge * (3 - 2 * edge);
  };
  /** A local-frame point as its sky offset from the centre (kpc east and north at the galaxy's distance), for the share. */
  const skyOffset = (point: Vec3): [number, number] => {
    const scale = disc.distanceKpc / (disc.distanceKpc + point[2]);
    return [point[0] * scale, point[1] * scale];
  };
  return { bulge, q0, share, fade, light, density, skyOffset, lineNodes, diskMinor, spheroidNormal, disc };
}
