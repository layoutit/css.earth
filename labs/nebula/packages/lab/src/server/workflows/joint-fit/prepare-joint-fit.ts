import { readFile } from 'node:fs/promises';
import { readStructureCatalogue } from '../../../features/observations/models/structures-model.ts';
import { defaultJointControls, type JointRequest } from '../../../features/joint-fit/model.ts';
import { prepareJointFit } from './prepare.ts';
import { prepareJointInput } from './input.ts';
import { fitJointModels } from '@cssearth/nebula-reconstruction/methods/joint/fitter';
const [recipePath, cataloguePath, mode] = process.argv.slice(2);
if (!recipePath || !cataloguePath) throw new TypeError('Usage: prepare-joint-fit <recipe.json> <structure-catalogue.json> [--fit-only]');
const catalogue = readStructureCatalogue(JSON.parse(await readFile(cataloguePath, 'utf8')));
const request: JointRequest = { action: 'apply', imageId: 'joint-fit', recipePath, cataloguePath, imageToFrame: {},
  evidence: { sensitivity: 1, weights: catalogue.images.map(() => 1) }, controls: defaultJointControls };
const start = performance.now(), progress = (message: string) => console.log(message);
if (mode === '--fit-only') {
  const input = await prepareJointInput(process.cwd(), request), output = fitJointModels(input.evidence, request.controls, input.recipe, progress);
  console.log(JSON.stringify({ status: 'complete', elapsedMs: performance.now() - start, ridgePoints: input.evidence.ridges.length,
    molecular: input.molecular.diagnostics, fits: output.fits.map(f => ({ parameters: f.parameters, metrics: f.metrics })), evaluatedModels: output.evaluatedModels }, null, 2));
} else {
  const result = await prepareJointFit(process.cwd(), request, new AbortController().signal, progress);
  console.log(JSON.stringify({ status: 'complete', id: result.id, elapsedMs: performance.now() - start, accounting: result.accounting,
    fits: result.candidates.map(c => ({ parameters: c.fit.parameters, metrics: c.fit.metrics })) }, null, 2));
}
