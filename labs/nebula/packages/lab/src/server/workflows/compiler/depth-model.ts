import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {geometrySha} from '../geometry/registered-source.ts';
import {jointPath} from '../../../features/joint-fit/model.ts';
import {readDepthRecipe as readRecipe,verifyDepthEvidence,type DepthRecipe} from '@cssearth/nebula-reconstruction/methods/inference/depth-model';
export * from '@cssearth/nebula-reconstruction/methods/inference/depth-model';
export function readDepthRecipe(value: unknown): DepthRecipe {return readRecipe(value,path=>path.startsWith('labs/nebula/models/'));}
export interface ResolvedDepthModel {
  recipe: DepthRecipe; recipeSha256: string; recipePath: string;
  evidenceBytes: Uint8Array; recipeBytes: Uint8Array;
  methods: string[];
}
export async function loadDepthModel(root: string, path: string, subjectId: string): Promise<ResolvedDepthModel> {
  if (!jointPath(path) || !path.startsWith('labs/nebula/models/')) throw new TypeError('Depth recipe must be an object-owned local input.');
  const source = async (path: string) => {
    const actual = await realpath(resolve(root, path)), offset = relative(await realpath(root), actual);
    if (offset === '..' || offset.startsWith('../') || isAbsolute(offset)) throw new TypeError('Depth source leaves the repository.');
    return readFile(actual);
  };
  const recipeBytes = await source(path), recipe = readDepthRecipe(JSON.parse(recipeBytes.toString()));
  if (recipe.id !== subjectId) throw new TypeError('Depth recipe belongs to another nebula.');
  const evidenceBytes = await source(recipe.evidence.path);
  const methods = verifyDepthEvidence(recipe, JSON.parse(evidenceBytes.toString()));
  return { recipe, recipeSha256: geometrySha(recipeBytes), recipePath: path, evidenceBytes, recipeBytes, methods };
}
