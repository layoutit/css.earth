// Refresh only the imported objects; pin original responses beside each body.
import {mkdir,writeFile} from 'node:fs/promises';
import {candidates} from './catalog.mts';
import {elementsUrl,vectorsUrl,horizons,parseElements,parseVectors} from '../../../packages/astronomy/tools/lib/horizons.mts';
const epoch=2461286.5,rad=Math.PI/180,records=[];
for(const c of candidates){
 const command=`DES=${c.designation};CAP;`;
 const query=elementsUrl({command,center:'500@10',startJd:epoch,stopJd:epoch+1,stepDays:1});
 const vectorQuery=vectorsUrl({command,center:'500@10',epochsJdTdb:[epoch-30,epoch,epoch+30],outUnits:'KM-D'});
 const et=await horizons(query,`comet-elements-${c.id}`),row=parseElements(et,c.id)[0];
 const vt=await horizons(vectorQuery,`comet-vectors-${c.id}`),vectors=parseVectors(vt,c.id);
 const elements={epochJdTt:epoch,semiMajorAxisKm:row.semiMajorAxisKm,eccentricity:row.eccentricity,inclinationRad:row.inclinationDeg*rad,ascendingNodeRad:row.nodeDeg*rad,argumentOfPeriapsisRad:row.periapsisDeg*rad,meanAnomalyAtEpochRad:row.meanAnomalyDeg*rad,meanMotionRadPerDay:row.meanMotionDegPerDay*rad};
 const s=`src/planets/${c.id}/source/reference`;await mkdir(s,{recursive:true});
 await writeFile(`${s}/horizons-elements.txt`,`# ${query}\n${et}`);await writeFile(`${s}/horizons-vectors.txt`,`# ${vectorQuery}\n${vt}`);
 const distanceAu=Math.hypot(...vectors[1].position)/149597870.7;
 records.push({...c,command,record:{query,elements},fixture:{query:vectorQuery,rows:vectors},distanceAu,perihelionAu:row.semiMajorAxisKm*(1-row.eccentricity)/149597870.7});
 console.log(c.id,'e='+row.eccentricity,'r='+distanceAu.toFixed(2)+' AU');
 await mkdir('output/celestia-comets',{recursive:true});await writeFile('output/celestia-comets/intake.json',JSON.stringify(records,null,2)+'\n');
}
