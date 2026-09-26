/** Explicit research orchestration around the application-owned delivery adapter. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { prepareNebulaObject as prepare, type NebulaResearchBackend } from '../../../../../../../../tools/nebula/application/objects.ts';
import { validatePreparedCssVolume } from '@cssearth/renderer/volume/validation.ts';
import { readCompilerRequest } from '../../../features/compiler/model.ts';
import { compileNebula } from '../../../server/workflows/compiler/compile.ts';
import { readCompilerResult } from '../../../features/compiler/result.ts';
import { prepareOpticalCompositeForResult } from '../../../server/workflows/compiler/optical-composite-preparation.ts';
import { pinned } from '../../../server/workflows/density/io.ts';
export { readNebulaDelivery } from '../../../../../../../../tools/nebula/application/objects.ts';
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected nebula delivery object.'); return v as Record<string, unknown>; };
async function symmetry(root: string, recipePath: string) {
  await new Promise<void>((accept,reject) => {
    const child = spawn(process.execPath,['--experimental-strip-types','labs/nebula/run.mts','prepare-emission',recipePath],{cwd:root,stdio:['ignore','pipe','inherit']});
    let completed = false;
    child.stdout.on('data',(b:Buffer) => { const line = b.toString(); if (line.includes('EMISSION_COMPLETE')) completed = true; process.stdout.write(line); });
    child.on('error',reject); child.on('close',code => code === 0 && completed ? accept() : reject(new Error('Symmetry preparation did not finish.')));
  });
}
const researchBackend: NebulaResearchBackend = {
  async compiler(root, recipe, progress) {
    const request = readCompilerRequest(JSON.parse((await pinned(root,recipe.request)).toString()));
    let result = readCompilerResult(await compileNebula(root,request,new AbortController().signal,progress));
    if (recipe.compositeRecipe) result = await prepareOpticalCompositeForResult(root,recipe.compositeRecipe.path,result,
      {progress:message=>console.log(`${recipe.id} ${message}`)});
    return result;
  },
  async symmetry(root, recipe) {
    if (!recipe.symmetryDirectory) throw new TypeError('Missing symmetry output owner.');
    const target = resolve(root,recipe.symmetryDirectory);
    try {
      const existing = record(JSON.parse(await readFile(resolve(target,'prepared/volume.json'),'utf8')));
      const prepared = validatePreparedCssVolume(existing.data);
      for (const resource of prepared.resources) await pinned(target,{path:`prepared/${resource.path}`});
    } catch(error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      await symmetry(root,recipe.request.path);
    }
    const descriptor = record(JSON.parse(await readFile(resolve(target,'object.json'),'utf8')));
    const sourcePin = record(record(descriptor.properties).preparation), preparedPin = record(descriptor.prepared);
    if (typeof preparedPin.url !== 'string')
      throw new TypeError('Symmetry output belongs to another recipe.');
    const value = record(JSON.parse((await pinned(target,{path:preparedPin.url})).toString()));
    const volume = validatePreparedCssVolume(value.data);
    return {path:`${recipe.symmetryDirectory}/${preparedPin.url}`,sha256:preparedPin.sha256,frame:volume.frame};
  },
};
export function prepareNebulaObject(root: string, directory: string, ifMissing = false, research = false) {
  return prepare(root,directory,ifMissing,research ? researchBackend : undefined);
}
