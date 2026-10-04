/** Gaia/Bailer-Jones field wire data, with the historical consumer subsets made explicit. */
import { readNonblankText, isRecord } from '@cssearth/core';

const invalidText = (): never => { throw new TypeError('Catalogue field requires nonempty text.'); };
export const GAIA_NEBULA_FIELD_SCHEMA = 'cssearth-gaia-nebula-field@1';

export interface GaiaNebulaFieldStar {
  sourceId: string; raDeg: number; decDeg: number; distancePc: number; distanceLowerPc: number; distanceUpperPc: number;
  pmRaMasYr: number | null; pmDecMasYr: number | null; photGMeanMag: number; bpRp: number | null;
  parallaxMas: number; parallaxErrorMas: number; ruwe: number;
}
export interface GaiaNebulaFieldSelection {
  centerIcrsDegrees: [number, number]; distancePc: number; outerRadiusPc: number; featherStartPc: number;
  maximumStars: number; retainedMatchArcsec: number; retainIds: string[]; retainedAppearance: 'dataset' | 'anchor';
  limitingMagnitude: number; fadeMagnitude: number; referenceMagnitude: number; referenceDiameterPx: number; referenceFocalPixels: number;
}
export interface GaiaNebulaCatalogueField {
  id: string; coordinateEpochJulianYear: number; stars: GaiaNebulaFieldStar[]; selection: GaiaNebulaFieldSelection;
}
/** The complete authored wire record; the catalogue parser supplies the two historical selection defaults. */
export interface GaiaNebulaFieldDocument extends Omit<GaiaNebulaCatalogueField, 'selection'> {
  schema: typeof GAIA_NEBULA_FIELD_SCHEMA;
  selection: Omit<GaiaNebulaFieldSelection, 'retainedMatchArcsec' | 'retainedAppearance'> & {
    retainedMatchArcsec?: number | null; retainedAppearance?: 'dataset' | 'anchor' | null;
  };
}
/** The astrometry-table subset preserves historical Number/String coercion, including nonfinite values.
 * Scientific astrometry admission remains the caller's responsibility. It does not require selection or photometry. */
export interface GaiaNebulaAstrometryRow {
  id: string; raDeg: number; decDeg: number; epochJulianYear: number; pmRaCosDecMasYr: number; pmDecMasYr: number;
  parallaxMas?: number; parallaxErrorMas?: number;
}
export type GaiaNebulaFieldSubset = 'catalogue-selection' | 'astrometry-table';
function record(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new TypeError('Catalogue field requires an object.');
  return v;
}
function number(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Catalogue field requires finite numbers.');
  return v;
}
function positive(v: unknown): number {
  const n = number(v); if (!(n > 0)) throw new TypeError('Catalogue field requires positive values.'); return n;
}
function nullable(v: unknown): number | null { return v === null ? null : number(v); }

