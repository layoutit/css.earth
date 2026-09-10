import {requireRecord} from './source-values.mts';
import {shape,text,number,array,optional,nullable,boolean} from './objects/terrestrial-layers/source-records.mts';
import {parseSourceManifest} from './objects/dist/operations.js';
import {parseSolidPreparationSource} from './objects/terrestrial-layers/profile-source.mts';

export function parseAuthoringManifest(value:unknown) {
  const manifest=parseSourceManifest(value);
  return {...requireRecord(value),...manifest,inputs:manifest.inputs.map(entry=>Object.assign({},requireRecord(entry),entry)),
    documents:manifest.documents.map(entry=>Object.assign({},requireRecord(entry),entry)),
    generatedIntermediates:manifest.generatedIntermediates.map(entry=>Object.assign({},requireRecord(entry),entry))};
}
export const parseAuthoringDescriptor=shape({prepared:shape({sha256:text}),properties:shape({page:optional(requireRecord),worldFrame:optional(value=>value),
  preparation:optional(shape({state:optional(text)})),recipe:shape({shape:shape({radiusKm:number}),sources:array(shape({path:text,sha256:text}))})})});
const fact=shape({id:text,label:text,value:text});
const resource=shape({label:text,role:text,description:text,href:text});
export const parseAuthoringContent=shape({panel:shape({introduction:text,facts:array(fact),moreFacts:array(fact)}),
  lenses:shape({controls:array(shape({description:text,title:text,detail:text,source:shape({url:text})}))}),
  settings:shape({controls:array(shape({name:text,checked:optional(boolean)}))}),resources:array(resource),provenance:requireRecord});
export const parseAuthoringNavigation=shape({source:value=>Object.assign({},requireRecord(value),shape({path:text,expectedBytes:number,expectedSha256:text})(value))});
export function parseAuthoringSolid(value:unknown) {
  const config=parseSolidPreparationSource(value),terrain=config.geometry.radialTerrain;
  if(!terrain?.simplification)throw new TypeError('Approximation template requires its existing radial simplification.');
  return {...config,geometry:{...config.geometry,radialTerrain:{...terrain,simplification:terrain.simplification}}};
}
export const parseLucyAuthoringInputs=shape({checkedOn:text,bodies:array(shape({id:text,name:text,horizons:text,fullAxesKm:array(number),
  axisUncertaintyKm:nullable(array(number)),poleIcrfDegrees:optional(array(number)),poleEclipticDegrees:optional(array(number)),
  periodHours:nullable(number),source:text,credit:text,papers:array(text),shapeMeaning:text,orientationMeaning:text,introduction:text,
  periodText:text,unresolved:array(text),population:optional(text),datasetTitle:optional(text),surfaceMeaning:optional(text),missionSource:optional(text)}))});
