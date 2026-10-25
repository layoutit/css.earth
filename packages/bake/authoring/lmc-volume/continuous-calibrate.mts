/** Global population grading, existing disc/bar gains, and an outer-annulus gain. */
import {catalogueBasis,type CatalogueProjection} from './catalogue-render.mts';
import {appearanceLoss,gradedPrediction,inverseTone,LUMA,tone,type Grade} from './grade.mts';
import {loss,type Target} from './render.mts';
import {rayPlane,type V3} from './geometry.mts';
import {need} from './inputs.mts';
import {CONTINUOUS_SETTINGS} from './continuous-model.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
import type {Observation} from './report.mts';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function fitOuterGain(flux:(gain:number)=>number,target:number,bounds:readonly[number,number]=CONTINUOUS_SETTINGS.outskirtsGainBounds){
 let [lo,hi]=bounds;need(target>0&&lo>0&&hi>lo,'Invalid outskirts calibration');const low=flux(lo),high=flux(hi);need(high>low&&Number.isFinite(low)&&Number.isFinite(high),'Outskirts gain has no positive rendered support');
 if(target<=low||target>=high){const gain=target<=low?lo:hi;return{gain,atBound:true,errorPercent:100*(flux(gain)/target-1)};}
 for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(flux(mid)<target)lo=mid;else hi=mid;}const gain=(lo+hi)/2;return{gain,atBound:false,errorPercent:100*(flux(gain)/target-1)};
}
export function calibrateContinuous(p:CatalogueProjection,scene:CatalogueScene,target:Target,initial:Grade,amplitudes:Float64Array,o:Observation):{grade:Grade;amplitudes:Float64Array;prediction:Float64Array;diagnostics:Record<string,unknown>}{
 const grade=structuredClone(initial),population=scene.owners.findIndex(v=>v.id===scene.youngOwner);need(population>=0,'Missing diffuse template');
 const identity={...scene,youngTint:[1,1,1] as V3,outskirtsGain:1,innerDiscGain:1,barGain:1},basis=catalogueBasis(p,identity,amplitudes),gaia=new Float64Array(target.data.length),core=new Float64Array(gaia.length),outer=new Float64Array(gaia.length),old=new Float64Array(gaia.length),bar=new Float64Array(gaia.length),aperture=new Uint8Array(target.train.length),outside:number[]=[];
 const sparse=p.objects[population];for(let j=0;j<sparse.indices.length;j++)for(let c=0;c<3;c++)gaia[sparse.indices[j]*3+c]=sparse.rgb[j*3+c]*amplitudes[population]*grade.coefficients[2][c];
 let outerTarget=0;for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++){const pixel=y*o.width+x,point=rayPlane(o.rayAt(x+.5,y+.5)),r=Math.hypot(point[0],point[1]);if(!(target.train[pixel]||target.holdout[pixel]))continue;if(r<4)aperture[pixel]=1;if(r>=4){outside.push(pixel);for(let c=0;c<3;c++)outerTarget+=target.data[pixel*3+c];}}
 need(outside.length>0&&aperture.some(v=>v===1),'Empty population or outskirts calibration aperture');
 for(let i=0;i<core.length;i++){const c=i%3;outer[i]=basis.planes[2][i]*grade.coefficients[0][c];old[i]=p.smooth.planes[0][i]*grade.coefficients[0][c];bar[i]=p.smooth.planes[1][i]*grade.coefficients[1][c];core[i]=(basis.planes[0][i]-p.smooth.planes[0][i])*grade.coefficients[0][c]+basis.planes[3][i]*grade.coefficients[2][c]-gaia[i]+basis.planes[4][i]*grade.coefficients[3][c];}
 const transformed=inverseTone(target.data,grade.stretch,grade.saturation),comparison={...target,train:aperture},f=[1,1,1,1,1],bounds=CONTINUOUS_SETTINGS.youngRgbFactorBounds;
 const emission=(i:number,c:number,f:number[],h:number)=>core[i]+gaia[i]*f[c]+outer[i]*h+old[i]*f[3]+bar[i]*f[4];
 const predict=(f:number[],h:number)=>{const out=new Float64Array(core.length);for(let i=0;i<out.length;i+=3){const rgb=tone(emission(i,0,f,h),emission(i+1,1,f,h),emission(i+2,2,f,h),grade.stretch,grade.saturation);out[i]=rgb[0];out[i+1]=rgb[1];out[i+2]=rgb[2];}return out;};
 const outerFlux=(f:number[],h:number)=>{let sum=0;for(const pixel of outside){const i=pixel*3,rgb=tone(emission(i,0,f,h),emission(i+1,1,f,h),emission(i+2,2,f,h),grade.stretch,grade.saturation);sum+=rgb[0]+rgb[1]+rgb[2];}return sum;};
 const score=(f:number[],h:number)=>{const rgb=predict(f,h);return appearanceLoss(rgb,comparison)**2+.15*loss(rgb,comparison)**2;};
 let outskirts=fitOuterGain(h=>outerFlux(f,h),outerTarget);
 for(let round=0;round<3;round++){
  const gram=Array.from({length:5},()=>new Float64Array(5)),rhs=new Float64Array(5);
  for(let pixel=0;pixel<aperture.length;pixel++)if(aperture[pixel]){const y=target.data[pixel*3]*LUMA[0]+target.data[pixel*3+1]*LUMA[1]+target.data[pixel*3+2]*LUMA[2],w=1/(.01+y);for(let c=0;c<3;c++){const i=pixel*3+c,a=[c===0?gaia[i]:0,c===1?gaia[i]:0,c===2?gaia[i]:0,old[i],bar[i]],value=transformed[i]-core[i]-outer[i]*outskirts.gain;for(let k=0;k<5;k++){rhs[k]+=w*a[k]*value;for(let j=0;j<5;j++)gram[k][j]+=w*a[k]*a[j];}}}
  for(let iteration=0;iteration<60;iteration++)for(let k=0;k<5;k++){let other=0;for(let j=0;j<5;j++)if(k!==j)other+=gram[k][j]*f[j];if(gram[k][k]>0)f[k]=clamp((rhs[k]-other)/gram[k][k],(k<3?bounds:CONTINUOUS_SETTINGS.discBarGainBounds)[0],(k<3?bounds:CONTINUOUS_SETTINGS.discBarGainBounds)[1]);}
  let best=score(f,outskirts.gain);for(const step of [.25,.1,.04,.01])for(let repeat=0;repeat<2;repeat++)for(let c=0;c<5;c++)for(const sign of [-1,1]){const candidate=[...f];candidate[c]=clamp(candidate[c]*(1+sign*step),(c<3?bounds:CONTINUOUS_SETTINGS.discBarGainBounds)[0],(c<3?bounds:CONTINUOUS_SETTINGS.discBarGainBounds)[1]);const s=score(candidate,outskirts.gain);if(s<best){best=s;f[c]=candidate[c];}}
  outskirts=fitOuterGain(h=>outerFlux(f,h),outerTarget);
 }
 scene.youngTint=[f[0],f[1],f[2]];scene.outskirtsGain=outskirts.gain;scene.innerDiscGain=f[3];scene.barGain=f[4];const prediction=gradedPrediction(catalogueBasis(p,scene,amplitudes),grade),check=predict(f,outskirts.gain);let discrepancy=0;for(let i=0;i<check.length;i++)discrepancy=Math.max(discrepancy,Math.abs(check[i]-prediction[i]));need(discrepancy<1e-10,'Global fit does not reach the canonical renderer');
 const gain=(f[0]+f[1]+f[2])/3;return{grade,amplitudes,prediction,diagnostics:{newGlobalParameters:4,existingGlobalGainsRefitted:2,pixelParameters:0,geometryParametersFitted:0,youngRgbFactors:f.slice(0,3),youngGainFactor:gain,youngNormalizedTint:f.slice(0,3).map(v=>v/gain),innerDiscGain:f[3],barGain:f[4],youngRgbFactorBounds:bounds,discBarGainBounds:CONTINUOUS_SETTINGS.discBarGainBounds,outskirts,apertures:'Global population and disc/bar gains from the inner 4 kpc. One outskirts gain from the >=4 kpc annulus. Both use all valid checkerboards.',fixed:'All l13 catalogue-object luminosities, component color tints, tone curve, dust settings and geometry.',canonicalRendererMaximumDifference:discrepancy}};
}
