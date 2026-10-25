/** Reduce H-alpha observations to finite-object geometry, never a volume texture. */
import {readFile,writeFile,stat,mkdir,readdir,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {readFitsImage,skyProjection} from '@cssearth/fits';
import {LOCAL,json,rec,array,num,numbers,need} from './inputs.mts';
import {DEG,unit,normalize,skyOf,type V3} from './geometry.mts';
import {normalizeEquinox} from './qualify-gas.mts';
import {L11,type CatalogueRow} from './catalogue-data.mts';
export interface HaKnot {x:number;y:number;radius:number;weight:number;}
export interface HaGeometry {id:string;source:string;coverage:number;ringRatio:number;knots:HaKnot[];links:[number,number][];bubbles:HaKnot[];signal:number;}
export function readHaGeometry(value:unknown):HaGeometry {
 const r=rec(value);need(typeof r.id==='string'&&typeof r.source==='string','Invalid H-alpha geometry identity');
 const knot=(v:unknown):HaKnot=>{const p=rec(v),q={x:num(p.x),y:num(p.y),radius:num(p.radius),weight:num(p.weight)};need(q.radius>0&&q.weight>=0,'Invalid finite H-alpha feature');return q;};
 const knots=array(r.knots).map(knot),links=array(r.links).map(v=>{const p=numbers(v,2);need(p.every(i=>Number.isInteger(i)&&i>=0&&i<knots.length),'Invalid filament endpoints');return [p[0],p[1]] as [number,number];});
 const coverage=num(r.coverage);need(coverage>=0&&coverage<=1,'Invalid H-alpha coverage');return{id:r.id,source:r.source,coverage,ringRatio:num(r.ringRatio),knots,links,bubbles:array(r.bubbles).map(knot),signal:num(r.signal)};
}
function readRow(v:unknown):CatalogueRow {const r=rec(v);need(typeof r.id==='string'&&typeof r.kind==='string'&&typeof r.ra==='number'&&typeof r.dec==='number'&&typeof r.majorArcmin==='number'&&typeof r.minorArcmin==='number'&&typeof r.pa==='number','Invalid stored catalogue row');return {id:r.id,kind:r.kind==='nebula'?'nebula':'cluster',aliases:array(r.aliases).map(v=>{need(typeof v==='string','Bad alias');return v;}),ra:r.ra,dec:r.dec,majorArcmin:r.majorArcmin,minorArcmin:r.minorArcmin,pa:r.pa,logAge:null,ageStatus:'',weight:num(r.weight),source:'',notes:''};}
export function skyOffset(r:Pick<CatalogueRow,'ra'|'dec'|'majorArcmin'|'minorArcmin'|'pa'>,x:number,y:number):[number,number] {
 const a=r.ra*DEG,d=r.dec*DEG,p=r.pa*DEG,major=x*r.majorArcmin/2*DEG/60,minor=y*r.minorArcmin/2*DEG/60,e=major*Math.sin(p)+minor*Math.cos(p),n=major*Math.cos(p)-minor*Math.sin(p),q=unit(r.ra,r.dec),east:V3=[-Math.sin(a),Math.cos(a),0],north:V3=[-Math.sin(d)*Math.cos(a),-Math.sin(d)*Math.sin(a),Math.cos(d)];return skyOf(normalize([q[0]+e*east[0]+n*north[0],q[1]+e*east[1]+n*north[1],q[2]+e*east[2]+n*north[2]]));
}
async function image(path:string){const raw=await readFile(path);need(raw.length<=64*1024**2,'H-alpha cutout exceeds 64 MiB');const im=readFitsImage(normalizeEquinox(raw).bytes,{maxDecodedBytes:128*1024**2}),h={...im.header};if(['CD1_1','CD1_2','CD2_1','CD2_2'].every(k=>typeof h[k]==='number'))for(const k of ['CDELT1','CDELT2','CROTA1','CROTA2'])delete h[k];return {im,wcs:skyProjection(h)};}
function sample(s:Awaited<ReturnType<typeof image>>,ra:number,dec:number):number {
 const p=s.wcs.pixelOf(ra,dec);if(!p)return NaN;const x=Math.round(p[0]),y=Math.round(p[1]);if(x<1||y<1||x+1>=s.im.width||y+1>=s.im.height)return NaN;
 let sum=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const v=s.im.values[(y+j)*s.im.width+x+i];if(Number.isFinite(v)){sum+=v;n++;}}return n>6?sum/n:NaN;
}
export {image as loadHaCutout,sample as sampleHaCutout};
const median=(v:number[])=>{v.sort((a,b)=>a-b);return v[Math.floor(v.length/2)]??0;};
function reduce(r:CatalogueRow,s:Awaited<ReturnType<typeof image>>,path:string):HaGeometry|null {
 const tara=r.aliases.some(a=>a==='30 Doradus'||a==='NGC2070'),n=tara?96:40,v=new Float64Array(n*n),valid=new Uint8Array(n*n),border:number[]=[];let count=0,total=0;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const xx=(x/(n-1)*2-1)*1.2,yy=(y/(n-1)*2-1)*1.2,rr=Math.hypot(xx,yy);if(rr>1.2)continue;total++;const z=sample(s,...skyOffset(r,xx,yy));if(Number.isFinite(z)){const i=y*n+x;v[i]=z;valid[i]=1;count++;if(rr>1)border.push(z);}}
 const coverage=count/Math.max(1,total);if(coverage<.55||border.length<5)return null;const background=median(border),noise=median(border.map(z=>Math.abs(z-background)))*1.4826;let inner=0,ni=0,rim=0,nr=0,signal=0;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,rr=Math.hypot((x/(n-1)*2-1)*1.2,(y/(n-1)*2-1)*1.2);v[i]=valid[i]?Math.max(0,v[i]-background-noise*.5):0;if(rr<.4){inner+=v[i];ni++;}if(rr>.65&&rr<.95){rim+=v[i];nr++;}if(rr<1)signal+=v[i];}
 if(!(signal>0))return null;const candidates:HaKnot[]=[];
 for(let y=2;y<n-2;y++)for(let x=2;x<n-2;x++){const i=y*n+x,xx=(x/(n-1)*2-1)*1.2,yy=(y/(n-1)*2-1)*1.2;if(Math.hypot(xx,yy)>.96||v[i]<=noise*2)continue;let peak=true;for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++)if(v[(y+j)*n+x+k]>v[i])peak=false;if(peak)candidates.push({x:xx,y:yy,radius:Math.max(.025,2.4/n),weight:v[i]});}
 const knots:HaKnot[]=[];for(const k of candidates.sort((a,b)=>b.weight-a.weight))if(knots.every(p=>Math.hypot(k.x-p.x,k.y-p.y)>(tara?.09:.22))){knots.push(k);if(knots.length>=(tara?48:6))break;}
 const links:[number,number][]=[];if(tara)for(let i=0;i<knots.length;i++){let near=-1,d=.4;for(let j=0;j<i;j++){const dd=Math.hypot(knots[i].x-knots[j].x,knots[i].y-knots[j].y);if(dd>=d)continue;let supported=0;for(let sample=1;sample<=12;sample++){const f=sample/13,x=knots[i].x*(1-f)+knots[j].x*f,y=knots[i].y*(1-f)+knots[j].y*f,px=Math.round((x/1.2+1)/2*(n-1)),py=Math.round((y/1.2+1)/2*(n-1));if(v[py*n+px]>noise*2)supported++;}if(supported>=9){d=dd;near=j;}}if(near>=0)links.push([i,near]);}
 const bubbles:HaKnot[]=[];
 if(tara){const candidates:HaKnot[]=[];for(const radius of [.18,.32,.48])for(let y=-.6;y<=.6;y+=.15)for(let x=-.6;x<=.6;x+=.15){let ring=0,center=0,ok=0;for(let a=0;a<24;a++){const angle=a/24*2*Math.PI,px=Math.round(((x+radius*Math.cos(angle))/1.2+1)/2*(n-1)),py=Math.round(((y+radius*Math.sin(angle))/1.2+1)/2*(n-1));if(px>=0&&py>=0&&px<n&&py<n){ring+=v[py*n+px];ok++;}}const px=Math.round((x/1.2+1)/2*(n-1)),py=Math.round((y/1.2+1)/2*(n-1));center=v[py*n+px];if(ok===24&&ring/24>center*1.5&&ring>noise*48)candidates.push({x,y,radius,weight:ring/24-center});}
  for(const b of candidates.sort((a,b)=>b.weight-a.weight))if(bubbles.every(p=>Math.hypot(b.x-p.x,b.y-p.y)>.7*(b.radius+p.radius))){bubbles.push(b);if(bubbles.length===5)break;}
 }
 return{id:r.id,source:path,coverage,ringRatio:(rim/Math.max(nr,1))/Math.max(noise,inner/Math.max(1,ni),1e-10),knots,links,bubbles,signal};
}
const TRANSFER_BUDGET=4*1024**3;let transferredBytes=0,retainedBytes=0;
async function get(url:string,path:string,cap:number):Promise<Buffer>{const r=await fetch(url,{signal:AbortSignal.timeout(40000)});need(r.ok&&r.body,`H-alpha HTTP ${r.status}`);const reader=r.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;while(true){const p=await reader.read();if(p.done)break;bytes+=p.value.byteLength;transferredBytes+=p.value.byteLength;if(retainedBytes+transferredBytes>TRANSFER_BUDGET||bytes>cap){await reader.cancel();throw Error('H-alpha transfer budget exceeded');}chunks.push(p.value);}const b=Buffer.concat(chunks);await writeFile(path,b);return b;}
async function acquire(r:CatalogueRow):Promise<string|null>{const path=L11+`inputs/ha/${r.id.replace(/[^a-z0-9_-]/giu,'_')}.fits`;if(await stat(path).catch(()=>null))return path;
 const xml=(await get(`https://datalab.noirlab.edu/sia/demcels_dr1?POS=${r.ra},${r.dec}&SIZE=0.1&FORMAT=image/fits`,path+'.xml',1024**2)).toString('utf8'),names=[...xml.matchAll(/<FIELD\b[^>]*\bname="([^"]+)"/gu)].map(x=>x[1]),rows=[...xml.matchAll(/<TR>([\s\S]*?)<\/TR>/gu)].map(x=>[...x[1].matchAll(/<TD>([\s\S]*?)<\/TD>/gu)].map(y=>y[1].replaceAll('&amp;','&'))),urls=rows.map(a=>Object.fromEntries(names.map((k,i)=>[k,a[i]]))).filter(v=>v.access_url?.includes('.ha_sub_r.')&&!v.access_url.includes('preview=true'));
 for(const v of urls.slice(0,3))try{const url=new URL(v.access_url),size=Math.max(.02,Math.min(.25,r.majorArcmin*1.4/60));url.searchParams.set('SIZE',`${size},${size}`);await get(url.href.replaceAll('%2C',','),path,60*1024**2);return path;}catch{}return null;}
