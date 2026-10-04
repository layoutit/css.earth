import { BODY_MAP_SCHEMA, type BodyMapProduct } from './body-map-product.js';
import { RASTER_RECIPE_SCHEMA } from './raster-recipe.js';
export const bodyMapFixture = (): BodyMapProduct => ({
  schema: BODY_MAP_SCHEMA,
  definition: { quantity: 'temperature', units: 'K', timeDependence: 'instantaneous-state', method: { convention: 'Planck' }, source: 'publication' },
  frame: { body: 'fixture', radiusKm: 100, rotation: { model: 'rotation', bodyCode: 1 } },
  grid: { width: 4, height: 2, longitude: 'east-positive-from-0', rows: 'north-to-south' },
  planes: { file: 'map.fits', value: 'VALUE', uncertainty: 'ERROR' }, mask: { maximumEmissionDegrees: 60, missing: 'NaN' },
  observations: [{ id: 'one', telescope: 'observatory', instrument: 'camera', midTimeJd: 2451545, rangeKm: 1000,
    subObserver: { latitudeDegrees: 0, westLongitudeDegrees: 0 }, angularResolution: { majorArcsec: 2, minorArcsec: 1, basis: 'beam', evidence: { kind: 'measured', receipt: { file: 'receipt.json' } } } }],
});
export const rasterRecipeFixture = () => ({
  schema: RASTER_RECIPE_SCHEMA, publicBase: '/scenes/fixture/', sourceWidth: 64, sourceHeight: 32,
  width: 32, height: 16, latitudeBands: 2, polarTile: 8, resample: 'density-before-pack', polarProjection: 'orthographic-bilinear',
  surfaces: [{ id: 'photo', source: 'photo.png', output: 'photo.webp', thumbnail: 'thumbnail.webp', falseColor: false }],
  polesOutput: '{id}-poles.webp', surfaceMetadata: { schema: 'fixture' }, thumbnail: { size: 8 },
});
