/** Fixed angular-scale texture diagnostic; it never changes a model or selects pixels by color. */
import {dot,DEG} from './geometry.mts';
import {blur} from './young-density.mts';
import {displayRgb,photoRgb,barAperture} from './bar-ratios.mts';
import type {Observation} from './report.mts';
import type {ObservationWindow} from './observation.mts';
import type {BarGeometry} from './bar-geometry.mts';
import type {CatalogueRow} from './catalogue-data.mts';
import {LUMA} from './grade.mts';
import {need} from './inputs.mts';
export function barWindow(o:Observation,b:BarGeometry,rows:CatalogueRow[]):ObservationWindow{const a=barAperture(o,b,rows);let x0=o.width,y0=o.height,x1=0,y1=0;for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++)if(a.bar[y*o.width+x]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}const pad=10;return{x0:Math.max(0,x0-pad)/o.width,y0:Math.max(0,y0-pad)/o.height,width:(Math.min(o.width,x1+pad+1)-Math.max(0,x0-pad))/o.width,height:(Math.min(o.height,y1+pad+1)-Math.max(0,y0-pad))/o.height};}
export function angularPixel(o:Observation){const cx=o.width/2,cy=o.height/2,angle=(a:number[],b:number[])=>Math.acos(Math.max(-1,Math.min(1,dot(a,b))))/DEG*60;return{x:angle(o.rayAt(cx,cy),o.rayAt(cx+1,cy)),y:angle(o.rayAt(cx,cy),o.rayAt(cx,cy+1))};}
export function contrast(rgb:Float64Array,o:Observation,mask:Uint8Array){
 const pixel=angularPixel(o),scale=Math.sqrt(pixel.x*pixel.y);need(scale<1,'Crop does not resolve the two-arcminute texture band');const n=o.width*o.height,log=new Float64Array(n),weights=Float64Array.from(mask),signal=new Float64Array(n);let mean=0,count=0;
 for(let p=0;p<n;p++){const y=rgb[p*3]*LUMA[0]+rgb[p*3+1]*LUMA[1]+rgb[p*3+2]*LUMA[2];log[p]=Math.log(Math.max(.01,y));signal[p]=log[p]*mask[p];if(mask[p]){mean+=y;count++;}}need(count>100,'Insufficient clean contrast samples');
 const smooth=(fwhm:number)=>{const sx=fwhm/2.354820045/pixel.x,sy=fwhm/2.354820045/pixel.y,numerator=blur(signal,o.width,o.height,sx,sy),denominator=blur(weights,o.width,o.height,sx,sy);return{values:Float64Array.from(numerator,(v,i)=>denominator[i]>.3?v/denominator[i]:0),weights:denominator};},fine=smooth(2),broad=smooth(5),band=new Float64Array(n);let power=0,dark=0,used=0;
 for(let i=0;i<n;i++)if(mask[i]&&fine.weights[i]>.5&&broad.weights[i]>.5){const v=fine.values[i]-broad.values[i];band[i]=v;power+=v*v;dark+=Math.min(0,v)**2;used++;}need(used>100,'Masked texture support vanished');return{power:power/used,darkPower:dark/used,rmsLogContrast:Math.sqrt(power/used),samples:used,meanLuminance:mean/count,pixelArcmin:pixel,band};
}
export function compareTexture(o:Observation,b:BarGeometry,rows:CatalogueRow[],old:Float64Array,current:Float64Array){const aperture=barAperture(o,b,rows),photo=contrast(photoRgb(o),o,aperture.mask),before=contrast(displayRgb(old,o.metadata.sky.rgbLinearDisplay),o,aperture.mask),after=contrast(displayRgb(current,o.metadata.sky.rgbLinearDisplay),o,aperture.mask),strip=(v:ReturnType<typeof contrast>)=>({power:v.power,darkPower:v.darkPower,rmsLogContrast:v.rmsLogContrast,samples:v.samples,meanLuminance:v.meanLuminance,pixelArcmin:v.pixelArcmin});return{photo:strip(photo),l18:strip(before),l19:strip(after),powerErrorBefore:Math.abs(before.power-photo.power),powerErrorAfter:Math.abs(after.power-photo.power),powerCloser:Math.abs(after.power-photo.power)<Math.abs(before.power-photo.power),definition:'Variance of log-luminance after a difference of Gaussian filters with FWHM 2 and 5 arcmin, within the same fixed catalogue-masked bar aperture. Mask-normalized convolution avoids treating excluded gas and clusters as dark features. Each axis uses its own angular pixel scale. This is a morphological contrast statistic, not an independent dust extinction measurement.'};}
