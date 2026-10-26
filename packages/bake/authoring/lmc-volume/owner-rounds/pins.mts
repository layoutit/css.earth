/** Owner coordinates are measurements, never a source of spatial model structure. */
import sharp from 'sharp';
import {need,rec,num,numbers} from '../inputs.mts';
export interface Pin {id:string;x:number;y:number;theme:number;}
export const PINS:readonly Pin[]=[{id:'F3',x:235,y:136,theme:30},{id:'G4',x:280,y:159,theme:30},{id:'H2',x:319,y:73,theme:29},{id:'I2',x:367,y:88,theme:29},{id:'I3',x:373,y:118,theme:29},{id:'D2',x:156,y:82,theme:29},{id:'D5',x:152,y:212,theme:29},{id:'E6',x:200,y:254,theme:29},{id:'D6',x:152,y:274,theme:29},{id:'G3',x:282,y:130,theme:31},{id:'H3',x:327,y:135,theme:31},{id:'I4',x:374,y:173,theme:31},{id:'H5',x:331,y:229,theme:28},{id:'G5',x:280,y:214,theme:28},{id:'F4',x:226,y:184,theme:28}];
export const RED_PINS:readonly Pin[]=[{id:'D2',x:143,y:61,theme:34},{id:'G6',x:290,y:277,theme:34},{id:'G3',x:286,y:120,theme:34}];
export function pinsFor(version:number):readonly Pin[]{return version===32||version===33?PINS.map(p=>p.theme===29?{...p,theme:version}:p):version===34?[...PINS,...RED_PINS]:PINS;}
export function saturationOf(m:Pick<Measurement,'rgb'>){const hi=Math.max(...m.rgb),lo=Math.min(...m.rgb);return hi>0?(hi-lo)/hi:0;}
export function pinScore(a:Measurement,b:Measurement,version:number){return version===32?colorError(a,b)**2+.2*(saturationOf(a)-saturationOf(b))**2:version===33?Math.log(Math.max(.001,a.texture)/Math.max(.001,b.texture))**2:score(a,b,version===29);}
export async function pngRgb(path:string){const {data,info}=await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});need(info.width===512&&info.height===384&&info.channels===3,'Owner evidence requires the native Earth grid');return Float64Array.from(data,v=>v/255);}
export function maskPins(pins:readonly Pin[]=PINS){const mask=new Uint8Array(512*384);for(const p of pins)for(let y=p.y-16;y<=p.y+16;y++)for(let x=p.x-16;x<=p.x+16;x++)mask[y*512+x]=1;return mask;}
export function measure(rgb:ArrayLike<number>,p:Pin){need(rgb.length===512*384*3,'Wrong pin grid');const mean=[0,0,0];let n=0,power=0,light=0;
 for(let y=p.y-4;y<=p.y+4;y++)for(let x=p.x-4;x<=p.x+4;x++){for(let c=0;c<3;c++)mean[c]+=rgb[(y*512+x)*3+c];n++;}for(let c=0;c<3;c++)mean[c]/=n;
 const luminance=(x:number,y:number)=>{const i=(y*512+x)*3;return .2126*rgb[i]+.7152*rgb[i+1]+.0722*rgb[i+2];};
 for(let y=p.y-14;y<=p.y+14;y++)for(let x=p.x-14;x<=p.x+14;x++){const v=luminance(x,y);let smooth=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)smooth+=luminance(x+dx,y+dy)/9;power+=(v-smooth)**2;light+=v;}
 return{id:p.id,rgb:mean,rg:mean[0]/mean[1],bg:mean[2]/mean[1],light:mean.reduce((a,b)=>a+b,0)/3,texture:Math.sqrt(power/841)/(light/841)};
}
export type Measurement=ReturnType<typeof measure>;
export function readMeasurement(v:unknown):Measurement{const r=rec(v);need(typeof r.id==='string','Missing pin identifier');const value={id:r.id,rgb:numbers(r.rgb,3),rg:num(r.rg),bg:num(r.bg),light:num(r.light),texture:num(r.texture)};need(value.rg>0&&value.bg>0&&value.light>0&&value.texture>=0,'Invalid pin statistic');return value;}
export function colorError(a:Measurement,b:Measurement){return Math.hypot(Math.log(a.rg/b.rg),Math.log(a.bg/b.bg));}
export function score(a:Measurement,b:Measurement,texture=false){return colorError(a,b)**2+.25*Math.log(a.light/b.light)**2+(texture?.025*Math.log(Math.max(a.texture,.001)/Math.max(b.texture,.001))**2:0);}
export async function crops(version:number,parent:number,dir:string,previous:string,photo:string){const pins=pinsFor(version).filter(p=>p.theme===version);for(const p of pins){const paths=[photo,previous,dir+'earth.png'],labels=['Horálek','l'+parent,'l'+version],panels=await Promise.all(paths.map(path=>sharp(path).extract({left:p.x-15,top:p.y-15,width:31,height:31}).resize(310,310,{kernel:'nearest'}).png().toBuffer()));const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="930" height="395"><rect width="100%" height="100%" fill="#101216"/><g fill="white" font-family="Arial"><text x="12" y="26" font-size="22">'+p.id+' ('+p.x+', '+p.y+') · 31 × 31 native pixels, enlarged 10×</text>'+labels.map((s,i)=>'<text x="'+(12+i*310)+'" y="57" font-size="20">'+s+'</text>').join('')+'</g></svg>');await sharp(svg).composite(panels.map((input,i)=>({input,left:i*310,top:75}))).png().toFile(dir+'pin-'+p.id+'.png');}
 await sharp({create:{width:930,height:395*pins.length,channels:3,background:'#101216'}}).composite(await Promise.all(pins.map(async(p,i)=>({input:await sharp(dir+'pin-'+p.id+'.png').png().toBuffer(),left:0,top:i*395})))).png().toFile(dir+'pins-all.png');
}
