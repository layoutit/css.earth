import { isArray } from '@cssearth/core';
import type {SourceMesh,SourceScalar,SciencePalette,Relief,ScalarGrid,LinearTransform,ScienceProjection,ColorBand,ObservationGeometry,PhotometryProfile,ObservedColorContext} from './contracts.mts';
import {decodeProfile,parseScienceInput,parseScienceGrid,parseQualitySource,parseQualityMask,parseColorSourceProfile,parseColorEntry,numericRaster,numericRasterBands} from './source-records.mts';
import {loadPdsFloatMap} from './pds-float-map.mts';
import { loadImageDemScience } from './image-dem-science.mts';
import {loadPdsImage} from './pds-image.mts';
import {loadFacetScalarSurface} from './facet-scalars.mts';
import {loadVtkCategories} from './vtk-categories.mts';
import {loadGeologySurface, categoryColorForValue} from './categorical-geology.mts';
import { loadScalarMap } from './pds-scalar-map.mts';
import { resolve } from 'node:path';
import { fromFile } from 'geotiff';
import {loadIsis3Raster} from './isis3-raster.mts';
import { paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mts';
import {composeCorrectedColor} from './photometric-observations.mts';
import { bandColorDisplay, encodeBandColor, bandColorEvidence, interpolatePalette } from '../color-transfer.mts';
import { checkKeys } from '../surface-observations/recipe.mts';
import { loadPdsScalarGrid } from './pds-scalar-grid.mts';
import { loadPdsRadialTable } from './pds-radial-table.mts';
import { loadShapeScalarGrid } from './obj-shape.mts';
import { loadObjUvFits } from './obj-uv-fits.mts';
import { loadFitsImageMap } from './fits-image-map.mts';
import { loadNpyDictionaryMap } from './npy-dictionary-map.mts';
import { loadNpyLonLatGrid } from './npy-lonlat-grid.mts';
import { loadBareRockEclipse, loadBareRockFit, loadEclipseMapFit } from './eclipse-map-fit.mts';
import { loadPublishedPhaseCurveMap } from './published-phase-curve-map.mts';
import { loadEigenspectraTemperature } from './eigenspectra-map.mts';
import { loadHealpixNpyMap } from './healpix-map.mts';
import { loadTecplotLonLatMap } from './tecplot-lonlat-map.mts';
import { loadLatitudeBeltMap } from './latitude-belt-map.mts';

/** Interpolate the authored numeric scale; source units remain unchanged. */
export function colorForValue(value: number, recipe: SciencePalette) {
  if (recipe.categories) return categoryColorForValue(value, recipe);
  const { minimum, maximum, colors } = recipe;
  return interpolatePalette(colors, (value - minimum) / (maximum - minimum));
}

/** Local finite differences on the source's own reference sphere. */
export function terrainBrightness(source: SourceScalar, longitude: number, latitude: number, step: number, relief: Relief) {
  const west = source.sample((longitude - step + 360) % 360, latitude);
  const east = source.sample((longitude + step) % 360, latitude);
  const north = source.sample(longitude, latitude + step);
  const south = source.sample(longitude, latitude - step);
  if (west===null||east===null||north===null||south===null) return 1;
  const distance = relief.referenceRadiusMeters * step * Math.PI / 180;
  const heightToMeters = relief.heightToMeters ?? 1;
  const eastSlope = (east - west) * heightToMeters / (2 * distance * Math.cos(latitude * Math.PI / 180));
  const northSlope = (north - south) * heightToMeters / (2 * distance);
  const [eastLight, northLight, upLight] = relief.lightDirection;
  const illumination = Math.max(0, (-eastLight * eastSlope - northLight * northSlope + upLight)
    / Math.hypot(eastSlope, northSlope, 1));
  return (relief.ambient + (1 - relief.ambient) * illumination)
    / (relief.ambient + (1 - relief.ambient) * upLight);
}

/** Sample the measured grid before applying the authored unit/datum conversion. */
export function sampleScienceGrid(data: ArrayLike<number>, grid: ScalarGrid, px: number, py: number, { sampling = 'nearest', valueTransform }: {sampling?:string;valueTransform?:LinearTransform} = {}) {
  if (px < 0 || py < 0 || px >= grid.width || py >= grid.height) return null;
  const valueAt = (x: number, y: number) => {
    const value = data[y * grid.width + x];
    return !Number.isFinite(value) || value === grid.noData || Math.abs(value) > (grid.specialValueMagnitude ?? Infinity) ? null : value;
  };
  let value;
  if (sampling === 'bilinear') {
    // The edge pixel covers its complete cell, but never extends outside the raster.
    const x = Math.max(0, Math.min(grid.width - 1, px - 0.5));
    const y = Math.max(0, Math.min(grid.height - 1, py - 0.5));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, grid.width - 1), y1 = Math.min(y0 + 1, grid.height - 1);
    const values = [valueAt(x0, y0), valueAt(x1, y0), valueAt(x0, y1), valueAt(x1, y1)];
    if (!values.every((v): v is number => v !== null)) return null;
    const dx = x - x0, dy = y - y0;
    value = values[0] * (1 - dx) * (1 - dy) + values[1] * dx * (1 - dy) +
      values[2] * (1 - dx) * dy + values[3] * dx * dy;
  } else value = valueAt(Math.floor(px), Math.floor(py));
  return value === null ? null : value * (valueTransform?.scale ?? 1) + (valueTransform?.offset ?? 0);
}

