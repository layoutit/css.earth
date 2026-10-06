/** The contract each observational-family handler implements: its format profiles, recognition and operations. */
import type { FamilyId, ProductDescriptor } from './products/product-descriptor.mts';

export interface HandlerEvidenceReference {readonly path:string;readonly establishes:string;readonly status:'partial'|'complete'}
export interface FormatProfile {readonly id:string;readonly format:string;readonly version:string;readonly families:readonly FamilyId[];readonly evidence:readonly HandlerEvidenceReference[];readonly publicBaseline?:boolean}
export interface OperationParameter {
  readonly id:string;readonly option:string;readonly kind:'integer'|'number-list'|'number-list-or-choice'|'choice'|'input-path'|'output-directory';readonly required:boolean;readonly description:string;
  readonly count?:number;readonly minimum?:number;readonly choices?:readonly string[];
}
export interface FamilyOperation {
  readonly id:string;readonly label:string;readonly handlerId:string;readonly componentId:string;readonly owner:{readonly module:string;readonly export:string};
  readonly available:boolean;readonly reason:string;readonly fixedArguments:Readonly<Record<string,string|number>>;readonly parameters:readonly OperationParameter[];readonly limitations:readonly string[];
}
export interface FamilyHandler {
  readonly id:string;readonly profiles:readonly FormatProfile[];readonly families:readonly FamilyId[];
  readonly recognizes:(members:readonly {readonly path:string;readonly prefix:Uint8Array}[])=>readonly string[];
  readonly operations:(descriptor:ProductDescriptor)=>readonly FamilyOperation[];
}
