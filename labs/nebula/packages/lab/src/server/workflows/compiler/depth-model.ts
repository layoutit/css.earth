import type { DepthRecipe } from '@cssearth/objects';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {jointPath} from '../../../features/joint-fit/model.ts';
import {readDepthRecipe as readRecipe,verifyDepthEvidence} from '@cssearth/nebula-reconstruction/methods/inference/depth-model';
export * from '@cssearth/nebula-reconstruction/methods/inference/depth-model';
export function readDepthRecipe(value: unknown): DepthRecipe {return readRecipe(value,path=>/^src\/objects\/[a-z0-9-]+\/source\//.test(path));}
export interface ResolvedDepthModel {
  recipe: DepthRecipe; recipePath: string;
  evidenceBytes: Uint8Array; recipeBytes: Uint8Array;
  methods: string[];
}
export async function loadDepthModel(root: string, path: string, subjectId: string): Promise<ResolvedDepthModel> {
  if (!jointPath(path) || !/^src\/objects\/[a-z0-9-]+\/source\//.test(path)) throw new TypeError('Depth recipe must be an object-owned local input.');
  const source = async (path: string) => {
    const actual = await realpath(resolve(root, path)), offset = relative(await realpath(root), actual);
    if (offset === '..' || offset.startsWith('../') || isAbsolute(offset)) throw new TypeError('Depth source leaves the repository.');
    return readFile(actual);
  };
  const recipeBytes = await source(path), recipe = readDepthRecipe(JSON.parse(recipeBytes.toString()));
  if (recipe.id !== subjectId) throw new TypeError('Depth recipe belongs to another nebula.');
  const evidenceBytes = await source(recipe.evidence.path);
  const methods = verifyDepthEvidence(recipe, JSON.parse(evidenceBytes.toString()));
  return { recipe, recipePath: path, evidenceBytes, recipeBytes, methods };
}
