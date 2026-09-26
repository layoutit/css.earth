export type Vec3 = [number, number, number];
export type LayerAxis = 'x' | 'y' | 'z';

export interface ImageLayerRecipe {
  schema: 'cssearth-image-layer-recipe@1';
  id: string;
  source: { path: string; dimensions: [number, number]; originalDimensions: [number, number];
    parentPixelWindow?: [number, number, number, number]; publisherUrl: string; downloadUrl: string; credit: string; license: 'CC-BY-4.0' };
  observation: { centerRaDeg: number; centerDecDeg: number; fieldOfViewDeg: [number, number]; northClockwiseDeg: number };
  target: { centerRaDeg: number; centerDecDeg: number; distancePc: number };
  geometry: { kind: 'inclined-disk' | 'line-of-sight-envelope'; inclinationDeg: number; lineOfNodesPaDeg: number;
    thicknessKpc: number; supportRadiusKpc: number; supportTaperFraction: number; depthWeights: number[]; depthScales: number[] };
  bake: { maxFacePixels: number; diffuseFacePixels: number; crossAxisSlices: number; crossAxisAlongPixels: number; crossAxisDepthPixels: number;
    backgroundFloor: number; edgeTaperFraction: number; diffuseFraction: number; diffuseSigmaPixels: number;
    encoding: { format: 'webp'; quality: number } };
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
const digest = (v: unknown, at: string): string => {
  const s = text(v, at); if (!/^[a-f0-9]{64}$/.test(s)) throw new TypeError(`${at} must be SHA256.`); return s;
};
const path = (v: unknown): string => {
  const p = text(v, 'source path'); if (p.startsWith('/') || p.split('/').includes('..') || /[\\\0]/.test(p)) throw new TypeError('Path must be contained.'); return p;
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
  if (s.license !== 'CC-BY-4.0') throw new TypeError('Unsupported source license declaration.');
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
    publisherUrl: text(s.publisherUrl, 'publisherUrl'), downloadUrl: text(s.downloadUrl, 'downloadUrl'), credit: text(s.credit, 'credit'), license: s.license },
    observation: { centerRaDeg: finite(o.centerRaDeg, 'centerRaDeg'), centerDecDeg: finite(o.centerDecDeg, 'centerDecDeg'),
      fieldOfViewDeg: pair(o.fieldOfViewDeg, 'fieldOfViewDeg'), northClockwiseDeg: finite(o.northClockwiseDeg, 'northClockwiseDeg') },
    target: { centerRaDeg: finite(t.centerRaDeg, 'target RA'), centerDecDeg: finite(t.centerDecDeg, 'target Dec'), distancePc: positive(t.distancePc, 'distancePc') },
    geometry: { kind, inclinationDeg, lineOfNodesPaDeg: finite(g.lineOfNodesPaDeg, 'lineOfNodesPaDeg'),
      thicknessKpc: positive(g.thicknessKpc, 'thicknessKpc'), supportRadiusKpc: positive(g.supportRadiusKpc, 'supportRadiusKpc'),
      supportTaperFraction, depthWeights: weights, depthScales: scales },
    bake: { maxFacePixels: positive(b.maxFacePixels, 'maxFacePixels', true), diffuseFacePixels: positive(b.diffuseFacePixels,'diffuseFacePixels',true), crossAxisSlices: positive(b.crossAxisSlices, 'crossAxisSlices', true),
      crossAxisAlongPixels:positive(b.crossAxisAlongPixels,'crossAxisAlongPixels',true),crossAxisDepthPixels: positive(b.crossAxisDepthPixels, 'crossAxisDepthPixels', true), backgroundFloor,edgeTaperFraction,diffuseFraction,diffuseSigmaPixels:positive(b.diffuseSigmaPixels,'diffuseSigmaPixels'),
      encoding: { format: 'webp', quality } }, provenance: { path: path(p.path) } };
}
