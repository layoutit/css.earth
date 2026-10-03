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
  observation: { centerRaDeg: number; centerDecDeg: number; fieldOfViewDeg: [number, number]; northClockwiseDeg: number };
  target: { centerRaDeg: number; centerDecDeg: number; distancePc: number };
  geometry: { kind: 'inclined-disk' | 'line-of-sight-envelope'; inclinationDeg: number; lineOfNodesPaDeg: number;
    thicknessKpc: number; supportRadiusKpc: number; supportTaperFraction: number; depthWeights: number[]; depthScales: number[];
    /** The bank's unit when it is not the kiloparsec: parsecs, for an object a few parsecs across (a nebula), whose leaves in
     * kiloparsecs would be smaller than one CSS pixel. The recipe's lengths stay in kiloparsecs. A flat bank without a bulge only. */
    unit?: 'pc';
    /** A published bulge-plus-disc fit of the sky light (./bulge.ts): Sérsic bulge, exponential disc, one position angle. */
    bulge?: { source: string; /** Whose light fills the bulge: a share of the photograph's (default) or the fit's own. */ lightFrom?: 'photograph' | 'fit'; positionAngleDeg: number; sersicIndex: number; halfLightRadiusKpc: number; surfaceBrightnessAtHalfLight: number;
      skyEllipticity: number; disc: { centralSurfaceBrightness: number; scaleLengthKpc: number; skyEllipticity: number; positionAngleDeg?: number };
      /** The fit's second exponential disc, where it has two: its light counts as the disc's. */
      secondDisc?: { centralSurfaceBrightness: number; scaleLengthKpc: number; skyEllipticity: number; positionAngleDeg?: number };
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
const text = (v: unknown, at: string): string => {
  if (typeof v !== 'string' || !v) throw new TypeError(`${at} must be a string.`); return v;
};
const path = (v: unknown): string => {
  const p = text(v, 'source path'); if (p.startsWith('/') || p.split('/').includes('..') || /[\\\0]/.test(p)) throw new TypeError('Path must be contained.'); return p;
};
const bulgeOf = (v: unknown): NonNullable<ImageLayerRecipe['geometry']['bulge']> => {
  const b = object(v, 'geometry.bulge'), d = object(b.disc, 'geometry.bulge.disc'), e = object(b.extentKpc, 'geometry.bulge.extentKpc');
  const ellipticity = (x: unknown, at: string) => { const n = finite(x, at); if (n < 0 || n >= 1) throw new TypeError(`${at} must be in [0, 1); got ${n}.`); return n; };
  const discOf = (d: Record<string, unknown>, at: string) => ({ centralSurfaceBrightness: finite(d.centralSurfaceBrightness, `${at}.centralSurfaceBrightness`), scaleLengthKpc: positive(d.scaleLengthKpc, `${at}.scaleLengthKpc`),
    skyEllipticity: ellipticity(d.skyEllipticity, `${at}.skyEllipticity`), ...(d.positionAngleDeg===undefined?{}:{positionAngleDeg:finite(d.positionAngleDeg,`${at}.positionAngleDeg`)}) });
  if (b.lightFrom !== undefined && b.lightFrom !== 'photograph' && b.lightFrom !== 'fit') throw new TypeError(`geometry.bulge.lightFrom must be photograph or fit; got ${JSON.stringify(b.lightFrom)}.`);
  return { source: text(b.source, 'geometry.bulge.source'), ...(b.lightFrom===undefined?{}:{lightFrom:b.lightFrom}), positionAngleDeg: finite(b.positionAngleDeg, 'geometry.bulge.positionAngleDeg'),
    sersicIndex: positive(b.sersicIndex, 'geometry.bulge.sersicIndex'), halfLightRadiusKpc: positive(b.halfLightRadiusKpc, 'geometry.bulge.halfLightRadiusKpc'),
    surfaceBrightnessAtHalfLight: finite(b.surfaceBrightnessAtHalfLight, 'geometry.bulge.surfaceBrightnessAtHalfLight'), skyEllipticity: ellipticity(b.skyEllipticity, 'geometry.bulge.skyEllipticity'),
    disc: discOf(d, 'geometry.bulge.disc'), ...(b.secondDisc===undefined?{}:{secondDisc:discOf(object(b.secondDisc,'geometry.bulge.secondDisc'),'geometry.bulge.secondDisc')}),
    extentKpc: { radius: positive(e.radius, 'geometry.bulge.extentKpc.radius'), height: positive(e.height, 'geometry.bulge.extentKpc.height'),
      ...(e.fadeFrom===undefined?{}:{fadeFrom:(()=>{const f=positive(e.fadeFrom,'geometry.bulge.extentKpc.fadeFrom');if(f>=Number(e.radius))throw new TypeError(`geometry.bulge.extentKpc.fadeFrom (${f}) must be inside radius (${String(e.radius)}).`);return f;})()}) } };
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
      ...(g.unit===undefined?{}:{unit:parsecUnit(g.unit,g.bulge!==undefined||b.flat!==true)}) },
    bake: { maxFacePixels: positive(b.maxFacePixels, 'maxFacePixels', true), diffuseFacePixels: positive(b.diffuseFacePixels,'diffuseFacePixels',true),
      ...(b.levels===undefined?{}:{levels:levelsOf(b.levels)}),
      ...(b.colorTie===undefined?{}:{colorTie:colorTieOf(b.colorTie)}),
      ...(g.bulge===undefined?{}:{bulgeSlices:positive(b.bulgeSlices,'bulgeSlices',true),bulgeFacePixels:positive(b.bulgeFacePixels,'bulgeFacePixels',true),bulgeCrossSlices:positive(b.bulgeCrossSlices,'bulgeCrossSlices',true)}), crossAxisSlices: positive(b.crossAxisSlices, 'crossAxisSlices', true),
      crossAxisAlongPixels:positive(b.crossAxisAlongPixels,'crossAxisAlongPixels',true),crossAxisDepthPixels: positive(b.crossAxisDepthPixels, 'crossAxisDepthPixels', true), backgroundFloor,edgeTaperFraction,diffuseFraction,diffuseSigmaPixels:positive(b.diffuseSigmaPixels,'diffuseSigmaPixels'),
      ...(b.flat===undefined?{}:{flat:flatOf(b.flat)}),
      encoding: { format: 'webp', quality, ...(e.alphaQuality===undefined?{}:{alphaQuality:alphaQualityOf(e.alphaQuality)}) } }, provenance: { path: path(p.path) } };
}