/** Native geographic degrees or spherical projected meters; no display geometry is derived here. */
export function scienceMapPoint(longitude: number, latitude: number, grid: ScienceProjection) {
  const radians = Math.PI / 180, radius = grid.referenceRadiusMeters;
  if (grid.projection === 'polar-stereographic') {
    if(grid.poleLatitude===undefined)throw new Error('Missing polar latitude');
    const sign = Math.sign(grid.poleLatitude), angle = (longitude - grid.centerLongitude) * radians;
    const distance = 2 * radius * Math.tan(Math.PI / 4 - sign * latitude * radians / 2);
    return [distance * Math.sin(angle), -sign * distance * Math.cos(angle)];
  }
  if (grid.longitudeRange?.[0] === -180) longitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  const delta = longitude - grid.centerLongitude;
  const wrapped = grid.wrapLongitude ? ((delta + 180) % 360 + 360) % 360 - 180 : delta;
  if (grid.coordinates === 'degrees') return [wrapped, latitude];
  return [wrapped * radians * radius, latitude * radians * radius];
}

export function validateScienceQualityMasks(value: unknown) {
  const lens=decodeProfile(parseQualitySource,value,"Scientific quality masks require bounded numeric nearest-neighbor grids and nearest source sampling.");
  if(lens.qualityMasks===undefined)return;
  if(!['isis3','geotiff','fits-image-map'].includes(lens.format ?? '')||lens.sampling!=='nearest'||lens.additionalGrids||
      !isArray(lens.qualityMasks)||!lens.qualityMasks.length||lens.qualityMasks.some(mask=>
        !['isis3','geotiff','fits-image-map'].includes(mask.format)||mask.sampling!=='nearest'||mask.qualityMasks||mask.additionalGrids||mask.valueTransform||
        typeof mask.path!=='string'||!mask.path||mask.path.startsWith('/')||mask.path.split('/').includes('..')||
        !mask.grid||![mask.grid.width,mask.grid.height].every(n=>Number.isSafeInteger(n)&&n>0)||
        !Number.isFinite(mask.minimum)&&!Number.isFinite(mask.maximum)||
        mask.minimum!==undefined&&!Number.isFinite(mask.minimum)||mask.maximum!==undefined&&!Number.isFinite(mask.maximum)||
        mask.minimum!==undefined&&mask.maximum!==undefined&&mask.minimum>mask.maximum))
    throw new TypeError('Scientific quality masks require bounded numeric nearest-neighbor grids and nearest source sampling.');
}

