/** Restore an accepted source-owned density/material delivery; no lab recipes, caches or research services. */
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { restoreCompactLmc } from '@cssearth/volume-bake/compact-inputs/density-material';
import type { Pin } from '@cssearth/volume-bake/compact-inputs/io';
import { deliveryReady, restoreDelivery, type BakeDelivery } from './density-delivery.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function pin(value: unknown): Pin {
  assert.ok(record(value) && typeof value.path === 'string' && typeof value.sha256 === 'string');
  assert.match(value.sha256,/^[a-f0-9]{64}$/);
  return {path:value.path,sha256:value.sha256};
}
export async function prepareCompactDensityObject(root: string, directory: string, ifMissing: boolean) {
  const value: unknown = JSON.parse(await readFile(resolve(directory,'source/compact-delivery.json'),'utf8'));
  assert.ok(record(value) && value.schema === 'cssearth-compact-density-delivery@1' && typeof value.id === 'string' && record(value.delivery));
  const data = value.delivery;
  assert.ok(typeof data.directory === 'string');
  assert.equal(resolve(root,data.directory),resolve(directory),'Density delivery differs from its source owner.');
  const delivery: BakeDelivery = {directory:data.directory,manifest:pin(data.manifest),atlasInputs:pin(data.atlasInputs),compactInputs:pin(data.compactInputs)};
  if (ifMissing && await deliveryReady(root,delivery)) return {id:value.id,status:'verified'};
  const temporary = await mkdtemp(resolve(directory,'.prepared-density-'));
  try {
    const results = await restoreCompactLmc(root,delivery.compactInputs!,temporary);
    await restoreDelivery(root,delivery,results.map(result=>({imageId:result.imageId,directory:relative(root,result.directory)})));
    assert.equal(await deliveryReady(root,delivery),true);
    return {id:value.id,status:'prepared'};
  } finally { await rm(temporary,{recursive:true,force:true}); }
}
