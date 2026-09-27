import { readFile } from 'node:fs/promises';
import { requireRecord } from '@cssearth/core';
export async function readFieldRecipe() {
  return parseFieldRecipe(JSON.parse(await readFile('src/objects/nearby-universe/source/preparation/field.json','utf8')) as unknown);
}
export function parseFieldRecipe(value: unknown) {
  const raw = requireRecord(value);
  if(raw.schema !== 'cssearth-galaxy-field-recipe@1') throw new TypeError('Invalid galaxy field recipe');
  const num=(v:unknown, max:number, integral=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>max||(integral&&!Number.isInteger(v)))throw new TypeError('Invalid galaxy recipe parameter');return v;};
  const sampling=requireRecord(raw.sampling),clouds=requireRecord(raw.clouds),texture=requireRecord(raw.texture),points=requireRecord(raw.points);
  const color=(v:unknown)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw new TypeError('Invalid point color');return v;};
  if(!Array.isArray(texture.rgb)||texture.rgb.length!==3||!texture.rgb.every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw new TypeError('Invalid cloud RGB');
  const spreadCount=num(sampling.spreadCount,1800,true),concentrationCount=num(sampling.concentrationCount,1800,true);
  if(spreadCount+concentrationCount>1800)throw new TypeError('Point budget exceeded');
  const minimumDistanceMpc=num(raw.minimumDistanceMpc,200),maximumDistanceMpc=num(raw.maximumDistanceMpc,200),size=num(texture.size,1024,true);
  if(minimumDistanceMpc>=maximumDistanceMpc)throw new TypeError('Minimum field distance must be below maximum distance');
  if(size<2)throw new TypeError('Cloud texture size must be at least 2');
  return {minimumDistanceMpc,maximumDistanceMpc,hubbleKmSPerMpc:num(raw.hubbleKmSPerMpc,200),
    sampling:{spreadCount,concentrationCount,cellSizeMpc:num(sampling.cellSizeMpc,100)},
    clouds:{count:num(clouds.count,160,true),iterations:num(clouds.iterations,100,true),minimumMembers:num(clouds.minimumMembers,10000,true),covarianceFloorMpc2:num(clouds.covarianceFloorMpc2,100),maximumBrightness:num(clouds.maximumBrightness,.15),exposure:num(clouds.exposure,1)},
    texture:{size,rgb:texture.rgb as number[],falloff:num(texture.falloff,100)},
    points:{unknownBrightness:num(points.unknownBrightness,1),ellipticalColor:color(points.ellipticalColor),spiralColor:color(points.spiralColor),unknownColor:color(points.unknownColor)}};
}