export async function loadScienceSurface(root: string, value: unknown, sourceMesh?: SourceMesh | null): Promise<SourceScalar & {report?:Record<string,unknown>;fieldReport?:Record<string,unknown>}> {
  const lens=parseScienceInput(value);
  if (lens.format === 'obj-uv-fits') return loadObjUvFits(root, lens, sourceMesh);
  if (lens.format === 'image-plane-dem') return loadImageDemScience(root, lens, sourceMesh);
  if(lens.qualityMasks!==undefined){
    validateScienceQualityMasks(lens);
    const source=await loadScienceSurface(root,{...lens,qualityMasks:undefined},sourceMesh);
    const limits=lens.qualityMasks.map(parseQualityMask);
    const masks=await Promise.all(limits.map(mask=>loadScienceSurface(root,mask)));
    return {sample(longitude: number,latitude: number){
      for(let i=0;i<masks.length;i++){
        const value=masks[i].sample(longitude,latitude),limit=limits[i];
        if(value===null||!Number.isFinite(value)||value<(limit.minimum??-Infinity)||value>(limit.maximum??Infinity))return null;
      }
      return source.sample(longitude,latitude);
    }};
  }
  if (lens.format === 'pds-image') return loadPdsImage(root, lens);
  if (lens.format === 'facet-scalars') return loadFacetScalarSurface(root, lens, sourceMesh);
  if (lens.format === 'vtk-cell-categories') { if(!sourceMesh)throw new Error('Categorical science requires source mesh'); return loadVtkCategories(root, lens, sourceMesh); }
  if (lens.format === 'geologic-shapefile') return loadGeologySurface(root, lens);
  if (lens.format === 'pds3-scalar-map') return loadScalarMap(root, lens, sourceMesh);
  if (['pds3-radius-zip', 'pds-radial-table'].includes(lens.format)) {
    const loader = lens.format === 'pds-radial-table' ? loadPdsRadialTable : loadPdsScalarGrid;
    const raster = await loader(resolve(root, lens.path), lens.grid, lens.sampleGrid);
    return { sample(longitude: number, latitude: number) {
      if (latitude < -90 || latitude > 90) return null;
      const value = raster.sample(longitude, latitude);
      return value === null ? null : value * (lens.valueTransform?.scale ?? 1) + (lens.valueTransform?.offset ?? 0);
    } };
  }
  if (['stl', 'wavefront-obj', 'wavefront-obj-zip', 'pds-vertex-facet', 'pds-plate-model', 'vrml-mesh', 'pds-radius-table'].includes(lens.format)) return loadShapeScalarGrid(root, lens, sourceMesh);
  if (lens.additionalGrids?.length) {
    const rasters = await Promise.all([lens, ...lens.additionalGrids].map(entry =>
      loadScienceSurface(root, {...lens, ...entry, additionalGrids: undefined})));
    return { sample(longitude: number, latitude: number) {
      for (const raster of rasters) {
        const value = raster.sample(longitude, latitude);
        if (value !== null) return value;
      }
      return null;
    } };
  }
  if (lens.format === 'pds3-float-map') return loadPdsFloatMap(root, lens);
  if (lens.format === 'fits-image-map') return loadFitsImageMap(root, lens);
  if (lens.format === 'npy-dictionary-map') return loadNpyDictionaryMap(root, lens);
  if (lens.format === 'npy-lonlat-grid') return loadNpyLonLatGrid(root, value);
  if (lens.format === 'eclipse-map-fit') return loadEclipseMapFit(root, value);
  if (lens.format === 'published-phase-curve-map') return loadPublishedPhaseCurveMap(root, value);
  if (lens.format === 'eigenspectra-temperature') return loadEigenspectraTemperature(root, value);
  if (lens.format === 'healpix-npy-map') return loadHealpixNpyMap(root, value);
  if (lens.format === 'tecplot-lonlat-map') return loadTecplotLonLatMap(root, value);
  if (lens.format === 'latitude-belt-map') return loadLatitudeBeltMap(root, value);
  if (lens.format === 'bare-rock-fit') return loadBareRockFit(root, value);
  if (lens.format === 'bare-rock-eclipse') return loadBareRockEclipse(root, value);
  if (lens.format === 'isis3') {
    const grid = parseScienceGrid(lens.grid);
    const {data, origin, resolution} = await loadIsis3Raster(resolve(root, lens.path), grid);
    return {sample(longitude: number, latitude: number) {
      if (latitude < -90 || latitude > 90) return null;
      const [easting, northing] = scienceMapPoint(longitude, latitude, grid);
      return sampleScienceGrid(data, grid, (easting - origin[0]) / resolution[0],
        (northing - origin[1]) / resolution[1], lens);
    }};
  }
  if (lens.format !== 'geotiff') throw new Error(`Unsupported scientific source format: ${lens.format}`);
  const tiff = await fromFile(resolve(root, lens.path));
  try {
    const image = await tiff.getImage(), keys = image.getGeoKeys(), grid = parseScienceGrid(lens.grid);
    if(!keys)throw new Error("Missing scientific GeoTIFF keys");
    const polar = grid.projection === 'polar-stereographic';
    const geographic = grid.coordinates === 'degrees';
    if (grid.coordinates !== undefined && !['degrees', 'meters'].includes(grid.coordinates) || geographic && polar)
      throw new Error(`Unsupported scientific grid coordinates: ${lens.path}`);
    const projectionMatches = geographic
      ? keys.GTModelTypeGeoKey === 2 && keys.GTRasterTypeGeoKey === 1 && keys.GeogAngularUnitsGeoKey === 9102 &&
        keys.GeogSemiMinorAxisGeoKey === grid.referenceRadiusMeters && (keys.GeogPrimeMeridianLongGeoKey ?? 0) === 0 && grid.centerLongitude === 0
      : polar
      ? keys.ProjCoordTransGeoKey === 15 && keys.ProjNatOriginLatGeoKey === grid.poleLatitude &&
        keys.ProjStraightVertPoleLongGeoKey === grid.centerLongitude && keys.ProjScaleAtNatOriginGeoKey === 1
      : keys.ProjCoordTransGeoKey === 17 && keys.ProjCenterLongGeoKey === grid.centerLongitude;
    if (image.getWidth() !== grid.width || image.getHeight() !== grid.height || !projectionMatches ||
        keys.GeogSemiMajorAxisGeoKey !== grid.referenceRadiusMeters ||
        image.getGDALNoData() !== grid.noData) throw new Error(`Scientific source grid changed: ${lens.path}`);
    const origin = image.getOrigin(), resolution = image.getResolution();
    if (resolution[0] <= 0 || resolution[1] >= 0 || image.getSamplesPerPixel() !== 1 ||
        (grid.origin && (origin[0] !== grid.origin[0] || origin[1] !== grid.origin[1])) ||
        (grid.resolutionMeters && (resolution[0] !== grid.resolutionMeters || resolution[1] !== -grid.resolutionMeters)) ||
        (grid.resolution && (resolution[0] !== grid.resolution[0] || resolution[1] !== grid.resolution[1]))) {
      throw new Error(`Scientific source georeference changed: ${lens.path}`);
    }
    const data = numericRaster(await image.readRasters({ interleave: true }));
    return { sample(longitude: number, latitude: number) {
      if (latitude < -90 || latitude > 90 || Math.abs(latitude) >= (grid.withholdLatitudeDegrees??Infinity)) return null;
      if (grid.latitudeRange && (latitude < grid.latitudeRange[0] || latitude > grid.latitudeRange[1])) return null;
      const [easting, northing] = scienceMapPoint(longitude, latitude, grid);
      const x = (easting - origin[0]) / resolution[0];
      const y = (northing - origin[1]) / resolution[1];
      return sampleScienceGrid(data, grid, x, y, lens);
    } };
  } finally { await tiff.close(); }
}

