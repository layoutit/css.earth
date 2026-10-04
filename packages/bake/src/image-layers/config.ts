import { requireNonemptyString as text } from '@cssearth/core';
import type { PreparedImageLayerBank } from '@cssearth/objects';
export type Vec3 = [number, number, number];
export type LayerAxis = 'x' | 'y' | 'z';

export interface ImageLayerRecipe {
  schema: 'cssearth-image-layer-recipe@1';
  id: string;
  source: { path: string; dimensions: [number, number]; originalDimensions: [number, number];
    parentPixelWindow?: [number, number, number, number]; publisherUrl: string; downloadUrl: string; credit: string;
    /** `CC-BY` is an attribution licence stated without a version, as the Sloan Digital Sky Survey states its images'. */
    license: 'CC-BY-4.0' | 'CC-BY';
    /** Milky Way stars in front of the galaxy, removed from the photograph before its layers are cut (./foreground.ts). */
    foregroundStars?: { path: string; raDegColumn: string; decDegColumn: string; gMagColumn: string; source: string; basis: string };
    /** Companion galaxies removed the same way, by their rows (key column) in a repository catalogue with the Local Volume
     * Database's columns: ra, dec (deg), rhalf (arcmin), position_angle (deg), ellipticity. */
    companions?: { catalogue: string; keys: string[]; source: string; basis: string } };
  observation: PreparedImageLayerBank['observation'];
  target: { centerRaDeg: number; centerDecDeg: number; distancePc: number };
  geometry: { kind: 'inclined-disk' | 'line-of-sight-envelope'; inclinationDeg: number; lineOfNodesPaDeg: number;
    thicknessKpc: number; supportRadiusKpc: number; supportTaperFraction: number; depthWeights: number[]; depthScales: number[];
    /** The bank's unit when it is not the kiloparsec: parsecs, for an object a few parsecs across (a nebula), whose leaves in
     * kiloparsecs would be smaller than one CSS pixel. The recipe's lengths stay in kiloparsecs. A flat bank without a bulge only. */
    unit?: 'pc';
    /** A nebula's published walls (./shape.ts). Spectra give each emission line's speed along the sight line across the
     * nebula, a velocity ellipse; with the published expansion law (`expansionKmSPerArcsec`: speed grows in proportion to
     * distance from the star) a speed is a depth, so each ellipse is an ellipsoidal wall. `ring` is the main shell: its
     * outline on the sky and, for the display's red, green and blue channels, the speed of the lines that make that
     * channel. Its pole is tipped `polarTiltDeg` from the sight line, the near end leaning to position angle
     * `polarLeansToPaDeg`. `lobe` is the body through the shell's opening, on the same axis. `inner` is a closed shell
     * inside the main one, on the same axis, where a paper gives each shell its own expansion law: its outline in its
     * equatorial plane, its speed along the pole and its own law. `speeds` are measured speeds along the sight line at
     * places on the sky (`path`: a table of whitespace-separated columns, counted from 0: arcseconds east and north of
     * the star, km/s away from the Sun). Inside `inner` a feature measured approaching is on the wall in front of the
     * star and one receding on the wall behind it (`restKmS` either way is all one wall). Outside it the detail lies
     * on one surface: the equatorial plane where it is at rest, the wall its speed points to where it reaches
     * `wallKmS`. With `depth` "speed" a measured speed is its own depth under the law, on no wall: the fine detail
     * lies on two surfaces, in front of the star's plane where the speeds approach and behind it where they recede.
     * The fine detail nothing measures stays on the picture's plane, and `ring` is then the shell the smooth light lies
     * on: its broad part half on each wall, the rest on the far wall. A place follows the measurements within about `reachArcsec`.
     * Every value is one a paper prints. `starRadiusArcsec` is
     * how far the central star's own light reaches in the picture: that light stays at the star, on no wall.
     * `smoothPixels` is presentation: the radius, in face pixels, of the smooth light the far wall carries. */
    shape?: { source: string; basis: string; expansionKmSPerArcsec: number;
      ring: { semiMajorArcsec: number; semiMinorArcsec: number; majorPaDeg: number; polarTiltDeg: number; polarLeansToPaDeg: number; expansionKmS: [number, number, number] };
      lobe?: { source: string; radiusArcsec: number; expansionKmS: [number, number, number] };
      inner?: { source: string; semiMajorArcsec: number; semiMinorArcsec: number; majorPaDeg: number; expansionKmSPerArcsec: number; expansionKmS: [number, number, number] };
      speeds?: { source: string; basis: string; path: string; columns: { east: number; north: number; kmS: number }; reachArcsec: number } & ({ depth?: 'wall'; restKmS: number; wallKmS: number } | { depth: 'speed' }); starRadiusArcsec?: number; smoothPixels: number };
    /** A nebula's published filled body (./body.ts): a spheroid of gas that emits evenly, `semiPolarArcsec` along its pole
     * and `semiEquatorialArcsec` across it, the pole tipped `polarTiltDeg` from the sight line with its near end leaning to
     * position angle `polarLeansToPaDeg`. `envelope` is a filled sphere around it, the nebula's outline. `cavities` are regions along the pole that emit `emission` of the body's emissivity, each about
     * `sizeArcsec` across; they lie behind the star between the position angles `farBetweenPaDeg` and in front of it
     * elsewhere. Every value is one a paper prints or states. */
    /** A nebula's published rings (./rings.ts): a filled disc and the ring around it, circles of `radiusArcsec` in two
     * planes through the star, each tilted its own way: the axis `tiltDeg` from the sight line, its far end leaning to
     * position angle `farAxisPaDeg`. With `lineOfSightThicknessArcsec` each has that much depth along the sight line.
     * Every value is one a paper prints. */
    rings?: { source: string; basis: string; disc: { radiusArcsec: number; tiltDeg: number; farAxisPaDeg: number }; ring: { radiusArcsec: number; tiltDeg: number; farAxisPaDeg: number };
      lineOfSightThicknessArcsec?: number };
    /** A nebula's published surface (./surface.ts): a closed mesh a paper made from spectra (`path`, a binary STL whose z
     * axis is the nebula's pole), placed on the sky. `arcsecPerUnit` is the file's unit on the sky and `originUnits` the
     * star in the file's units. `pole.tiltDeg` is the pole's angle from the sight line, `pole.paDeg` the position angle
     * its receding end points to, `pole.rollDeg` the file's turn about the pole and `pole.receding` the end of the file's
     * z axis that recedes. The picture's light inside the surface's outline lies on the side that faces the Sun.
     * `starRadiusArcsec` is how far the central star's own light reaches in the picture: that light stays at the star,
     * on no surface. `fitArcsec` is how closely the drawn patches follow the surface: presentation. */
    surface?: { source: string; basis: string; path: string; arcsecPerUnit: number; originUnits: [number, number, number];
      pole: { tiltDeg: number; paDeg: number; rollDeg: number; receding: '+z' | '-z' }; starRadiusArcsec?: number; fitArcsec: number };
    /** A nebula's published density grid (./density-grid.ts): a cube of gas densities a paper made from velocity cubes, a
     * speed standing for a depth. The file's rows are "x y z density", its first axis outermost. That first axis is the
     * sight line, toward the Sun at its `toward` end ("high" or "low"); its second axis points to position angle
     * `secondAxisPaDeg` on the sky and its third to `thirdAxisPaDeg`, a quarter turn from it. `cells` is the cube's
     * side and `cellArcsec` a cell on the sky; `centreArcsec` is the cube's middle from the star, east and north.
     * `smoothPixels` is the radius over which the picture's smooth light is read, as for walls; `starRadiusArcsec` is
     * how far the central star's own light reaches in the picture: that light stays at the star. */
    densityGrid?: { source: string; basis: string; path: string; cells: number; cellArcsec: number; toward: 'high' | 'low'; secondAxisPaDeg: number; thirdAxisPaDeg: number;
      centreArcsec?: [number, number]; smoothPixels: number; starRadiusArcsec?: number };
    body?: { source: string; basis: string; semiPolarArcsec: number; semiEquatorialArcsec: number; polarTiltDeg: number; polarLeansToPaDeg: number;
      envelope?: { source: string; radiusArcsec: number };
      cavities?: { source: string; emission: number; sizeArcsec: number; farBetweenPaDeg: [number, number] } };
    /** A published bulge-plus-disc fit of the sky light (./bulge.ts): Sérsic bulge, exponential disc, one position angle.
     * Every surface brightness is the component's as projected on the sky, in magnitudes per square arcsecond: a disc's
     * face-on central value (as S4G tabulates it) brightens by 2.5 log10 of its axis ratio. */
    bulge?: { source: string; /** Whose light fills the bulge: a share of the photograph's (default) or the fit's own. */ lightFrom?: 'photograph' | 'fit'; positionAngleDeg: number; sersicIndex: number; halfLightRadiusKpc: number; surfaceBrightnessAtHalfLight: number;
      skyEllipticity: number; /** The fit's exponential disc; a fit of an edge-on galaxy has `edgeDisc` in its place. */ disc?: { centralSurfaceBrightness: number; scaleLengthKpc: number; skyEllipticity: number; positionAngleDeg?: number };
      /** The fit's edge-on disc, I0 (r / hr) K1(r / hr) sech^2(z / hz) along and across its position angle (van der Kruit & Searle 1981, as GALFIT's
       * edgedisk and S4G's Z component): disc light too. Its central surface brightness is as seen, edge-on. */
      edgeDisc?: { centralSurfaceBrightness: number; scaleLengthKpc: number; scaleHeightKpc: number; positionAngleDeg: number };
      /** The galaxy's own disc, where the picture does not lie on it (a picture standing flat, facing the Sun): the spheroid is
       * flattened along this disc's normal and its sky fade follows this line of nodes. Without it the spheroid shares the
       * picture's disc (geometry.inclinationDeg and lineOfNodesPaDeg). */
      galaxyDisc?: { inclinationDeg: number; lineOfNodesPaDeg: number; source: string; basis: string };
      /** The fit's second exponential disc, where it has two: its light counts as the disc's. */
      secondDisc?: { centralSurfaceBrightness: number; scaleLengthKpc: number; skyEllipticity: number; positionAngleDeg?: number };
      /** The fit's bar, a modified Ferrers profile I0 (1 - (r / radius)^2)^2 inside its radius (Salo et al. 2015, eq. 4, with their fixed alpha = 2, beta = 0): disc light too. */
      bar?: { centralSurfaceBrightness: number; radiusKpc: number; skyEllipticity: number; positionAngleDeg: number };
      /** How far the bulge's slices reach: radius on the sky and height either side of the disc, kpc. */
      extentKpc: { radius: number; height: number; /** The share fades to nothing from here out to `radius`. */ fadeFrom?: number } } };
  bake: { maxFacePixels: number; diffuseFacePixels: number;
    /** A levels adjustment of the photograph (0-1 black and white points, then gamma), after star and companion removal. */
    levels?: { black: number; white: number; gamma: number; basis: string };
    /** Ties the photograph's whole-galaxy color to a published integrated B-V: red and blue are scaled in linear light so
     * the light-weighted mean over the disc matches the catalogue color of that index; green and all structure stay. */
    colorTie?: { bv: number; source: string; basis: string }; bulgeSlices?: number; bulgeFacePixels?: number; bulgeCrossSlices?: number; crossAxisSlices: number; crossAxisAlongPixels: number; crossAxisDepthPixels: number;
    backgroundFloor: number; edgeTaperFraction: number; diffuseFraction: number; diffuseSigmaPixels: number;
    /** One midplane image holding the whole observation, as the Milky Way's backing is: no depth slabs, no side banks. */
    flat?: boolean;
    /** `alphaQuality` (0-100, default 100: lossless) is WebP's alpha quality; a lower one trades faint alpha noise for bytes. */
    encoding: { format: 'webp'; quality: number; alphaQuality?: number } };
  provenance: { path: string };
}

