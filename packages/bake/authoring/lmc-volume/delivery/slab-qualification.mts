/** Independent report admission: no failed camera may be hidden by an aggregate fit score. */
import {rec,num,array,need} from '../inputs.mts';
import {mergedAlpha,MERGED_OPTICAL_COPIES} from '../../milky-way-dust/galaxy-merged-copies.mts';
export const SLAB_CAMERAS=['earth',...[0,22.5,45,67.5,90].flatMap(tilt=>[0,90,180,270].map(az=>`tilt-${tilt}-azimuth-${az}`))];
export function qualifySlabViews(value:unknown){
 const rows=array(value).map(rec);need(rows.length===SLAB_CAMERAS.length&&SLAB_CAMERAS.every(name=>rows.filter(r=>r.name===name).length===1),'Slab report must include Earth and all 20 outside cameras');
 let passed=true;
 for(const row of rows){const light=num(row.lightDifferencePercent),radial=array(row.annulusDifferencePercent).map(num),color=array(row.channelShareDifferencePercentagePoints).map(v=>array(v).map(num));
  need(radial.length===4&&color.length===3&&color.every(r=>r.length===3),'Slab report has incomplete radial or color regions');
  const cameraPass=light>=-5&&light<=2&&radial.every(v=>Math.abs(v)<=10)&&color.flat().every(v=>Math.abs(v)<=3);
  need(row.passed===cameraPass,'Slab report acceptance flag contradicts its measured residuals');passed=passed&&cameraPass;
 }
 return{passed,cameras:rows.length};
}
/** Analytic bound for the documented three-copy normal-incidence rule; this is not a browser test. */
export function isolatedMergedCeiling():number{return mergedAlpha(255)/255/MERGED_OPTICAL_COPIES;}
export function isolatedMergedChannel(channel:number,gain:number,alphaByte=255):number {need(Number.isFinite(channel)&&channel>=0&&channel<=1&&Number.isFinite(gain)&&gain>=0,'Invalid illustrative channel');return Math.min(1,channel*gain)*mergedAlpha(alphaByte)/255/MERGED_OPTICAL_COPIES;}