function sky(raValue: unknown, decValue: unknown): [number, number] {
  const ra = number(raValue), dec = number(decValue);
  if (ra < 0 || ra >= 360 || Math.abs(dec) > 90) throw new TypeError('Catalogue field ICRS coordinates are invalid.');
  return [ra, dec];
}
function astrometryRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
export function parseGaiaNebulaField(input: unknown, options: { subset: 'catalogue-selection' }): GaiaNebulaCatalogueField;
export function parseGaiaNebulaField(input: unknown, options: { subset: 'astrometry-table' }): GaiaNebulaAstrometryRow[];
export function parseGaiaNebulaField(input: unknown, options: { subset: GaiaNebulaFieldSubset }): GaiaNebulaCatalogueField | GaiaNebulaAstrometryRow[] {
  if (options.subset === 'astrometry-table') {
    const source = astrometryRecord(input, 'astrometry member');
    if (source.schema !== GAIA_NEBULA_FIELD_SCHEMA || !Array.isArray(source.stars))
      throw new TypeError('The public astrometry executor reads a Gaia-named CSV table or the pinned Gaia nebula-field schema.');
    const epoch = Number(source.coordinateEpochJulianYear);
    return source.stars.map((raw, index) => {
      const row = astrometryRecord(raw, `star ${index}`);
      return { id: String(row.sourceId), raDeg: Number(row.raDeg), decDeg: Number(row.decDeg), epochJulianYear: epoch,
        pmRaCosDecMasYr: Number(row.pmRaMasYr), pmDecMasYr: Number(row.pmDecMasYr),
        ...(row.parallaxMas === undefined ? {} : { parallaxMas: Number(row.parallaxMas) }),
        ...(row.parallaxErrorMas === undefined ? {} : { parallaxErrorMas: Number(row.parallaxErrorMas) }) };
    });
  }
  const value = record(input), selection = record(value.selection);
  if (value.schema !== GAIA_NEBULA_FIELD_SCHEMA || !/^[a-z][a-z0-9-]*$/.test(readNonblankText(value.id, '', invalidText))) {
    throw new TypeError('Invalid Gaia catalogue field schema or identity.');
  }
  const center = selection.centerIcrsDegrees;
  if (!Array.isArray(center) || center.length !== 2) throw new TypeError('Catalogue field needs a two-coordinate centre.');
  const centerIcrsDegrees = sky(center[0], center[1]), distancePc = positive(selection.distancePc);
  const outerRadiusPc = positive(selection.outerRadiusPc), featherStartPc = number(selection.featherStartPc);
  const maximumStars = number(selection.maximumStars), retainedMatchArcsec = number(selection.retainedMatchArcsec ?? 0);
  if (featherStartPc < 0 || featherStartPc >= outerRadiusPc || !Number.isInteger(maximumStars) ||
      maximumStars < 1 || maximumStars > 2000 || retainedMatchArcsec < 0 || retainedMatchArcsec > 180 * 3600) {
    throw new TypeError('Invalid catalogue field sphere, fade, match radius or budget.');
  }
  if (!Array.isArray(selection.retainIds)) throw new TypeError('Catalogue field needs explicit retained identities.');
  const retainIds = selection.retainIds.map(value => readNonblankText(value, '', invalidText));
  const retainedAppearance = selection.retainedAppearance ?? 'dataset';
  if (retainedAppearance !== 'dataset' && retainedAppearance !== 'anchor') throw new TypeError('Invalid retained star appearance policy.');
  if (new Set(retainIds).size !== retainIds.length || retainIds.length > maximumStars) throw new TypeError('Invalid retained catalogue identities or budget.');
  if (!Array.isArray(value.stars)) throw new TypeError('Catalogue field requires source rows.');
  const ids = new Set<string>();
  const stars = value.stars.map(inputStar => {
    const s = record(inputStar), sourceId = readNonblankText(s.sourceId, '', invalidText), [raDeg, decDeg] = sky(s.raDeg, s.decDeg);
    if (!/^\d{10,20}$/.test(sourceId) || ids.has(sourceId)) throw new TypeError('Gaia source identities must be unique decimal strings.');
    ids.add(sourceId);
    const distancePc = positive(s.distancePc), distanceLowerPc = positive(s.distanceLowerPc), distanceUpperPc = positive(s.distanceUpperPc);
    if (distanceLowerPc > distancePc || distancePc > distanceUpperPc) throw new TypeError('Invalid Gaia distance posterior quantiles.');
    return { sourceId, raDeg, decDeg, distancePc, distanceLowerPc, distanceUpperPc,
      pmRaMasYr: nullable(s.pmRaMasYr), pmDecMasYr: nullable(s.pmDecMasYr), photGMeanMag: number(s.photGMeanMag),
      bpRp: nullable(s.bpRp), parallaxMas: number(s.parallaxMas), parallaxErrorMas: positive(s.parallaxErrorMas), ruwe: positive(s.ruwe) };
  });
  return { id: readNonblankText(value.id, '', invalidText), coordinateEpochJulianYear: number(value.coordinateEpochJulianYear), stars,
    selection: { centerIcrsDegrees, distancePc, outerRadiusPc, featherStartPc, maximumStars, retainedMatchArcsec, retainIds, retainedAppearance,
      limitingMagnitude: number(selection.limitingMagnitude), fadeMagnitude: positive(selection.fadeMagnitude),
      referenceMagnitude: number(selection.referenceMagnitude), referenceDiameterPx: positive(selection.referenceDiameterPx),
      referenceFocalPixels: positive(selection.referenceFocalPixels) } };
}