export async function prepareHa(pilot=false){await mkdir(L11+'inputs/ha/',{recursive:true});retainedBytes=(await Promise.all((await readdir(L11+'inputs/ha/')).filter(s=>s.endsWith('.fits')).map(async s=>(await stat(L11+'inputs/ha/'+s)).size))).reduce((a,b)=>a+b,0);const rows=array(rec(await json(L11+'catalogues.json')).rows).map(readRow).filter(r=>r.kind==='nebula'),output=new Map<string,HaGeometry>(),old=await json(L11+'ha-geometry.json').catch(()=>null);if(old)for(const v of array(old)){const r=readHaGeometry(v);output.set(r.id,r);}
 const inputs=array(await json(`${LOCAL}versions/inputs/gas/index.json`)).map(rec).filter(v=>typeof v.file==='string');
 if(!old)for(const input of inputs){const path=String(input.file),s=await image(path);let hits=0;for(const r of rows){const center=s.wcs.pixelOf(r.ra,r.dec);if(!center||center[0]<0||center[1]<0||center[0]>=s.im.width||center[1]>=s.im.height)continue;const geometry=reduce(r,s,path);if(geometry&&geometry.coverage>(output.get(r.id)?.coverage??0)){output.set(r.id,geometry);hits++;}}console.log(JSON.stringify({sentinel:'L11_HA_CACHE_REDUCED',path,hits}));}
 await writeFile(L11+'ha-geometry.json',JSON.stringify([...output.values()],null,2)+'\n');
 let saveQueue=Promise.resolve();const save=()=>{saveQueue=saveQueue.then(async()=>{await writeFile(L11+'ha-geometry.tmp',JSON.stringify([...output.values()],null,2)+'\n');await rename(L11+'ha-geometry.tmp',L11+'ha-geometry.json');});return saveQueue;};
 const missing=rows.filter(r=>!output.has(r.id)),selected=pilot?missing.slice(0,3):missing,unavailable:string[]=[];let next=0,downloadBytes=0;const began=performance.now();
 async function worker(){while(next<selected.length&&retainedBytes+transferredBytes<TRANSFER_BUDGET){const r=selected[next++];try{const path=await acquire(r);if(!path){unavailable.push(r.id);continue;}downloadBytes+=(await stat(path)).size;const s=await image(path),geometry=reduce(r,s,path);if(geometry)output.set(r.id,geometry);else unavailable.push(r.id);await save();console.log(JSON.stringify({sentinel:'L11_HA_OBJECT_REDUCED',id:r.id,coverage:geometry?.coverage,bytes:(await stat(path)).size}));}catch(e){unavailable.push(r.id);console.log(JSON.stringify({id:r.id,reason:String(e)}));}}}
 await Promise.all([worker(),worker()]);const summary={pilot,nebulae:rows.length,geometryAvailable:output.size,requested:selected.length,unavailable,newBytes:transferredBytes,retainedBytesBeforeRun:retainedBytes,budgetBytes:TRANSFER_BUDGET,seconds:(performance.now()-began)/1000,method:'H-alpha supplies finite-object shell, knot and filament parameters only. No image array enters the volume.'};await writeFile(L11+(pilot?'ha-pilot.json':'ha-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({sentinel:'L11_HA_GEOMETRY_COMPLETE',...summary}));
}
/** Requalify cached observations after a catalogue identity correction; no network access. */
export async function refreshHaGeometry(ids:string[]){
 const allRows=array(rec(await json(L11+'catalogues.json')).rows).map(readRow),validIds=new Set(allRows.map(r=>r.id)),rows=allRows.filter(r=>ids.includes(r.id)),output=new Map(array(await json(L11+'ha-geometry.json')).map(v=>{const r=readHaGeometry(v);return[r.id,r] as const;}).filter(([id])=>validIds.has(id))),paths=new Set<string>();
 for(const input of array(await json(`${LOCAL}versions/inputs/gas/index.json`)).map(rec))if(typeof input.file==='string')paths.add(input.file);
 for(const id of ids){const old=output.get(id);if(old)paths.add(old.source);output.delete(id);const own=L11+`inputs/ha/${id}.fits`;if(await stat(own).catch(()=>null))paths.add(own);}
 for(const path of paths){const s=await image(path);for(const row of rows){const center=s.wcs.pixelOf(row.ra,row.dec);if(!center||center[0]<0||center[1]<0||center[0]>=s.im.width||center[1]>=s.im.height)continue;const r=reduce(row,s,path);if(r&&r.coverage>(output.get(r.id)?.coverage??0))output.set(r.id,r);}}
 await writeFile(L11+'ha-geometry.json',JSON.stringify([...output.values()],null,2)+'\n');return{refreshed:ids,qualified:rows.filter(r=>output.has(r.id)).map(r=>r.id),geometryAvailable:output.size};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await prepareHa(process.argv.includes('--pilot'));
