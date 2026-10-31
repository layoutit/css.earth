/** C1 partition of a source image across overlapping compact cloud patches. */
export function patchAxisWeight(t:number,index:number,count:number):number {
 const phi=(i:number)=>{const d=count*t-(i+.5);return Math.abs(d)<1?Math.cos(Math.PI*d/2)**2:0;};let total=0;for(let i=0;i<count;i++)total+=phi(i);return total>0?phi(index)/total:0;
}
/** Split prepared opacity through optical depth, so source-over reconstructs the original endpoint. */
export function partitionAlpha(alpha:number,weight:number):number {return weight<=0?0:alpha>=1?1:-Math.expm1(weight*Math.log1p(-alpha));}
/** Quantize an entire overlapping partition jointly. Flooring the other pieces
 * lets the strongest piece carry the residual transmission with ≤half a byte
 * error, instead of losing faint dust independently in every piece. */
export function quantizedPatchAlpha(alpha:number,u:number,v:number,x:number,y:number,count:number):number {
 const weights:number[]=[];let anchor=0;for(let j=0;j<count;j++)for(let i=0;i<count;i++){weights.push(patchAxisWeight(u,i,count)*patchAxisWeight(v,j,count));if(weights.at(-1)!>weights[anchor]!)anchor=weights.length-1;}
 const index=y*count+x;if(weights[index]!<=0||alpha<=0)return 0;if(alpha>=1)return index===anchor?255:0;
 let transmitted=1;const bytes=weights.map((w,i)=>{if(i===anchor)return 0;const b=Math.floor(255*partitionAlpha(alpha,w)+1e-12);transmitted*=1-b/255;return b;});
 bytes[anchor]=Math.round(255*Math.max(0,Math.min(1,1-(1-alpha)/transmitted)));return bytes[index]!;
}
