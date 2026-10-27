/** Admit every numerical camera independently; a mean score cannot hide a missing or unresolved view. */
import {rec,array,num,need} from '../inputs.mts';
export function qualifyResolution(input:unknown){
 const r=rec(input),rows=array(r.convergence).map(rec),names=['earth','face','tilt45','edge'];
 const provenance=rec(r.provenance);need(provenance.complete===true&&provenance.tiles===300&&provenance.physicalConfigurationAndGradeMatchApproved===true&&provenance.joinedPngsMatchWholeFloatEncoding===true&&num(provenance.optimizedAndUnoptimizedReplayMaximumAbsoluteDifference)<1e-10&&r.freshFieldsByteIdentical===true,'Native resolution requires complete tile provenance and a fresh field-cache replay');
 need(rows.length===8&&['bar','gas'].every(region=>names.every(name=>rows.filter(v=>v.region===region&&v.camera===name).length===1)),'Resolution evidence must include both native-pitch regions in all four views');
 for(const row of rows)need(num(row.mediumToFineRelativeL1)>=0&&num(row.mediumToFineRelativeL1)<=.01,'A view failed the one-percent numerical convergence limit');
 for(const name of['smallPins','nativePins']){const pins=rec(r[name]);need(num(pins.maxColorRatioChange)<=.02&&num(pins.maxBrightnessChange)<=.02&&num(pins.maxColorRatioChange)>=0&&num(pins.maxBrightnessChange)>=0,'Refining sampling changed the approved Earth calibration');}
 const views=array(r.nativeViews).map(rec);need(views.length===4&&names.every(name=>views.filter(v=>v.camera===name).length===1),'Native equal-scale views are incomplete');
 for(const view of views){const fields=rec(view.fields);need(view.complete===true&&view.size===1024&&view.width===1024&&view.height===(view.camera==='earth'?768:1024)&&view.parametersFitted===0&&fields.n===2048&&fields.oldSigmaPc===100&&fields.youngSigmaPc===45&&view.stepPc===15&&view.objectSubpixels===4&&Math.abs(num(view.pcPerPixel)-9.250826559679918)<1e-8,'A native view changed sampling, physical regularization or calibration');}
 return{passed:true,regions:2,cameras:4,maximumConvergenceRelativeL1:Math.max(...rows.map(v=>num(v.mediumToFineRelativeL1)))};
}
