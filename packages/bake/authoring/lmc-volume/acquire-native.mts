/** Bounded acquisition of individual SMASH blue-star records, never image fits. */
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {LOCAL,need} from './inputs.mts';
const out=`${LOCAL}versions/inputs/native-bright/`;
const quality='chi > 0 AND chi < 3 AND ABS(sharp) < 1 AND gmag >= 12 AND gmag < 20.5 AND rmag >= 12 AND rmag < 20.5 AND imag >= 12 AND imag < 20.5 AND gerr > 0 AND gerr < 0.1 AND rerr > 0 AND rerr < 0.1 AND ierr > 0 AND ierr < 0.1 AND ndetg > 0 AND ndetr > 0 AND ndeti > 0 AND gmag-imag >= -0.5 AND gmag-imag < 0.5';
await mkdir(out,{recursive:true});
async function get(name:string,box:string,limit:number,cap:number){
  const path=`${out}${name}.csv`;if(await stat(path).catch(()=>null))return (await readFile(path,'utf8')).trim().split('\n').length-1;
  const sql=`SELECT id,ra,dec,gmag,rmag,imag FROM smash_dr2.object WHERE ${box} AND ${quality} LIMIT ${limit}`;
  const url=new URL('https://datalab.noirlab.edu/query/query');for(const[k,v]of Object.entries({sql,ofmt:'csv',out:'None',async:'False',drop:'False',profile:'default'}))url.searchParams.set(k,v);
  const start=performance.now(),response=await fetch(url,{signal:AbortSignal.timeout(120000),headers:{'X-DL-AuthToken':'anonymous.0.0.anon_access','X-DL-TimeoutRequest':'120'}});
  need(response.ok&&response.body,`Native catalogue HTTP ${response.status}`);const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>cap){await reader.cancel();throw Error('Native catalogue byte cap exceeded');}chunks.push(r.value);}
  const text=Buffer.concat(chunks).toString('utf8'),lines=text.trim().split(/\r?\n/u);need(lines[0]==='id,ra,dec,gmag,rmag,imag'&&lines.length>1&&lines.length-1<limit,'Truncated or invalid native star list');
  for(const line of lines.slice(1)){const v=line.split(',');need(v.length===6&&/^\d+\.\d+$/u.test(v[0])&&v.slice(1).every(x=>Number.isFinite(Number(x))),'Invalid native star record');}
  await writeFile(path,text);await writeFile(`${path}.request.json`,JSON.stringify({sql,endpoint:url.origin+url.pathname,bytes,rows:lines.length-1,seconds:(performance.now()-start)/1000,quality,source:'SMASH DR2 object catalogue; individual measured sky positions and gri magnitudes',limitations:['Observed-color selection is not a complete age or membership catalogue.','No individual line-of-sight depth is measured.']},null,2)+'\n');
  console.log(JSON.stringify({sentinel:'NATIVE_STAR_QUERY_COMPLETE',name,rows:lines.length-1,bytes,seconds:(performance.now()-start)/1000}));return lines.length-1;
}
const pilot=await get('pilot','ra >= 81.27 AND ra < 81.29 AND dec >= -69.785 AND dec < -69.775',5001,1024**2);need(pilot>0,'No stars in native pilot');
// Exact same query/selection, bounded tiles. Completed tiles resume without reacquisition.
for(let ra=61.5;ra<98.75;ra+=1){const hi=Math.min(98.75,ra+1);await get(`ra-${ra}`,`ra >= ${ra} AND ra < ${hi} AND dec >= -73.5 AND dec < -64.65`,1000001,32*1024**2);}
console.log(JSON.stringify({sentinel:'NATIVE_STAR_ACQUISITION_COMPLETE'}));
