import {requireRecord} from '../../source-values.mts';
import {shape,text,number} from '../terrestrial-layers/source-records.mts';
const parseSelection=shape({model:text,centerRaDegrees:number,centerDecDegrees:number,horizontalFovDegrees:number,aspectRatio:number});
import {csvRow} from './csv.mts';
/** Catalog coordinates projected into a source-authored representative field. */
export function prepareProjectedCatalog({bytes,template:templateValue,selection:selectionValue,selectedCount,catalogRows}:{bytes:Uint8Array;template:unknown;selection:unknown;selectedCount:number;catalogRows:number}) {
  const template=requireRecord(templateValue),selection=parseSelection(selectionValue);
  if(selection?.model!=='gnomonic'||!Number.isFinite(selection.centerRaDegrees)||!Number.isFinite(selection.centerDecDegrees)||!Number.isFinite(selection.horizontalFovDegrees)||selection.horizontalFovDegrees<=0||selection.horizontalFovDegrees>=180||!Number.isFinite(selection.aspectRatio)||selection.aspectRatio<=0||!Number.isSafeInteger(selectedCount)||selectedCount<1)throw new TypeError('Invalid projected catalog selection.');
  const lines=new TextDecoder().decode(bytes).trimEnd().split('\n');
  if(lines.length-1!==catalogRows)throw new Error('Projected catalog row count drifted.');
  const columns=Object.fromEntries(csvRow(lines[0]).map((name,index)=>[name,index]));
  for(const key of ['ra','dec','mag','ci','id'])if(columns[key]===undefined)throw new Error('Projected catalog columns drifted.');
  const radians=(value:number)=>value*Math.PI/180,centerRa=radians(selection.centerRaDegrees),centerDec=radians(selection.centerDecDegrees),tangentX=Math.tan(radians(selection.horizontalFovDegrees/2)),tangentY=tangentX/selection.aspectRatio,candidates=[];
  for(const line of lines.slice(1)) {
    const row=csvRow(line),ra=radians(Number(row[columns.ra])*15),dec=radians(Number(row[columns.dec])),magnitude=Number(row[columns.mag]),colorIndex=Number(row[columns.ci]),id=Number(row[columns.id]);
    if(![ra,dec,magnitude,id].every(Number.isFinite))continue;
    const deltaRa=ra-centerRa,cosc=Math.sin(centerDec)*Math.sin(dec)+Math.cos(centerDec)*Math.cos(dec)*Math.cos(deltaRa);
    if(cosc<=0)continue;
    const projectedX=Math.cos(dec)*Math.sin(deltaRa)/cosc,projectedY=(Math.cos(centerDec)*Math.sin(dec)-Math.sin(centerDec)*Math.cos(dec)*Math.cos(deltaRa))/cosc;
    const x=.5+projectedX/(2*tangentX),y=.5-projectedY/(2*tangentY);
    if(x<0||x>1||y<0||y>1)continue;
    candidates.push({id,x,y,magnitude,colorIndex});
  }
  candidates.sort((left,right)=>left.magnitude-right.magnitude||left.id-right.id);
  const fixed=(value:number,digits:number)=>Number(value.toFixed(digits));
  const stars=candidates.slice(0,selectedCount).map(({id,x,y,magnitude,colorIndex})=>({id,x:fixed(x,9),y:fixed(y,9),magnitude:fixed(magnitude,3),colorIndex:Number.isFinite(colorIndex)?fixed(colorIndex,3):null}));
  if(stars.length!==selectedCount)throw new Error('Projected catalog population is too small.');
  return new TextEncoder().encode(JSON.stringify({...template,presentation:{...requireRecord(template.presentation),visibleCatalogStars:candidates.length,selectedStars:stars.length,brightestMagnitude:stars[0].magnitude,faintestMagnitude:stars[stars.length-1].magnitude},stars},null,2)+'\n');
}
