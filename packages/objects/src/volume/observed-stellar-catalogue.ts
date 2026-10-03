/** Observed stellar catalogue wire data; projection and display selection stay with reconstruction. */
import { isFiniteNumber as coreIsFiniteNumber, isRecord as coreIsRecord } from '@cssearth/core';

export const OBSERVED_STELLAR_CATALOGUE_SCHEMA = 'cssearth-observed-stellar-catalogue@1';

const record = coreIsRecord;
const finite = coreIsFiniteNumber;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 128;
const coordinate = (ra: unknown, dec: unknown): boolean => finite(ra) && ra >= 0 && ra < 360 && finite(dec) && dec >= -90 && dec <= 90;
const error = (v: unknown): v is number | null => v === null || finite(v) && v >= 0;
export type PhotometryKind = 'johnson-measured' | 'tycho-johnson-approximation';
export interface ObservedStar {
  id: string;
  raDegrees: number;
  decDegrees: number;
  properMotionRaCosDecMasPerYear: number;
  properMotionDecMasPerYear: number;
  magnitudeV: number;
  colorIndexBV: number | null;
  sourceId: string;
  sourceEpochJulianYear: number;
  sourceRaDegrees: number;
  sourceDecDegrees: number;
  photometry: { kind: PhotometryKind; errorMagnitudeV: number | null; errorColorIndexBV: number | null };
}

/** Decode consumed catalogue fields; extra source columns remain in the pinned source, not type assertions. */
function readStar(value: unknown): ObservedStar {
  if (!record(value) || !text(value.id) || !finite(value.raDegrees) || !finite(value.decDegrees) ||
      !coordinate(value.raDegrees, value.decDegrees) || !finite(value.properMotionRaCosDecMasPerYear) ||
      !finite(value.properMotionDecMasPerYear) || !finite(value.magnitudeV) || value.magnitudeV < -30 || value.magnitudeV > 40 ||
      !(value.colorIndexBV === null || finite(value.colorIndexBV) && value.colorIndexBV >= -2 && value.colorIndexBV <= 10) ||
      !text(value.sourceId) || !finite(value.sourceEpochJulianYear) || value.sourceEpochJulianYear < 1800 || value.sourceEpochJulianYear > 2200 ||
      !finite(value.sourceRaDegrees) || !finite(value.sourceDecDegrees) || !coordinate(value.sourceRaDegrees, value.sourceDecDegrees) ||
      !record(value.photometry)) throw new TypeError('Invalid observed stellar catalogue record.');
  const p = value.photometry;
  if ((p.kind !== 'johnson-measured' && p.kind !== 'tycho-johnson-approximation') ||
      !error(p.errorMagnitudeV) || !error(p.errorColorIndexBV)) throw new TypeError('Invalid observed stellar photometry.');
  return { id: value.id, raDegrees: value.raDegrees, decDegrees: value.decDegrees,
    properMotionRaCosDecMasPerYear: value.properMotionRaCosDecMasPerYear, properMotionDecMasPerYear: value.properMotionDecMasPerYear,
    magnitudeV: value.magnitudeV, colorIndexBV: value.colorIndexBV, sourceId: value.sourceId,
    sourceEpochJulianYear: value.sourceEpochJulianYear, sourceRaDegrees: value.sourceRaDegrees, sourceDecDegrees: value.sourceDecDegrees,
    photometry: { kind: p.kind, errorMagnitudeV: p.errorMagnitudeV, errorColorIndexBV: p.errorColorIndexBV } };
}

export interface ObservedStellarCatalogueEnvelope {
  schema: typeof OBSERVED_STELLAR_CATALOGUE_SCHEMA; id: string; frame: 'ICRS'; coordinateEpochJulianYear: 2000; stars: unknown[];
}
export interface ObservedStellarCatalogue extends ObservedStellarCatalogueEnvelope { stars: ObservedStar[] }

/** Envelope admission runs before the caller validates its frame and selection policy. */
export function readObservedStellarCatalogueEnvelope(value: unknown): ObservedStellarCatalogueEnvelope {
  if (!record(value) || value.schema !== OBSERVED_STELLAR_CATALOGUE_SCHEMA || !text(value.id) || value.frame !== 'ICRS' ||
      value.coordinateEpochJulianYear !== 2000 || !Array.isArray(value.stars) || value.stars.length > 200000)
    throw new TypeError('Observed stellar catalogue requires ICRS positions at epoch 2000.');
  return { schema: OBSERVED_STELLAR_CATALOGUE_SCHEMA, id: value.id, frame: value.frame,
    coordinateEpochJulianYear: value.coordinateEpochJulianYear, stars: value.stars };
}

export function parseObservedStellarCatalogue(input: unknown): ObservedStellarCatalogue {
  const value = readObservedStellarCatalogueEnvelope(input);
  const sourceStars = value.stars.map(readStar), ids = new Set<string>();
  for (const star of sourceStars) {
    if (ids.has(star.id)) throw new TypeError('Duplicate observed stellar catalogue identity.');
    ids.add(star.id);
  }
  return { ...value, stars: sourceStars };
}
