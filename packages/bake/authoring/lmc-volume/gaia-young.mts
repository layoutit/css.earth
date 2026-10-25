/** Gaia DR3 upper-main-sequence sample, following Gaia Collaboration/Luri 2021. */
import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {tapRows} from '@cssearth/telescope-core/node';
import {LOCAL,rec,array,num,need} from './inputs.mts';
import {DEG} from './geometry.mts';
export const L13=LOCAL+'versions/l13/',GAIA_SERVICE='https://gaia.ari.uni-heidelberg.de/tap';
export const SELECTION_PAPER='https://arxiv.org/html/2012.01771';
export interface GaiaStar {id:string;ra:number;dec:number;g:number;bp:number|null;rp:number|null;parallax:number;parallaxError:number;pmra:number;pmdec:number;pmraError:number;pmdecError:number;parallaxPmraCorr:number;parallaxPmdecCorr:number;}
export interface Membership {mean:[number,number];covariance:[number,number,number];parallaxMedian:number;calibrationRows:number;retainedCalibration:number;}
const columns=['source_id','ra','dec','phot_g_mean_mag','phot_bp_mean_mag','phot_rp_mean_mag','parallax','parallax_error','pmra','pmdec','pmra_error','pmdec_error','parallax_pmra_corr','parallax_pmdec_corr'];
export function youngPhase(g:number,color:number):0|1|2 {if(g<10||g>=18||color< -1||color>.08*g-1.10)return 0;return g<16?1:2;}
export function query(kind:'calibration'|'young',pilot=false):string {
 const radius=pilot?(kind==='calibration'?.3:.15):(kind==='calibration'?5:20),limit=kind==='calibration'?200001:800001;
 const where=[`1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',81.28,-69.78,${radius}))`,'parallax IS NOT NULL','parallax_error>0','parallax/parallax_error<5','pmra IS NOT NULL','pmdec IS NOT NULL'];
 if(kind==='calibration')where.push('phot_g_mean_mag<19','random_index<20000000');else where.push('phot_g_mean_mag>=10','phot_g_mean_mag<18','phot_bp_mean_mag-phot_rp_mean_mag>=-1','phot_bp_mean_mag-phot_rp_mean_mag<=0.08*phot_g_mean_mag-1.10');
 return `SELECT TOP ${limit} ${columns.join(',')} FROM gaiadr3.gaia_source WHERE ${where.join(' AND ')}`;
}
export function parseStars(values:unknown):GaiaStar[] {
 const seen=new Set<string>();return array(values).map((v,i)=>{const r=rec(v),cell=(name:string,nullable=false):number|null=>{const s=r[name];if(nullable&&(s===null||s===undefined||s===''))return null;need((typeof s==='string'&&s.trim()!=='')||typeof s==='number',`Missing Gaia ${name} row ${i}`);const n=Number(s);need(Number.isFinite(n),`Invalid Gaia ${name}`);return n;},n=(name:string)=>{const v=cell(name);need(v!==null,'Missing Gaia number');return v;};
  need(typeof r.source_id==='string'&&/^\d{10,20}$/u.test(r.source_id)&&!seen.has(r.source_id),'Invalid or repeated Gaia source identity');seen.add(r.source_id);
  const s:GaiaStar={id:r.source_id,ra:n('ra'),dec:n('dec'),g:n('phot_g_mean_mag'),bp:cell('phot_bp_mean_mag',true),rp:cell('phot_rp_mean_mag',true),parallax:n('parallax'),parallaxError:n('parallax_error'),pmra:n('pmra'),pmdec:n('pmdec'),pmraError:n('pmra_error'),pmdecError:n('pmdec_error'),parallaxPmraCorr:n('parallax_pmra_corr'),parallaxPmdecCorr:n('parallax_pmdec_corr')};
  need(s.ra>=0&&s.ra<360&&Math.abs(s.dec)<=90&&s.parallaxError>0&&s.pmraError>=0&&s.pmdecError>=0&&Math.abs(s.parallaxPmraCorr)<=1&&Math.abs(s.parallaxPmdecCorr)<=1,'Invalid Gaia astrometry');return s;
 });
}
const median=(values:number[])=>{need(values.length>0,'Empty Gaia statistic');const a=[...values].sort((a,b)=>a-b);return a[Math.floor(a.length/2)];};
export function projectedMotion(s:GaiaStar,parallaxMedian?:number):[number,number]{
 const a=(s.ra-81.28)*DEG,d=s.dec*DEG,dc=-69.78*DEG,p=parallaxMedian===undefined?0:s.parallax-parallaxMedian,ra=s.pmra-p*s.parallaxPmraCorr*s.pmraError/s.parallaxError,dec=s.pmdec-p*s.parallaxPmdecCorr*s.pmdecError/s.parallaxError;
 return[ra*Math.cos(a)-dec*Math.sin(d)*Math.sin(a),ra*Math.sin(dc)*Math.sin(a)+dec*(Math.cos(d)*Math.cos(dc)+Math.sin(d)*Math.sin(dc)*Math.cos(a))];
}
function moments(points:[number,number][]):Pick<Membership,'mean'|'covariance'>{const mean:[number,number]=[median(points.map(p=>p[0])),median(points.map(p=>p[1]))];let a=0,b=0,c=0;for(const p of points){const x=p[0]-mean[0],y=p[1]-mean[1];a+=x*x;b+=x*y;c+=y*y;}const n=points.length-1;need(n>10&&a*c>b*b,'Degenerate Gaia membership covariance');return{mean,covariance:[a/n,b/n,c/n]};}
export function mahalanobis(p:[number,number],m:Pick<Membership,'mean'|'covariance'>):number{const x=p[0]-m.mean[0],y=p[1]-m.mean[1],[a,b,c]=m.covariance;return(c*x*x-2*b*x*y+a*y*y)/(a*c-b*b);}
export function learnMembership(sample:GaiaStar[]):Membership {
 const initial=sample.filter(s=>s.g<19&&s.parallax/s.parallaxError<5);need(initial.length>=100,'Gaia calibration sample too small');const first=moments(initial.map(s=>projectedMotion(s))),clean=initial.filter(s=>mahalanobis(projectedMotion(s),first)<9.21);need(clean.length>100,'Gaia calibration clipping emptied the sample');const parallaxMedian=median(clean.map(s=>s.parallax)),final=moments(clean.map(s=>projectedMotion(s,parallaxMedian)));
 return{...final,parallaxMedian,calibrationRows:initial.length,retainedCalibration:clean.length};
}
export function isYoungMember(s:GaiaStar,m:Membership):boolean{return s.bp!==null&&s.rp!==null&&youngPhase(s.g,s.bp-s.rp)!==0&&s.parallax/s.parallaxError<5&&mahalanobis(projectedMotion(s,m.parallaxMedian),m)<9.21;}
async function acquire(kind:'calibration'|'young',pilot:boolean){const dir=L13+'inputs/',name=kind+(pilot?'-pilot':''),path=dir+name+'.rows.json';await mkdir(dir,{recursive:true});const previous=await readFile(dir+name+'.request.json','utf8').then(JSON.parse).then(rec).catch(()=>null);if(previous?.complete===true&&previous.service===GAIA_SERVICE&&previous.query===query(kind,pilot)&&await stat(path).catch(()=>null)){const cached=parseStars(JSON.parse(await readFile(path,'utf8')));need(cached.length===num(previous.rows)&&(await stat(path)).size===num(previous.bytes),'Gaia cache does not match its completed query record');return cached;}
 const adql=query(kind,pilot),cap=kind==='calibration'?200000:800000,start=performance.now();console.log(JSON.stringify({sentinel:'L13_GAIA_QUERY_STARTED',kind,pilot,rowCap:cap}));const raw=await tapRows(GAIA_SERVICE,adql,cap+2,'async');need(raw.length>0&&raw.length<cap,'Gaia answer empty or at row cap; do not treat a truncated map as complete');const stars=parseStars(raw),bytes=Buffer.from(JSON.stringify(raw));need(bytes.length<500*1024**2,'Gaia input exceeds byte budget');await writeFile(path+'.pending',bytes);await rename(path+'.pending',path);const record={product:'Gaia DR3 gaiadr3.gaia_source',service:GAIA_SERVICE,query:adql,rows:stars.length,bytes:bytes.length,seconds:(performance.now()-start)/1000,complete:true,pilot,method:SELECTION_PAPER,route:'Telescope core PyVO TAP client; archive QUERY_STATUS must be complete'};await writeFile(dir+name+'.request.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({sentinel:'L13_GAIA_QUERY_COMPLETE',kind,...record}));return stars;
}
export async function loadGaiaSample(pilot=false,summaryDirectory=L13){const calibration=await acquire('calibration',pilot),membership=learnMembership(calibration),candidates=await acquire('young',pilot),selected=candidates.filter(s=>isYoungMember(s,membership));need(selected.length>(pilot?5:10000),'No useful Gaia young population');const summary={pilot,candidateRows:candidates.length,selectedStars:selected.length,young1:selected.filter(s=>s.g<16).length,young2:selected.filter(s=>s.g>=16).length,membership,selection:'Luri 2021 Young 1 + Young 2 CMD polygons; signed parallax/error <5; conditional orthographic proper-motion ellipse with chi-square <9.21.',adaptation:'Membership statistics use a uniform Gaia random_index <20,000,000 calibration subset within 5 degrees, G<19. DR3 photometry is used as published; no extra G correction.',paper:SELECTION_PAPER};await writeFile(summaryDirectory+(pilot?'gaia-pilot.json':'gaia-selection.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({sentinel:'L13_GAIA_SELECTION_COMPLETE',...summary}));return{stars:selected,summary};}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await loadGaiaSample(process.argv.includes('--pilot'));
