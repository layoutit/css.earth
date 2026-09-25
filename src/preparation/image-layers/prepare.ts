import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from '@cssearth/core/node';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import type { ImageLayerRecipe, LayerAxis, Vec3 } from './config.js';
import { resizeRgbaLanczos3 } from './resize-rgba.js';

type Quad = { id: string; axis: LayerAxis; offsetKpc: number; centerUnits: Vec3; doubleSided: true; texturePath: string; widthPx: number; heightPx: number;
  verticesUnits: [Vec3, Vec3, Vec3, Vec3]; uvs: [[number, number], [number, number], [number, number], [number, number]];
  style: { width: string; height: string; transform: string; backgroundSize: string; backgroundPosition: string };
  sha256: string; bytes: number };
export interface PreparedImageLayerBank {
  schema: 'cssearth-image-layer-bank@1'; id: string; frame: { referenceFrame: 'sun-icrf'; epochJdTt: 2461286.5;
    originM: Vec3; localToReferenceXyzw: [number, number, number, number]; metersPerUnit: number;
    boundsUnits: { min: Vec3; max: Vec3 } }; observation: ImageLayerRecipe['observation'];
  banks: { axis: LayerAxis; normalUnits: Vec3; samplingStepUnits: number; leaves: Quad[] }[]; resources: { path: string; sha256: string; bytes: number; width: number; height: number }[];
  provenance: unknown; approximation: { model: string; canonicalRecomposition: string; limitations: string[] };
}
const M_PER_PC = 3.0856775814913673e16, M_PER_KPC = M_PER_PC * 1000;
const rad = (n: number): number => n * Math.PI / 180;
const unit = (raDeg: number, decDeg: number): Vec3 => {
  const ra = rad(raDeg), dec = rad(decDeg), c = Math.cos(dec); return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
};

