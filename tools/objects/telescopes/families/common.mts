import { createHash } from 'node:crypto';
import type { DescriptorMember, ProductDescriptor } from '../product-descriptor.mts';
import { parseProductDescriptor } from '../product-descriptor.mts';

export const csvCell=(value:unknown):string=>{
  if(value===null||value===undefined)return '';
  const text=typeof value==='number'&&!Number.isFinite(value)?'':String(value);
  return /[",\n\r]/u.test(text)?`"${text.replaceAll('"','""')}"`:text;
};
export const csv=(head:readonly string[],rows:readonly (readonly unknown[])[])=>[head,...rows].map(row=>row.map(csvCell).join(',')).join('\n')+'\n';
export const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export const member=(id:string,path:string,role:DescriptorMember['role'],bytes:Uint8Array,mediaType?:string):DescriptorMember=>({id,path,role,bytes:bytes.byteLength,sha256:sha256(bytes),...(mediaType?{mediaType}:{})});
export const descriptor=(value:ProductDescriptor):ProductDescriptor=>parseProductDescriptor(value);
export const finite=(value:number,label:string)=>{if(!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};
export const stable=(value:string,label:string)=>{if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value))throw new TypeError(`${label} must be a stable identifier.`);return value;};
