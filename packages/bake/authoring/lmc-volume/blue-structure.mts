/** Two population gains, keeping catalogue shapes, age spectra and the photo grade fixed. */
import {catalogueBasis,type CatalogueProjection} from './catalogue-render.mts';
import type {CatalogueScene,Owner} from './catalogue-scene.mts';
import {gradedPrediction,appearanceLoss,tone,type Grade} from './grade.mts';
import {loss,type Basis,type Target} from './render.mts';
import {need} from './inputs.mts';
export const BLUE_SMOOTHING_KPC=.1;
export const youngAssociation=(o:Owner)=>o.kind==='association'&&o.component===3&&(o.logAge===null||o.logAge<8.6);
export function blueBases(p:CatalogueProjection,scene:CatalogueScene,amplitudes:Float64Array){
 const extract=(choose:(o:Owner)=>boolean):Basis=>catalogueBasis({...p,smooth:{...p.smooth,planes:p.smooth.planes.map(v=>new Float64Array(v.length))},objects:p.objects.filter(s=>choose(scene.owners[s.owner]))},scene,amplitudes);
 return{full:catalogueBasis(p,scene,amplitudes),gaia:extract(o=>o.id===scene.youngOwner),associations:extract(youngAssociation)};
}
export function fitBlueStructure(bases:ReturnType<typeof blueBases>,grade:Grade,target:Target){
 const all={...target,train:Uint8Array.from(target.train,(v,i)=>v||target.holdout[i]?1:0)},initial=gradedPrediction(bases.full,grade),gaia=bases.gaia.planes[3],associations=bases.associations.planes[3],linear=new Float64Array(initial.length);
 for(let i=0;i<linear.length;i++){const c=i%3;linear[i]=(bases.full.planes[0][i]+bases.full.planes[2][i])*grade.coefficients[0][c]+bases.full.planes[1][i]*grade.coefficients[1][c]+bases.full.planes[3][i]*grade.coefficients[2][c]+bases.full.planes[4][i]*grade.coefficients[3][c];}
 const predict=(g:readonly number[])=>{const p=new Float64Array(linear.length);for(let i=0;i<p.length;i+=3){const rgb=[0,0,0];for(let c=0;c<3;c++)rgb[c]=linear[i+c]+((g[0]-1)*gaia[i+c]+(g[1]-1)*associations[i+c])*grade.coefficients[2][c];const value=tone(rgb[0],rgb[1],rgb[2],grade.stretch,grade.saturation);for(let c=0;c<3;c++)p[i+c]=value[c];}return p;};
 let observed=0;for(let i=0;i<all.train.length;i++)if(all.train[i])for(let c=0;c<3;c++)observed+=target.data[i*3+c];need(observed>0,'Empty blue calibration target');
 const evaluate=(g:readonly number[])=>{const p=predict(g);let total=0;for(let i=0;i<all.train.length;i++)if(all.train[i])for(let c=0;c<3;c++)total+=p[i*3+c];return{prediction:p,score:appearanceLoss(p,all)**2+.15*loss(p,all)**2+.25*Math.log(Math.max(1e-12,total/observed))**2};};
 const gains=[1,1];let best=evaluate(gains);const before=best.score;
 for(const step of [.25,.1,.04,.01])for(let repeat=0;repeat<2;repeat++)for(let k=0;k<2;k++)for(const sign of [-1,1]){const candidate=[...gains];candidate[k]=Math.max(.5,Math.min(2,candidate[k]*(1+sign*step)));const value=evaluate(candidate);if(value.score<best.score){gains[k]=candidate[k];best=value;}}
 return{gains,prediction:best.prediction,diagnostics:{freeParameters:2,pixelParameters:0,bounds:[.5,2],gaiaGain:gains[0],associationGain:gains[1],before,after:best.score,displayCurveFixed:true,colorsFixed:true,geometryFixed:true}};
}
export function applyBlueGains(scene:CatalogueScene,amplitudes:Float64Array,gains:readonly number[]){need(gains.length===2&&gains.every(v=>Number.isFinite(v)&&v>=.5&&v<=2)&&scene.youngTint,'Invalid blue population gains');scene.youngTint=scene.youngTint.map(v=>v*gains[0]) as [number,number,number];for(let i=0;i<scene.owners.length;i++)if(youngAssociation(scene.owners[i]))amplitudes[i]*=gains[1];}
