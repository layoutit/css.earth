import { parsePreparedObjectRuntime } from '../../validation/index.js';
import { loadPresentationAdapters } from './adapters.js';
import { prepareRowBankCutaway } from './row-bank-cutaway.js';
import { prepareComposite } from './composite.js';
import type { PresentationInputs } from './types.js';
export type { PresentationInputs } from './types.js';

export interface PresentationProfile {
  schema: 'cssearth-css-presentation-profile@1'; namespace: string;
  mode: PresentationInputs['mode'];
}
export function parsePresentationProfile(value: unknown): PresentationProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Presentation profile must be an object.');
  const input = value as Record<string, unknown>;
  if (input.schema !== 'cssearth-css-presentation-profile@1' || typeof input.namespace !== 'string' ||
      !/^[a-z][a-z0-9-]*$/.test(input.namespace) || !['row-bank-cutaway', 'composite'].includes(String(input.mode))) {
    throw new TypeError('Unsupported CSS presentation profile.');
  }
  return input as unknown as PresentationProfile;
}
/** Compile capabilities into a retained CSS tree; the runtime accepts only validated data. */
export async function prepareCssPresentation(input: PresentationInputs) {
  if (input.namespace !== input.solarSource.bodyId) throw new TypeError('Presentation and physical source identities disagree.');
  const adapters = await loadPresentationAdapters();
  const compile = input.mode === 'row-bank-cutaway' ? prepareRowBankCutaway : input.mode === 'composite' ? prepareComposite : null;
  if (!compile) throw new TypeError('Unsupported material composition.');
  const draft = await compile(input, adapters);
  const presentation = { ...draft, materials: adapters.prepareMaterialTracks(draft) };
  adapters.requirePreparedPresentation(presentation, { controls: input.controls });
  return parsePreparedObjectRuntime({ ...presentation, schema: 'cssearth-object-runtime@4',
    id: input.solarSource.bodyId, controls: input.controls });
}