const object = (v: unknown, at: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError(`${at} must be an object.`);
  return v as Record<string, unknown>;
};
const finite = (v: unknown, at: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${at} must be finite.`);
  return v;
};
const positive = (v: unknown, at: string, integer = false): number => {
  const n = finite(v, at); if (n <= 0 || (integer && !Number.isInteger(n))) throw new TypeError(`${at} must be positive.`); return n;
};

const path = (v: unknown): string => {
  const p = text(v, 'source path'); if (p.startsWith('/') || p.split('/').includes('..') || /[\\\0]/.test(p)) throw new TypeError('Path must be contained.'); return p;
};
const bulgeOf = (v: unknown): NonNullable<ImageLayerRecipe['geometry']['bulge']> => {
  const b = object(v, 'geometry.bulge'), e = object(b.extentKpc, 'geometry.bulge.extentKpc');
  if (b.disc === undefined && b.edgeDisc === undefined) throw new TypeError('geometry.bulge needs the fit\'s disc: disc (exponential) or edgeDisc (edge-on).');
  const ellipticity = (x: unknown, at: string) => { const n = finite(x, at); if (n < 0 || n >= 1) throw new TypeError(`${at} must be in [0, 1); got ${n}.`); return n; };
  const discOf = (d: Record<string, unknown>, at: string) => ({ centralSurfaceBrightness: finite(d.centralSurfaceBrightness, `${at}.centralSurfaceBrightness`), scaleLengthKpc: positive(d.scaleLengthKpc, `${at}.scaleLengthKpc`),
    skyEllipticity: ellipticity(d.skyEllipticity, `${at}.skyEllipticity`), ...(d.positionAngleDeg===undefined?{}:{positionAngleDeg:finite(d.positionAngleDeg,`${at}.positionAngleDeg`)}) });
  if (b.lightFrom !== undefined && b.lightFrom !== 'photograph' && b.lightFrom !== 'fit') throw new TypeError(`geometry.bulge.lightFrom must be photograph or fit; got ${JSON.stringify(b.lightFrom)}.`);
  return { source: text(b.source, 'geometry.bulge.source'), ...(b.lightFrom===undefined?{}:{lightFrom:b.lightFrom}), positionAngleDeg: finite(b.positionAngleDeg, 'geometry.bulge.positionAngleDeg'),
    sersicIndex: positive(b.sersicIndex, 'geometry.bulge.sersicIndex'), halfLightRadiusKpc: positive(b.halfLightRadiusKpc, 'geometry.bulge.halfLightRadiusKpc'),
    surfaceBrightnessAtHalfLight: finite(b.surfaceBrightnessAtHalfLight, 'geometry.bulge.surfaceBrightnessAtHalfLight'), skyEllipticity: ellipticity(b.skyEllipticity, 'geometry.bulge.skyEllipticity'),
    ...(b.disc===undefined?{}:{disc:discOf(object(b.disc,'geometry.bulge.disc'),'geometry.bulge.disc')}),
    ...(b.edgeDisc===undefined?{}:{edgeDisc:(()=>{const r=object(b.edgeDisc,'geometry.bulge.edgeDisc');return{centralSurfaceBrightness:finite(r.centralSurfaceBrightness,'geometry.bulge.edgeDisc.centralSurfaceBrightness'),scaleLengthKpc:positive(r.scaleLengthKpc,'geometry.bulge.edgeDisc.scaleLengthKpc'),scaleHeightKpc:positive(r.scaleHeightKpc,'geometry.bulge.edgeDisc.scaleHeightKpc'),positionAngleDeg:finite(r.positionAngleDeg,'geometry.bulge.edgeDisc.positionAngleDeg')};})()}),
    ...(b.galaxyDisc===undefined?{}:{galaxyDisc:(()=>{const r=object(b.galaxyDisc,'geometry.bulge.galaxyDisc'),i=finite(r.inclinationDeg,'geometry.bulge.galaxyDisc.inclinationDeg');if(!(i>0&&i<=90))throw new TypeError(`geometry.bulge.galaxyDisc.inclinationDeg must be above 0 and at most 90; got ${i}.`);return{inclinationDeg:i,lineOfNodesPaDeg:finite(r.lineOfNodesPaDeg,'geometry.bulge.galaxyDisc.lineOfNodesPaDeg'),source:text(r.source,'geometry.bulge.galaxyDisc.source'),basis:text(r.basis,'geometry.bulge.galaxyDisc.basis')};})()}),
    ...(b.secondDisc===undefined?{}:{secondDisc:discOf(object(b.secondDisc,'geometry.bulge.secondDisc'),'geometry.bulge.secondDisc')}),
    ...(b.bar===undefined?{}:{bar:(()=>{const r=object(b.bar,'geometry.bulge.bar');return{centralSurfaceBrightness:finite(r.centralSurfaceBrightness,'geometry.bulge.bar.centralSurfaceBrightness'),radiusKpc:positive(r.radiusKpc,'geometry.bulge.bar.radiusKpc'),skyEllipticity:ellipticity(r.skyEllipticity,'geometry.bulge.bar.skyEllipticity'),positionAngleDeg:finite(r.positionAngleDeg,'geometry.bulge.bar.positionAngleDeg')};})()}),
    extentKpc: { radius: positive(e.radius, 'geometry.bulge.extentKpc.radius'), height: positive(e.height, 'geometry.bulge.extentKpc.height'),
      ...(e.fadeFrom===undefined?{}:{fadeFrom:(()=>{const f=positive(e.fadeFrom,'geometry.bulge.extentKpc.fadeFrom');if(f>=Number(e.radius))throw new TypeError(`geometry.bulge.extentKpc.fadeFrom (${f}) must be inside radius (${String(e.radius)}).`);return f;})()}) } };
};
const shapeOf = (v: unknown): NonNullable<ImageLayerRecipe['geometry']['shape']> => {
  const s = object(v, 'geometry.shape'), r = object(s.ring, 'geometry.shape.ring'), tilt = finite(r.polarTiltDeg, 'geometry.shape.ring.polarTiltDeg'), smooth = finite(s.smoothPixels, 'geometry.shape.smoothPixels');
  const speeds = (value: unknown, name: string): [number, number, number] => { if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${name} holds three speeds, for the red, green and blue channels.`); return [positive(value[0], `${name}[0]`), positive(value[1], `${name}[1]`), positive(value[2], `${name}[2]`)]; };
  if (!(tilt >= 0 && tilt <= 90)) throw new TypeError(`geometry.shape.ring.polarTiltDeg must be from 0 to 90; got ${tilt}.`);
  if (!(Number.isInteger(smooth) && smooth >= 1 && smooth <= 64)) throw new TypeError(`geometry.shape.smoothPixels must be a whole number from 1 to 64; got ${smooth}.`);
  const lobe = s.lobe === undefined ? undefined : object(s.lobe, 'geometry.shape.lobe'), inner = s.inner === undefined ? undefined : object(s.inner, 'geometry.shape.inner'), measured = s.speeds === undefined ? undefined : object(s.speeds, 'geometry.shape.speeds');
  if (lobe && inner) throw new TypeError('geometry.shape takes a lobe through the shell\'s opening or a closed inner shell, not both.');
  const column = (value: unknown, name: string) => { const index = finite(value, name); if (!(Number.isInteger(index) && index >= 0)) throw new TypeError(`${name} is a column counted from 0; got ${index}.`); return index; };
  // Where a measured feature lies: on a wall, between the two speeds that say which, or at its own speed's depth.
  const placed = (measured: Record<string, unknown>): { depth?: 'wall'; restKmS: number; wallKmS: number } | { depth: 'speed' } => {
    if (measured.depth !== undefined && measured.depth !== 'wall' && measured.depth !== 'speed') throw new TypeError(`geometry.shape.speeds.depth says where a measured feature lies: "wall" (on the shell's wall its speed points to) or "speed" (as deep as its own speed puts it under the shell's law), not ${JSON.stringify(measured.depth)}.`);
    if (measured.depth === 'speed') { for (const key of ['restKmS', 'wallKmS']) if (measured[key] !== undefined) throw new TypeError(`geometry.shape.speeds.${key} says which wall a feature is on; with depth "speed" no feature is on a wall, so leave it out.`); return { depth: 'speed' }; }
    return { ...(measured.depth === undefined ? {} : { depth: measured.depth }), restKmS: positive(measured.restKmS, 'geometry.shape.speeds.restKmS'), wallKmS: positive(measured.wallKmS, 'geometry.shape.speeds.wallKmS') }; };
  return { source: text(s.source, 'geometry.shape.source'), basis: text(s.basis, 'geometry.shape.basis'), expansionKmSPerArcsec: positive(s.expansionKmSPerArcsec, 'geometry.shape.expansionKmSPerArcsec'),
    ring: { semiMajorArcsec: positive(r.semiMajorArcsec, 'geometry.shape.ring.semiMajorArcsec'), semiMinorArcsec: positive(r.semiMinorArcsec, 'geometry.shape.ring.semiMinorArcsec'), majorPaDeg: finite(r.majorPaDeg, 'geometry.shape.ring.majorPaDeg'),
      polarTiltDeg: tilt, polarLeansToPaDeg: finite(r.polarLeansToPaDeg, 'geometry.shape.ring.polarLeansToPaDeg'), expansionKmS: speeds(r.expansionKmS, 'geometry.shape.ring.expansionKmS') },
    ...(lobe === undefined ? {} : { lobe: { source: text(lobe.source, 'geometry.shape.lobe.source'), radiusArcsec: positive(lobe.radiusArcsec, 'geometry.shape.lobe.radiusArcsec'), expansionKmS: speeds(lobe.expansionKmS, 'geometry.shape.lobe.expansionKmS') } }),
    ...(inner === undefined ? {} : { inner: { source: text(inner.source, 'geometry.shape.inner.source'), semiMajorArcsec: positive(inner.semiMajorArcsec, 'geometry.shape.inner.semiMajorArcsec'), semiMinorArcsec: positive(inner.semiMinorArcsec, 'geometry.shape.inner.semiMinorArcsec'), majorPaDeg: finite(inner.majorPaDeg, 'geometry.shape.inner.majorPaDeg'),
      expansionKmSPerArcsec: positive(inner.expansionKmSPerArcsec, 'geometry.shape.inner.expansionKmSPerArcsec'), expansionKmS: speeds(inner.expansionKmS, 'geometry.shape.inner.expansionKmS') } }),
    ...(measured === undefined ? {} : { speeds: (() => { const columns = object(measured.columns, 'geometry.shape.speeds.columns'); return { source: text(measured.source, 'geometry.shape.speeds.source'), basis: text(measured.basis, 'geometry.shape.speeds.basis'), path: path(measured.path),
      columns: { east: column(columns.east, 'geometry.shape.speeds.columns.east'), north: column(columns.north, 'geometry.shape.speeds.columns.north'), kmS: column(columns.kmS, 'geometry.shape.speeds.columns.kmS') }, reachArcsec: positive(measured.reachArcsec, 'geometry.shape.speeds.reachArcsec'), ...placed(measured) }; })() }),
    ...(s.starRadiusArcsec === undefined ? {} : { starRadiusArcsec: positive(s.starRadiusArcsec, 'geometry.shape.starRadiusArcsec') }),
    smoothPixels: smooth };
};
const ringsOf = (v: unknown): NonNullable<ImageLayerRecipe['geometry']['rings']> => {
  const r = object(v, 'geometry.rings'), plane = (value: unknown, name: string) => { const q = object(value, name), tilt = finite(q.tiltDeg, `${name}.tiltDeg`); if (!(tilt >= 0 && tilt < 90)) throw new TypeError(`${name}.tiltDeg must be from 0 to under 90; got ${tilt}.`); return { radiusArcsec: positive(q.radiusArcsec, `${name}.radiusArcsec`), tiltDeg: tilt, farAxisPaDeg: finite(q.farAxisPaDeg, `${name}.farAxisPaDeg`) }; };
  const disc = plane(r.disc, 'geometry.rings.disc'), ring = plane(r.ring, 'geometry.rings.ring');
  if (!(ring.radiusArcsec > disc.radiusArcsec)) throw new TypeError(`geometry.rings.ring.radiusArcsec (${ring.radiusArcsec}) must be over the disc's (${disc.radiusArcsec}).`);
  return { source: text(r.source, 'geometry.rings.source'), basis: text(r.basis, 'geometry.rings.basis'), disc, ring,
    ...(r.lineOfSightThicknessArcsec === undefined ? {} : { lineOfSightThicknessArcsec: positive(r.lineOfSightThicknessArcsec, 'geometry.rings.lineOfSightThicknessArcsec') }), };
};
const surfaceOf = (v: unknown): NonNullable<ImageLayerRecipe['geometry']['surface']> => {
  const s = object(v, 'geometry.surface'), pole = object(s.pole, 'geometry.surface.pole'), tilt = finite(pole.tiltDeg, 'geometry.surface.pole.tiltDeg');
  if (!(tilt > 0 && tilt < 180)) throw new TypeError(`geometry.surface.pole.tiltDeg is the pole's angle from the sight line, above 0 and below 180; got ${tilt}.`);
  if (pole.receding !== '+z' && pole.receding !== '-z') throw new TypeError(`geometry.surface.pole.receding says which end of the file's z axis recedes: "+z" or "-z", not ${JSON.stringify(pole.receding)}.`);
  if (!Array.isArray(s.originUnits) || s.originUnits.length !== 3) throw new TypeError('geometry.surface.originUnits is the star in the file\'s units: x, y and z.');
  return { source: text(s.source, 'geometry.surface.source'), basis: text(s.basis, 'geometry.surface.basis'), path: path(s.path), arcsecPerUnit: positive(s.arcsecPerUnit, 'geometry.surface.arcsecPerUnit'),
    originUnits: [finite(s.originUnits[0], 'geometry.surface.originUnits[0]'), finite(s.originUnits[1], 'geometry.surface.originUnits[1]'), finite(s.originUnits[2], 'geometry.surface.originUnits[2]')],
    pole: { tiltDeg: tilt, paDeg: finite(pole.paDeg, 'geometry.surface.pole.paDeg'), rollDeg: finite(pole.rollDeg, 'geometry.surface.pole.rollDeg'), receding: pole.receding }, ...(s.starRadiusArcsec === undefined ? {} : { starRadiusArcsec: positive(s.starRadiusArcsec, 'geometry.surface.starRadiusArcsec') }), fitArcsec: positive(s.fitArcsec, 'geometry.surface.fitArcsec') };
};
const densityOf = (v: unknown): NonNullable<ImageLayerRecipe['geometry']['densityGrid']> => {
  const d = object(v, 'geometry.densityGrid'), second = finite(d.secondAxisPaDeg, 'geometry.densityGrid.secondAxisPaDeg'), third = finite(d.thirdAxisPaDeg, 'geometry.densityGrid.thirdAxisPaDeg'), apart = (((third - second) % 360) + 360) % 360;
  if (d.toward !== 'high' && d.toward !== 'low') throw new TypeError(`geometry.densityGrid.toward says which end of the grid's first axis is toward the Sun: "high" or "low", not ${JSON.stringify(d.toward)}.`);
  if (Math.abs(apart - 90) > 1e-6 && Math.abs(apart - 270) > 1e-6) throw new TypeError(`geometry.densityGrid.thirdAxisPaDeg is a quarter turn from secondAxisPaDeg (${second}); got ${third}.`);
  if (d.centreArcsec !== undefined && (!Array.isArray(d.centreArcsec) || d.centreArcsec.length !== 2)) throw new TypeError('geometry.densityGrid.centreArcsec is the grid\'s middle from the star: east and north.');
  return { source: text(d.source, 'geometry.densityGrid.source'), basis: text(d.basis, 'geometry.densityGrid.basis'), path: path(d.path), cells: positive(d.cells, 'geometry.densityGrid.cells', true), cellArcsec: positive(d.cellArcsec, 'geometry.densityGrid.cellArcsec'),
    toward: d.toward, secondAxisPaDeg: second, thirdAxisPaDeg: third, ...(Array.isArray(d.centreArcsec) ? { centreArcsec: [finite(d.centreArcsec[0], 'geometry.densityGrid.centreArcsec[0]'), finite(d.centreArcsec[1], 'geometry.densityGrid.centreArcsec[1]')] as [number, number] } : {}),
    smoothPixels: positive(d.smoothPixels, 'geometry.densityGrid.smoothPixels', true), ...(d.starRadiusArcsec === undefined ? {} : { starRadiusArcsec: positive(d.starRadiusArcsec, 'geometry.densityGrid.starRadiusArcsec') }) };
};
const bodyOf = (v: unknown): NonNullable<ImageLayerRecipe['geometry']['body']> => {
  const b = object(v, 'geometry.body'), tilt = finite(b.polarTiltDeg, 'geometry.body.polarTiltDeg'), fraction = (value: unknown, name: string) => { const n = finite(value, name); if (!(n > 0 && n < 1)) throw new TypeError(`${name} is a fraction above 0 and under 1; got ${n}.`); return n; };
  if (!(tilt >= 0 && tilt < 90)) throw new TypeError(`geometry.body.polarTiltDeg must be from 0 to under 90; got ${tilt}.`);
  const envelope = b.envelope === undefined ? undefined : object(b.envelope, 'geometry.body.envelope'), cavities = b.cavities === undefined ? undefined : object(b.cavities, 'geometry.body.cavities');
  const angles = (value: unknown, name: string): [number, number] => { if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${name} holds two position angles, from and to through east.`); return [finite(value[0], `${name}[0]`), finite(value[1], `${name}[1]`)]; };
    return { source: text(b.source, 'geometry.body.source'), basis: text(b.basis, 'geometry.body.basis'), semiPolarArcsec: positive(b.semiPolarArcsec, 'geometry.body.semiPolarArcsec'), semiEquatorialArcsec: positive(b.semiEquatorialArcsec, 'geometry.body.semiEquatorialArcsec'),
    polarTiltDeg: tilt, polarLeansToPaDeg: finite(b.polarLeansToPaDeg, 'geometry.body.polarLeansToPaDeg'),
    ...(envelope === undefined ? {} : { envelope: { source: text(envelope.source, 'geometry.body.envelope.source'), radiusArcsec: positive(envelope.radiusArcsec, 'geometry.body.envelope.radiusArcsec') } }),
    ...(cavities === undefined ? {} : { cavities: { source: text(cavities.source, 'geometry.body.cavities.source'), emission: fraction(cavities.emission, 'geometry.body.cavities.emission'), sizeArcsec: positive(cavities.sizeArcsec, 'geometry.body.cavities.sizeArcsec'), farBetweenPaDeg: angles(cavities.farBetweenPaDeg, 'geometry.body.cavities.farBetweenPaDeg') } }) };
};
const parsecUnit = (v: unknown, unsupported: boolean): 'pc' => {
  if (v !== 'pc' || unsupported) throw new TypeError(`geometry.unit is "pc", on a flat bank without a bulge; got ${JSON.stringify(v)}${unsupported ? ' on a bank that is not flat or has a bulge' : ''}.`);
  return v;
};
const flatOf = (v: unknown): boolean => { if (typeof v !== 'boolean') throw new TypeError(`bake.flat must be true or false; got ${JSON.stringify(v)}.`); return v; };
const alphaQualityOf = (v: unknown): number => {
  const n = finite(v, 'encoding.alphaQuality'); if (!Number.isInteger(n) || n < 0 || n > 100) throw new TypeError(`encoding.alphaQuality must be an integer 0-100; got ${n}.`); return n;
};
const colorTieOf = (v: unknown): NonNullable<ImageLayerRecipe['bake']['colorTie']> => {
  const t = object(v, 'bake.colorTie'), bv = finite(t.bv, 'bake.colorTie.bv');
  if (bv < -0.4 || bv > 4) throw new TypeError(`bake.colorTie.bv must be a B-V index in [-0.4, 4]; got ${bv}.`);
  return { bv, source: text(t.source, 'bake.colorTie.source'), basis: text(t.basis, 'bake.colorTie.basis') };
};
const levelsOf = (v: unknown): NonNullable<ImageLayerRecipe['bake']['levels']> => {
  const l = object(v, 'bake.levels'), black = finite(l.black, 'bake.levels.black'), white = finite(l.white, 'bake.levels.white'), gamma = positive(l.gamma, 'bake.levels.gamma');
  if (!(black >= 0 && white <= 1 && black < white)) throw new TypeError(`bake.levels needs 0 <= black < white <= 1; got black ${black}, white ${white}.`);
  return { black, white, gamma, basis: text(l.basis, 'bake.levels.basis') };
};
const companionsOf = (v: unknown): NonNullable<ImageLayerRecipe['source']['companions']> => {
  const c = object(v, 'source.companions'), catalogue = text(c.catalogue, 'source.companions.catalogue');
  if (!catalogue.startsWith('src/') || catalogue.split('/').includes('..')) throw new TypeError(`source.companions.catalogue must be a repository path under src/; got ${JSON.stringify(catalogue)}.`);
  if (!Array.isArray(c.keys) || !c.keys.length) throw new TypeError(`source.companions.keys must list catalogue keys; got ${JSON.stringify(c.keys)}.`);
  return { catalogue, keys: c.keys.map((key, i) => text(key, `source.companions.keys[${i}]`)), source: text(c.source, 'source.companions.source'), basis: text(c.basis, 'source.companions.basis') };
};
const foreground = (v: unknown): NonNullable<ImageLayerRecipe['source']['foregroundStars']> => {
  const f = object(v, 'source.foregroundStars');
  return { path: path(f.path), raDegColumn: text(f.raDegColumn, 'foregroundStars.raDegColumn'), decDegColumn: text(f.decDegColumn, 'foregroundStars.decDegColumn'),
    gMagColumn: text(f.gMagColumn, 'foregroundStars.gMagColumn'), source: text(f.source, 'foregroundStars.source'), basis: text(f.basis, 'foregroundStars.basis') };
};
const pair = (v: unknown, at: string, integers = false): [number, number] => {
  if (!Array.isArray(v) || v.length !== 2) throw new TypeError(`${at} must contain two values.`);
  const p: [number, number] = [positive(v[0], at, integers), positive(v[1], at, integers)]; return p;
};
const window = (v: unknown): [number, number, number, number] => {
  if (!Array.isArray(v) || v.length !== 4) throw new TypeError('parentPixelWindow must contain four integers.');
  const values=v.map((n,i)=>finite(n,`parentPixelWindow[${i}]`));
  if(values.some((n,i)=>!Number.isInteger(n)||(i<2?n<0:n<=0)))throw new TypeError('Invalid parentPixelWindow.');
  return values as [number,number,number,number];
};

export function parseImageLayerRecipe(value: unknown): ImageLayerRecipe {
  const r = object(value, 'recipe');
  if (r.schema !== 'cssearth-image-layer-recipe@1') throw new TypeError('Unsupported image-layer recipe schema.');
  const s = object(r.source, 'source'), o = object(r.observation, 'observation'), t = object(r.target, 'target');
  const g = object(r.geometry, 'geometry'), b = object(r.bake, 'bake'), e = object(b.encoding, 'encoding');
  const p = object(r.provenance, 'provenance');
  const kind = g.kind;
  if (kind !== 'inclined-disk' && kind !== 'line-of-sight-envelope') throw new TypeError('Unsupported image-layer geometry.');
  if (e.format !== 'webp') throw new TypeError('Image layers require WebP.');
  if (s.license !== 'CC-BY-4.0' && s.license !== 'CC-BY') throw new TypeError(`Unsupported source license declaration: ${JSON.stringify(s.license)}; expected CC-BY-4.0 or CC-BY.`);
  if (!Array.isArray(g.depthWeights) || g.depthWeights.length < 3 || g.depthWeights.length > 64) throw new TypeError('depthWeights must contain 3-64 values.');
  const weights = g.depthWeights.map((v, i) => positive(v, `depthWeights[${i}]`));
  if(!Array.isArray(g.depthScales)||g.depthScales.length!==weights.length)throw new TypeError('depthScales must align with depthWeights.');
  const scales=g.depthScales.map((v,i)=>{const n=positive(v,`depthScales[${i}]`);if(n>1)throw new TypeError('depthScales must be at most one.');return n;});
  const sum = weights.reduce((a, n) => a + n, 0);
  if (Math.abs(sum - 1) > 1e-9) throw new TypeError('depthWeights must sum to one.');
  const inclinationDeg = finite(g.inclinationDeg, 'inclinationDeg');
  if (inclinationDeg < 0 || inclinationDeg >= 89) throw new TypeError('inclinationDeg must be in [0, 89).');
  const supportTaperFraction = finite(g.supportTaperFraction, 'supportTaperFraction');
  if (supportTaperFraction < 0 || supportTaperFraction >= 1) throw new TypeError('supportTaperFraction must be in [0, 1).');
  const backgroundFloor = finite(b.backgroundFloor, 'backgroundFloor');
  if (backgroundFloor < 0 || backgroundFloor >= 1) throw new TypeError('backgroundFloor must be in [0, 1).');
  const edgeTaperFraction=finite(b.edgeTaperFraction,'edgeTaperFraction');if(edgeTaperFraction<=0||edgeTaperFraction>.25)throw new TypeError('edgeTaperFraction must be in (0, .25].');
  const diffuseFraction=finite(b.diffuseFraction,'diffuseFraction');if(diffuseFraction<=0||diffuseFraction>=1)throw new TypeError('diffuseFraction must be in (0, 1).');
  const quality = positive(e.quality, 'quality', true); if (quality > 100) throw new TypeError('quality must be at most 100.');
  return { schema: r.schema, id: text(r.id, 'id'), source: { path: path(s.path),
    dimensions: pair(s.dimensions, 'source.dimensions', true), originalDimensions: pair(s.originalDimensions, 'source.originalDimensions', true),
    ...(s.parentPixelWindow===undefined?{}:{parentPixelWindow:window(s.parentPixelWindow)}),
    publisherUrl: text(s.publisherUrl, 'publisherUrl'), downloadUrl: text(s.downloadUrl, 'downloadUrl'), credit: text(s.credit, 'credit'), license: s.license,
    ...(s.foregroundStars===undefined?{}:{foregroundStars:foreground(s.foregroundStars)}),
    ...(s.companions===undefined?{}:{companions:companionsOf(s.companions)}) },
    observation: { centerRaDeg: finite(o.centerRaDeg, 'centerRaDeg'), centerDecDeg: finite(o.centerDecDeg, 'centerDecDeg'),
      fieldOfViewDeg: pair(o.fieldOfViewDeg, 'fieldOfViewDeg'), northClockwiseDeg: finite(o.northClockwiseDeg, 'northClockwiseDeg') },
    target: { centerRaDeg: finite(t.centerRaDeg, 'target RA'), centerDecDeg: finite(t.centerDecDeg, 'target Dec'), distancePc: positive(t.distancePc, 'distancePc') },
    geometry: { kind, inclinationDeg, lineOfNodesPaDeg: finite(g.lineOfNodesPaDeg, 'lineOfNodesPaDeg'),
      thicknessKpc: positive(g.thicknessKpc, 'thicknessKpc'), supportRadiusKpc: positive(g.supportRadiusKpc, 'supportRadiusKpc'),
      supportTaperFraction, depthWeights: weights, depthScales: scales, ...(g.bulge===undefined?{}:{bulge:bulgeOf(g.bulge)}),
      ...(g.shape===undefined?{}:{shape:(()=>{if(g.bulge!==undefined||b.flat!==true)throw new TypeError('geometry.shape is for a flat bank without a bulge.');return shapeOf(g.shape);})()}),
      ...(g.body===undefined?{}:{body:(()=>{if(g.bulge!==undefined||g.shape!==undefined||b.flat!==true)throw new TypeError('geometry.body is for a flat bank without a bulge or walls.');return bodyOf(g.body);})()}),
      ...(g.rings===undefined?{}:{rings:(()=>{if(g.bulge!==undefined||g.shape!==undefined||g.body!==undefined||b.flat!==true)throw new TypeError('geometry.rings is for a flat bank without a bulge, walls or a body.');return ringsOf(g.rings);})()}),
      ...(g.surface===undefined?{}:{surface:(()=>{if(g.bulge!==undefined||g.shape!==undefined||g.body!==undefined||g.rings!==undefined||b.flat!==true)throw new TypeError('geometry.surface is for a flat bank without a bulge, walls, a body or rings.');return surfaceOf(g.surface);})()}),
      ...(g.densityGrid===undefined?{}:{densityGrid:(()=>{if(g.bulge!==undefined||g.shape!==undefined||g.body!==undefined||g.rings!==undefined||g.surface!==undefined||b.flat!==true)throw new TypeError('geometry.densityGrid is for a flat bank without a bulge, walls, a body, rings or a surface.');return densityOf(g.densityGrid);})()}),
      ...(g.unit===undefined?{}:{unit:parsecUnit(g.unit,g.bulge!==undefined||b.flat!==true)}) },
    bake: { maxFacePixels: positive(b.maxFacePixels, 'maxFacePixels', true), diffuseFacePixels: positive(b.diffuseFacePixels,'diffuseFacePixels',true),
      ...(b.levels===undefined?{}:{levels:levelsOf(b.levels)}),
      ...(b.colorTie===undefined?{}:{colorTie:colorTieOf(b.colorTie)}),
      ...(g.bulge===undefined&&g.shape===undefined&&g.densityGrid===undefined&&g.body===undefined&&(g.rings as {lineOfSightThicknessArcsec?:unknown}|undefined)?.lineOfSightThicknessArcsec===undefined?{}:{bulgeSlices:positive(b.bulgeSlices,'bulgeSlices',true),bulgeFacePixels:positive(b.bulgeFacePixels,'bulgeFacePixels',true),bulgeCrossSlices:positive(b.bulgeCrossSlices,'bulgeCrossSlices',true)}), crossAxisSlices: positive(b.crossAxisSlices, 'crossAxisSlices', true),
      crossAxisAlongPixels:positive(b.crossAxisAlongPixels,'crossAxisAlongPixels',true),crossAxisDepthPixels: positive(b.crossAxisDepthPixels, 'crossAxisDepthPixels', true), backgroundFloor,edgeTaperFraction,diffuseFraction,diffuseSigmaPixels:positive(b.diffuseSigmaPixels,'diffuseSigmaPixels'),
      ...(b.flat===undefined?{}:{flat:flatOf(b.flat)}),
      encoding: { format: 'webp', quality, ...(e.alphaQuality===undefined?{}:{alphaQuality:alphaQualityOf(e.alphaQuality)}) } }, provenance: { path: path(p.path) } };
}
