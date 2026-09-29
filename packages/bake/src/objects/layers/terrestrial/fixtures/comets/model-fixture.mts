import { array, boolean, number, shape, text, requireRecord } from '@cssearth/core';

const vector = (input: unknown): number[] => {
  const value = array(number)(input);
  if (value.length !== 3) throw new TypeError('Expected three prepared coordinates.');
  return value;
};
const triangle = (input: unknown): number[][] => {
  const value = array(vector)(input);
  if (value.length !== 3) throw new TypeError('Expected three vertices per prepared triangle.');
  return value;
};
export const preparedModelTerrain = shape({ faces: array(shape({ vertices: triangle })) });
export const modelConfig = shape({
  geometry: shape({ radiusKm: number, radius: number,
    radialTerrain: shape({ sourceLighting: shape({ uniformFlood: boolean }) }) }),
  raster: shape({ width: number, height: number, observations: array(requireRecord) }),
});
export const modelSurfaces = shape({ surfaces: array(shape({
  missingPixels: number, appearance: text, layout: shape({ faceCount: number }),
})) });
export const modelSettings = shape({ settings: shape({ controls: array(shape({ name: text, checked: boolean })) }) });
