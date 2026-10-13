/** Read only the standard sphere inputs needed to export a measurement. */
import { objectPageCss, parsePreparedObjectRuntime } from '@cssearth/objects';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LEAF_BOXES_FILE, joinPreparedRuntimeText } from '@cssearth/objects/node';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { readRasterRecipe } from '@cssearth/bake/raster';
import { parseGeometryProfile } from '@cssearth/bake/scene';
import { readSphereBank, readSphereBody } from './sphere-bank.mts';

export async function inspectMeasurementSphere(root:string,target:string){
  const id = target.toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Sphere output needs an existing body identity');
  const object = resolve(root, 'src/objects', id);
  const inputs: { role: string; identity: string; bytes: number }[] = [];
  const pinned = async (file: string) => {
    const bytes=await readFile(file);
    inputs.push({ role: 'standard sphere input', identity: file, bytes: bytes.length });
    return bytes;
  };
  if(existsSync(resolve(root,'sphere-bank.json.gz'))) {
    const bank=await readSphereBank(root),body=await readSphereBody(bank,id);
    inputs.push({role:'prepared sphere bank',identity:bank.file,bytes:bank.bytes});
    return {id,object,inputs,pinned,...body};
  }
  const json = async (file: string): Promise<unknown> => JSON.parse((await pinned(file)).toString());
  const geometry = parseGeometryProfile(await json(resolve(object, 'source/preparation/geometry.json')));
  if (geometry.namespace !== id) throw new Error('Standard sphere geometry belongs to another body');
  const recipe = readRasterRecipe(await json(resolve(object, 'source/preparation/raster.json')));
  const original = parsePreparedObjectRuntime(JSON.parse(await joinPreparedRuntimeText((await pinned(resolve(object, 'prepared/runtime.json'))).toString(),
    async () => (await pinned(resolve(object, 'prepared', LEAF_BOXES_FILE))).toString())));
  if (original.id !== id || original.destinations)
    throw new Error('This sphere requires application capabilities that cannot be exported');
  const datasetId = original.controls.datasets?.defaultDataset;
  const surface = recipe.surfaces.find(item => item.id === datasetId);
  if (!datasetId || !surface) throw new Error('Standard sphere has no matching prepared surface dataset');
  // A paged body binds each page of the dataset (`surface:<id>:<page>`); an unpaged one its whole atlas.
  const replacementKeys=new Set([`surface:${datasetId}`,`poles:${datasetId}`,'poles']),pagePrefix=`surface:${datasetId}:`;
  const variant = original.variants.find(item => item.when.datasetId === datasetId && item.when.shadows !== true && item.when.atmosphere !== true);
  if (!variant) throw new Error('Standard sphere has no unshadowed surface variant');
  const required = variant.required.filter(key => replacementKeys.has(key) || key.startsWith(pagePrefix) && /^\d+$/.test(key.slice(pagePrefix.length)));
  if (!required.some(key => key.startsWith('surface:'))) throw new Error('Sphere surface binding is unavailable');
  const descriptor = requireRecord(await json(resolve(object, 'object.json'))),properties = requireRecord(descriptor.properties),worldFrame = properties.worldFrame;
  // The shared body rules and the shell, then the page's own stylesheets (a lane template names the object as __object__).
  const shared = ['src/renderers/css/styles/body-surfaces.css'];
  const own = requireArray(requireRecord(properties.page).stylesheets).map(path => requireString(path)).filter(path => !shared.includes(path));
  const styles = await Promise.all([...shared, ...own].map(async file => Buffer.from(objectPageCss((await pinned(resolve(root, file))).toString(), id))));
  if (!worldFrame) throw new Error('Standard sphere has no prepared physical frame');
  return {id,object,inputs,pinned,recipe,original,datasetId,surface,variant,required,styles,worldFrame};
}