const norm = (a: Vec3): Vec3 => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };
const scale = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];
const add = (...v: Vec3[]): Vec3 => v.reduce<Vec3>((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);
function quaternionFromBasis(x: Vec3, y: Vec3, z: Vec3): [number, number, number, number] {
  const m00=x[0],m01=y[0],m02=z[0],m10=x[1],m11=y[1],m12=z[1],m20=x[2],m21=y[2],m22=z[2], tr=m00+m11+m22;
  let q: [number,number,number,number];
  if (tr > 0) { const s=Math.sqrt(tr+1)*2; q=[(m21-m12)/s,(m02-m20)/s,(m10-m01)/s,s/4]; }
  else if (m00>m11&&m00>m22) { const s=Math.sqrt(1+m00-m11-m22)*2; q=[s/4,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s]; }
  else if (m11>m22) { const s=Math.sqrt(1+m11-m00-m22)*2; q=[(m01+m10)/s,s/4,(m12+m21)/s,(m02-m20)/s]; }
  else { const s=Math.sqrt(1+m22-m00-m11)*2; q=[(m02+m20)/s,(m12+m21)/s,s/4,(m10-m01)/s]; }
  return q;
}
function compileStyle(vertices: Quad['verticesUnits'], texture: string, width: number, height: number, index: number): Quad['style'] {
  const polygon: Polygon = { vertices, uvs: [[0,0],[1,0],[1,1],[0,1]], texture,
    textureImageSource: { url: texture, width, height }, texturePresentation: { backend:'image',lighting:'source',projection:'projective' }, doubleSided:true };
  const plan=computeTextureAtlasPlanPublic(polygon,index,{tileSize:50,layerElevation:50,seamBleed:0});
  const g=plan&&resolvePolyTextureLeafGeometry(plan,{backend:'image',lighting:'source',projection:'projective'});
  if(!g) throw new TypeError(`Could not compile ${texture}.`);
  return { width:`${g.leafWidth}px`,height:`${g.leafHeight}px`,transform:`matrix3d(${g.matrix})`,
    backgroundSize:g.backgroundSize.map(v=>`${v}px`).join(' '),backgroundPosition:g.backgroundPosition.map(v=>`${v}px`).join(' ') };
}
export async function prepareImageLayers(options: { sourceDirectory: string; outputDirectory: string; recipe: ImageLayerRecipe }): Promise<PreparedImageLayerBank> {
  const { recipe }=options, source=await readFile(resolve(options.sourceDirectory,recipe.source.path));
  const metadata=await sharp(source).metadata();
  if(metadata.width!==recipe.source.dimensions[0]||metadata.height!==recipe.source.dimensions[1]) throw new TypeError('Image source dimensions mismatch.');
  const resized=sharp(source).rotate().resize({width:recipe.bake.maxFacePixels,height:recipe.bake.maxFacePixels,fit:'inside',withoutEnlargement:true});
  const {data:rgb,info}=await resized.removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  const base=Buffer.alloc(info.width*info.height*4), floor=recipe.bake.backgroundFloor*255;
  for(let p=0;p<info.width*info.height;p++) { const i=p*3,o=p*4,r=Math.max(0,rgb[i]-floor),g=Math.max(0,rgb[i+1]-floor),b=Math.max(0,rgb[i+2]-floor),a=Math.max(r,g,b);
    base[o]=a?Math.round(r*255/a):0;base[o+1]=a?Math.round(g*255/a):0;base[o+2]=a?Math.round(b*255/a):0;base[o+3]=Math.round(a*255/(255-floor)); }
  const inclination=rad(recipe.geometry.inclinationDeg), pa=rad(recipe.geometry.lineOfNodesPaDeg), theta=rad(recipe.observation.northClockwiseDeg);
  const target=unit(recipe.target.centerRaDeg,recipe.target.centerDecDeg), north=norm([-Math.cos(rad(recipe.target.centerRaDeg))*Math.sin(rad(recipe.target.centerDecDeg)),-Math.sin(rad(recipe.target.centerRaDeg))*Math.sin(rad(recipe.target.centerDecDeg)),Math.cos(rad(recipe.target.centerDecDeg))]);
  const east=norm(cross(north,target)), origin=scale(target,recipe.target.distancePc*M_PER_PC), q=quaternionFromBasis(east,north,target);
  const diskNormal:Vec3=[Math.sin(inclination)*Math.cos(pa),-Math.sin(inclination)*Math.sin(pa),Math.cos(inclination)];
  const obs=unit(recipe.observation.centerRaDeg,recipe.observation.centerDecDeg),obsNorth=norm([-Math.cos(rad(recipe.observation.centerRaDeg))*Math.sin(rad(recipe.observation.centerDecDeg)),-Math.sin(rad(recipe.observation.centerRaDeg))*Math.sin(rad(recipe.observation.centerDecDeg)),Math.cos(rad(recipe.observation.centerDecDeg))]);
  const obsEast=norm(cross(obsNorth,obs)),imageRight=add(scale(obsNorth,Math.sin(theta)),scale(obsEast,-Math.cos(theta))),imageUp=add(scale(obsNorth,Math.cos(theta)),scale(obsEast,Math.sin(theta)));
  const tanX=Math.tan(rad(recipe.observation.fieldOfViewDeg[0])/2),tanY=Math.tan(rad(recipe.observation.fieldOfViewDeg[1])/2),distanceKpc=recipe.target.distancePc/1000;
  const rayLocal=(u:number,v:number):Vec3=>{let fullU=u,fullV=v;const window=recipe.source.parentPixelWindow;if(window){const [x,y,w,h]=window,[ow,oh]=recipe.source.originalDimensions;fullU=2*(x+(u+1)*w/2)/ow-1;fullV=1-2*(y+(1-v)*h/2)/oh;}
    const ray=norm(add(obs,scale(imageRight,fullU*tanX),scale(imageUp,fullV*tanY)));return [dot(ray,east),dot(ray,north),dot(ray,target)];};
  const intersect=(u:number,v:number,offset:number):Vec3=>{const ray=rayLocal(u,v),t=(dot(diskNormal,[0,0,distanceKpc])+offset)/dot(diskNormal,ray);return [t*ray[0],t*ray[1],t*ray[2]-distanceKpc];};
  const thickness=recipe.geometry.thicknessKpc;
  const lineNodes:Vec3=[Math.sin(pa),Math.cos(pa),0],diskMinor=norm(cross(diskNormal,lineNodes)),support=recipe.geometry.supportRadiusKpc,taper=support*recipe.geometry.supportTaperFraction;
  for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++){const p=intersect(2*(px+.5)/info.width-1,1-2*(py+.5)/info.height,0),radius=Math.hypot(dot(p,lineNodes),dot(p,diskMinor));let factor=1;
    if(radius>=support)factor=0;else if(radius>taper){const t=(support-radius)/(support-taper);factor=t*t*(3-2*t);}
    const edge=Math.min(px/Math.max(1,info.width-1),(info.width-1-px)/Math.max(1,info.width-1),py/Math.max(1,info.height-1),(info.height-1-py)/Math.max(1,info.height-1)),et=Math.min(1,edge/recipe.bake.edgeTaperFraction),edgeFactor=et*et*(3-2*et);
    base[4*(py*info.width+px)+3]=Math.round(base[4*(py*info.width+px)+3]*factor*edgeFactor);}
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++)if(base[4*(py*info.width+px)+3]){left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
  if(right<left)throw new TypeError('Physical support removed the complete observation.');
  left=Math.max(0,left-1);right=Math.min(info.width-1,right+1);top=Math.max(0,top-1);bottom=Math.min(info.height-1,bottom+1);
  const extractSized=(rgba:Buffer,width:number,x0:number,y0:number,x1:number,y1:number):Buffer=>{const out=Buffer.alloc((x1-x0)*(y1-y0)*4);for(let py=y0;py<y1;py++)rgba.copy(out,(py-y0)*(x1-x0)*4,4*(py*width+x0),4*(py*width+x1));return out;};
  const luminance=Buffer.alloc(info.width*info.height);for(let p=0;p<info.width*info.height;p++){const i=4*p,a=base[i+3]/255;luminance[p]=Math.round(a*(.2126*base[i]+.7152*base[i+1]+.0722*base[i+2]));}
  const blurredResult=await sharp(luminance,{raw:{width:info.width,height:info.height,channels:1}}).blur(recipe.bake.diffuseSigmaPixels).greyscale().raw().toBuffer({resolveWithObject:true});
  if(blurredResult.info.channels!==1||blurredResult.data.length!==info.width*info.height)throw new TypeError('Diffuse luminance blur must remain single-channel.');
  const blurred=blurredResult.data;
  const diffuse=Buffer.from(base),residual=Buffer.from(base);
  for(let p=0;p<info.width*info.height;p++){const i=4*p,a=base[i+3]/255,compactness=Math.min(1,(blurred[p]+2)/(luminance[p]+2)),ad=a*recipe.bake.diffuseFraction*compactness;
    diffuse[i+3]=Math.round(255*ad);residual[i+3]=Math.round(255*(a-ad)/Math.max(1-ad,1e-9));}
  await mkdir(resolve(options.outputDirectory,'layers'),{recursive:true});
  const leaves: Quad[]=[], resources: PreparedImageLayerBank['resources']=[];
  const encode=async(rgba:Buffer,width:number,height:number,path:string)=>{ const bytes=await sharp(rgba,{raw:{width,height,channels:4}}).webp({quality:recipe.bake.encoding.quality,alphaQuality:100,effort:5}).toBuffer(); await writeFile(resolve(options.outputDirectory,path),bytes); resources.push({path,sha256:sha256(bytes),bytes:bytes.length,width,height}); return bytes; };
  const cropWidth=right-left+1,cropHeight=bottom-top+1,u0=2*left/info.width-1,u1=2*(right+1)/info.width-1,v0=1-2*top/info.height,v1=1-2*(bottom+1)/info.height;
  const diffuseCrop=extractSized(diffuse,info.width,left,top,right+1,bottom+1),residualCrop=extractSized(residual,info.width,left,top,right+1,bottom+1);
  const diffuseScale=Math.min(1,recipe.bake.diffuseFacePixels/Math.max(cropWidth,cropHeight)),dw=Math.max(1,Math.round(cropWidth*diffuseScale)),dh=Math.max(1,Math.round(cropHeight*diffuseScale));
  const diffuseSmall=dw===cropWidth&&dh===cropHeight?diffuseCrop:resizeRgbaLanczos3(diffuseCrop,cropWidth,cropHeight,dw,dh);
  for(let layer=0;layer<recipe.geometry.depthWeights.length;layer++){const w=recipe.geometry.depthWeights[layer],rgba=Buffer.from(diffuseSmall);for(let p=0;p<dw*dh;p++){const i=4*p,a=rgba[i+3]/255;rgba[i+3]=Math.round(255*(1-(1-a)**w));}
    const offset=thickness*(layer/(recipe.geometry.depthWeights.length-1)-.5),path=`layers/z-${String(layer).padStart(2,'0')}.webp`,bytes=await encode(rgba,dw,dh,path),v:[Vec3,Vec3,Vec3,Vec3]=[intersect(u0,v0,offset),intersect(u1,v0,offset),intersect(u1,v1,offset),intersect(u0,v1,offset)];
    leaves.push({id:`z-${layer}`,axis:'z',offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:dw,heightPx:dh,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,dw,dh,leaves.length),sha256:sha256(bytes),bytes:bytes.length});}
  {const path='layers/z-detail.webp',bytes=await encode(residualCrop,cropWidth,cropHeight,path),v:[Vec3,Vec3,Vec3,Vec3]=[intersect(u0,v0,0),intersect(u1,v0,0),intersect(u1,v1,0),intersect(u0,v1,0)];leaves.push({id:'z-detail',axis:'z',offsetKpc:0,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:cropWidth,heightPx:cropHeight,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,cropWidth,cropHeight,leaves.length),sha256:sha256(bytes),bytes:bytes.length});}
  const weightAt=(z:number)=>{const q=(z+1)/2*(recipe.geometry.depthWeights.length-1),i=Math.min(recipe.geometry.depthWeights.length-2,Math.max(0,Math.floor(q))),t=q-i;return ((recipe.geometry.depthWeights[i]??0)*(1-t)+(recipe.geometry.depthWeights[i+1]??0)*t)*recipe.geometry.depthWeights.length;};
  const side=async(axis:'x'|'y')=>{const slices=recipe.bake.crossAxisSlices,sourceAlong=axis==='x'?info.height:info.width,along=Math.min(sourceAlong,recipe.bake.crossAxisAlongPixels),depth=recipe.bake.crossAxisDepthPixels,crossSize=axis==='x'?info.width:info.height;
    for(let s=0;s<slices;s++){const rgba=Buffer.alloc(along*depth*4);
      for(let a=0;a<along;a++){const alongSource=Math.min(sourceAlong-1,Math.floor((a+.5)/along*sourceAlong));let ad=0,ar=0,pd=[0,0,0],pr=[0,0,0];
        for(let sample=0;sample<4;sample++){const crossSource=Math.min(crossSize-1,Math.floor((s+(sample+.5)/4)/slices*crossSize)),px=axis==='x'?crossSource:alongSource,py=axis==='x'?alongSource:crossSource,si=4*(py*info.width+px),da=diffuse[si+3]/255,ra=residual[si+3]/255;ad+=da/4;ar+=ra/4;for(let c=0;c<3;c++){pd[c]+=base[si+c]/255*da/4;pr[c]+=base[si+c]/255*ra/4;}}
        for(let d=0;d<depth;d++){const zz=(d+.5)/depth*2-1,aD=1-(1-ad)**(weightAt(zz)/slices),aR=Math.abs(d-(depth-1)/2)<.5?1-(1-ar)**(1/slices):0,A=aR+aD*(1-aR),di=4*(d*along+a);for(let c=0;c<3;c++){const premul=(ar?pr[c]/Math.max(ar,1e-9)*aR:0)+(ad?pd[c]/Math.max(ad,1e-9)*aD*(1-aR):0);rgba[di+c]=A?Math.round(255*premul/A):0;}rgba[di+3]=Math.round(255*A);}}
      let aMin=along,aMax=-1;for(let d=0;d<depth;d++)for(let a=0;a<along;a++)if(rgba[4*(d*along+a)+3]){aMin=Math.min(aMin,a);aMax=Math.max(aMax,a);}
      if(aMax<aMin)continue;
      const sideWidth=aMax-aMin+1,sideRgba=Buffer.alloc(sideWidth*depth*4);for(let d=0;d<depth;d++)rgba.copy(sideRgba,d*sideWidth*4,4*(d*along+aMin),4*(d*along+aMax+1));
      const coordinate=(s+.5)/slices*2-1,path=`layers/${axis}-${String(s).padStart(2,'0')}.webp`,bytes=await encode(sideRgba,sideWidth,depth,path),lo=-thickness/2,hi=thickness/2;
      const alongA=2*aMin/along-1,alongB=2*(aMax+1)/along-1;
      const v:Quad['verticesUnits']=axis==='x'?[intersect(coordinate,-alongA,hi),intersect(coordinate,-alongB,hi),intersect(coordinate,-alongB,lo),intersect(coordinate,-alongA,lo)]:[intersect(alongA,-coordinate,hi),intersect(alongB,-coordinate,hi),intersect(alongB,-coordinate,lo),intersect(alongA,-coordinate,lo)];
      const offset=axis==='x'?(v[0][0]+v[1][0])/2:(v[0][1]+v[1][1])/2;
      leaves.push({id:`${axis}-${s}`,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:sideWidth,heightPx:depth,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,sideWidth,depth,leaves.length),sha256:sha256(bytes),bytes:bytes.length}); }};
  await side('x');await side('y');
  const provenanceBytes=await readFile(resolve(options.sourceDirectory,recipe.provenance.path));
  const provenance=JSON.parse(provenanceBytes.toString('utf8')) as unknown;
  const allVertices=leaves.flatMap(l=>l.verticesUnits),bounds={min:[0,1,2].map(i=>Math.min(...allVertices.map(v=>v[i]))) as Vec3,max:[0,1,2].map(i=>Math.max(...allVertices.map(v=>v[i]))) as Vec3};
  const difference=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const bank=(axis:LayerAxis)=>{const selected=leaves.filter(l=>l.axis===axis),middle=selected[Math.floor(selected.length/2)],normal=axis==='z'?diskNormal:norm(cross(difference(middle.verticesUnits[1],middle.verticesUnits[0]),difference(middle.verticesUnits[2],middle.verticesUnits[1])));let samplingStepUnits=thickness/(recipe.geometry.depthWeights.length-1);
    if(axis!=='z'){const values=selected.map(l=>dot(l.centerUnits,normal)),span=Math.max(...values)-Math.min(...values);samplingStepUnits=selected.length>1?span/(selected.length-1):recipe.geometry.supportRadiusKpc*2;}
    return {axis,normalUnits:normal,samplingStepUnits,leaves:selected};};
  const result:PreparedImageLayerBank={schema:'cssearth-image-layer-bank@1',id:recipe.id,frame:{referenceFrame:'sun-icrf',epochJdTt:2461286.5,originM:origin,localToReferenceXyzw:q,metersPerUnit:M_PER_KPC,boundsUnits:bounds},observation:recipe.observation,
    banks:(['x','y','z'] as LayerAxis[]).map(bank),resources,provenance,approximation:{model:`A low-frequency fraction of the observed display RGB is distributed through one normalized ${recipe.geometry.kind} depth profile; the compact residual remains on the physical midplane.`,canonicalRecomposition:'The source-facing diffuse slabs use optical-depth weights and composite with the residual layer to reproduce the prepared observation within resampling and encoding error.',limitations:['Depth is parametric and is not measured per pixel.','Compact residuals are image-frequency features, not classified stars or measured 3D positions.','Cross-axis banks are sampled projections of the separable display model; finite slices and bank handoffs remain visible.','Released foreground stars remain because blanket removal would also erase intrinsic galaxy stars.']}};
  await writeFile(resolve(options.outputDirectory,'image-layers.json'),JSON.stringify(result,null,2)+'\n');return result;
}
