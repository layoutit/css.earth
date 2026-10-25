/** Bounded deletion checks of l9 physical properties. Restore every file before continuing. */
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LOCAL,need} from './inputs.mts';
const base=fileURLToPath(new URL('.',import.meta.url)),path=base+'depth-model.mts',mutations=[
 {name:'Remove the Cepheid depth',from:'CEPHEID_SKY_SECH_SCALE=1.94',to:'CEPHEID_SKY_SECH_SCALE=.1'},
 {name:'Lose the sky-Z to normal conversion',from:'CEPHEID_SKY_SECH_SCALE*Math.cos(INCLINATION)',to:'CEPHEID_SKY_SECH_SCALE'},
 {name:'Remove finite cloud support',from:'if(!(halfDepth>0)||Math.abs(q)>=halfDepth)return 0;',to:'if(!(halfDepth>0))return 0;'},
 {name:'Remove depth equals width',from:'const scale=7*sigma*sigma*flux/weightedDepth',to:'const scale=.01'},
 {name:'Use the old assumed bar height',from:'BAR_QZ_LIMIT=.35',to:'BAR_QZ_LIMIT=.23'},
 {name:'Remove the wide boundary blend',from:'BLEND_PIXELS=64',to:'BLEND_PIXELS=20'},
 {name:'Remove cloud emission from the renderer',from:'out[9+k*3+c]+=amp*color[c]',to:'out[9+k*3+c]+=0'},
 {name:'Return to a photographic bar layer',from:'const b=fields.barNormalization*barSurface(x,y)*gaussian(z-BAR_VERTICAL_OFFSET,BAR_SIGMA_Z)',to:'const b=sample[1]*gaussian(z-BAR_VERTICAL_OFFSET,BAR_SIGMA_Z)'},
 {name:'Lose Bell when widening the fade',from:'dustFadeCorrection=bellSum/proxySum',to:'dustFadeCorrection=1'},
 {name:'Count compact light twice',from:'diffuse[k+2][i]-=splits[k].light[i]/Math.max(1e-10,smoothstep(sky.distance[i]/BLEND_PIXELS))',to:'diffuse[k+2][i]-=0'}
],results=[];
for(const m of mutations){const original=await readFile(path,'utf8');need(original.includes(m.from),`Missing target: ${m.name}`);try{
 await writeFile(path,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--test',base+'depth.test.mts'],{encoding:'utf8',timeout:30000});need(r.status!==null&&r.status>0&&/not ok/u.test(r.stdout),`Mutation survived or failed to execute: ${m.name}`);results.push({name:m.name,caught:true,failingTests:r.stdout.split('\n').filter(s=>s.startsWith('not ok'))});
 }finally{await writeFile(path,original);}}
await writeFile(`${LOCAL}versions/l9/mutations.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({sentinel:'L9_ALL_MUTATIONS_CAUGHT',results}));
