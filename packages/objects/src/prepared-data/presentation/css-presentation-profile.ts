/** Authored CSS presentation profile; compilation stays with bake. */
export const CSS_PRESENTATION_PROFILE_SCHEMA = 'cssearth-css-presentation-profile@2';

export interface PresentationProfile {
  schema: typeof CSS_PRESENTATION_PROFILE_SCHEMA; namespace: string;
  mode: 'row-bank-cutaway' | 'composite' | 'emissive';
  /** Authored surface targets (positive-east degrees) selected with a dataset; composite only. */
  datasetFocus?: Record<string, { longitudeDegrees: number; latitudeDegrees: number; zoom: number }>;
  /** A pulsating star's published light-curve model, source-relative; emissive only (photometry/light-curve.ts). `stills`
   * names the dataset step group whose members each draw the star at one moment of that light curve: the played light
   * curve is not drawn over them. */
  lightCurve?: { model: string; stills?: string };
}
export function parsePresentationProfile(value: unknown): PresentationProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Presentation profile must be an object.');
  const input = value as Record<string, unknown>;
  if (input.schema !== CSS_PRESENTATION_PROFILE_SCHEMA || typeof input.namespace !== 'string' ||
      !/^[a-z][a-z0-9-]*$/.test(input.namespace) || !['row-bank-cutaway', 'composite', 'emissive'].includes(String(input.mode))) {
    throw new TypeError('Unsupported CSS presentation profile.');
  }
  if (input.textureLevels !== undefined) throw new TypeError('Raster surfaces have one prepared density; remove textureLevels.');
  if (input.datasetFocus !== undefined) {
    if (input.mode !== 'composite' || !input.datasetFocus || typeof input.datasetFocus !== 'object' || Array.isArray(input.datasetFocus)) throw new TypeError('Dataset focus requires the composite presentation.');
    for (const [dataset, focus] of Object.entries(input.datasetFocus as Record<string, Record<string, unknown>>)) {
      if (!/^[a-z][a-z0-9-]*$/.test(dataset) || !['longitudeDegrees', 'latitudeDegrees', 'zoom'].every(key => typeof focus[key] === 'number' && Number.isFinite(focus[key]))) throw new TypeError(`Dataset focus ${dataset} needs finite coordinates and zoom.`);
    }
  }
  if (input.lightCurve !== undefined) {
    const lightCurve = input.lightCurve as Record<string, unknown> | null;
    if (input.mode !== 'emissive' || !lightCurve || typeof lightCurve !== 'object' || Array.isArray(lightCurve) ||
        !['model', 'model,stills'].includes(Object.keys(lightCurve).join()) || lightCurve.model !== 'photometry/gaia-dr3-vari-cepheid.csv' ||
        (lightCurve.stills !== undefined && (typeof lightCurve.stills !== 'string' || !/^[a-z][a-z0-9-]*$/.test(lightCurve.stills))))
      throw new TypeError(`${input.namespace}: lightCurve needs the emissive presentation and { "model": "photometry/gaia-dr3-vari-cepheid.csv" }, with the id of a dataset step group as "stills" or without, got ${JSON.stringify(input.lightCurve)}.`);
  }
  return input as unknown as PresentationProfile;
}
