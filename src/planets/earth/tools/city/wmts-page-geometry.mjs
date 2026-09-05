import { preparePolarWmtsTile } from "./wmts-polar-geometry.mjs";
import { prepareCityPageGeometry } from "./page-geometry.mjs";
import { preparePageTextureQuad, geographicTextureMapping } from "./wms-page-geometry.mjs";

export const WMTS_RASTER_SCALE = 8;
export const WMTS_PIXEL_ERROR = 0.125;
const LIMIT = 85.0511287798066;
const facesByScene=new WeakMap();
function preparedFaces(scene){
  if(!facesByScene.has(scene))facesByScene.set(scene,Array.from({length:14*32},(_,i)=>
    prepareCityPageGeometry({level:0,x:i%32,y:Math.floor(i/32)+1},scene)));
  return facesByScene.get(scene);
}
export const wmtsLatitude = (row, zoom) => Math.atan(Math.sinh(Math.PI*(1-2*row/2**zoom)))*180/Math.PI;
export const wmtsRow = (latitude, zoom) => (1-Math.asinh(Math.tan(latitude*Math.PI/180))/Math.PI)/2*2**zoom;

export function wmtsAddress(longitude, latitude, zoom) {
  if (!Number.isSafeInteger(zoom)||zoom<5||zoom>19||!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(latitude)>LIMIT) {
    throw new Error("Invalid WorldCover WMTS location.");
  }
  const n=2**zoom;
  return {zoom,x:Math.min(n-1,Math.floor(((longitude+180)%360+360)%360/360*n)),
    y:Math.max(0,Math.min(n-1,Math.floor(wmtsRow(latitude,zoom))))};
}

// The interpolation error for f(t)=atan(sinh(pi*(1-2t/n))) is at most
// max|f''| * interval^2 / 8. Convert angular error back to provider pixels
// using the maximum Mercator derivative over the complete interval.
export function mercatorStripErrorBound(zoom, row0, row1) {
  const a=wmtsLatitude(row0,zoom)*Math.PI/180,b=wmtsLatitude(row1,zoom)*Math.PI/180;
  const lo=Math.min(a,b),hi=Math.max(a,b),values=[Math.abs(Math.sin(2*lo)),Math.abs(Math.sin(2*hi))];
  for(const extremum of [-Math.PI/4,Math.PI/4])if(lo<=extremum&&hi>=extremum)values.push(1);
  const c=2*Math.PI/2**zoom;
  const secondDerivative=c*c*Math.max(...values)/2;
  const inverseDerivative=1/(c*Math.min(Math.cos(a),Math.cos(b)));
  return secondDerivative*(row1-row0)**2/8*inverseDerivative*256;
}

// Prepares regular-band pieces and the accepted polar caps. Each provider tile is cropped at the
// accepted face aprons and subdivided to bound Mercator curvature. The coarse
// faces overlap: clipping only at nominal geographic edges leaves them visible
// above detail. Each intersected face gets a small prepared clipping rectangle.
// Multiple pieces share the original PNG URL; no new imagery is produced.
export function prepareWmtsTile({zoom,x,y},scene) {
  const n=2**zoom;
  if(!Number.isSafeInteger(zoom)||zoom<5||zoom>19||![x,y].every(v=>Number.isSafeInteger(v)&&v>=0&&v<n))throw new Error("Invalid WMTS tile.");
  const west=-180+x/n*360,east=-180+(x+1)/n*360;
  const north=wmtsLatitude(y,zoom),south=wmtsLatitude(y+1,zoom);

  const url=`https://mapproxy.terrascope.be/mapproxy/wmts/esa-worldcover-s2rgbnir-10m-2021-v2_tcc/webmercator/${String(zoom).padStart(2,"0")}/${x}/${y}.png`;
  const geoWest=(west+360)%360;
  const candidates=preparedFaces(scene).filter(coarse=>{
    const b=coarse.sourceBounds;
    const shift=360*Math.round(((b.west+b.east)/2-(geoWest+(east-west)/2))/360);
    return geoWest+shift < b.east && geoWest+shift+east-west > b.west && south < b.north && north > b.south;
  });
  const pieces=[];
  const split=(row0,row1)=>{
    const error=mercatorStripErrorBound(zoom,row0,row1);
    if(error>WMTS_PIXEL_ERROR){const mid=(row0+row1)/2;split(row0,mid);split(mid,row1);return;}
    const fraction=row1-row0,v0=row0-y;
    for(const coarse of candidates){
      const b=coarse.sourceBounds;
      const shift=360*Math.round(((b.west+b.east)/2-(geoWest+(east-west)/2))/360);
      const bounds={west:geoWest+shift,east:geoWest+shift+(east-west),north:wmtsLatitude(row0,zoom),south:wmtsLatitude(row1,zoom)};
      if(bounds.west>=b.east||bounds.east<=b.west||bounds.south>=b.north||bounds.north<=b.south)continue;
      const h=geographicTextureMapping(coarse,bounds);
      const corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{
        const w=h[6]*u+h[7]*v+h[8];return [(h[0]*u+h[1]*v+h[2])/w,(h[3]*u+h[4]*v+h[5])/w];
      });
      const u0=Math.max(0,Math.min(...corners.map(p=>p[0]))),u1=Math.min(1,Math.max(...corners.map(p=>p[0])));
      const q0=Math.max(0,Math.min(...corners.map(p=>p[1]))),q1=Math.min(1,Math.max(...corners.map(p=>p[1])));
      if(u1-u0<1e-10||q1-q0<1e-10)continue;
      const du=u1-u0,dv=q1-q0;
      const mapping=preparePageTextureQuad(coarse,[du,0,u0,0,dv,q0,0,0,1],WMTS_RASTER_SCALE);
      const relative=[(h[0]-u0*h[6])/du,(h[1]-u0*h[7])/du,(h[2]-u0*h[8])/du,
        (h[3]-q0*h[6])/dv,(h[4]-q0*h[7])/dv,(h[5]-q0*h[8])/dv,h[6],h[7],h[8]];
      const imageMatrix=[relative[0],relative[3],0,relative[6]/256,relative[1],relative[4],0,relative[7]/256,
        0,0,1,0,relative[2]*256,relative[5]*256,0,relative[8]].join(",");
      pieces.push({key:`wmts-${zoom}-${x}-${y}-${pieces.length}`,level:zoom,x,y,
        rasterSource:"terrascope-wmts@1",url,width:256,height:256,
        bounds,sourceCrop:{u0:0,u1:1,v0,v1:row1-y},coarseKey:coarse.key,faceClip:{u0,u1,v0:q0,v1:q1},normal:coarse.normal,...mapping,imageMatrix,
        textureBackgroundSize:`256px ${256/fraction}px`,textureBackgroundPosition:`0px ${-v0*256/fraction}px`,
        maximumCssSpan:512,children:[],projectionErrorPixels:error});
    }
  };
  if(candidates.length)split(y,y+1);
  pieces.push(...preparePolarWmtsTile({zoom,x,y},scene,url,pieces.length));
  return pieces;
}