/** Cartographic relief from the matched source facet, in local east/north/up.
 * The normal and radius come from that same surface, including overhangs; no
 * finite difference can accidentally cross to another radial branch. */
export function sourceSurfaceBrightness({ point, normal }: {point:readonly number[];normal:readonly number[]}, relief?: Relief) {
  if (!relief) return 1;
  const radius = Math.hypot(...point), horizontal = Math.hypot(point[0], point[1]);
  const east = horizontal > 0 ? [-point[1] / horizontal, point[0] / horizontal, 0] : [0, 1, 0];
  const up = point.map(n => n / radius);
  const north = [up[1]*east[2]-up[2]*east[1], up[2]*east[0]-up[0]*east[2], up[0]*east[1]-up[1]*east[0]];
  const light = up.map((_, i) => east[i] * relief.lightDirection[0] + north[i] * relief.lightDirection[1] + up[i] * relief.lightDirection[2]);
  const illumination = Math.max(0, normal.reduce((sum, n, i) => sum + n * light[i], 0));
  return (relief.ambient + (1 - relief.ambient) * illumination) /
    (relief.ambient + (1 - relief.ambient) * relief.lightDirection[2]);
}

/**
 * A numeric palette on a lossless (nearest-sampled) surface is looked up through 256 steps across its declared range: finer
 * than any legend stop and than the 8-bit channels, and it trims the noise between steps that lossless WebP pays for (baked
 * 2026-09-22 against 1024 steps: Moon heat anomalies 9.35 → 7.52 MB, rock abundance 9.02 → 7.87 MB, Titan interpolated
 * 2.59 → 1.19 MB). A lossy surface keeps 1024 steps: its size does not depend on colour count, and the flat one-level steps
 * a coarser ramp leaves on smooth slopes raised the q88 encoder's own error on Miranda's elevation from 41 to 66 at its worst
 * texel (raw pixels differ by at most 2). Relief shading multiplies the looked-up colour afterwards.
 */
