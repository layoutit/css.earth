import { prepareCityPageGeometry, createCityGeographicSampler, createCityCoverageSampler } from "./page-geometry.mjs";

export const COARSE_PAGE_PIXELS = 260;
export const COARSE_PAGE_RASTER_SCALE = 8;
export const MERCATOR_LATITUDE_LIMIT = 85.0511287798066;
const samplers = new WeakMap();

// Trim only transparent storage, after all source sampling. The retained face
// and texel scale stay unchanged. Two transparent border texels preserve the
// existing filtered edge; background addressing places the crop on that face.
export function trimCoarsePageRgba(rgba,width,height) {
  if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1||rgba.length!==width*height*4)throw new Error('Invalid prepared coarse image.');
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  const empty=right<0;
  const side=32*COARSE_PAGE_RASTER_SCALE;
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const stepX=width/gcd(width,side),stepY=height/gcd(height,side);
  if(empty){left=top=0;right=bottom=0;}
  else{
    // Keep the crop edges on the original CSS paint grid. Fractional background
    // boxes introduce an additional resampling phase even with identical texels.
    left=Math.max(0,Math.floor((left-2)/stepX)*stepX);top=Math.max(0,Math.floor((top-2)/stepY)*stepY);
    right=Math.min(width,Math.ceil((right+3)/stepX)*stepX)-1;bottom=Math.min(height,Math.ceil((bottom+3)/stepY)*stepY)-1;
  }
  const w=right-left+1,h=bottom-top+1,data=new Uint8Array(w*h*4);
  if(!empty)for(let y=0;y<h;y++)data.set(rgba.subarray(((top+y)*width+left)*4,((top+y)*width+left+w)*4),y*w*4);
  return {rgba:data,width:w,height:h,empty,crop:{left,top,width:w,height:h,canvasWidth:width,canvasHeight:height},
    textureBackgroundSize:`${side*w/width}px ${side*h/height}px`,textureBackgroundPosition:`${side*left/width}px ${side*top/height}px`};
}

// Keep the accepted face and apron. Half the existing fine-page separation
// places backing between that face and the unchanged fine imagery.
export function prepareCoarsePageGeometry(address, scene) {
  const page = prepareCityPageGeometry(address, scene, {normalOffset:0.0005, rasterScale:COARSE_PAGE_RASTER_SCALE});
  return {...page, key:`backing-${page.key}`, width:COARSE_PAGE_PIXELS, height:COARSE_PAGE_PIXELS, maximumCssSpan:384};
}

// Preparation only. Unwrap each footprint around its own centre: a footprint
// crossing the dateline must sample adjacent wrapped source pixels, not the
// rectangle extending across the whole world. Mercator's unserved poles stay
// transparent; the accepted base remains below them.
export function coarsePageFootprint(page, zoom, x, y) {
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 19) throw new Error("Invalid coarse source level.");
  if (!samplers.has(page)) samplers.set(page,{geographic:createCityGeographicSampler(page),covered:createCityCoverageSampler(page)});
  const {geographic,covered}=samplers.get(page);
  const width=page.width, height=page.height, size=256*2**zoom;
  const center=geographic((x+.5)/width,1-(y+.5)/height);
  const coverage=[.25,.75].reduce((sum,dy)=>sum+[.25,.75].reduce((n,dx)=>{
    const u=(x+dx)/width,v=1-(y+dy)/height;
    return n+Number(covered(u,v)&&Math.abs(geographic(u,v)[1])<=MERCATOR_LATITUDE_LIMIT);
  },0),0)/4;
  if (!coverage) return null;
  const points=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([px,py])=>{
    const [longitude,latitude]=geographic(px/width,1-py/height);
    const lon=longitude+360*Math.round((center[0]-longitude)/360);
    const lat=Math.max(-MERCATOR_LATITUDE_LIMIT,Math.min(MERCATOR_LATITUDE_LIMIT,latitude));
    return [(lon+180)/360*size,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*size];
  });
  const u=points[0].map((_,i)=>(points[1][i]-points[0][i]+points[2][i]-points[3][i])/2);
  const v=points[0].map((_,i)=>(points[3][i]-points[0][i]+points[2][i]-points[1][i])/2);
  const a=u[0]**2+u[1]**2,c=v[0]**2+v[1]**2,b=u[0]*v[0]+u[1]*v[1];
  const largest=(a+c+Math.hypot(a-c,2*b))/2;
  const minimumScale=Math.abs(u[0]*v[1]-u[1]*v[0])/Math.sqrt(largest);
  return {x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),
    y0:Math.max(0,Math.min(...points.map(p=>p[1]))),y1:Math.min(size,Math.max(...points.map(p=>p[1]))),coverage,minimumScale};
}

