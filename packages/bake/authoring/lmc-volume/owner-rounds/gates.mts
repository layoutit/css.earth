/** A soft fitting guard is distinct from the hard retention check. */
import {colorError,type Measurement} from './pins.mts';
export const SOFT_COLOR_REGRESSION=.03,HARD_COLOR_REGRESSION=.035;
export function guardPass(photo:Measurement,previous:Measurement,current:Measurement){return colorError(current,photo)-colorError(previous,photo)<=HARD_COLOR_REGRESSION;}