export const LOSSLESS_PALETTE_STEPS = 256, LOSSY_PALETTE_STEPS = 1024;
export const paletteSteps = (lens: SciencePalette) => lens.displaySampling === 'nearest' ? LOSSLESS_PALETTE_STEPS : LOSSY_PALETTE_STEPS;
export function paletteLookup(lens: SciencePalette) {
  const { minimum, maximum } = lens;
  if (minimum === undefined || maximum === undefined || !(maximum > minimum)) throw new TypeError('A numeric palette needs a declared range.');
  const steps = paletteSteps(lens);
  const palette = Array.from({ length: steps }, (_, i) => colorForValue(minimum + i / (steps - 1) * (maximum - minimum), lens));
  return (value: number) => palette[Math.round(Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) * (steps - 1))]!;
}

export function createSourceSurfacePainter(lens: SciencePalette) {
  const palette = lens.categories ? null : paletteLookup(lens);
  return (sample: {value:number;point:readonly number[];normal:readonly number[]}) => {
    const color = lens.categories ? categoryColorForValue(sample.value, lens) : palette!(sample.value);
    const brightness = sourceSurfaceBrightness(sample, lens.relief);
    return color.map(c => Math.max(0, Math.min(255, Math.round(c * brightness))));
  };
}

/** The colour of drawn boundaries: black, as the contours of the papers' figures. */
const OUTLINE = [0, 0, 0] as const;

export function paintScienceSurface(source: SourceScalar, lens: SciencePalette, width: number, height: number) {
  const origin = lens.outputLongitudeOrigin ?? 0;
  if (!Number.isFinite(origin) || origin < -180 || origin >= 360) throw new TypeError('Invalid scientific output longitude origin.');
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const palette = lens.categories ? null : paletteLookup(lens);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = origin + (x + 0.5) / width * 360, latitude = 90 - (y + 0.5) / height * 180;
    const i = y * width + x, value = source.sample(longitude, latitude);
    if (value === null) { missing[i] = 1; continue; }
    // A source may draw published boundaries over its values, as a paper's figure draws contours on its map.
    const color = source.outline?.(longitude, latitude, 360 / width) ? OUTLINE : lens.categories ? categoryColorForValue(value, lens) : palette!(value);
    const brightness = lens.relief ? terrainBrightness(source, longitude, latitude, 360 / width, lens.relief) : 1;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.min(255, Math.round(color[c] * brightness));
  }
  return { rgb: paintMissingCoverage(rgb, { width, height, channels: 3 }, missing), missing };
}

/** Bilinear observations retain their complete four-sample validity footprint. */
export function sampleColorBand(band: Omit<ColorBand, "filter">, easting: number, northing: number) {
  const px = (easting - band.origin[0]) / band.resolution[0] - 0.5;
  const py = (northing - band.origin[1]) / band.resolution[1] - 0.5;
  const x = Math.floor(px), y = Math.floor(py);
  if (x < 0 || y < 0 || x + 1 >= band.width || y + 1 >= band.height) return null;
  const values = [band.data[y * band.width + x], band.data[y * band.width + x + 1],
    band.data[(y + 1) * band.width + x], band.data[(y + 1) * band.width + x + 1]];
  if (values.some(value => !Number.isFinite(value) || value === band.noData || Math.abs(value) > (band.specialValueMagnitude??Infinity))) return null;
  const dx = px - x, dy = py - y;
  return values[0] * (1 - dx) * (1 - dy) + values[1] * dx * (1 - dy) +
    values[2] * (1 - dx) * dy + values[3] * dx * dy;
}

