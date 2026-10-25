/** Six global grading controls; measured Gaia counts and every 3D primitive stay fixed. */
import {gradedPrediction,appearanceLoss,type Grade} from './grade.mts';
import {loss,type Basis,type Target} from './render.mts';
import {need} from './inputs.mts';
export function balanceGaiaGrade(basis:Basis,initial:Grade,target:Target,annulus:Uint8Array){
 need(annulus.length===target.train.length&&annulus.every(a=>a<4),'Mismatched radial calibration groups');
 const all:Target={...target,train:Uint8Array.from(target.train,(v,i)=>v||target.holdout[i]?1:0)},observed=new Float64Array(4);let observedTotal=0;
 for(let i=0;i<annulus.length;i++)if(all.train[i])for(let c=0;c<3;c++){observed[annulus[i]]+=target.data[i*3+c];observedTotal+=target.data[i*3+c];}
 const evaluate=(g:Grade)=>{
  const prediction=gradedPrediction(basis,g),sums=new Float64Array(4);let total=0;
  for(let i=0;i<annulus.length;i++)if(all.train[i])for(let c=0;c<3;c++){sums[annulus[i]]+=prediction[i*3+c];total+=prediction[i*3+c];}
  let radial=0,n=0;for(let a=0;a<4;a++)if(observed[a]>0){radial+=Math.log(Math.max(1e-12,sums[a]/observed[a]))**2;n++;}
  return{prediction,score:appearanceLoss(prediction,all)**2+.15*loss(prediction,all)**2+.25*Math.log(Math.max(1e-12,total/observedTotal))**2+radial/Math.max(1,n)};
 };
 let grade=structuredClone(initial),best=evaluate(grade);const before=best.score;
 for(const step of [.25,.1,.04,.01])for(let repeat=0;repeat<2;repeat++)for(let parameter=0;parameter<6;parameter++)for(const sign of [-1,1]){
  const candidate=structuredClone(grade);
  if(parameter<4){const rgb=candidate.coefficients[parameter],factor=Math.min(1+sign*step,100/Math.max(...rgb,1e-30));candidate.coefficients[parameter]=[rgb[0]*factor,rgb[1]*factor,rgb[2]*factor];}
  else if(parameter===4)candidate.stretch=Math.max(0,Math.min(20,candidate.stretch+sign*step*10));
  else candidate.saturation=Math.max(.5,Math.min(2.5,candidate.saturation+sign*step));
  const value=evaluate(candidate);if(value.score<best.score){grade=candidate;best=value;}
 }
 grade.score=appearanceLoss(best.prediction,all);
 return{grade,prediction:best.prediction,diagnostics:{parameters:'Four component gains, shared stretch and saturation. Existing component RGB tints stay fixed.',freeParameters:6,regionalParameters:0,pixelParameters:0,objective:'Existing appearance, linear RMS and total-light terms, plus equal-weight logarithmic light residuals in four fixed annuli.',before,after:best.score}};
}
