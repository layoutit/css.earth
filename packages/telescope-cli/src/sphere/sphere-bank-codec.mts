/** A backwards-only dictionary shares identical prepared values without changing them. */
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '@cssearth/core';

export function sphereDictionary() {
  const entries: unknown[]=[],ids=new Map<string,number>();
  const add=(value:unknown):number=>{
    const key=JSON.stringify(value),held=ids.get(key);if(held!==undefined)return held;
    const encoded=Array.isArray(value)?{array:value.map(add)}:value!==null&&typeof value==='object'
      ?{object:Object.entries(value).map(([name,item])=>[name,add(item)])}:value;
    const index=entries.length;entries.push(encoded);ids.set(key,index);return index;
  };
  return {entries,add};
}
export function decodeSphereDictionary(input: unknown) {
  const values:unknown[]=[];
  const get=(reference:unknown):unknown=>{
    const index=requireFiniteNumber(reference,'Sphere dictionary reference');
    if(!Number.isSafeInteger(index)||index<0||index>=values.length)throw new TypeError('Invalid sphere dictionary reference.');
    return values[index];
  };
  for(const entry of requireArray(input)) {
    if(entry===null||typeof entry==='string'||typeof entry==='boolean'||typeof entry==='number') {values.push(entry);continue;}
    const record=requireRecord(entry);
    if(Object.keys(record).length!==1)throw new TypeError('Invalid sphere dictionary entry.');
    if(record.array!==undefined)values.push(requireArray(record.array).map(get));
    else if(record.object!==undefined)values.push(Object.fromEntries(requireArray(record.object).map(pair=>{
      const row=requireArray(pair);if(row.length!==2)throw new TypeError('Invalid sphere dictionary property.');
      return [requireString(row[0]),get(row[1])];
    })));
    else throw new TypeError('Invalid sphere dictionary entry.');
  }
  return get;
}
export const SPHERE_ID_TOKEN='__standalone_sphere_identity__';
