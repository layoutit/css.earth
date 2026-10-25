/** Appearance calibration: only component RGB coefficients and one display curve. */
import {loss,type Basis,type Target} from './render.mts';
import {EXTINCTION_RGB} from './model.mts';
import {need,rec,array,numbers,num} from './inputs.mts';
import {type V3} from './geometry.mts';
export interface Grade {coefficients:V3[];dustStrength:number;dustTint:V3;stretch:number;saturation:number;score:number;}
export function readGrade(value:unknown):Grade {
  const v=rec(value),t=numbers(v.dustTint,3),g:Grade={coefficients:array(v.coefficients).map(v=>{const a=numbers(v,3);return [a[0],a[1],a[2]];}),dustStrength:num(v.dustStrength),dustTint:[t[0],t[1],t[2]],stretch:num(v.stretch),saturation:num(v.saturation),score:num(v.score)};validateGrade(g);return g;
}
export const LUMA:V3=[.2126,.7152,.0722];
export function validateGrade(g:Grade):void {
  need(g.coefficients.length===4&&g.coefficients.every(v=>v.length===3&&v.every(x=>Number.isFinite(x)&&x>=0&&x<=100)),'Invalid component RGB grade');
  need(g.dustStrength>=.01&&g.dustStrength<=2&&g.dustTint.length===3&&g.dustTint.every(v=>v>=.6&&v<=1.5)&&g.dustTint[1]===1,'Dust must remain positive with a V-normalized tint');
  need(g.stretch>=0&&g.stretch<=20&&g.saturation>=.5&&g.saturation<=2.5,'Invalid global display curve');
}
export function tone(r:number,g:number,b:number,stretch:number,saturation:number):V3 {
  const y=r*LUMA[0]+g*LUMA[1]+b*LUMA[2],mapped=stretch<1e-6?y:Math.asinh(stretch*y)/Math.asinh(stretch),scale=y>1e-20?mapped/y:0;
  return [Math.max(0,(y+(r-y)*saturation)*scale),Math.max(0,(y+(g-y)*saturation)*scale),Math.max(0,(y+(b-y)*saturation)*scale)];
}
export function inverseTone(values:Float64Array,stretch:number,saturation:number):Float64Array {
  const out=new Float64Array(values.length);
  for(let i=0;i<out.length;i+=3){const y=values[i]*LUMA[0]+values[i+1]*LUMA[1]+values[i+2]*LUMA[2],original=stretch<1e-6?y:Math.sinh(Math.asinh(stretch)*y)/stretch,scale=y>0?original/y:0;
    for(let c=0;c<3;c++)out[i+c]=Math.max(0,(y+(values[i+c]-y)/saturation)*scale);
  }return out;
}
export function gradedPrediction(basis:Basis,grade:Grade):Float64Array {
  validateGrade(grade);const out=new Float64Array(basis.width*basis.height*3);
  for(let i=0;i<out.length;i+=3){const rgb:V3=[0,0,0];
    for(let c=0;c<3;c++)rgb[c]=(basis.planes[0][i+c]+basis.planes[2][i+c])*grade.coefficients[0][c]+basis.planes[1][i+c]*grade.coefficients[1][c]+basis.planes[3][i+c]*grade.coefficients[2][c]+basis.planes[4][i+c]*grade.coefficients[3][c];
    const t=tone(...rgb,grade.stretch,grade.saturation);for(let c=0;c<3;c++)out[i+c]=t[c];
  }return out;
}
export function sourceTarget(target:Target,factor:number):Target {return {...target,data:Float64Array.from(target.data,v=>v/factor)};}
function srgb(v:number){const x=Math.max(0,Math.min(1,v));return x<.0031308?12.92*x:1.055*x**(1/2.4)-.055;}
export function appearanceLoss(prediction:Float64Array,target:Target,holdout=false):number {
  const mask=holdout?target.holdout:target.train;let sum=0,denom=0;
  for(let p=0;p<mask.length;p++)if(mask[p])for(let c=0;c<3;c++){const i=p*3+c,a=srgb(prediction[i]),b=srgb(target.data[i]);sum+=(a-b)**2;denom+=b*b;}
  return Math.sqrt(sum/Math.max(1e-20,denom));
}
/** Fixed-tone, four-component weighted NNLS; the only learned values are twelve global RGB coefficients. */
function fitColors(basis:Basis,target:Target,grade:Grade,gas:boolean):Grade {
  const transformed=inverseTone(target.data,grade.stretch,grade.saturation),coefficients=grade.coefficients.map(v=>[...v] as V3),components=gas?4:3;
  const value=(component:number,i:number)=>component===0?basis.planes[0][i]+basis.planes[2][i]:basis.planes[[0,1,3,4][component]][i];
  for(let c=0;c<3;c++){
    const gram=Array.from({length:components},()=>new Float64Array(components)),rhs=new Float64Array(components),a=new Float64Array(components);
    for(let p=0;p<target.train.length;p++)if(target.train[p]){const i=p*3+c,y=target.data[p*3]*LUMA[0]+target.data[p*3+1]*LUMA[1]+target.data[p*3+2]*LUMA[2],w=1/(.01+y);
      for(let k=0;k<components;k++)a[k]=value(k,i);
      for(let k=0;k<components;k++){rhs[k]+=w*a[k]*transformed[i];for(let j=0;j<components;j++)gram[k][j]+=w*a[k]*a[j];}
    }
    for(let iteration=0;iteration<80;iteration++)for(let k=0;k<components;k++){let other=0;for(let j=0;j<components;j++)if(k!==j)other+=gram[k][j]*coefficients[j][c];if(gram[k][k]>1e-18)coefficients[k][c]=Math.max(0,Math.min(100,(rhs[k]-other)/gram[k][k]));}
  }
  if(!gas)coefficients[3]=[0,0,0];const result={...grade,coefficients};result.score=appearanceLoss(gradedPrediction(basis,result),target);return result;
}
export function componentSettings(grade:Grade){
  const result:Record<string,unknown>={};for(let k=0;k<4;k++){const v=grade.coefficients[k],gain=(v[0]+v[1]+v[2])/3;result[['oldDiscAndOutskirts','bar','young','gas'][k]]={gain,rgbTint:gain>0?v.map(x=>x/gain):[1,1,1]};}
  result.dust={gain:grade.dustStrength,rgbTint:grade.dustTint,meaning:'Global attenuation-response tint; Bell spatial columns are fixed.'};return result;
}
export interface Family {values:number[];bases:Basis[];}
export function familyBasis(family:Family,strength:number,tint:V3):Basis {
  const template=family.bases[0],out={width:template.width,height:template.height,dustGain:strength,planes:Array.from({length:5},()=>new Float64Array(template.width*template.height*3))};
  for(let c=0;c<3;c++){const t=strength*tint[c]*EXTINCTION_RGB[c];let j=0;while(j+1<family.values.length-1&&family.values[j+1]<t)j++;need(t>=family.values[0]&&t<=family.values.at(-1)!,'Dust grade outside sampled family');const f=(t-family.values[j])/(family.values[j+1]-family.values[j]);
    for(let component=0;component<5;component++)for(let i=c;i<out.planes[component].length;i+=3)out.planes[component][i]=family.bases[j].planes[component][i]*(1-f)+family.bases[j+1].planes[component][i]*f;
  }return out;
}
export function fitGrade(family:Family,target:Target,initial:Grade,dust:boolean,gas:boolean):Grade {
  let best={...initial,coefficients:initial.coefficients.map(v=>[...v] as V3)};
  const evaluate=(g:Grade)=>fitColors(dust?familyBasis(family,g.dustStrength,g.dustTint):family.bases[0],target,g,gas);
  best=evaluate(best);
  for(const stretch of [0,2,6,12])for(const saturation of [1,1.6,2.3]){const trial=evaluate({...best,stretch,saturation});if(trial.score<best.score)best=trial;}
  for(let round=0;round<2;round++){
    const candidates:{key:'strength'|'redDust'|'blueDust'|'stretch'|'saturation';values:number[]}[]=[
      ...(dust?[{key:'strength' as const,values:[.25,.5,.75,1,1.5,2]},{key:'redDust' as const,values:[.6,1,1.5]},{key:'blueDust' as const,values:[.6,1,1.5]}]:[]),
      {key:'stretch',values:round===0?[0,2,6,12,20]:[Math.max(0,best.stretch-2),best.stretch,Math.min(20,best.stretch+2)]},
      {key:'saturation',values:round===0?[.5,1,1.5,2,2.5]:[Math.max(.5,best.saturation-.25),best.saturation,Math.min(2.5,best.saturation+.25)]}
    ];
    for(const {key,values}of candidates)for(const value of values){const g={...best,dustTint:[...best.dustTint] as V3};if(key==='strength')g.dustStrength=value;else if(key==='redDust')g.dustTint[0]=value;else if(key==='blueDust')g.dustTint[2]=value;else g[key]=value;
      const trial=evaluate(g);if(trial.score<best.score)best=trial;
    }
  }
  // NNLS solves the inverse-tone approximation. Finish against the actual shared
  // display curve so channel coupling cannot leave the bright bar underexposed.
  const basis=dust?familyBasis(family,best.dustStrength,best.dustTint):family.bases[0];
  const objective=(g:Grade)=>{
    const p=gradedPrediction(basis,g);let model=0,observed=0;
    for(let i=0;i<target.train.length;i++)if(target.train[i])for(let c=0;c<3;c++){model+=p[i*3+c];observed+=target.data[i*3+c];}
    return appearanceLoss(p,target)**2+.15*loss(p,target)**2+.25*Math.log(Math.max(1e-12,model/observed))**2;
  };
  let score=objective(best);
  for(const step of [.2,.1,.05,.02])for(let repeat=0;repeat<2;repeat++){
    for(let k=0;k<(gas?4:3);k++)for(let c=0;c<3;c++)for(const sign of [-1,1]){
      const co=best.coefficients.map(v=>[...v] as V3);co[k][c]=Math.max(0,Math.min(100,co[k][c]+sign*Math.max(.01,co[k][c]*step)));
      const trial={...best,coefficients:co},s=objective(trial);if(s<score){best=trial;score=s;}
    }
    for(const key of ['stretch','saturation'] as const)for(const sign of [-1,1]){
      const trial={...best,[key]:Math.max(key==='stretch'?0:.5,Math.min(key==='stretch'?20:2.5,best[key]+sign*step*(key==='stretch'?10:1)))};
      const s=objective(trial);if(s<score){best=trial;score=s;}
    }
  }
  best.score=appearanceLoss(gradedPrediction(basis,best),target);validateGrade(best);return best;
}
