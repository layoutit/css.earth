/** Worker for tools/objects/dawn/vir-mosaic.mts: projects one reduced cube per message and returns the covered cells
 * and each parameter's values there as transferable typed arrays. */
import { parentPort, workerData } from 'node:worker_threads';
import { projectReducedFile } from './vir-projection.mts';
import type { VirRecipe } from './vir-mosaic.mts';

const { recipe, gain, work, ppd, fillMaximumStepKm } = workerData as { recipe: VirRecipe; gain: number[][]; work: string; ppd: number; fillMaximumStepKm: number };
parentPort!.on('message', async (name: string) => {
  const result = await projectReducedFile(recipe, gain, work, name, ppd, fillMaximumStepKm);
  parentPort!.postMessage(result, result.projected ? [result.projected.cells.buffer, ...result.projected.values.map(v => v.buffer), ...result.projected.highPass.map(v => v.buffer)] : []);
});
