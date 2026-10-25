/** Brightness per catalogue object, four global RGB grades, and one display curve. */
import {fitGrade,inverseTone,LUMA,gradedPrediction,appearanceLoss,type Grade} from './grade.mts';
import {catalogueBasis,type CatalogueProjection} from './catalogue-render.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
import type {Target} from './render.mts';
import {need} from './inputs.mts';
function gradeSlot(component:number):number{return component===0||component===2?0:component===1?1:component===3?2:3;}
export function calibrateObjects(p:CatalogueProjection,scene:CatalogueScene,comparisonTarget:Target,initial:Grade,warm?:Float64Array):{grade:Grade;amplitudes:Float64Array;prediction:Float64Array;diagnostics:Record<string,unknown>} {
 // Luminosity calibration uses every valid pixel in an object's footprint. Splitting
 // subpixel clusters across a checkerboard destabilizes their aperture photometry.
 // Both checkerboards are therefore calibration residuals, not independent validation.
 const target:Target={...comparisonTarget,train:Uint8Array.from(comparisonTarget.train,(v,i)=>v||comparisonTarget.holdout[i]?1:0)};
 const amplitudes=warm?.slice()??Float64Array.from(scene.owners,o=>o.prior);need(amplitudes.length===scene.owners.length,'Mismatched object calibration');let grade=structuredClone(initial);const initialAppearanceRms=appearanceLoss(gradedPrediction(catalogueBasis(p,scene,amplitudes),grade),target);
 for(let pass=0;pass<3;pass++){
  let basis=catalogueBasis(p,scene,amplitudes);grade=fitGrade({values:[1],bases:[basis]},target,grade,false,true);const transformed=inverseTone(target.data,grade.stretch,grade.saturation),prediction=new Float64Array(transformed.length);
  for(let component=0;component<5;component++)for(let i=0;i<prediction.length;i++)prediction[i]+=basis.planes[component][i]*grade.coefficients[gradeSlot(component)][i%3];
  for(let iteration=0;iteration<16;iteration++)for(const s of p.objects){
   const o=scene.owners[s.owner],rgb=grade.coefficients[gradeSlot(o.component)],old=amplitudes[s.owner];let numerator=0,denominator=0;
   for(let j=0;j<s.indices.length;j++){const pixel=s.indices[j];if(!target.train[pixel])continue;const y=target.data[pixel*3]*LUMA[0]+target.data[pixel*3+1]*LUMA[1]+target.data[pixel*3+2]*LUMA[2],w=1/(.01+y);
    for(let c=0;c<3;c++){const i=pixel*3+c,a=s.rgb[j*3+c]*rgb[c];numerator+=w*a*(transformed[i]-prediction[i]+old*a);denominator+=w*a*a;}
   }
   if(denominator<1e-20)continue;const regularization=denominator*.03,value=Math.max(0,Math.min(o.maximum,(numerator+regularization*o.prior)/(denominator+regularization))),delta=value-old;amplitudes[s.owner]=value;
   if(delta)for(let j=0;j<s.indices.length;j++)for(let c=0;c<3;c++)prediction[s.indices[j]*3+c]+=delta*s.rgb[j*3+c]*rgb[c];
  }
 }
 const basis=catalogueBasis(p,scene,amplitudes);grade=fitGrade({values:[1],bases:[basis]},target,grade,false,true);const prediction=gradedPrediction(basis,grade);
 const active=scene.owners.filter((_,i)=>amplitudes[i]>1e-12).length;return{grade,amplitudes,prediction,diagnostics:{catalogueObjectParameters:scene.owners.filter(o=>o.kind!=='population').length,populationGainParameters:scene.owners.filter(o=>o.kind==='population').length,activeObjects:active,geometryParametersFitted:0,pixelParameters:0,componentRgbGrades:4,regularization:'3% diagonal ridge towards catalogue light priors, nonnegative amplitudes bounded at 25 times prior',initialAppearanceRms,appearanceRms:appearanceLoss(prediction,target),calibrationPixels:'All valid pixels in each catalogue-object footprint. Both checkerboards are calibration residuals.',scope:'Only catalogue-object luminosities, global population gains, component RGB grades and one tone curve. Geometry stays fixed during calibration.'}};
}
