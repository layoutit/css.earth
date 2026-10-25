/** Two global dust appearance controls; no spatial dust operation. */
import {need} from '../inputs.mts';import {EXTINCTION_RGB} from '../model.mts';import type {CatalogueScene} from '../catalogue-scene.mts';import type {V3} from '../geometry.mts';
import {measure,type Measurement} from './measure.mts';
export const BOUNDS={strength:[.2,1],reddening:[.5,3]} as const;
export const TOLERANCE={localColorRelative:.03,localContrastAbsolute:.05};
export function coefficients(reddening:number):V3{need(Number.isFinite(reddening)&&reddening>=.5&&reddening<=3,'Reddening grade must lie within 0.5–3');return[1+reddening*(EXTINCTION_RGB[0]-1),1,1+reddening*(EXTINCTION_RGB[2]-1)];}
export function applyDust(scene:CatalogueScene,strength:number,reddening:number){
 need(scene.dustLayer?.clouds&&!scene.dustLayer.cloudExtinctionRgb,'l28 requires the exact l25 dust bank without clump optics');need(Number.isFinite(strength)&&strength>=.2&&strength<=1,'Strength factor must lie within 0.2–1');const rgb=coefficients(reddening);scene.dustLayer.strength=1.2*strength;
 if(reddening===1)delete scene.dustLayer.extinctionRgb;else scene.dustLayer.extinctionRgb=rgb;return{strengthFactor:strength,effectiveStrength:scene.dustLayer.strength,reddeningGrade:reddening,extinctionRgb:rgb};
}
function comparison(a:Measurement,b:Measurement){need(a.calibrated&&b.calibrated&&a.lane&&b.lane&&a.contrast!==undefined&&b.contrast!==undefined,'Excluded pin cannot enter calibration');return{pin:a.id,rgError:a.lane.rg/b.lane.rg-1,bgError:a.lane.bg/b.lane.bg-1,contrastError:a.contrast-b.contrast};}
export function compare(model:ReturnType<typeof measure>,photo:ReturnType<typeof measure>){
 const errors=model.filter(v=>v.calibrated).map(v=>{const target=photo.find(t=>t.id===v.id);need(target,'Missing fixed target');return comparison(v,target);});need(errors.length===2&&errors.some(v=>v.pin==='H5')&&errors.some(v=>v.pin==='F4'),'Exactly the two owner calibration pins are required');
 const score=errors.reduce((sum,e)=>sum+(Math.log1p(e.rgError)/Math.log(1.03))**2+(Math.log1p(e.bgError)/Math.log(1.03))**2+(e.contrastError/.05)**2,0);return{errors,score,passed:errors.every(e=>Math.abs(e.rgError)<=.03&&Math.abs(e.bgError)<=.03&&Math.abs(e.contrastError)<=.05)};
}
