/** Reload the qualification and its pins; a serialized selection cannot authorize different bytes or facts. */
import { resolve } from 'node:path';
import { readProductRecord, pinFile, type ProductInput } from '../product-record.mts';
import { loadSourceProducts, sourceQualifiedObservations } from './source-products.mts';
import { loadQualifiedObservations, type QualifiedObservation } from './qualified-observations.mts';
import type { ObservationSelection } from './query.mts';
export async function selectedProductInput(root:string, selection:ObservationSelection) {
 const stated=selection.product;
 if(!stated)throw new Error('The selection has no qualified artifact; qualify and select a product first.');
 if(stated.program!==selection.programme||stated.telescope!==selection.telescope||stated.mode!==selection.mode||stated.target!==selection.request.target)throw new Error('Selection differs from its qualified artifact.');
 return qualifiedProductInput(root,stated);
}
export async function qualifiedProductInput(root:string, stated:QualifiedObservation) {
 const current=[...await loadQualifiedObservations(root,stated.target), ...sourceQualifiedObservations(await loadSourceProducts(root,stated.target))].find(p=>p.product===stated.product && p.productRecord===stated.productRecord && p.receipt===stated.receipt && p.program===stated.program && p.telescope===stated.telescope && p.mode===stated.mode && p.observation===stated.observation);
 if(!current)throw new Error('The selected artifact or its qualification receipt is stale.');
 const file=resolve(root,current.product),pin=await pinFile(file),record=await readProductRecord(resolve(root,current.productRecord));
 if(!record?.outputs.some(o=>resolve(root,current.outputRoot,o.path)===file && o.sha256===pin.sha256 && o.bytes===pin.bytes))throw new Error('Selected artifact is not the qualified output.');
 const input:ProductInput={role:'qualified scientific product',identity:current.product,...pin};
 return {file,input,facts:current.facts,qualification:current};
}
