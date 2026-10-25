/** l27 changes one scalar in l25's existing Gordon optical-depth calculation. */
import {need,LOCAL} from '../inputs.mts';
import {measure,laneContext} from '../dust-lanes/measure.mts';
import {laneField,agreement} from '../dust-geometry/diagnostics.mts';
import type {CatalogueScene} from '../catalogue-scene.mts';
export const L27=LOCAL+'versions/l27/';
export const BOUNDS:readonly[number,number]=[.01,1];
export const TOLERANCE={dimmingAbsolute:.01,colorContrastRelative:.10,barColorRelative:.02};
export function scaleDust(scene:CatalogueScene,baseStrength:number,factor:number){
 need(scene.dustLayer&&Number.isFinite(baseStrength)&&baseStrength>0,'Missing accepted dust strength');
 need(Number.isFinite(factor)&&factor>=BOUNDS[0]&&factor<=BOUNDS[1],'l27 multiplier must lie within 0.01–1');
 need(!scene.dustLayer.cloudExtinctionRgb,'l27 must start from l25, without clump attenuation');
 scene.dustLayer.strength=baseStrength*factor;
 return scene.dustLayer.strength;
}
export function colorContrast(v:{rg:number;bg:number}){need(v.rg>0&&v.bg>0,'Invalid lane color');return v.rg/v.bg;}
export function calibrationSupport(valid:Float64Array,bar:Uint8Array){need(valid.length===bar.length,'Mask dimensions differ');return Uint8Array.from(valid,(v,i)=>Number(v>0||bar[i]));}
export function checks(model:{depth:number;rg:number;bg:number;bar:{rg:number;bg:number}},photo:typeof model,overlap:number,parentOverlap:number){return{
 dimming:Math.abs(model.depth-photo.depth)<=TOLERANCE.dimmingAbsolute,
 colorContrast:Math.abs(colorContrast(model)/colorContrast(photo)-1)<=TOLERANCE.colorContrastRelative,
 overlap:overlap>=parentOverlap,
 barColor:Math.abs(model.bar.rg/photo.bar.rg-1)<=.02&&Math.abs(model.bar.bg/photo.bar.bg-1)<=.02,
 };}
export function evaluate(rgb:Float64Array,c:Awaited<ReturnType<typeof laneContext>>,photoRgb:Float64Array){
 const measurement=measure(rgb,c),photo=measure(photoRgb,c),reference=laneField(photoRgb,c.o,c.bar),field=laneField(rgb,c.o,c.bar);
 return{measurement,photo,colorContrast:colorContrast(measurement),photoColorContrast:colorContrast(photo),location:agreement(reference,field)};
}
