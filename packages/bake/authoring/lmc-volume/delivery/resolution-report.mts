/** Native-pitch crop evidence. Brightness/detail statistics are diagnostics, not outside-view measurements. */
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {RESOLUTION_DIR} from './resolution-cameras.mts';
import {VIEW_NAMES} from './resolution-views.mts';
import {pixelDelta} from './resolution-pilot.mts';
import {need} from '../inputs.mts';
function contrast(rgb:Float64Array){const y=Float64Array.from({length:128*128},(_,p)=>.2126*rgb[p*3]+.7152*rgb[p*3+1]+.0722*rgb[p*3+2]);let power=0,sum=0,n=0;for(let j=1;j<127;j++)for(let i=1;i<127;i++){const k=j*128+i,v=y[k],lap=v-(y[k-1]+y[k+1]+y[k-128]+y[k+128])/4;power+=lap*lap;sum+=v;n++;}return Math.sqrt(power/n)/(sum/n);}
async function raw(path:string){const b=await readFile(path);need(b.length===128*128*3*8,'Crop pixels incomplete');return new Float64Array(Uint8Array.from(b).buffer);}
export async function resolutionReport(partial=false){
 const rows=[],panels=[],labels:{region:string;kind:string;top:number}[]=[];for(const region of['bar','gas'])for(const kind of['coarse','fine','refined']){
  const top=labels.length*300;labels.push({region,kind,top});for(const[cameraIndex,camera]of VIEW_NAMES.entries()){
   const directory=RESOLUTION_DIR+(kind==='refined'?'refined-pilot/':'pilot/'),step=kind==='coarse'?.06:kind==='fine'?.0075:.015,stem=region+'-'+camera+'-'+step;let bytes:Buffer;
   try{bytes=await readFile(directory+stem+'.png');}catch(error){if(!partial)throw error;continue;}
   panels.push({input:await sharp(bytes).resize(256,256,{kernel:'nearest'}).png().toBuffer(),left:cameraIndex*256,top:top+40});
   const current=await raw(directory+stem+'.f64le'),coarse=await raw(RESOLUTION_DIR+'pilot/'+region+'-'+camera+'-0.06.f64le');rows.push({region,kind,camera,pcPerPixel:9.250826559679918,relativeL1FromEqualScaleOriginal:pixelDelta(current,coarse),smallScaleContrast:contrast(current)});
  }
 }
 const height=labels.length*300,title=Buffer.from(`<svg width="1024" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="white" font-family="Arial" font-size="17">${labels.map(({region,kind,top})=>`<text x="8" y="${top+26}">${region} · ${kind} · Earth | face-on | 45 degrees | edge-on · 1.18 kpc crops, enlarged 2x</text>`).join('')}</g></svg>`);
 await sharp(title).composite(panels).png().toFile(RESOLUTION_DIR+(partial?'partial-crops.png':'equal-scale-crops.png'));await writeFile(RESOLUTION_DIR+(partial?'partial-contrast.json':'contrast.json'),JSON.stringify({complete:!partial,rows},null,2)+'\n');console.log(JSON.stringify({sentinel:'RESOLUTION_CROP_REPORT',partial,rows}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await resolutionReport(process.argv.includes('--partial'));
