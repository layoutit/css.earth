/** Inspect native Earth sampling before spending time on the compression stage. */
import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {versionDir} from '../sequence-state.mts';
import {loadObservation} from '../observation.mts';
import {imageBytes} from '../report.mts';
import {normalized} from '../grade-report.mts';
import {pinsFor,pngRgb,measure} from '../owner-rounds/pins.mts';
import {need} from '../inputs.mts';
import {downsampleLinear,requireNativeAgreement} from './reference.mts';
const dir=versionDir(36)+'delivery/1024/',o=await loadObservation(8),bytes=await readFile(dir+'earth.f64le');
need(bytes.length===1024*768*3*8,'The native Earth ray projection has not finished');
const native=new Float64Array(Uint8Array.from(bytes).buffer),reduced=downsampleLinear(native,1024,768,2),encoded=imageBytes(normalized(reduced,o),o,true);
await sharp(encoded,{raw:{width:512,height:384,channels:3}}).png().toFile(dir+'earth-linear-512.png');
const before=await pngRgb(versionDir(36)+'earth.png'),after=await pngRgb(dir+'earth-linear-512.png'),photo=await pngRgb(versionDir(36)+'horalek.png'),pins=[];
for(const pin of pinsFor(36)){
 const a=measure(before,pin),b=measure(after,pin),target=measure(photo,pin);pins.push({pin,approved:a,native:b,photo:target,rgRelative:b.rg/a.rg-1,bgRelative:b.bg/a.bg-1,luminanceRelative:b.rgb.reduce((s,v,c)=>s+v*[.2126,.7152,.0722][c],0)/a.rgb.reduce((s,v,c)=>s+v*[.2126,.7152,.0722][c],0)-1});
 const panels=await Promise.all([versionDir(36)+'horalek.png',versionDir(36)+'earth.png',dir+'earth-linear-512.png'].map(p=>sharp(p).extract({left:pin.x-15,top:pin.y-15,width:31,height:31}).resize(248,248,{kernel:'nearest'}).png().toBuffer()));
 await sharp({create:{width:744,height:248,channels:3,background:'#101216'}}).composite(panels.map((input,i)=>({input,left:i*248,top:0}))).png().toFile(dir+'check-pin-'+pin.id+'.png');
}
const summary={complete:true,reduction:'2×2 area mean in linear display light, then the frozen l36 sky and sRGB encoding',maximumPinColorRatioChange:Math.max(...pins.flatMap(p=>[Math.abs(p.rgRelative),Math.abs(p.bgRelative)])),maximumPinLuminanceChange:Math.max(...pins.map(p=>Math.abs(p.luminanceRelative))),pins};
await writeFile(dir+'native-pin-check.json',JSON.stringify(summary,null,2)+'\n');requireNativeAgreement(summary.maximumPinColorRatioChange,summary.maximumPinLuminanceChange);console.log(JSON.stringify({sentinel:'NATIVE_EARTH_CHECK',maximumPinColorRatioChange:summary.maximumPinColorRatioChange,maximumPinLuminanceChange:summary.maximumPinLuminanceChange,pins:pins.map(p=>({id:p.pin.id,rg:p.rgRelative,bg:p.bgRelative,light:p.luminanceRelative}))}));
