/** A neutron star's surface temperature map drawn from a published pulse-profile fit: the paper's own hot-region parameters, no refit.
 *
 * NICER papers fit the X-ray pulse of a millisecond pulsar with X-PSI (Riley et al. 2023, JOSS 8, 4977), whose hot regions are
 * built from circles on the sphere. Each region has a `superseding` circle of one effective temperature and, optionally,
 * - an `omit` circle that removes its part of the superseding circle. Only the concentric case is read (a ring, X-PSI's CST);
 * - a `cede` circle of a second temperature, shown wherever the superseding circle does not cover it (X-PSI's PDT).
 *
 * The frame is X-PSI's. Colatitude is measured from the rotation pole the paper calls north. A region's phase is in cycles from the
 * meridian that faces Earth at the fit's phase zero, or from the opposite meridian when the paper says so (`antiphased`); X-PSI's own
 * projection tool (xpsi/utilities/ProjectionTool.py, `transform`) turns a phase into a right-handed rotation about that pole, so east
 * longitude here is 360 x phase, plus 180 for an antiphased region, and a ceding circle's centre lies its `azimuthRadians` east of
 * its superseding circle's (the same file: phi_c = phi_s + cede_azimuth / 2 pi).
 *
 * A point inside a circle is one whose great-circle angle from the circle's centre is at most the circle's angular radius. Regions
 * are refused if they overlap, as X-PSI refuses them.
 *
 * These fits give the surface outside the regions no temperature. A record may add `bulk`: the temperature another measurement
 * gives the whole surface apart from the hot regions (a far-ultraviolet and soft X-ray spectrum), with its own source. The surface
 * outside every region then has that temperature; without it, it has no value. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

const cell = (value: unknown, label: string) => requireFiniteNumber(requireRecord(value, label).value, `${label}.value`);

export interface HotCircle { readonly colatitudeRadians: number; readonly longitudeDegrees: number; readonly radiusRadians: number }
export interface HotRegion {
  readonly id: string;
  readonly superseding: HotCircle & { readonly kelvin: number };
  /** Angular radius of the concentric circle that does not emit. */
  readonly omitRadiusRadians?: number;
  readonly ceding?: HotCircle & { readonly kelvin: number };
}
export interface PublishedHotRegions { readonly source: string; readonly regions: readonly HotRegion[];
  /** The measured temperature of the surface outside the hot regions, from its own source. */
  readonly bulk?: { readonly kelvin: number; readonly source: string; readonly url: string } }

const DEGREES = 180 / Math.PI;
const wrap = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;

