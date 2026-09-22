import { array, boolean, number, optional, shape, text, parseAddress, parseAssetReference,
  parseBounds, parseIndexHead } from '../../../../tools/objects/geographic-pages/source-records.mts';
import type { GeographicBounds, PolarBounds } from '../../../../tools/objects/geographic-pages/contracts.mts';
import { requireArray, requireRecord } from '../../../../tools/sources/source-values.mts';

// Decode the legacy local raster fixture at its filesystem boundary. Parent
// nodes have geometry but no image; published leaves carry the complete raster.
const vector3 = (input: unknown): [number, number, number] => {
  const value = requireArray(input);
  if (value.length !== 3) throw new TypeError('City geometry requires three coordinates');
  return [number(value[0]), number(value[1]), number(value[2])];
};
const bounds = (input: unknown): GeographicBounds | PolarBounds => {
  const value = requireRecord(input);
  if (value.projection !== 'polar') return parseBounds(value);
  if (value.hemisphere !== 'north' && value.hemisphere !== 'south') throw new TypeError('Invalid polar hemisphere');
  return { projection: 'polar' as const, hemisphere: value.hemisphere,
    ...shape({u0:number,u1:number,v0:number,v1:number})(value) };
};
export const parseCityFixtureBounds = shape({corners:array(vector3), normal:vector3});
const nodeFields = { ...{key:text, level:number, x:number, y:number}, corners:array(vector3),
  normal:vector3, children:array(text), coverageCorners:optional(array(vector3)),
  childrenCoverImage:optional(boolean) };
export const parseCityRaster = shape({ ...nodeFields, url:text, bytes:number, sha256:text,
  width:number, height:number, frameMatrix:text, textureMatrix:text, maximumCssSpan:number,
  bounds, outer:bounds, sourceBounds:parseBounds });
const parseCityNode = shape({ ...nodeFields, url:optional(text), bytes:optional(number), sha256:optional(text),
  width:optional(number), height:optional(number), frameMatrix:optional(text), textureMatrix:optional(text),
  maximumCssSpan:optional(number), bounds:optional(bounds), outer:optional(bounds), sourceBounds:optional(parseBounds) });
export const parseCityFixtureDirectory = shape({schema:text,dataset:text,key:text,
  nodes:array(parseCityNode),external:array(parseIndexHead)});
export const parseCityFixtureManifest = shape({ pages:array(parseCityRaster), proofRoots:optional(array(text)) });
export const parseCityFixtureReference = parseAssetReference;
