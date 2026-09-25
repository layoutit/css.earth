import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import type { Vector3 } from '@cssearth/bake/volume';
export interface FiniteMaterialSettings {width:number;spacing:Vector3;origin:Vector3;maximumRegions:number;iterations:number;regularization:number}
export function parseFiniteMaterialSettings(value:unknown):FiniteMaterialSettings {
  if(!value||typeof value!=='object')throw Error('Missing finite material settings');
  const v=Object.fromEntries(Object.entries(value));
  const vector=(key:string):Vector3=>{const a=v[key];if(!Array.isArray(a)||a.length!==3||!a.every(n=>typeof n==='number'&&Number.isFinite(n)))throw Error('Invalid '+key);return[a[0],a[1],a[2]];};
  const number=(key:string)=>{const n=v[key];if(typeof n!=='number'||!Number.isFinite(n))throw Error('Invalid '+key);return n;};
  const result={width:number('width'),spacing:vector('spacing'),origin:vector('origin'),maximumRegions:number('maximumRegions'),iterations:number('iterations'),regularization:number('regularization')};
  if(!Number.isInteger(result.width)||result.width<16||result.width>512||result.spacing.some(n=>n<=0)||!Number.isInteger(result.maximumRegions)||result.maximumRegions<1||result.maximumRegions>8192||!Number.isInteger(result.iterations)||result.iterations<1||result.iterations>2000||result.regularization<0)throw Error('Invalid bounded finite material settings');
  return result;
}
export async function verifyFiniteMaterialArtifacts(directory:string,expectedId:string) {
  const manifest=parseLabModelJson(await readFile(resolve(directory,'manifest.json'),'utf8'));
  if(manifest.schema!=='cssearth-nebula-reconstruction-artifacts@1'||manifest.id!==expectedId||!manifest.artifacts||typeof manifest.artifacts!=='object'||!manifest.artifacts['object.json']||!manifest.artifacts['prepared/volume.json'])throw Error('Invalid reconstruction artifact manifest');
  for(const[path,value]of Object.entries(manifest.artifacts)){
    if(!value||typeof value!=='object'||!('sha256'in value)||typeof value.sha256!=='string'||!('bytes'in value)||typeof value.bytes!=='number')throw Error('Invalid artifact pin');
    const bytes=await sourceBytes(directory,{path});if(bytes.length!==value.bytes)throw Error('Artifact byte length mismatch');
  }
}
