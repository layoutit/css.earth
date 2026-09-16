/** Research identities are resolved here; the application installer accepts only explicit slice directories. */
import assert from 'node:assert/strict';
import { readPreparedReconstruction } from '../../services/density-reconstruction.ts';
import { restoreDelivery as restore, type BakeDelivery } from '../../../adapters/application/density-delivery.ts';
export { deliveryReady, type BakeDelivery } from '../../../adapters/application/density-delivery.ts';
export async function restoreDelivery(root: string, delivery: BakeDelivery, results: {imageId: string; resultId?: string; directory?: string}[]) {
  const sources = await Promise.all(results.map(async result => {
    if (result.directory) return {imageId:result.imageId,directory:result.directory};
    assert.ok(result.resultId);
    const prepared = await readPreparedReconstruction(root,result.resultId);
    assert.equal(prepared.imageId,result.imageId);
    return {imageId:result.imageId,directory:`${prepared.subject.directory}/prepared`};
  }));
  return restore(root,delivery,sources);
}
