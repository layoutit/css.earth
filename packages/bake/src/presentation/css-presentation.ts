import { OBJECT_RUNTIME_SCHEMA, parsePreparedObjectRuntime } from '@cssearth/objects';

import { presentationAdapters, type PresentationHostAdapters } from './adapters.ts';
import { requirePreparedPresentation } from './prepared-presentation-contract.ts';
import { prepareRowBankCutaway } from './lighting/row-bank-cutaway.ts';
import { prepareComposite } from './lighting/composite.ts';
import { prepareEmissive } from './lighting/emissive.ts';
import type { PresentationInputs } from './types.ts';
import { prepareActivationGroups } from './layout/prepared-activation-groups.ts';
export type { PresentationInputs } from './types.ts';

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
