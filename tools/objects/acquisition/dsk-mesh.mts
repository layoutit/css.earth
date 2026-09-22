import { sha256 } from '../../../src/platform/sha256.mts';
import {requireRecord} from '../../sources/source-values.mts';
import {shape,text,number} from '../terrestrial-layers/source-records.mts';
const parseRecipe=shape({inputPath:text,member:text,spiceypyVersion:text,cspiceVersion:text,inputBytes:number,targetId:number,frameId:number,surfaceId:number,sourceVertices:number,sourceFaces:number,weldedVertices:number});
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {resolve, isAbsolute, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

export function validateDskMeshRecipe(value:unknown) {
  const recipe=parseRecipe(value);
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe) ||
      typeof recipe.inputPath !== 'string' || !recipe.inputPath || isAbsolute(recipe.inputPath) ||
      recipe.inputPath.includes('\\') || recipe.inputPath.split('/').some(p => !p || p === '.' || p === '..') ||
      !/^[a-z0-9][a-z0-9_-]*\.obj$/.test(recipe.member) ||
      recipe.spiceypyVersion !== '6.0.3' || recipe.cspiceVersion !== 'CSPICE_N0067') {
    throw new TypeError('Invalid DSK mesh conversion recipe.');
  }
  for (const key of ['inputBytes', 'targetId', 'frameId', 'surfaceId', 'sourceVertices', 'sourceFaces', 'weldedVertices'] as const) {
    if (!Number.isSafeInteger(recipe[key]) || recipe[key] <= 0) throw new TypeError(`Invalid DSK ${key}.`);
  }
  if (recipe.weldedVertices > recipe.sourceVertices) throw new TypeError('DSK welding cannot add vertices.');
  return value as typeof recipe;
}

/** Source restoration only: CSPICE reads the pinned type-2 DSK, then a fixed
 * archive retains original triangles and an exact duplicate-vertex map. */
export async function prepareDskMesh({sourceRoot, recipe:recipeValue}:{sourceRoot:string;recipe:unknown}) {
  const recipe=validateDskMeshRecipe(recipeValue);
  const root = resolve(sourceRoot), path = resolve(root, recipe.inputPath);
  if (!path.startsWith(root + sep)) throw new TypeError('DSK source escapes source root.');
  const source = await readFile(path);
  if (source.length !== recipe.inputBytes) {
    throw new Error('DSK source length differs from its recipe.');
  }
  const python = process.env.CSSEARTH_SPICE_PYTHON ?? 'python3';
  // Name the requirement before the conversion runs; a bare ModuleNotFoundError
  // from inside the script tells a contributor nothing about what to install.
  try { await promisify(execFile)(python, ['-c', 'import numpy'], {timeout: 60000}); }
  catch (cause) {
    throw new Error(`DSK mesh conversion needs Python 3 with numpy (\`${python} -m pip install numpy\`, or point CSSEARTH_SPICE_PYTHON at an interpreter that has it).`, {cause});
  }
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-dsk-mesh-'));
  try {
    const destination = resolve(directory, 'mesh.zip');
    const {stdout} = await promisify(execFile)(python,
      [fileURLToPath(new URL('../acquisition/dsk-mesh.py', import.meta.url)), path, JSON.stringify(recipe), destination],
      {maxBuffer: 1024 * 1024, timeout: 300000});
    const report = requireRecord(JSON.parse(stdout)), bytes = await readFile(destination);
    if (report.schema !== 'cssearth-dsk-mesh-conversion@1' || report.bytes !== bytes.length ||
        report.sha256 !== sha256(bytes)) throw new Error('DSK conversion receipt differs.');
    return bytes;
  } finally {await rm(directory, {recursive:true, force:true});}
}