export async function prepareObservedColor({ sourceDirectory, entries:values, profile:profileValue, width, height, photometry }: {sourceDirectory:string;entries:readonly unknown[];profile:unknown;width:number;height:number;photometry?:{geometry:ReadonlyMap<string,ObservationGeometry>;profile:PhotometryProfile}|null}) {
  // The filters name the bands. Corrected colour is matched in display-linear I/F, so only uncorrected colour declares a range.
  checkKeys(profileValue,['sampleFormat','sampleBytes','noData','referenceRadiusMeters','centerLongitude','standardParallel','filters'],['specialValueMagnitude','displayRange'],'observed color profile');
  const entries=values.map(parseColorEntry),profile=parseColorSourceProfile(profileValue);
  if(!photometry===(profile.displayRange===undefined))throw new TypeError('Observed calibrated color declares a display range exactly when it is not photometrically matched.');
  const groups = new Map<string,ColorBand[]>();
  for (const entry of entries) {
    const file = await fromFile(resolve(sourceDirectory, entry.path));
    try {
      const image = await file.getImage(), keys = image.getGeoKeys();
      const origin = image.getOrigin(), resolution = image.getResolution();
      const band = await image.getGDALMetadata(0);
      if(!keys||!band)throw new Error("Missing observed color source metadata");
      if (image.getWidth() !== entry.width || image.getHeight() !== entry.height ||
          image.getSampleFormat(0) !== profile.sampleFormat || image.getSampleByteSize(0) !== profile.sampleBytes || image.getGDALNoData() !== profile.noData ||
          keys.GeogSemiMajorAxisGeoKey !== profile.referenceRadiusMeters || keys.ProjCenterLongGeoKey !== profile.centerLongitude ||
          keys.ProjStdParallel1GeoKey !== profile.standardParallel || resolution[0] <= 0 || resolution[1] >= 0 ||
          Number(band.WAVELENGTH) !== entry.wavelengthMicrometers || band.DESCRIPTION !== entry.filter) {
        throw new Error(`Observed color source mapping or filter changed: ${entry.id}`);
      }
      const [data] = numericRasterBands(await image.readRasters());
      if (!groups.has(entry.observation)) groups.set(entry.observation, []);
      groups.get(entry.observation)!.push({ ...entry, data, origin, resolution,
        noData: profile.noData, specialValueMagnitude: profile.specialValueMagnitude,
        ...(photometry?{capture:photometry.geometry.get(entry.id)}:{}) });
      if(photometry&&(!photometry.geometry.has(entry.id)||!Object.hasOwn(photometry.profile.observationWeights,entry.observation)))throw new Error(`Missing pinned observation geometry: ${entry.id}`);
    } finally { await file.close(); }
  }
  const context={groups,profile,width,height,sourceIds:entries.map(entry=>entry.id)};
  return photometry?composeCorrectedColor({...context,photometryProfile:photometry.profile,sampleColorBand}):composeObservedColor(context);
}

/** Highest native density owns a pixel only when every authored channel exists. */
export function composeObservedColor({ groups, profile, width, height, sourceIds = [] }: ObservedColorContext) {
  const display=bandColorDisplay(profile.filters,'radiance-factor',profile.displayRange);
  const samples = new Float32Array(width * height * 3), missing = new Uint8Array(width * height).fill(1), coverage: Record<string,{pixels:number;surfacePercent:number}> = {};
  const ordered = [...groups].sort((a, b) => a[1][0].resolution[0] - b[1][0].resolution[0]);
  for (const [observation, bands] of ordered) {
    const channels = profile.filters.map(filter => bands.filter(band => band.filter === filter));
    if (channels.some(channel => !channel.length)) throw new Error(`Incomplete color observation: ${observation}`);
    let pixels = 0, solidAngle = 0;
    for (let y = 0; y < height; y++) {
      const latitude = (90 - (y + 0.5) * 180 / height) * Math.PI / 180;
      const northing = latitude * profile.referenceRadiusMeters;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!missing[index]) continue;
        const easting = ((x + 0.5) * 360 / width - profile.centerLongitude) * Math.PI / 180 * profile.referenceRadiusMeters;
        const values = channels.map(channel => {
          for (const band of channel) {
            const value = sampleColorBand(band, easting, northing);
            if (value !== null) return value;
          }
          return null;
        });
        if (!values.every((value): value is number => value !== null)) continue;
        missing[index] = 0; pixels++; solidAngle += Math.cos(latitude);
        for (let c = 0; c < 3; c++) samples[index * 3 + c] = values[c];
      }
    }
    coverage[observation] = { pixels, surfacePercent: solidAngle / (width * height * 2 / Math.PI) * 100 };
  }
  return { rgb:encodeBandColor(samples,missing,display), missing, coverage, sourceIds,display,colorDisplay:bandColorEvidence(display) };
}
