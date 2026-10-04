/** Restore an accepted source-owned compact delivery; no lab recipes, caches or research services. */
import { parseCompactDensityDelivery, parseCompactDensityInputs } from '@cssearth/objects';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareFiniteEmissionObject } from './finite-emission-object.ts';
export async function prepareCompactDensityObject(root: string, directory: string, ifMissing: boolean, allowMissing = false) {
  const value: unknown = JSON.parse(await readFile(resolve(directory,'source/compact-delivery.json'),'utf8'));
  const policy = { extraKeys: 'allow', assertion: assert } as const;
  const data = parseCompactDensityDelivery(value, policy);
  assert.equal(resolve(root,data.directory),resolve(directory),'Density delivery differs from its source owner.');
  // A finite-emission delivery regenerates its own bank and atlases from delivered inputs. The historical
  // projection-only LMC repaint replay was retired with its delivery; nothing else uses that method.
  return prepareFiniteEmissionObject(root,directory,parseCompactDensityInputs(data.method, data.compactInputs, policy),ifMissing,allowMissing);
}
