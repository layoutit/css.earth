import type { ObservationMapping } from '../contracts/observation-mapping.ts';
import type { ObservationPhoto } from '../contracts/observation-photo.ts';
export function registeredImageSampler(photo:ObservationPhoto,mapping:ObservationMapping) {
  return registeredRasterSampler(photo.width,photo.height,photo.rgb,3,mapping);
}

export function registeredScalarSampler(photo:ObservationPhoto,values:Float32Array,mapping:ObservationMapping) {
  if(values.length!==photo.width*photo.height)throw new TypeError('Registered scalar field dimensions differ.');
  const sample=registeredRasterSampler(photo.width,photo.height,values,1,mapping),out:[number,number,number]=[1,1,1];
  return (x:number,y:number,z:number)=>sample(x,y,z,out)?out[0]:1;
}

function registeredRasterSampler(width:number,height:number,values:Uint8Array|Float32Array,channels:1|3,mapping:ObservationMapping) {
  const {min,max}=mapping.boundsUnits;
  return (x:number,y:number,z:number,out:[number,number,number]) => {
    const [tx,ty]=mapping.tangentAtPoint(x,y,z);
    if(!mapping.uvAtTangent(tx,ty))return false;
    const px=Math.max(0,Math.min(width-1,(tx-min[0])/(max[0]-min[0])*width-.5));
    const py=Math.max(0,Math.min(height-1,(max[1]-ty)/(max[1]-min[1])*height-.5));
    const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(x0+1,width-1),y1=Math.min(y0+1,height-1);
    const u=px-x0,v=py-y0;
    for(let c=0;c<channels;c++)out[c]=
      ((1-u)*values[(y0*width+x0)*channels+c]+u*values[(y0*width+x1)*channels+c])*(1-v)+
      ((1-u)*values[(y1*width+x0)*channels+c]+u*values[(y1*width+x1)*channels+c])*v;
    return true;
  };
}
