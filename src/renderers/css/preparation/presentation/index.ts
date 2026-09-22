import { parsePreparedObjectRuntime } from '../../validation/index.js';
import { loadPresentationAdapters } from './adapters.js';
import { prepareRowBankCutaway } from './row-bank-cutaway.js';
import { prepareComposite } from './composite.js';
import { prepareEmissive } from './emissive.js';
import type { PresentationInputs } from './types.js';
import { prepareActivationGroups } from '../../../../../tools/prepared/prepared-activation-groups.mts';
export type { PresentationInputs } from './types.js';

export interface PresentationProfile {
  schema: 'cssearth-css-presentation-profile@1'; namespace: string;
  mode: PresentationInputs['mode'];
  /** Authored surface targets (positive-east degrees) selected with a lens; composite only. */
  lensFocus?: Record<string, { longitudeDegrees: number; latitudeDegrees: number; zoom: number }>;
}
export function parsePresentationProfile(value: unknown): PresentationProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Presentation profile must be an object.');
  const input = value as Record<string, unknown>;
  if (input.schema !== 'cssearth-css-presentation-profile@1' || typeof input.namespace !== 'string' ||
      !/^[a-z][a-z0-9-]*$/.test(input.namespace) || !['row-bank-cutaway', 'composite', 'emissive'].includes(String(input.mode))) {
    throw new TypeError('Unsupported CSS presentation profile.');
  }
  if (input.textureLevels !== undefined) throw new TypeError('Raster surfaces have one prepared density; remove textureLevels.');
  if (input.lensFocus !== undefined) {
    if (input.mode !== 'composite' || !input.lensFocus || typeof input.lensFocus !== 'object' || Array.isArray(input.lensFocus)) throw new TypeError('Lens focus requires the composite presentation.');
    for (const [lens, focus] of Object.entries(input.lensFocus as Record<string, Record<string, unknown>>)) {
      if (!/^[a-z][a-z0-9-]*$/.test(lens) || !['longitudeDegrees', 'latitudeDegrees', 'zoom'].every(key => typeof focus[key] === 'number' && Number.isFinite(focus[key]))) throw new TypeError(`Lens focus ${lens} needs finite coordinates and zoom.`);
    }
  }
  return input as unknown as PresentationProfile;
}
/** Compile capabilities into a retained CSS tree; the runtime accepts only validated data. */
export async function prepareCssPresentation(input: PresentationInputs) {
  if (input.namespace !== input.solarSource.bodyId) throw new TypeError('Presentation and physical source identities disagree.');
  const adapters = await loadPresentationAdapters();
  const compile = input.mode === 'row-bank-cutaway' ? prepareRowBankCutaway : input.mode === 'composite' ? prepareComposite : input.mode === 'emissive' ? prepareEmissive : null;
  if (!compile) throw new TypeError('Unsupported material composition.');
  const draft = await compile(input, adapters);
  const presentation = { ...draft, materials: adapters.prepareMaterialTracks(draft),
    tree: { ...draft.tree, activationGroups: prepareActivationGroups(draft) } };
  adapters.requirePreparedPresentation(presentation, { controls: input.controls });
  return parsePreparedObjectRuntime({ ...presentation, schema: 'cssearth-object-runtime@4',
    id: input.solarSource.bodyId, controls: input.controls });
}
