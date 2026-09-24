import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {array, boolean, dictionary, number, optional, shape, text, requireRecord} from '@cssearth/core';
import {parseRadialSource} from '../../../tools/objects/terrestrial-layers/radial-source.mts';

const acquisition = shape({operations:array(shape({path:text,kind:optional(text),url:optional(text)}))});
const damit = shape({modelId:number,fields:dictionary(text)});
const rotation = shape({periodHours:number,phase:text,rightAscensionDegrees:optional(number),declinationDegrees:optional(number)});
// The sampler treats an omitted linear transform as identity.
const transform = (value:unknown) => value === undefined ? {scale:1,offset:0} : shape({scale:number,offset:number})(value);
const scalar = shape({id:text,path:text,format:text,grid:requireRecord,valueTransform:transform,
  surfaceSampling:optional(shape({method:text,maximumDistanceMeters:number})),minimum:number,maximum:number,colors:array(text)});
const terrestrial = shape({namespace:text,geometry:shape({radius:number,radiusKm:number,radialTerrain:parseRadialSource}),
  raster:shape({width:number,height:number,scientific:array(scalar)})});
const acceptedAnchor = shape({accepted:boolean,query:array(number),point:array(number),value:number,distanceMeters:number});
function anchor(value:unknown) {
  const record = requireRecord(value);
  if(record.accepted === false) return {accepted:false as const,query:array(number)(record.query)};
  const parsed = acceptedAnchor(record);
  assert.equal(parsed.accepted,true);
  return {...parsed,accepted:true as const};
}
const anchors = shape({checks:array(anchor)});

/** Decode only the source facts consumed by these independent fixture checks.
 * The preparation owner still receives the original additional recipe fields. */
export function createSourceFixtureReader(root:string) {
  async function read(path:'preparation/acquisition.json'):Promise<ReturnType<typeof acquisition>>;
  async function read(path:'preparation/terrestrial.json'):Promise<ReturnType<typeof terrestrial>>;
  async function read(path:'preparation/rotation.json'):Promise<ReturnType<typeof rotation>>;
  async function read(path:'reference/damit-model.json'):Promise<ReturnType<typeof damit>>;
  async function read(path:'reference/scalar-anchors.json'):Promise<ReturnType<typeof anchors>>;
  async function read(path:string):Promise<unknown>;
  async function read(path:string):Promise<unknown> {
    const value:unknown=JSON.parse(await readFile(resolve(root,path),'utf8'));
    switch(path) {
      case 'preparation/acquisition.json':return acquisition(value);
      case 'preparation/terrestrial.json':return terrestrial(value);
      case 'preparation/rotation.json':return rotation(value);
      case 'reference/damit-model.json':return damit(value);
      case 'reference/scalar-anchors.json':return anchors(value);
      default:return value;
    }
  }
  return read;
}

const closedSimplification = shape({sourceFaces:number,removedOppositeFaces:number,estimatedErrorMeters:number,
  topology:shape({eulerCharacteristic:number,components:optional(number)})});
export function requireClosedTerrain<T extends {simplification?:unknown}>(value:T|null) {
  assert.ok(value,'Expected a prepared radial terrain');
  return {...value,simplification:closedSimplification(value.simplification)};
}
