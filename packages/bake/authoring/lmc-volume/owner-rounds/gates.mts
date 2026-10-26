/** A soft fitting guard is distinct from the hard retention check. */
import {rec,array,need} from '../inputs.mts';
import {colorError,type Measurement} from './pins.mts';
export const SOFT_COLOR_REGRESSION=.03,HARD_COLOR_REGRESSION=.035;
export function guardPass(photo:Measurement,previous:Measurement,current:Measurement){return colorError(current,photo)-colorError(previous,photo)<=HARD_COLOR_REGRESSION;}

export function readVisualReview(value:unknown){const r=rec(value);need(typeof r.visualPinsInspected==='boolean'&&typeof r.sideViewsInspected==='boolean'&&typeof r.sideViewsCoherent==='boolean','Invalid visual review flags');const issues=array(r.issues).map(v=>{need(typeof v==='string','Invalid visual review issue');return v;});return{visualPinsInspected:r.visualPinsInspected,sideViewsInspected:r.sideViewsInspected,sideViewsCoherent:r.sideViewsCoherent,issues};}