// Choose the source mip from actual prepared texel footprints. Polar pages
// cover much more Mercator imagery than regular faces at the same page level.
// The least-resolved direction of every full texel must still span at least
// one source pixel; fractional coverage at the source boundary does not set
// the mip. A rotated or sheared footprint cannot hide a short sampling axis.
export function coarsePageSourceLevel(page) {
  let minimum=Infinity,partialMinimum=Infinity;
  for(let y=0;y<page.height;y++)for(let x=0;x<page.width;x++){
    const b=coarsePageFootprint(page,0,x,y);if(!b)continue;
    const span=b.minimumScale;
    if(!Number.isFinite(span)||span<=0)throw new Error("Invalid coarse resolution footprint.");
    if(b.coverage===1)minimum=Math.min(minimum,span);
    else partialMinimum=Math.min(partialMinimum,span);
  }
  if(minimum===Infinity)minimum=partialMinimum;
  if(minimum===Infinity)return {zoom:0,empty:true};
  const zoom=Math.max(0,Math.ceil(Math.log2(1/minimum)));
  if(zoom>19)throw new Error("Coarse preparation exceeds the provider pyramid.");
  return {zoom,minimumSourceSpan:minimum*2**zoom};
}

// Source pixels are supplied by a pinned, bounded tile window. This is the
// same area-weighted premultiplied-alpha sampling used by mapped city pages,
// with wrapped horizontal addresses instead of a global stitched raster.
// Like that sampler, this returns north-up pixels. Publication flips the rows
// for the retained face's south-to-north texture axis.
export function sampleCoarsePage(page, zoom, sourcePixel) {
  const size=256*2**zoom,output=Buffer.alloc(page.width*page.height*4);
  for(let y=0;y<page.height;y++)for(let x=0;x<page.width;x++){
    const bounds=coarsePageFootprint(page,zoom,x,y);if(!bounds)continue;
    const {x0,x1,y0,y1,coverage}=bounds;
    if (![x0,x1,y0,y1].every(Number.isFinite)||x1<=x0||y1<=y0||x1-x0>size/2) throw new Error("Invalid coarse source footprint.");
    let red=0,green=0,blue=0,alpha=0;
    for(let sy=Math.floor(y0);sy<Math.ceil(y1);sy++)for(let sx=Math.floor(x0);sx<Math.ceil(x1);sx++){
      const area=(Math.min(x1,sx+1)-Math.max(x0,sx))*(Math.min(y1,sy+1)-Math.max(y0,sy));
      const pixel=sourcePixel(((sx%size)+size)%size,sy),weight=area*pixel[3];
      alpha+=weight;red+=weight*pixel[0];green+=weight*pixel[1];blue+=weight*pixel[2];
    }
    const at=(y*page.width+x)*4;
    if(alpha){output[at]=Math.round(red/alpha);output[at+1]=Math.round(green/alpha);output[at+2]=Math.round(blue/alpha);}
    output[at+3]=Math.round(coverage*alpha/((x1-x0)*(y1-y0)));
  }
  return output;
}
