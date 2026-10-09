/** `model <id> --method <m>`: one method's surfaces for one object, written to `.local/lab/model/`. */
import type { LabObject } from '../lab-objects.ts';
import { MODEL_METHODS, type ModelMethod } from '../research/research.ts';
import { withProgress } from '../plates/progress.ts';
import { writeLabModel, type LabModel } from './model-output.ts';
import { paperSurfaces } from './paper-surfaces.ts';
import { symmetrySurfaces } from './symmetry-model.ts';
import { kinematicSurfaces } from './kinematic-model.ts';

export function readModelMethod(value: string | undefined): ModelMethod {
  if (!(MODEL_METHODS as readonly (string | undefined)[]).includes(value)) throw new TypeError(`--method is one of ${MODEL_METHODS.join(', ')}.`);
  return value as ModelMethod;
}
const methods: Record<ModelMethod, (root: string, object: LabObject, stage: (message: string, fraction: number) => void) => Promise<LabModel>> = {
  'paper-surfaces': paperSurfaces, symmetry: symmetrySurfaces, kinematic: kinematicSurfaces };

export function runModel(root: string, object: LabObject, method: ModelMethod): Promise<LabModel> {
  return withProgress(root, object.id, `model ${method}`, async stage => {
    const model = await methods[method](root, object, stage);
    await writeLabModel(root, model);
    return model;
  }, model => ({ method: model.method, outlines: model.outlines.length, points: model.points.length, files: model.files.length }));
}
