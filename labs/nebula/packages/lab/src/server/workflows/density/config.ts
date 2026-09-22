import assert from 'node:assert/strict';
import type { OverlayPlacement } from '@cssearth/volume-core/coordinates/overlay-placement';
import { parseCloudAppearance, type CloudAppearance } from '@cssearth/volume-core/materials/cloud-appearance';
import { parseReconstructionRequest } from '../../services/density-reconstruction.ts';
import { json, pinned, type Pin } from './io.ts';
import type { BakeDelivery } from './delivery.ts';

export interface BakeRecipe {
  schema: 'cssearth-nebula-bake@1'; id: string; subjectId: string; densityObjects: string[];
  catalogue: Pin; separationPlan: Pin; stars: Pin; starAlignment: Pin; promotion: Pin;
  delivery?: BakeDelivery; starCalibration?: Pin;
  environment: { pythonVersions: string[]; packages: string[] };
  removal: { method: string; script: Pin; baselineScript: Pin; model: Pin & { url: string };
    tilePixels: number; stridePixels: number; paddingPixels: number; batchSize: number };
  reconstruction: { analysisWidth: number; originalWidth: number; quality: number };
  images: { imageId: string; placement: OverlayPlacement; appearance: CloudAppearance }[];
}
export async function readRecipe(root: string, path: string): Promise<BakeRecipe> {
  const recipe = await json(path) as BakeRecipe;
  assert.equal(recipe.schema, 'cssearth-nebula-bake@1');
  assert.match(recipe.id, /^[a-z][a-z0-9-]*$/);
  assert.ok(recipe.densityObjects.length && recipe.images.length);
  assert.equal(new Set(recipe.images.map(image => image.imageId)).size, recipe.images.length);
  for (const pin of [recipe.catalogue, recipe.separationPlan, recipe.stars, recipe.starAlignment, recipe.promotion,
    recipe.removal.script, recipe.removal.baselineScript]) await pinned(root, pin);
  if (recipe.delivery?.compactInputs) await pinned(root, recipe.delivery.compactInputs);
  if (recipe.starCalibration) await pinned(root, recipe.starCalibration);
  assert.equal(recipe.removal.method, 'nox-positive-union-with-saved-baseline');
  // These are the pinned worker's actual settings; changing the algorithm requires a new script pin too.
  assert.deepEqual([recipe.removal.tilePixels, recipe.removal.stridePixels, recipe.removal.paddingPixels, recipe.removal.batchSize], [512, 384, 64, 2]);
  assert.deepEqual(recipe.reconstruction, { analysisWidth: 1024, originalWidth: 2048, quality: 92 });
  for (const image of recipe.images) {
    parseCloudAppearance(image.appearance);
    parseReconstructionRequest({ action: 'apply', subjectId: recipe.subjectId, imageId: image.imageId,
      placement: image.placement, appearance: image.appearance, removalResultId: `${'0'.repeat(64)}.${'0'.repeat(64)}` });
  }
  return recipe;
}
export const stages = ['density', 'assets', 'removal', 'reconstruction', 'all'] as const;
type BakeStage = typeof stages[number];
export function parseBakeArgs(args: string[]): {recipe: string; stage: BakeStage; image?: string; python?: string; ifMissing: boolean; research: boolean} {
  let recipe = 'labs/nebula/models/lmc/bake.json', stage: BakeStage = 'all', image: string | undefined, python: string | undefined;
  let ifMissing = false, research = false;
  for (const arg of args) {
    if (arg === '--research') { research = true; continue; }
    if (arg === '--if-missing') { ifMissing = true; continue; }
    const [key, ...rest] = arg.split('='), value = rest.join('=');
    if (!value) throw new Error(`Expected --option=value: ${arg}`);
    if (key === '--recipe') recipe = value;
    else if (key === '--image') image = value;
    else if (key === '--python') python = value;
    else if (key === '--stage' && stages.includes(value as BakeStage)) stage = value as BakeStage;
    else throw new Error(`Unknown bake option: ${arg}`);
  }
  if (ifMissing && (stage !== 'all' || image)) throw new Error('--if-missing checks the complete application delivery; use it without --stage or --image.');
  if (image && !research) throw new Error('--image requires --research; use the default bake for compact LMC replay.');
  return { recipe, stage, image, python, ifMissing, research };
}
