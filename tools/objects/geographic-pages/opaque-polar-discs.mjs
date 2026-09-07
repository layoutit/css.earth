import {createHash} from 'node:crypto';
import sharp from 'sharp';

// Preparation only: certify an opaque disc inside each retained polar texture.
// The alpha margin includes filtering support; it never enlarges the cap.
export async function prepareOpaquePolarDiscs(scene,bytes){
  const {data,info}=await sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const asset=scene.body.assets.poles,ratio=info.width/asset.width;
  if(!(ratio>0)||info.height/asset.height!==ratio)throw new Error('Polar source dimensions differ from the retained atlas.');
  const discs=[],caps=[];
  for(const band of scene.body.bands){
    if(band.leaves.length!==1)continue;
    const leaf=band.leaves[0],rect=leaf.sourceRect;
    if(!rect||rect.width!==rect.height||leaf.leafWidth!==leaf.leafHeight)continue;
    const m=leaf.style.match(/matrix3d\(([^)]+)\)/)?.[1].split(',').map(Number);
    if(!m||m.length!==16||m.some(v=>!Number.isFinite(v))||m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)throw new Error('Opaque polar support requires its prepared affine face.');
    const u=m.slice(0,3),v=m.slice(4,7),normal=m.slice(8,11),length=Math.hypot(...u);
    const dot=(a,b)=>a.reduce((s,value,i)=>s+value*b[i],0);
    if(!(length>0)||!(leaf.leafWidth>0)||Math.abs(Math.hypot(...v)-length)>1e-8*length||Math.abs(dot(u,v))>1e-8*length*length||
      Math.abs(Math.hypot(...normal)-1)>1e-8||Math.abs(dot(u,normal))+Math.abs(dot(v,normal))>1e-8*length)
      throw new Error('Opaque polar support requires a circular face with its authored normal.');
    const side=rect.width*ratio,x0=rect.x*ratio,y0=rect.y*ratio;
    if(![side,x0,y0].every(Number.isSafeInteger)||side<5||x0<0||y0<0||x0+side>info.width||y0+side>info.height)throw new Error('Polar source crop is outside its atlas.');
    const midpoint=(side-1)/2;let firstNonopaque=side/2;
    for(let y=0;y<side;y++)for(let x=0;x<side;x++)if(data[((y0+y)*info.width+x0+x)*4+3]!==255)
      firstNonopaque=Math.min(firstNonopaque,Math.hypot(x-midpoint,y-midpoint));
    if(firstNonopaque<=2)continue;
    const center=[0,1,2].map(i=>m[i]*leaf.leafWidth/2+m[i+4]*leaf.leafHeight/2+m[i+12]);
    const radius=(firstNonopaque-2)*length*leaf.leafWidth/side;
    discs.push({center,normal,radius});caps.push({latitudeIndex:band.latitudeIndex,sourceRect:rect,firstNonopaque,radius});
  }
  return {discs,receipt:{sourceSha256:createHash('sha256').update(bytes).digest('hex'),width:info.width,height:info.height,caps}};
}
