/** Restore an accepted source-owned compact delivery; no lab recipes, caches or research services. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pin } from '@cssearth/volume-bake/compact-inputs/io';
import { prepareFiniteEmissionObject } from './finite-emission-object.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function pin(value: unknown): Pin {
  assert.ok(record(value) && typeof value.path === 'string');
  return {path:value.path};
}
export async function prepareCompactDensityObject(root: string, directory: string, ifMissing: boolean, allowMissing = false) {
  const value: unknown = JSON.parse(await readFile(resolve(directory,'source/compact-delivery.json'),'utf8'));
  assert.ok(record(value) && value.schema === 'cssearth-compact-density-delivery@1' && typeof value.id === 'string' && record(value.delivery));
  const data = value.delivery;
  assert.ok(typeof data.directory === 'string');
  assert.equal(resolve(root,data.directory),resolve(directory),'Density delivery differs from its source owner.');
  // A finite-emission delivery regenerates its own bank and atlases from delivered inputs. The historical
  // projection-only LMC repaint replay was retired with its delivery; nothing else uses that method.
  assert.equal(data.method,'finite-emission','Compact deliveries regenerate a finite-emission bank.');
  return prepareFiniteEmissionObject(root,directory,pin(data.compactInputs),ifMissing,allowMissing);
}
