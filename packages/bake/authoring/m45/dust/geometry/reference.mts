import {requireRecord} from '@cssearth/core';
import {parseDensityVolumeFrame} from '@cssearth/objects';
import {json,vector} from '../field/grid.mts';
import type {Axes} from './patches.mts';
/** Fixed preparation camera; the runtime camera never moves this reference. */
export async function referenceCamera(){
 const parameters=await json('src/objects/milky-way-pleiades-dust/source/parameters.json'),r=requireRecord(parameters.reference),a=requireRecord(r.axes);
 const axes:Axes={right:vector(a.right),down:vector(a.down),back:vector(a.back)};
 return {frame:parseDensityVolumeFrame(r.frame),eye:vector(r.eye),axes};
}
