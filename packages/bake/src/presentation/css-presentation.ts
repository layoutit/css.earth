import { OBJECT_RUNTIME_SCHEMA, parsePreparedObjectRuntime } from '@cssearth/objects';

import { presentationAdapters, type PresentationHostAdapters } from './adapters.ts';
import { requirePreparedPresentation } from './prepared-presentation-contract.ts';
import { prepareRowBankCutaway } from './row-bank-cutaway.ts';
import { prepareComposite } from './composite.ts';
import { prepareEmissive } from './emissive.ts';
import type { PresentationInputs } from './types.ts';
import { prepareActivationGroups } from './prepared-activation-groups.ts';
export type { PresentationInputs } from './types.ts';

export interface PresentationProfile {
  schema: 'cssearth-css-presentation-profile@2'; namespace: string;
  mode: PresentationInputs['mode'];
  /** Authored surface targets (positive-east degrees) selected with a dataset; composite only. */
  datasetFocus?: Record<string, { longitudeDegrees: number; latitudeDegrees: number; zoom: number }>;
  /** A pulsating star's published light-curve model, source-relative; emissive only (photometry/light-curve.ts). */
  lightCurve?: { model: string };
}
export function parsePresentationProfile(value: unknown): PresentationProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Presentation profile must be an object.');
  const input = value as Record<string, unknown>;
  if (input.schema !== 'cssearth-css-presentation-profile@2' || typeof input.namespace !== 'string' ||
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
        Object.keys(lightCurve).join() !== 'model' || lightCurve.model !== 'photometry/gaia-dr3-vari-cepheid.csv')
      throw new TypeError(`${input.namespace}: lightCurve needs the emissive presentation and { "model": "photometry/gaia-dr3-vari-cepheid.csv" }, got ${JSON.stringify(input.lightCurve)}.`);
  }
  return input as unknown as PresentationProfile;
}
/** Compile capabilities into a retained CSS tree; the runtime accepts only validated data. */
export async function prepareCssPresentation(input: PresentationInputs, host: PresentationHostAdapters) {
  if (input.namespace !== input.solarSource.bodyId) throw new TypeError('Presentation and physical source identities disagree.');
  const adapters = presentationAdapters(host);
  const compile = input.mode === 'row-bank-cutaway' ? prepareRowBankCutaway : input.mode === 'composite' ? prepareComposite : input.mode === 'emissive' ? prepareEmissive : null;
  if (!compile) throw new TypeError('Unsupported material composition.');
  const draft = await compile(input, adapters);
  const presentation = { ...draft, materials: adapters.prepareMaterialTracks(draft),
    tree: { ...draft.tree, activationGroups: prepareActivationGroups(draft) } };
  requirePreparedPresentation(presentation, { controls: input.controls });
  return parsePreparedObjectRuntime({ ...presentation, schema: OBJECT_RUNTIME_SCHEMA,
    id: input.solarSource.bodyId, controls: input.controls });
}
