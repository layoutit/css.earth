/** Tiny end-to-end smoke render of the exact field builder and canonical projector. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {json,rec,num,array,need} from '../inputs.mts';
import {versionDir,loadParent,parentRung} from '../sequence-state.mts';
import {readVolumeObject} from '../frozen-l12.mts';
import {loadObservation} from '../observation.mts';
import {earthCamera,outsideCamera} from '../render.mts';
import {projectCatalogue,catalogueBasis} from '../catalogue-render.mts';
import {readGrade,gradedPrediction} from '../grade.mts';
import {saveGradedSheet} from '../grade-report.mts';
const dir=versionDir(35),out=dir+'source-pilot/',{scene}=await loadParent(32),parent=await parentRung(32,false,scene),m=rec(await json(dir+'pilot-diffuse-gas.json')),n=num(m.n),half=num(m.halfKpc),bytes=await readFile(dir+'pilot-diffuse-gas.f32le'),values=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),source=rec(await json(dir+'pilot-gas-survey.json'));
need(values.length===n*n&&values.every(v=>Number.isFinite(v)&&v>=0),'Invalid pilot diffuse field');scene.objects=[...scene.objects.filter(v=>v.component!==4),...array(await json(dir+'pilot-ionized-objects.json')).map(readVolumeObject)];scene.ionizedGain=num(source.compactGain);scene.diffuseGas={n,half,values,mask:new Uint8Array(n*n).fill(1)};scene.diffuseGasGain=num(source.globalDiffuseGain);
const o=await loadObservation(1),grade=readGrade(parent.result.grade),render=(camera:ReturnType<typeof earthCamera>)=>gradedPrediction(catalogueBasis(projectCatalogue(scene,camera,.12),scene,parent.amplitudes),grade),earth=render(earthCamera(o.width,o.height,o.rayAt,o.pixelOf)),views=[0,45,90].map(a=>render(outsideCamera(a,64)));
need([earth,...views].every(a=>a.every(v=>Number.isFinite(v)&&v>=0)),'Invalid pilot radiance');await mkdir(out,{recursive:true});await saveGradedSheet(out,35,o,earth,views,grade,'Source-pipeline smoke test with a limited native-tile pilot.','Not a full-mosaic fit or acceptance result.');await writeFile(out+'result.json',JSON.stringify({complete:true,n,finite:earth.every(v=>Number.isFinite(v)&&v>=0),source},null,2)+'\n');console.log('DEM CELS TINY SOURCE PILOT COMPLETE');
