/** Owner-pinned local image measurements on the unchanged 512 by 384 Earth grid. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,need} from '../inputs.mts';
import {decode} from '../dust-lanes/measure.mts';
export const L28=LOCAL+'versions/l28/';
export const PINS=[{id:'H5',x:331,y:229,calibrate:true},{id:'G5',x:280,y:214,calibrate:false},{id:'F4',x:226,y:184,calibrate:true}] as const;
export const CORE={x:280,y:214,rx:32,ry:24};
export const WINDOW={half:7,laneHalf:2,barInner:5};
export type Pin=typeof PINS[number];
export function excludedCore(x:number,y:number){return((x-CORE.x)/CORE.rx)**2+((y-CORE.y)/CORE.ry)**2<=1;}
export function zone(pin:Pin,x:number,y:number){const r=Math.max(Math.abs(x-pin.x),Math.abs(y-pin.y));return r<=WINDOW.laneHalf?'lane':r>=WINDOW.barInner&&r<=WINDOW.half?'bar':null;}
export function calibrationMask(){const mask=new Uint8Array(512*384);for(const pin of PINS)if(pin.calibrate)for(let y=pin.y-7;y<=pin.y+7;y++)for(let x=pin.x-7;x<=pin.x+7;x++)if(zone(pin,x,y)&&!excludedCore(x,y))mask[y*512+x]=1;return mask;}
export async function annotations(){const text=await readFile(LOCAL+'annotations/2026-10-25-owner-dust.md','utf8');need(text.includes('512×384'),'Owner grid changed');for(const p of PINS)need(text.includes(p.id+' (x '+p.x+', y '+p.y+')'),'Owner pin moved: '+p.id);return text;}
export async function pngRgb(path:string){const {data,info}=await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});need(info.width===512&&info.height===384&&info.channels===3,'Pin measurements require the original 512 by 384 grid');return Float64Array.from(data,v=>v/255);}
export function quantized(rgb:Float64Array){return Float64Array.from(rgb,v=>Math.round(255*Math.min(1,Math.max(0,v)))/255);}
function median(a:number[]){need(a.length>0&&a.every(Number.isFinite),'Empty or invalid local sample');a.sort((a,b)=>a-b);const middle=Math.floor(a.length/2);return a.length%2?a[middle]:(a[middle-1]+a[middle])/2;}
function region(rgb:Float64Array,pin:Pin,kind:'lane'|'bar'){
 const channels:[number[],number[],number[]]=[[],[],[]],luma:number[]=[];for(let y=pin.y-7;y<=pin.y+7;y++)for(let x=pin.x-7;x<=pin.x+7;x++)if(zone(pin,x,y)===kind&&(!pin.calibrate||!excludedCore(x,y))){const i=(y*512+x)*3;for(let c=0;c<3;c++)channels[c].push(rgb[i+c]);luma.push(.2126*decode(rgb[i])+.7152*decode(rgb[i+1])+.0722*decode(rgb[i+2]));}
 const values=channels.map(median);return{rgb:values,luma:median(luma),rg:values[0]/values[1],bg:values[2]/values[1],rb:values[0]/values[2],pixels:luma.length};
}
export function measurePin(rgb:Float64Array,pin:Pin){need(rgb.length===512*384*3,'Wrong Earth grid');const lane=region(rgb,pin,'lane'),bar=region(rgb,pin,'bar');return{id:pin.id,calibrated:pin.calibrate,lane,bar,contrast:1-lane.luma/bar.luma,colorContrast:lane.rb/bar.rb};}
export function measure(rgb:Float64Array){return PINS.map(p=>measurePin(rgb,p));}
export type Measurement=ReturnType<typeof measurePin>;
export async function baseline(){await annotations();await mkdir(L28,{recursive:true});const photo=await pngRgb(LOCAL+'versions/l25/horalek.png'),l25=await pngRgb(LOCAL+'versions/l25/earth.png');const result={grid:[512,384],window:WINDOW,excludedCore:CORE,pins:PINS,definition:'Channel medians in the central 5 by 5 pixels measure local displayed color. Median decoded linear luminance in that sample, divided by the median of the square annulus at Chebyshev radii 5 through 7 pixels, measures local lane contrast. Only H5 and F4 enter calibration. G5 and the complete core ellipse are excluded.',photo:measure(photo),l25:measure(l25)};await writeFile(L28+'baseline.json',JSON.stringify(result,null,2)+'\n');
 for(const name of ['photo','l25'])for(const pin of PINS)await sharp(name==='photo'?LOCAL+'versions/l25/horalek.png':LOCAL+'versions/l25/earth.png').extract({left:pin.x-15,top:pin.y-15,width:31,height:31}).resize(310,310,{kernel:'nearest'}).png().toFile(L28+pin.id+'-'+name+'.png');
 console.log(JSON.stringify({sentinel:'L28_PINS_MEASURED',...result}));
}
if(process.argv[1]?.endsWith('/dust-pins/measure.mts'))await baseline();
