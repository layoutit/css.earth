// `@cssearth/bake/objects/raster` (Node only): the science and observation rasters preparation reads. Scientific surfaces
// from PDS, ISIS, FITS, GeoTIFF, VTK, NumPy, HEALPix and Tecplot products, categorical geology and symbol overlays, published
// exoplanet phase-curve and eclipse maps, observed colour rasters and their photometric composition, the records that describe
// them, and the WISE atlas mosaic grid.
// `npy-lonlat-grid` and `npy-pickle` each read a different NumPy array type, so the lonlat grid's stays internal; the published
// phase-curve and eigenmap fits each define a brightness temperature, and the phase curve's is `phaseCurveBrightnessTemperature`.
export * from './background-offsets.ts';
export * from './categorical-geology.ts';
export * from './contracts.ts';
export * from './eclipse-map-fit.ts';
export * from './eigenspectra-map.ts';
export * from './facet-scalars.ts';
export * from './fits-image-map.ts';
export * from './healpix-map.ts';
export * from './image-dem-science.ts';
export * from './image-dem.ts';
export * from './isis3-raster.ts';
export * from './latitude-belt-map.ts';
export * from './npy-dictionary-map.ts';
export { readNpy, type SpinFrameTransfer, spinFrameTransfer, loadSpinFrameTransfer, decodeNpyLonLatGrid, loadNpyLonLatGrid, npyLonLatGridDependencies } from './npy-lonlat-grid.ts';
export * from './npy-pickle.ts';
export * from './npz.ts';
export * from './obj-uv-fits.ts';
export * from './observation-raster.ts';
export * from './observed-fits.ts';
export * from './observed-geotiff.ts';
export * from './observed-image.ts';
export * from './observed-pds-rgb.ts';
export * from './observed-pds4.ts';
export * from './pds-byte-mosaic.ts';
export * from './pds-float-map.ts';
export * from './pds-image.ts';
export * from './pds-scalar-grid.ts';
export * from './pds-scalar-map.ts';
export * from './photometric-observations.ts';
export { type TwoTermSinusoid, type FourierFromTransit, type EclipseNormalizedFourier, type FourierPhaseCurve, type SpidermanModel, type PublishedPhaseCurve,
  type DepositedChannels, type StarryPhaseCurve, parseStarryPhaseCurve, parsePublishedPhaseCurve, brightnessTemperature as phaseCurveBrightnessTemperature, impliedStellarTemperature, sinusoidMap, loadPublishedPhaseCurveMap,
  depositedChannelWeights } from './published-phase-curve-map.ts';
export * from './record-keys.ts';
export * from './sbmt-symbols.ts';
export * from './scientific-raster.ts';
export * from './source-records.ts';
export * from './tar-member.ts';
export * from './tecplot-lonlat-map.ts';
export * from './vtk-categories.ts';
export * from './wise-atlas-mosaic.ts';
export * from './eclipse-map/bare-rock.ts';
export * from './eclipse-map/eigenmap-fit.ts';
export * from './eclipse-map/light-curve-map.ts';
export * from './eclipse-map/phase-curve.ts';
export * from './eclipse-map/spherical-harmonics.ts';
export * from './eclipse-map/transit-timing.ts';
