import {jointRecord} from '../methods/joint/model.ts';
const range=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export interface CompilerStarCatalogue { sourceIds: string[]; mergeRadiusArcsec: number }
export function readCompilerStarCatalogue(v: unknown): CompilerStarCatalogue {
  if (!jointRecord(v) || !Array.isArray(v.sourceIds) || v.sourceIds.length < 2 || v.sourceIds.length > 8 ||
      v.sourceIds.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) || new Set(v.sourceIds).size !== v.sourceIds.length ||
      !range(v.mergeRadiusArcsec, .01, 60)) throw new TypeError('Invalid compiler star catalogue.');
  return { sourceIds: v.sourceIds.map(String), mergeRadiusArcsec: v.mergeRadiusArcsec };
}
