/** Versioned mapping from archive product labels to cssEarth observational families. */
import type { FamilyId } from './product-descriptor.mts';

export const IVOA_PRODUCT_TYPE_VOCABULARY='http://www.ivoa.net/rdf/product-type/2026-01-15' as const;
export interface ProductTypeMapping {
  readonly sourceTerm:string;readonly vocabulary:typeof IVOA_PRODUCT_TYPE_VOCABULARY;readonly vocabularyVersion:'2026-01-15';
  readonly status:'mapped'|'preliminary'|'unmapped';readonly families:readonly FamilyId[];
}
const mappings:Readonly<Record<string,{readonly families:readonly FamilyId[];readonly preliminary?:boolean}>>={
  image:{families:['F01']},cube:{families:['F02']},'spectral-cube':{families:['F02']},'time-cube':{families:['F02','F07']},
  spectrum:{families:['F03']},'slit-spectrum':{families:['F04']},'spatial-profile':{families:['F04']},sed:{families:['F05']},
  'light-curve':{families:['F06']},timeseries:{families:['F06']},'velocity-curve':{families:['F06']},'dynamic-spectrum':{families:['F07']},
  measurements:{families:['F08']},'event-list':{families:['F10']},'event-bundle':{families:['F10','F18'],preliminary:true},visibility:{families:['F11']},
  'polarization-cube':{families:['F02','F13']},'polarized-spectrum':{families:['F03','F13']},
};
const aliases:Readonly<Record<string,string>>={image:'image',cube:'cube',spectrum:'spectrum',sed:'sed',timeseries:'timeseries',time_series:'timeseries',visibility:'visibility',event:'event-list',events:'event-list',measurements:'measurements'};
/** Archive labels propose routing only. Product content still has to validate a concrete handler profile. */
export function mapIvoaProductType(value:string|null):ProductTypeMapping|null{
  if(value===null||!value.trim())return null;const sourceTerm=value.trim(),key=aliases[sourceTerm.toLowerCase()]??sourceTerm.toLowerCase(),mapped=mappings[key];
  return {sourceTerm,vocabulary:IVOA_PRODUCT_TYPE_VOCABULARY,vocabularyVersion:'2026-01-15',status:mapped?.preliminary?'preliminary':mapped?'mapped':'unmapped',families:mapped?.families??[]};
}
export function familiesForProductKind(value:string|null):readonly FamilyId[]{return mapIvoaProductType(value)?.families??[];}
