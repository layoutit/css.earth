import {LOCAL,rec,array,json,makeRaster,at,need,type Sources} from './inputs.mts';
import {bodyToIcrs,skyOf} from './geometry.mts';
import {readGas} from './qualify-gas.mts';
/** Only observed DeMCELS samples are included. Outside cutouts remains unsupported. */
export async function addGas(sources:Sources):Promise<void>{
  const dir=`${LOCAL}versions/inputs/gas/`,rows=array(await json(`${dir}index.json`));
  const products=[];
  for(const r of rows){const v=rec(r);if(typeof v.file==='string'){
    const source=await readGas(v.file),bin=32,w=Math.floor(source.image.width/bin),h=Math.floor(source.image.height/bin),values=new Float32Array(w*h);values.fill(NaN);
    // Area averages retain diffuse line emission and suppress native-pixel aliasing.
    // Negative sky noise is retained until after averaging, avoiding a positive noise floor.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,n=0;
      for(let j=0;j<bin;j++)for(let i=0;i<bin;i++){const a=source.image.values[(y*bin+j)*source.image.width+x*bin+i];if(Number.isFinite(a)){sum+=a;n++;}}
      if(n>=.95*bin*bin)values[y*w+x]=sum/n;
    }
    products.push({projection:source.projection,summary:source.summary,values,w,h,bin});
  }}
  need(products.length>0,'No DeMCELS field passed qualification');
  const map=makeRaster(1024,8),samples:number[]=[];let covered=0;
  for(let y=0;y<map.n;y++)for(let x=0;x<map.n;x++){
    const bx=(x+.5)/map.n*16-8,by=(y+.5)/map.n*16-8,sky=skyOf(bodyToIcrs([bx,by,at(sources.warp,bx,by)]));let value=0,n=0;
    for(const s of products){const p=s.projection.pixelOf(...sky);if(!p)continue;
      const xx=(p[0]-(s.bin-1)/2)/s.bin,yy=(p[1]-(s.bin-1)/2)/s.bin,i=Math.floor(xx),j=Math.floor(yy);if(i<0||j<0||i+1>=s.w||j+1>=s.h)continue;
      const ids=[j*s.w+i,j*s.w+i+1,(j+1)*s.w+i,(j+1)*s.w+i+1],a=ids.map(k=>s.values[k]);if(!a.every(Number.isFinite))continue;
      const u=xx-i,t=yy-j;value+=Math.max(0,(a[0]*(1-u)+a[1]*u)*(1-t)+(a[2]*(1-u)+a[3]*u)*t);n++;
    }
    if(n){const i=y*map.n+x;map.values[i]=value/n;map.mask[i]=1;covered++;samples.push(value/n);}
  }
  const integrated=map.values.reduce((a,b)=>a+b,0)*(16/map.n)**2;need(integrated>0,'No positive projected DeMCELS signal');
  for(let i=0;i<map.values.length;i++)map.values[i]/=integrated;
  sources.gas=map;sources.metadata.gas={products:products.map(p=>p.summary),coveredGridCells:covered,totalGridCells:map.n**2,halfKpc:8,
    meaning:'Measured continuum-subtracted H-alpha-filter morphology, normalized once; one global RGB tint/gain supplies appearance color. Not a resolved spectral model.',
    unsupported:'Outside these qualified cutouts the ionized-gas component is not supplied, not measured absent.'};
}
