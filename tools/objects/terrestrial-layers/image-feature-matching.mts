/** Preparation-only image matching. Smoothed copies locate controls; the
 * photographic sampler continues to use untouched radiance and quality flags. */
export interface MatchRaster {width:number;height:number;values:Uint8Array|Float32Array|Float64Array;valid:Uint8Array}
export interface MatchPolicy {
  patchRadius:number;searchRadius:number;gridStride:number;gridOrigin:number;
  targetSmoothingSigma:number;minimumCorrelation:number;minimumPeakMargin:number;minimumJointValidFraction:number;
}
export interface ImageMatch {
  id:string;partition:'fit'|'holdout';sourcePixel:number[];seedPixel:number[];
  correlation:number;peakMargin:number;jointValidFraction:number;
}

function smooth(raster:MatchRaster,sigma:number) {
  const {width,height}=raster,radius=Math.round(4*sigma),kernel=Array.from({length:2*radius+1},(_,i)=>Math.exp(-.5*((i-radius)/sigma)**2));
  const filter=(input:Float64Array)=>{
    const scratch=new Float64Array(input.length),output=new Float64Array(input.length);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let d=-radius;d<=radius;d++){
      const xx=Math.max(0,Math.min(width-1,x+d));scratch[y*width+x]+=input[y*width+xx]*kernel[d+radius];
    }
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let d=-radius;d<=radius;d++){
      const yy=Math.max(0,Math.min(height-1,y+d));output[y*width+x]+=scratch[yy*width+x]*kernel[d+radius];
    }
    return output;
  };
  const sum=filter(Float64Array.from(raster.values,(n,i)=>raster.valid[i]?n:0)),weight=filter(Float64Array.from(raster.valid));
  return sum.map((n,i)=>weight[i]>0?n/weight[i]:0);
}

/** Grid cells decide fit/holdout membership before correlation is evaluated.
 * No residual-based pruning is applied to either partition. */
export function matchImageFeatures(target:MatchRaster,referenceWarp:MatchRaster,margin:number,p:MatchPolicy) {
  for(const r of [target,referenceWarp])if(!Number.isSafeInteger(r.width)||!Number.isSafeInteger(r.height)||r.width<1||r.height<1||r.values.length!==r.width*r.height||r.valid.length!==r.values.length)throw new Error('Invalid matching raster.');
  if(![p.patchRadius,p.searchRadius,p.gridStride,p.gridOrigin,margin].every(Number.isSafeInteger)||p.patchRadius<2||p.searchRadius<2||p.searchRadius>64||p.gridStride<2*p.patchRadius+3||p.gridOrigin<=p.patchRadius||margin<p.searchRadius+p.patchRadius||referenceWarp.width!==target.width+2*margin||referenceWarp.height!==target.height+2*margin||!(p.targetSmoothingSigma>0&&p.targetSmoothingSigma<=2)||!(p.minimumCorrelation>=.8&&p.minimumCorrelation<1)||!(p.minimumPeakMargin>=.02&&p.minimumPeakMargin<1)||!(p.minimumJointValidFraction>=.8&&p.minimumJointValidFraction<=1))throw new Error('Invalid image matching policy.');
  const native=smooth(target,p.targetSmoothingSigma),matches:ImageMatch[]=[],excluded:{id:string;pixel:number[];reason:string;correlation:number;peakMargin:number}[]=[];
  const side=2*p.searchRadius+1,rad=p.patchRadius,patchArea=(2*rad+1)**2;
  let row=0;
  for(let y=p.gridOrigin;y<target.height-rad-1;y+=p.gridStride,row++){
    let col=0;
    for(let x=p.gridOrigin;x<target.width-rad-1;x+=p.gridStride,col++){
      const id=`patch-${row}-${col}`,scores=new Float64Array(side*side).fill(-2),counts=new Uint16Array(scores.length);
      let best=-2,bestX=0,bestY=0;
      for(let sy=0;sy<side;sy++)for(let sx=0;sx<side;sx++){
        let count=0,a=0,b=0,aa=0,bb=0,ab=0;
        for(let py=-rad;py<=rad;py++)for(let px=-rad;px<=rad;px++){
          const ti=(y+py)*target.width+x+px,ri=(y+margin+sy-p.searchRadius+py)*referenceWarp.width+x+margin+sx-p.searchRadius+px;
          if(!target.valid[ti]||!referenceWarp.valid[ri])continue;
          const av=referenceWarp.values[ri],bv=native[ti];count++;a+=av;b+=bv;aa+=av*av;bb+=bv*bv;ab+=av*bv;
        }
        const i=sy*side+sx;counts[i]=count;
        if(count<patchArea*p.minimumJointValidFraction)continue;
        const variance=(aa-a*a/count)*(bb-b*b/count);
        if(variance<=1e-16)continue;
        const score=(ab-a*b/count)/Math.sqrt(variance);scores[i]=score;
        if(score>best){best=score;bestX=sx;bestY=sy;}
      }
      let next=-2;
      for(let sy=0;sy<side;sy++)for(let sx=0;sx<side;sx++)if(Math.abs(sx-bestX)>3||Math.abs(sy-bestY)>3)next=Math.max(next,scores[sy*side+sx]);
      const gap=best-next,rx=x+bestX-p.searchRadius,ry=y+bestY-p.searchRadius;
      const reason=best<p.minimumCorrelation?'weak-correlation':gap<p.minimumPeakMargin?'ambiguous-peak':bestX===0||bestY===0||bestX===side-1||bestY===side-1?'search-boundary':!referenceWarp.valid[(ry+margin)*referenceWarp.width+rx+margin]?'invalid-anchor':null;
      if(reason){excluded.push({id,pixel:[x,y],reason,correlation:best,peakMargin:gap});continue;}
      const center=bestY*side+bestX,parabola=(left:number,right:number)=>Math.max(-.5,Math.min(.5,.5*(left-right)/(left-2*best+right)));
      const subX=parabola(scores[center-1],scores[center+1]),subY=parabola(scores[center-side],scores[center+side]);
      matches.push({id,partition:(row+col)%2===0?'fit':'holdout',sourcePixel:[x-subX,y-subY],seedPixel:[rx,ry],correlation:best,peakMargin:gap,jointValidFraction:counts[center]/patchArea});
    }
  }
  const fit=matches.filter(m=>m.partition==='fit');
  if(fit.length<6||matches.length-fit.length<6)throw new Error('Insufficient independent image feature controls.');
  const offsetPixels=[0,1].map(i=>fit.reduce((sum,m)=>sum+m.sourcePixel[i]-m.seedPixel[i],0)/fit.length);
  return {offsetPixels,matches,excluded};
}
