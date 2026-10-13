/** Pack-time sphere transport: shared leaf geometry and CSS, one selected dataset per body. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';
import { parsePreparedObjectRuntime, parsePreparedWorldCameraFrame } from '@cssearth/objects';
import { joinPreparedRuntimeText } from '@cssearth/objects/node';
import { readRasterRecipe } from '@cssearth/bake/raster';

import { decodeSphereDictionary, SPHERE_ID_TOKEN } from './sphere-bank-codec.mts';

const banks = new Map<string, ReturnType<typeof loadBank>>();
async function loadBank(root: string) {
  const file=resolve(root,'sphere-bank.json.gz'),stored=await readFile(file);
  const value=requireRecord(JSON.parse(gunzipSync(stored).toString()),'Sphere bank');
  if(value.schema!=='cssearth-telescope-spheres@2')throw new TypeError('Unsupported sphere bank.');
  return {decode:decodeSphereDictionary(value.dictionary),file,bytes:stored.length,bodies:requireRecord(value.bodies),profiles:requireArray(value.profiles).map(value=>requireString(value)),styles:requireArray(value.styles).map(value=>requireString(value))};
}
export function readSphereBank(root: string) {
  let pending=banks.get(root);
  if(!pending){pending=loadBank(root);banks.set(root,pending);pending.catch(()=>banks.delete(root));}
  return pending;
}
export function sphereDirection(value: unknown): readonly number[] {
  const vector=requireArray(value).map(coordinate=>requireFiniteNumber(coordinate));
  if(vector.length!==3||Math.abs(Math.hypot(...vector)-1)>1e-6)throw new TypeError('Sphere direction must be a unit 3-vector.');
  return vector;
}
export async function readSphereBody(bank: Awaited<ReturnType<typeof readSphereBank>>, id: string) {
  const body=requireRecord(bank.bodies[id],`No packaged standard sphere for ${id}`);
  const original=parsePreparedObjectRuntime(JSON.parse(await joinPreparedRuntimeText(JSON.stringify(bank.decode(body.runtime)).replaceAll(SPHERE_ID_TOKEN,id),async()=>{
    const profile=requireFiniteNumber(body.profile);
    if(!Number.isSafeInteger(profile)||!bank.profiles[profile])throw new TypeError('Invalid sphere leaf profile.');
    return bank.profiles[profile];
  })));
  if(original.id!==id||original.destinations)throw new TypeError('Invalid packaged sphere identity.');
  const recipe=readRasterRecipe(body.recipe),datasetId=original.controls.datasets?.defaultDataset;
  const surface=recipe.surfaces.find(item=>item.id===datasetId),variant=original.variants[0];
  if(!datasetId||!surface||!variant||variant.when.datasetId!==datasetId)throw new TypeError('Invalid packaged sphere dataset.');
  const styles=requireArray(body.styles).map(value=>{
    const index=requireFiniteNumber(value);
    if(!Number.isSafeInteger(index)||bank.styles[index]===undefined)throw new TypeError('Invalid sphere CSS index.');
    return Buffer.from(bank.styles[index]);
  });
  const worldFrame=parsePreparedWorldCameraFrame(body.worldFrame);
  if(!worldFrame)throw new TypeError('Invalid packaged sphere world frame.');
  return {recipe,original,datasetId,surface,variant,required:[...variant.required],styles,worldFrame};
}
