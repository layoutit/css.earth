/** Reuse the preserved NOX cleaning; compare the publisher original in the same registration. */
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,ROOT,json,rec,numbers,num,need} from './inputs.mts';
import {loadObservation} from './observation.mts';
import {skyOf,DEG} from './geometry.mts';
const out=`${LOCAL}versions/l8/`;await mkdir(out+'inputs/',{recursive:true});
const original=await sharp(out+'inputs/horalek-publisher.jpg').removeAlpha().raw().toBuffer({resolveWithObject:true});
need(original.info.width===6582&&original.info.height===4388&&original.info.channels===3,'Publisher source dimensions changed');
const record=rec(await json(`${ROOT}src/objects/lmc-volume/source/lenses/horalek-widefield/provenance.json`)),request=rec(record.request),cloud=rec(request.cloud),alignment=rec(cloud.starAlignment),wcs=rec(alignment.wcs),center=numbers(wcs.referenceValueDeg,2),ref=numbers(wcs.referencePixel,2),scale=numbers(wcs.scaleDeg,2),dim=numbers(wcs.referenceDimension,2),rotation=num(wcs.rotationDeg)*DEG;
const reg=rec(await json(`${ROOT}src/objects/lmc-volume/source/candidates/source/horalek-registration.json`)),m=numbers(reg.imageToReferenceMatrix,9);
const [a,b,c,d,e,f,g,h,i]=m,det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g),inv=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d].map(v=>v/det);
const o=await loadObservation(8),raw=Buffer.alloc(o.width*o.height*3),diffuse=Buffer.alloc(raw.length),residual=Buffer.alloc(raw.length);let positive=0,negative=0,signal=0;
for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++){
  const [ra,de]=skyOf(o.rayAt(x+.5,y+.5)),dr=(ra-center[0])*DEG,dec=de*DEG,dc=center[1]*DEG,den=Math.sin(dc)*Math.sin(dec)+Math.cos(dc)*Math.cos(dec)*Math.cos(dr),east=Math.cos(dec)*Math.sin(dr)/den/DEG,north=(Math.cos(dc)*Math.sin(dec)-Math.sin(dc)*Math.cos(dec)*Math.cos(dr))/den/DEG;
  const wx=(Math.cos(rotation)*east+Math.sin(rotation)*north)/scale[0]+ref[0],wy=(-Math.sin(rotation)*east+Math.cos(rotation)*north)/scale[1]+ref[1];
  // The native homography uses top-left zero-based SMASH raster coordinates.
  const rx=wx-1,ry=dim[1]-wy,k=inv[6]*rx+inv[7]*ry+inv[8],sx=(inv[0]*rx+inv[1]*ry+inv[2])/k,sy=(inv[3]*rx+inv[4]*ry+inv[5])/k,xx=Math.floor(sx),yy=Math.floor(sy),u=sx-xx,v=sy-yy;
  for(let c=0;c<3;c++){const p=(y*o.width+x)*3+c;diffuse[p]=Math.round(o.rawRgb[c][y][x]*255);let value=0;
    if(xx>=0&&yy>=0&&xx+1<original.info.width&&yy+1<original.info.height){const at=(dx:number,dy:number)=>original.data[((yy+dy)*original.info.width+xx+dx)*3+c];value=(at(0,0)*(1-u)+at(1,0)*u)*(1-v)+(at(0,1)*(1-u)+at(1,1)*u)*v;}
    raw[p]=Math.round(value);residual[p]=Math.max(0,raw[p]-diffuse[p]);if(o.mask[y][x]){positive+=Math.max(0,raw[p]-diffuse[p]);negative+=Math.max(0,diffuse[p]-raw[p]);signal+=raw[p];}
  }
}
for(const[name,bytes]of Object.entries({'publisher-registered':raw,'cleaned-photo':diffuse,'removed-positive':residual}))await sharp(bytes,{raw:{width:o.width,height:o.height,channels:3}}).png().toFile(out+name+'.png');
const labels=Buffer.from(`<svg width="1536" height="462" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g font-family="Arial" font-size="18" fill="white"><text x="12" y="28">Publisher original · same registration</text><text x="524" y="28">Preserved NOX diffuse input</text><text x="1036" y="28">Positive image difference</text><text x="12" y="451" font-size="14">Inherited compact-source removal suppresses foreground stars; membership is not determined by image morphology.</text></g></svg>`);
await sharp(labels).composite(await Promise.all([raw,diffuse,residual].map(async(b,i)=>({input:await sharp(b,{raw:{width:o.width,height:o.height,channels:3}}).png().toBuffer(),left:i*512,top:38})))).png().toFile(out+'cleaning.png');
await writeFile(out+'cleaning.json',JSON.stringify({sourceUrl:'https://storage.noirlab.edu/media/archives/images/large/iotw2547a.jpg',sourceDimensions:[6582,4388],registeredDimensions:[o.width,o.height],method:'Reuse the preserved compact NOX diffuse source; do not remove stars twice. The publisher image is reprojected only for inspection through the existing homography and WCS.',positiveRemovedCodeFraction:positive/signal,negativeDifferenceCodeFraction:negative/signal,membership:'Morphological compact-light removal does not distinguish foreground Milky Way stars from LMC members. Extended emission is retained; the original remains unchanged.',differenceMeaning:'A registered visual comparison, including resampling differences; not exact native NOX residual accounting.',noNewStarRemoval:true},null,2)+'\n');
console.log(JSON.stringify({sentinel:'L8_CLEANING_COMPARISON_WRITTEN',positiveRemovedCodeFraction:positive/signal,negativeDifferenceCodeFraction:negative/signal}));
