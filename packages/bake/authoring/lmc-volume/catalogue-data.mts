/** Published catalogue inputs only. No Horálek or photographic component maps. */
import {readFile,writeFile} from 'node:fs/promises';
import {ARCHIVE,LOCAL,need} from './inputs.mts';
import {loadBica,loadDetailClusters,type BicaRow} from './catalogue-clusters.mts';
export const L11=`${LOCAL}versions/l11/`;
export interface CatalogueRow {id:string;kind:'cluster'|'association'|'nebula'|'supershell'|'molecular';aliases:string[];ra:number;dec:number;majorArcmin:number;minorArcmin:number;pa:number;logAge:number|null;ageStatus:string;weight:number;source:string;notes:string;parentIds?:number[];radiusPc?:number;massMsun?:number;}
const text=(s:string,a:number,b:number)=>s.slice(a-1,b).trim();
function value(s:string,a:number,b:number,optional=false):number {const q=text(s,a,b);if(!q&&optional)return NaN;need(/^[+\-]?(\d+(\.\d*)?|\.\d+)$/u.test(q),`Invalid numeric catalogue field ${a}..${b}: ${q}`);return Number(q);}
const key=(s:string)=>s.replace(/[^A-Z0-9]/giu,'').toUpperCase();
const lmc=(ra:number,dec:number)=>ra>65&&ra<100&&dec>-75.5&&dec<-62;
const lines=async(p:string)=>(await readFile(p,'utf8')).split(/\r?\n/u).filter(s=>s.trim());
const clusterDir=`${ARCHIVE}dataset-model/detail-clusters/`;
export async function catalogueRows():Promise<{rows:CatalogueRow[];metadata:Record<string,unknown>}> {
 const [bica,ages,demLines,sgsLines,co1,co3,magma]=await Promise.all([loadBica(),loadDetailClusters(),lines(L11+'inputs/DEM1976-j2000.tsv'),lines(L11+'inputs/Bica2008-table6.dat'),lines(L11+'inputs/NANTEN2008-table1.dat'),lines(L11+'inputs/NANTEN2008-table3.dat'),lines(L11+'inputs/MAGMA2011-table4.dat')]);
 const rows:CatalogueRow[]=[],aged=new Map<string,typeof ages.components[number]>();
 for(const c of ages.components)if(c.bica)aged.set(`${c.bica.table}:${c.bica.row}`,c);
 for(const b of bica.filter(b=>b.table<5&&lmc(b.raDeg,b.decDeg))){
  const age=aged.get(`${b.table}:${b.row}`),association=b.table===4;
  rows.push({id:`Bica${b.table}-${b.row}`,kind:association?'association':'cluster',aliases:b.aliases,ra:b.raDeg,dec:b.decDeg,majorArcmin:b.majorDiameterArcmin,minorArcmin:b.minorDiameterArcmin,pa:b.positionAngleEastOfNorthDeg??0,logAge:age?.logAgeYr??null,ageStatus:age?`Glatt 2010, quality ${age.ageQuality??'unknown'}`:'Unknown; class-based spectrum only',weight:age?.fluxRelativeToV10??Math.sqrt(b.majorDiameterArcmin*b.minorDiameterArcmin),source:'Bica2008',notes:`Bica class ${b.type}. ${b.comments}`});
 }
 // The age catalogue can supply genuine objects whose Bica identity could not be joined.
 for(const c of ages.components)if(!c.bica||c.bica.table===5){if(!lmc(c.raDeg,c.decDeg))continue;
  rows.push({id:c.id,kind:'cluster',aliases:c.aliases,ra:c.raDeg,dec:c.decDeg,majorArcmin:2*c.apparentRadiusArcmin,minorArcmin:2*c.apparentRadiusArcmin,pa:0,logAge:c.logAgeYr,ageStatus:`Glatt 2010, quality ${c.ageQuality??'unknown'}`,weight:c.fluxRelativeToV10,source:'Glatt2010',notes:c.caution.join('; ')});
 }
 const bicaNeb=bica.filter(b=>b.table===5&&lmc(b.raDeg,b.decDeg));
 const demAlias=new Map<string,BicaRow>();for(const b of bicaNeb)for(const a of b.aliases)demAlias.set(key(a).replace(/^LMC/,'').replace(/^DEML/,'DEM'),b);
 const demRecords=demLines.filter(s=>!s.startsWith('#')&&/^\s*\d+\s*\t/u.test(s)),demIds=new Map<string,number>();for(const s of demRecords){const a=s.split('\t').map(v=>v.trim()),id=`DEM${Number(a[0])}${a[1]}`;demIds.set(id,(demIds.get(id)??0)+1);}
 const brightnessWeights:Record<string,number>={vf:.1,f:.3,fb:.7,b:1,vb:2};
 let demCount=0;
 for(const [sourceIndex,line] of demRecords.entries()){if(line.startsWith('#'))continue;const a=line.split('\t').map(v=>v.trim());if(!/^\d+$/u.test(a[0]??''))continue;
  const [number,suffix,name,ra,dec,maj,min,brightness,comment]=a,alias=`DEM${Number(number)}${suffix}`,id=(demIds.get(alias)??0)>1?`${alias}-row${sourceIndex+1}`:alias,modern=demAlias.get(key(alias))??demAlias.get(key(name.split(',')[0])),major=Number(maj),minor=Number(min);if(!(major>0&&minor>0))continue;
  const b=(demIds.get(alias)??0)>1?undefined:modern;rows.push({id,kind:'nebula',aliases:[id,...name.split(',').filter(Boolean),...(b?.aliases??[])],ra:b?.raDeg??Number(ra),dec:b?.decDeg??Number(dec),majorArcmin:b?.majorDiameterArcmin??major,minorArcmin:b?.minorDiameterArcmin??minor,pa:b?.positionAngleEastOfNorthDeg??0,logAge:null,ageStatus:'Not a stellar-age measurement',weight:major*minor*(brightnessWeights[brightness]??.5),source:'DEM1976/CDS J2000; Bica2008 identity',notes:comment??''});demCount++;
 }
 need(demCount>300&&demCount<450,'Unexpected DEM census');
 // Named complexes and subobjects preserve the modern Henize/Bica hierarchy.
 const named=bicaNeb.filter(b=>b.aliases.some(a=>/^(LMC-N(11|44|157)[A-Z]?|30 Doradus|NGC2070|N44-shell\d)/iu.test(a)));
 for(const b of named){const overlap=rows.find(r=>r.kind==='nebula'&&r.aliases.some(a=>b.aliases.includes(a)));if(overlap)continue;
  rows.push({id:`BicaNeb-${b.row}`,kind:'nebula',aliases:b.aliases,ra:b.raDeg,dec:b.decDeg,majorArcmin:b.majorDiameterArcmin,minorArcmin:b.minorDiameterArcmin,pa:b.positionAngleEastOfNorthDeg??0,logAge:null,ageStatus:'Nebula',weight:b.majorDiameterArcmin*b.minorDiameterArcmin,source:'Bica2008/Henize',notes:`Bica class ${b.type}. ${b.comments}`});
 }
 const rejectedShells:number[]=[];
 for(const s of sgsLines){const match=/^KDS-SGS(\d+)/u.exec(s);if(!match)continue;const id=Number(match[1]);if([9,10,18].includes(id)){rejectedShells.push(id);continue;}
  const ra=15*(value(s,33,34)+value(s,36,37)/60+value(s,39,40)/3600),dec=-(value(s,44,45)+value(s,47,48)/60+value(s,50,51)/3600),a=value(s,57,62),b=value(s,64,68),p=text(s,70,72);
  rows.push({id:`KDS-SGS${id}`,kind:'supershell',aliases:[`KDS-SGS${id}`],ra,dec,majorArcmin:a,minorArcmin:b,pa:p==='-'?0:Number(p),logAge:null,ageStatus:'No uniform stellar rim is assumed',weight:a*b*.01,source:'Kim1999 via Bica2008; Book2008 selection',notes:text(s,74,120)});
 }
 const properties=new Map<number,{radius:number;major:number;minor:number;pa:number;mass:number}>();
 for(const s of co3)properties.set(value(s,1,3),{radius:value(s,27,29,true),major:value(s,35,37),minor:value(s,39,40,true),pa:value(s,31,33),mass:value(s,52,56)*1e5});
 const parents=new Map<number,CatalogueRow>();
 for(const s of co1){const id=value(s,1,3),p=properties.get(id);need(p,'Missing NANTEN cloud properties');const radius=Number.isFinite(p.radius)?p.radius:20,ratio=Number.isFinite(p.minor)?Math.max(1,p.major/p.minor):1;
  const ra=15*(value(s,22,22)+value(s,24,25)/60+value(s,27,30)/3600),dec=-(value(s,33,34)+value(s,36,37)/60+value(s,39,42)/3600);
  parents.set(id,{id:`NANTEN-${id}`,kind:'molecular',aliases:[text(s,11,20)],ra,dec,majorArcmin:2*1.6*radius*Math.sqrt(ratio)/49590*180/Math.PI*60,minorArcmin:2*1.6*radius/Math.sqrt(ratio)/49590*180/Math.PI*60,pa:p.pa,logAge:null,ageStatus:'Molecular cloud',weight:p.mass,source:'Fukui2008 NANTEN',notes:Number.isFinite(p.radius)?'Effective-radius compact-cloud prior':'Unresolved radius: adopted 20 pc upper-scale prior',radiusPc:radius,massMsun:p.mass});
 }
 const refinements:CatalogueRow[]=[],parentLum=new Map<number,number>();
 for(const s of magma){const radius=value(s,45,49,true);if(!(radius>0))continue;const ids=(text(s,122,128).match(/\d+/gu)??[]).map(Number).filter(i=>parents.has(i)),lco=value(s,69,74)*100,major=value(s,28,32),minor=value(s,34,38,true),ratio=Number.isFinite(minor)&&minor>0?Math.max(1,major/minor):1;
  for(const id of ids)parentLum.set(id,(parentLum.get(id)??0)+lco);
  refinements.push({id:`MAGMA-${text(s,1,4)}`,kind:'molecular',aliases:[text(s,130,134)].filter(Boolean),ra:value(s,6,11),dec:value(s,13,19),majorArcmin:2*1.6*radius*Math.sqrt(ratio)/49590*180/Math.PI*60,minorArcmin:2*1.6*radius/Math.sqrt(ratio)/49590*180/Math.PI*60,pa:value(s,41,43),logAge:null,ageStatus:'Molecular cloud',weight:lco,source:'Wong2011 MAGMA islands',notes:'Relative CO weights; 2013 erratum affects velocity-width labels only',parentIds:ids,radiusPc:radius});
 }
 for(const r of refinements){const mass=r.parentIds!.length?r.parentIds!.reduce((a,id)=>a+parents.get(id)!.massMsun!*r.weight/parentLum.get(id)!,0):r.weight*15.2;r.massMsun=mass;r.weight=mass;rows.push(r);}
 for(const [id,r]of parents)if(!parentLum.has(id))rows.push(r);
 const filtered=rows.filter(r=>lmc(r.ra,r.dec)&&Number.isFinite(r.weight)&&r.weight>0&&r.majorArcmin>0&&r.minorArcmin>0);
 const seenIds=new Set<string>();for(const r of filtered){need(!seenIds.has(r.id),`Duplicate canonical catalogue ID ${r.id}`);seenIds.add(r.id);}
 const metadata={catalogueCounts:Object.fromEntries(['cluster','association','nebula','supershell','molecular'].map(k=>[k,filtered.filter(r=>r.kind===k).length])),measuredAges:filtered.filter(r=>r.logAge!==null).length,unknownAges:filtered.filter(r=>(r.kind==='cluster'||r.kind==='association')&&r.logAge===null).length,rejectedKimShells:rejectedShells,molecularMassMsun:filtered.filter(r=>r.kind==='molecular').reduce((a,b)=>a+b.weight,0),selection:'LMC catalogue bounds: RA 65..100, declination -75.5..-62 degrees. MAGMA replaces covered NANTEN parents without adding the same mass twice.'};
 await writeFile(L11+'catalogues.json',JSON.stringify({rows:filtered,metadata},null,2)+'\n');return{rows:filtered,metadata};
}