/** Great-circle angle between a circle's centre and the point at `longitude`, `latitude` (degrees), in radians. */
function angleFrom(circle: HotCircle, longitude: number, latitude: number) {
  const colatitude = (90 - latitude) / DEGREES, difference = (longitude - circle.longitudeDegrees) / DEGREES;
  const cosine = Math.cos(circle.colatitudeRadians) * Math.cos(colatitude) + Math.sin(circle.colatitudeRadians) * Math.sin(colatitude) * Math.cos(difference);
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

/** Reads `cssearth-published-hot-regions@1`: every number is a table cell `{ value, cell }` whose source the record names. */
export function parsePublishedHotRegions(value: unknown): PublishedHotRegions {
  const input = requireRecord(value, 'published hot regions');
  if (input.schema !== 'cssearth-published-hot-regions@1') throw new TypeError('Published hot regions use cssearth-published-hot-regions@1.');
  const regions = requireArray(input.regions, 'regions').map((entry, index): HotRegion => {
    const region = requireRecord(entry, `regions[${index}]`), id = requireString(region.id, `regions[${index}].id`), at = (key: string) => `${id}.${key}`;
    if (region.antiphased !== undefined && typeof region.antiphased !== 'boolean') throw new TypeError(`${at('antiphased')} is true, false or absent.`);
    const longitude = 360 * cell(region.phaseCycles, at('phaseCycles')) + (region.antiphased === true ? 180 : 0);
    const circle = (source: unknown, label: string, offsetRadians = 0): HotCircle => {
      const c = requireRecord(source, label), colatitudeRadians = cell(c.colatitudeRadians, `${label}.colatitudeRadians`), radiusRadians = cell(c.radiusRadians, `${label}.radiusRadians`);
      if (!(colatitudeRadians >= 0 && colatitudeRadians <= Math.PI)) throw new RangeError(`${label}.colatitudeRadians ${colatitudeRadians} is outside 0 to pi.`);
      if (!(radiusRadians > 0 && radiusRadians <= Math.PI / 2)) throw new RangeError(`${label}.radiusRadians ${radiusRadians} is outside 0 to pi/2.`);
      return { colatitudeRadians, longitudeDegrees: wrap(longitude + offsetRadians * DEGREES), radiusRadians };
    };
    const kelvin = (source: unknown, label: string) => {
      const log10 = cell(requireRecord(source, label).log10TemperatureK, `${label}.log10TemperatureK`);
      if (!(log10 >= 3 && log10 <= 7.6)) throw new RangeError(`${label}.log10TemperatureK ${log10} is outside X-PSI's 3 to 7.6.`);
      return 10 ** log10;
    };
    const superseding = { ...circle(region.superseding, at('superseding')), kelvin: kelvin(region.superseding, at('superseding')) };
    const omit = region.omit === undefined ? undefined : cell(requireRecord(region.omit, at('omit')).radiusRadians, at('omit.radiusRadians'));
    if (omit !== undefined && !(omit > 0 && omit < superseding.radiusRadians)) throw new RangeError(`${at('omit.radiusRadians')} ${omit} must be inside the superseding circle's ${superseding.radiusRadians}.`);
    if (omit !== undefined && region.cede !== undefined) throw new TypeError(`${id}: a region has an omit circle or a cede circle, not both.`);
    const cede = region.cede === undefined ? undefined : requireRecord(region.cede, at('cede'));
    const ceding = cede === undefined ? undefined : { ...circle(cede, at('cede'), cell(cede.azimuthRadians, at('cede.azimuthRadians'))), kelvin: kelvin(cede, at('cede')) };
    return { id, superseding, ...(omit === undefined ? {} : { omitRadiusRadians: omit }), ...(ceding ? { ceding } : {}) };
  });
  if (!regions.length) throw new TypeError('Published hot regions name at least one region.');
  if (new Set(regions.map(region => region.id)).size !== regions.length) throw new TypeError('Hot region ids repeat.');
  // X-PSI refuses overlapping regions; a transcription that makes them overlap is a wrong cell.
  const circles = regions.map(region => [region.superseding, ...region.ceding ? [region.ceding] : []]);
  for (let a = 0; a < circles.length; a++) for (let b = a + 1; b < circles.length; b++) for (const first of circles[a]!) for (const second of circles[b]!) {
    if (angleFrom(first, second.longitudeDegrees, 90 - second.colatitudeRadians * DEGREES) < first.radiusRadians + second.radiusRadians)
      throw new RangeError(`Hot regions ${regions[a]!.id} and ${regions[b]!.id} overlap.`);
  }
  const bulk = input.bulk === undefined ? undefined : (() => {
    const b = requireRecord(input.bulk, 'bulk'), kelvin = cell(b.temperatureK, 'bulk.temperatureK'), coolest = Math.min(...circles.flat().map(circle => circle.kelvin));
    if (!(kelvin > 0 && kelvin < coolest)) throw new RangeError(`bulk.temperatureK ${kelvin} must be positive and below the coolest hot region's ${Math.round(coolest)} K.`);
    return { kelvin, source: requireString(b.source, 'bulk.source'), url: requireString(b.url, 'bulk.url') };
  })();
  return { source: requireString(input.source, 'source'), regions, ...(bulk ? { bulk } : {}) };
}

/** Effective temperature in kelvin at a point; outside every region, the bulk temperature when the record has one, else null. */
export function hotRegionTemperature(record: PublishedHotRegions, longitude: number, latitude: number): number | null {
  for (const region of record.regions) {
    const fromCentre = angleFrom(region.superseding, longitude, latitude);
    if (fromCentre <= region.superseding.radiusRadians && !(region.omitRadiusRadians !== undefined && fromCentre < region.omitRadiusRadians)) return region.superseding.kelvin;
    if (region.ceding && angleFrom(region.ceding, longitude, latitude) <= region.ceding.radiusRadians) return region.ceding.kelvin;
  }
  return record.bulk?.kelvin ?? null;
}

/** The share of the sphere a circle of angular radius `radians` covers. */
const capShare = (radians: number) => (1 - Math.cos(radians)) / 2;

/** The map of a parsed record, as `loadPublishedHotRegionMap` reads it from a file. */
export function publishedHotRegionMap(record: PublishedHotRegions) {
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      return hotRegionTemperature(record, longitude, latitude);
    },
    report: { format: 'published-hot-region-map', units: 'K', source: record.source, ...(record.bulk ? { bulk: record.bulk } : {}),
      regions: record.regions.map(region => ({ id: region.id,
        superseding: { latitudeDegrees: 90 - region.superseding.colatitudeRadians * DEGREES, eastLongitudeDegrees: region.superseding.longitudeDegrees, radiusDegrees: region.superseding.radiusRadians * DEGREES, kelvin: region.superseding.kelvin,
          sphereShare: capShare(region.superseding.radiusRadians) - (region.omitRadiusRadians === undefined ? 0 : capShare(region.omitRadiusRadians)) },
        ...(region.omitRadiusRadians === undefined ? {} : { omitRadiusDegrees: region.omitRadiusRadians * DEGREES }),
        ...(region.ceding ? { ceding: { latitudeDegrees: 90 - region.ceding.colatitudeRadians * DEGREES, eastLongitudeDegrees: region.ceding.longitudeDegrees, radiusDegrees: region.ceding.radiusRadians * DEGREES, kelvin: region.ceding.kelvin } } : {}) })) },
  };
}

export async function loadPublishedHotRegionMap(root: string, value: unknown) {
  const dataset = requireRecord(value, 'published hot-region dataset'), path = requireString(dataset.path, 'path');
  if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('Published hot regions must be inside the source directory.');
  return publishedHotRegionMap(parsePublishedHotRegions(JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown));
}
