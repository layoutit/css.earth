/** Bounded Gaia DR3/Bailer-Jones stellar neighbourhood intake, recorded by its archive query. */
import { GAIA_NEBULA_FIELD_SCHEMA } from '@cssearth/objects';
import { tapRows } from '@cssearth/telescope/node';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';

const arguments_=process.argv.slice(2), magnitudeOptions=arguments_.filter(value=>value.startsWith('--magnitude-limit='));
const magnitudeLimit=magnitudeOptions.length?Number(magnitudeOptions[0]!.split('=')[1]):null;
const twoStage=arguments_.includes('--two-stage');
const radiusOptions=arguments_.filter(value=>value.startsWith('--radius-pc='));
const radiusOverride=radiusOptions.length?Number(radiusOptions[0]!.split('=')[1]):null;
if(radiusOptions.length>1 || radiusOverride!==null&&(!Number.isFinite(radiusOverride)||radiusOverride<=0)) throw new Error('Invalid authored field radius.');
if(magnitudeOptions.length>1 || magnitudeLimit!==null&&(!Number.isFinite(magnitudeLimit) || magnitudeLimit<5 || magnitudeLimit>20)) throw new Error('Invalid catalogue magnitude limit.');
const ids = arguments_.filter(value=>!value.startsWith('--magnitude-limit=')&&!value.startsWith('--radius-pc=')&&value!=='--two-stage').map(value=>{
  const [id,limit,...rest]=value.split('@'),selectedLimit=limit===undefined?magnitudeLimit:Number(limit);
  if(!id || !/^[a-z][a-z0-9-]*$/.test(id) || rest.length || selectedLimit!==null&&(!Number.isFinite(selectedLimit) || selectedLimit<5 || selectedLimit>20)) throw new Error('Supply nebula object ids, optionally id@magnitude.');
  return {id,magnitudeLimit:selectedLimit};
});
if (!ids.length) throw new Error('Supply nebula object ids.');

const columns = ['source_id','ra','dec','pmra','pmdec','parallax','parallax_error','phot_g_mean_mag',
  'phot_bp_mean_mag','phot_rp_mean_mag','ruwe','r_med_geo','r_lo_geo','r_hi_geo'];
const xyz = (ra:number,dec:number,d:number) => [d*Math.cos(dec*Math.PI/180)*Math.cos(ra*Math.PI/180),
  d*Math.cos(dec*Math.PI/180)*Math.sin(ra*Math.PI/180),d*Math.sin(dec*Math.PI/180)];
function numeric(v:string|undefined, nullable=false): number|null {
  if (nullable && (v === undefined || v.trim() === '')) return null;
  const n = Number(v); if (!v?.trim() || !Number.isFinite(n)) throw new Error('Invalid Gaia numeric field.'); return n;
}
const service='https://dc.g-vo.org/tap';
const absent = (error:unknown) => error instanceof Error && 'code' in error && error.code==='ENOENT';
/** One query's rows in column order, asked and decoded by PyVO (the telescope's `tap-query`). A kept answer is reused only for the
 * query saved with it; any other query asks again. A query GAVO's synchronous limit cuts off runs as a job (`async`). */
async function acquire(object:string, id:string, query:string, limit:number, expectedColumns:readonly string[]=columns, mode?:'async') {
  const cache=`src/objects/${object}/.local/stars/${id}.json`;await mkdir(`src/objects/${object}/.local/stars`,{recursive:true});
  const saved:unknown=await readFile(cache,'utf8').then(text=>JSON.parse(text),(error:unknown)=>{if(absent(error)) return null;throw error;});
  if(saved && typeof saved==='object' && 'query' in saved && saved.query===query && 'rows' in saved && Array.isArray(saved.rows))
    return {rows:saved.rows.map(row=>catalogueRow(row,expectedColumns)),cache,retrievedAt:(await stat(cache)).mtime.toISOString()};
  // One row past the query's own bound, so the archive's row limit never cuts an answer the query already bounds.
  const rows=(await tapRows(service,query,limit+1,mode)).map(row=>catalogueRow(expectedColumns.map(name=>row[name]),expectedColumns));
  await writeFile(`${cache}.pending`,JSON.stringify({query,rows})+'\n');await rename(`${cache}.pending`,cache);
  return {rows,cache,retrievedAt:new Date().toISOString()};
}
function catalogueRow(cells:unknown, expectedColumns:readonly string[]) {
  if(!Array.isArray(cells) || cells.length!==expectedColumns.length || !cells.every((cell):cell is string=>typeof cell==='string') || !/^\d{10,20}$/.test(cells[0]!))
    throw new Error('Invalid catalogue row.');
  return cells;
}
async function acquireInTwoStages(id:string, query:string, gaiaColumns:readonly string[]) {
  const candidateLimit=50000,gaia=await acquire(id,`${id}-gaia`,query,candidateLimit,gaiaColumns,'async'),rows=gaia.rows;
  if(rows.length>=candidateLimit) throw new Error(`${id}: unordered Gaia candidate query reached its ${candidateLimit}-row cap; refusing an incomplete selection.`);
  const sourceIds=rows.map(row=>row[0]!);
  if(new Set(sourceIds).size!==sourceIds.length) throw new Error('Duplicate Gaia source ids.');
  const distances=new Map<string,string[]>(),acquisitions:Array<{cache:string;query:string;queryUrl:string;retrievedAt:string;rows:number}>=[];
  acquisitions.push({cache:gaia.cache,query,queryUrl:service,retrievedAt:gaia.retrievedAt,rows:rows.length});
  // Exact indexed ID lookups only, one batch at a time. Outer object concurrency bounds the archive requests to three.
  const batchSize=1000,distanceColumns=['source_id','r_med_geo','r_lo_geo','r_hi_geo'];
  for(let offset=0;offset<sourceIds.length;offset+=batchSize) {
    const batch=sourceIds.slice(offset,offset+batchSize),distanceQuery=`SELECT ${distanceColumns.join(',')} FROM gedr3dist.main WHERE source_id IN (${batch.join(',')})`;
    const acquired=await acquire(id,`${id}-distance-${offset/batchSize+1}`,distanceQuery,batch.length,distanceColumns);
    for(const record of acquired.rows){if(distances.has(record[0]!)) throw new Error('Duplicate Bailer-Jones source id.');distances.set(record[0]!,record.slice(1));}
    acquisitions.push({cache:acquired.cache,query:distanceQuery,queryUrl:service,retrievedAt:acquired.retrievedAt,rows:acquired.rows.length});
    console.log(`CATALOGUE_DISTANCE_BATCH ${id} ${Math.min(offset+batchSize,sourceIds.length)}/${sourceIds.length}`);
  }
  const matched=rows.flatMap(row=>{const distance=distances.get(row[0]!);return distance?[[...row,...distance]]:[];});
  return {rows:matched,cache:gaia.cache,retrievedAt:gaia.retrievedAt,acquisitions,candidateRows:rows.length,
    candidateLimit,candidateTruncated:rows.length===candidateLimit,missingDistances:rows.length-matched.length};
}
async function prepare(id:string,explicitMagnitudeLimit:number|null) {
  const raw:unknown=JSON.parse(await readFile(`src/objects/${id}/source/delivery.json`,'utf8'));
  if (!raw || typeof raw!=='object' || !('sky' in raw) || !('framingRadiusUnits' in raw)) throw new Error('Missing delivery sky frame.');
  const s=raw.sky;
  if (!s || typeof s!=='object' || !('centerIcrsDegrees' in s) || !Array.isArray(s.centerIcrsDegrees) ||
      !s.centerIcrsDegrees.every(v=>typeof v==='number'&&Number.isFinite(v)) || s.centerIcrsDegrees.length!==2 ||
      !('distancePc' in s) || typeof s.distancePc!=='number' || !(s.distancePc>0) || typeof raw.framingRadiusUnits!=='number') throw new Error('Invalid source sky frame.');
  const [ra,dec]=s.centerIcrsDegrees, distance=s.distancePc;
  if(typeof ra!=='number' || typeof dec!=='number' || ra<0 || ra>=360 || Math.abs(dec)>90) throw new Error('Invalid ICRS source direction.');
  let previousRadius:number|null=null,previousMagnitude:number|null=null;
  let previousRetainIds:string[]|null=null,previousRetainedMatch:number|undefined;
  let previousRetainedAppearance:'anchor'|'dataset'|undefined;
  let previousRetainedSources:string|null|undefined,previousImageAnchors:object|undefined;
  try {
    const previous:unknown=JSON.parse(await readFile(`src/objects/${id}/source/stellar-field.json`,'utf8'));
    if(!previous || typeof previous!=='object' || !('schema' in previous) || previous.schema!==GAIA_NEBULA_FIELD_SCHEMA || !('id' in previous) || previous.id!==id || !('selection' in previous)) throw new Error('Invalid existing stellar-field identity.');
    const selection=previous.selection;
    if(!selection || typeof selection!=='object' || !('outerRadiusPc' in selection) || typeof selection.outerRadiusPc!=='number' || !Number.isFinite(selection.outerRadiusPc) || selection.outerRadiusPc<=0 || !('limitingMagnitude' in selection) || typeof selection.limitingMagnitude!=='number' || !Number.isFinite(selection.limitingMagnitude) || selection.limitingMagnitude<5 || selection.limitingMagnitude>20) throw new Error('Invalid existing stellar-field selection.');
    previousRadius=selection.outerRadiusPc;previousMagnitude=selection.limitingMagnitude;
    if(!('retainIds' in selection) || !Array.isArray(selection.retainIds) ||
      !selection.retainIds.every((id):id is string=>typeof id==='string'&&id.trim().length>0) ||
      new Set(selection.retainIds).size!==selection.retainIds.length || selection.retainIds.length>2000)
      throw new Error('Invalid existing retained stellar identities.');
    previousRetainIds=selection.retainIds;
    if('retainedMatchArcsec' in selection) {
      if(typeof selection.retainedMatchArcsec!=='number' || !Number.isFinite(selection.retainedMatchArcsec) ||
        selection.retainedMatchArcsec<0 || selection.retainedMatchArcsec>648000) throw new Error('Invalid existing retained-star match radius.');
      previousRetainedMatch=selection.retainedMatchArcsec;
    }
    if('retainedAppearance' in selection) {
      if(selection.retainedAppearance!=='anchor' && selection.retainedAppearance!=='dataset') throw new Error('Invalid existing retained-star appearance.');
      previousRetainedAppearance=selection.retainedAppearance;
    }
    if('provenance' in previous) {
      const provenance=previous.provenance;
      if(!provenance || typeof provenance!=='object' || Array.isArray(provenance)) throw new Error('Invalid existing stellar provenance.');
      if('retainedSources' in provenance) {
        if(provenance.retainedSources!==null && typeof provenance.retainedSources!=='string') throw new Error('Invalid retained-star provenance.');
        previousRetainedSources=provenance.retainedSources;
      }
      if('imageAnchors' in provenance) {
        const anchors=provenance.imageAnchors;
        if(!anchors || typeof anchors!=='object' || Array.isArray(anchors)) throw new Error('Invalid image-anchor provenance.');
        previousImageAnchors=anchors;
      }
    }
  } catch(error){if(!absent(error))throw error;}
  const radius=radiusOverride??previousRadius??Math.min(200,Math.max(50,10*raw.framingRadiusUnits*distance*Math.PI/648000));
  const magnitudeLimit=explicitMagnitudeLimit??previousMagnitude??16;
  if(radius>=distance) throw new Error('The authored sphere must not contain the observer.');
  const cone=Math.asin(radius/distance)*180/Math.PI, center=xyz(ra,dec,distance), limit=8000;
  // GAVO documents this CTE and SELECT ALL (its OFFSET 0 extension) as planner fences.
  // Apply the physical sphere before TOP so the bounded rows are the sphere's brightest sources.
  const gaiaColumns=columns.slice(0,-3);
  const gaiaWhere=`1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${cone})) AND phot_g_mean_mag<${magnitudeLimit} AND ruwe<1.4 AND parallax>5*parallax_error`;
  const query=twoStage?`SELECT TOP 50000 ${gaiaColumns.join(',')} FROM gaia.dr3lite WHERE ${gaiaWhere}`:
    `WITH candidates AS (SELECT ALL ${gaiaColumns.join(',')} FROM gaia.dr3lite WHERE `+
    `1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${cone})) `+
    `AND phot_g_mean_mag<${magnitudeLimit} AND ruwe<1.4 AND parallax>5*parallax_error) `+
    `SELECT TOP ${limit} ${gaiaColumns.map(name=>`c.${name}`).join(',')},r_med_geo,r_lo_geo,r_hi_geo `+
    'FROM candidates AS c JOIN gedr3dist.main AS d ON c.source_id=d.source_id '+
    `WHERE r_med_geo BETWEEN ${distance-radius} AND ${distance+radius} `+
    `AND POWER(r_med_geo,2)+${distance*distance}-2*r_med_geo*${distance}*COS(RADIANS(DISTANCE(POINT('ICRS',c.ra,c.dec),POINT('ICRS',${ra},${dec}))))<${radius*radius} `+
    'ORDER BY phot_g_mean_mag,c.source_id';
  const staged=twoStage?await acquireInTwoStages(id,query,gaiaColumns):null;
  const {rows:lines,cache,retrievedAt}=staged??await acquire(id,id,query,limit,columns,'async');
  const truncated=staged?staged.candidateTruncated:false;
  const stars=lines.map(cells=>{
    const values=cells.slice(1).map(v=>numeric(v,true));
    const [raDeg,decDeg,pmRaMasYr,pmDecMasYr,parallaxMas,parallaxErrorMas,photGMeanMag,bp,rp,ruwe,distancePc,distanceLowerPc,distanceUpperPc]=values;
    if ([raDeg,decDeg,parallaxMas,parallaxErrorMas,photGMeanMag,ruwe,distancePc,distanceLowerPc,distanceUpperPc].some(v=>v===null||v===undefined)) throw new Error('Missing required Gaia value.');
    const position=xyz(raDeg!,decDeg!,distancePc!);
    return {sourceId:cells[0]!,raDeg:raDeg!,decDeg:decDeg!,pmRaMasYr:pmRaMasYr??null,pmDecMasYr:pmDecMasYr??null,
      parallaxMas:parallaxMas!,parallaxErrorMas:parallaxErrorMas!,photGMeanMag:photGMeanMag!,bpRp:bp!=null&&rp!=null?bp-rp:null,
      ruwe:ruwe!,distancePc:distancePc!,distanceLowerPc:distanceLowerPc!,distanceUpperPc:distanceUpperPc!,
      separation:Math.hypot(...position.map((v,i)=>v-center[i]!))};
  }).filter(star=>star.separation<radius).sort((a,b)=>a.photGMeanMag-b.photGMeanMag || a.sourceId.localeCompare(b.sourceId))
    .map(({separation:_separation,...star})=>star);
  if (!stars.length) throw new Error(`${id}: no qualified stars in the 3D neighbourhood.`);
  const field={schema:GAIA_NEBULA_FIELD_SCHEMA,id,coordinateEpochJulianYear:2016,
    selection:{centerIcrsDegrees:[ra,dec],distancePc:distance,outerRadiusPc:radius,featherStartPc:radius*.65,
      limitingMagnitude:magnitudeLimit,fadeMagnitude:1.5,maximumStars:1500,
      retainIds:previousRetainIds??(id==='m1'?['crab-pulsar']:id==='m45'?['HIP 17702','HIP 17847','HIP 17499','HIP 17573','HIP 17608','HIP 17531','HIP 17851','HIP 17579']:[]),
      ...(previousRetainedMatch!==undefined?{retainedMatchArcsec:previousRetainedMatch}:id==='m1'||id==='m45'?{retainedMatchArcsec:3}:{}),
      ...(previousRetainedAppearance===undefined?{}:{retainedAppearance:previousRetainedAppearance}),
      referenceMagnitude:10,referenceDiameterPx:.05,referenceFocalPixels:1000},stars,
    provenance:{catalogue:'Gaia DR3 astrometry/photometry + Bailer-Jones et al.2021 EDR3 geometric distances',
      sourceUrl:'https://dc.zah.uni-heidelberg.de/tableinfo/gedr3dist.litewithdist',
      paperUrl:'https://doi.org/10.3847/1538-3881/abd806',credit:'ESA/Gaia/DPAC; Bailer-Jones, Rybizki, Fouesneau, Demleitner and Andrae (2021); GAVO',
      license:'CC-BY-4.0',queryUrl:service,query,cache,
      retrievedAt,queryRows:lines.length,truncated:twoStage?truncated:lines.length===limit,
      authoredRadiusPc:radius,radiusSelection:radiusOverride!==null?'Explicit physical neighbourhood radius selected for the displayed surrounding field; independent of image or cloud bounds.':previousRadius!==null?'Reused the physical neighbourhood radius from the existing checked-in field selection.':'Ten times the configured angular framing radius at the nebula distance, bounded to 50–200 pc.',
      ...(staged?{acquisitions:staged.acquisitions,candidateRows:staged.candidateRows,candidateLimit:staged.candidateLimit,missingDistances:staged.missingDistances}:{}),
      plannerReference:'https://dc.g-vo.org/tap/examples#tricking-the-query-planner',
      brightestMagnitude:stars[0]!.photGMeanMag,faintestMagnitude:stars.at(-1)!.photGMeanMag,
      selection:twoStage?'Authored spherical neighbourhood with radial taper. RUWE<1.4 and parallax/error>5; qualified Gaia cone query without archive sorting, then exact source-id Bailer-Jones lookups, local physical-sphere filtering and brightness sorting. Reaching the 50000-candidate cap is an error, so published inputs preserve the complete query selection. Distance medians and 16/84 percentiles retained; no cluster membership inferred.':'Authored spherical neighbourhood with radial taper. RUWE<1.4 and parallax/error>5; physical sphere filtered before brightness-ordered TOP 8000. Distance medians and 16/84 percentiles retained; no cluster membership inferred.',
      ...(previousImageAnchors===undefined?{}:{imageAnchors:previousImageAnchors}),
      retainedSources:previousRetainedSources!==undefined?previousRetainedSources:id==='m45'?'Eight explicitly named major HIP stars retained from the existing scene because Gaia may omit saturated bright sources. Their existing depths remain inferred; they are not Bailer-Jones catalogue distances.':id==='m1'?'The explicitly named Crab pulsar retains its prior scene placement; surrounding Gaia field rows use Bailer-Jones median distances.':null}};
  const path=`src/objects/${id}/source/stellar-field.json`, text=JSON.stringify(field,null,2)+'\n';await writeFile(path,text);
  console.log(JSON.stringify({id,stars:stars.length,radiusPc:radius,queryRows:lines.length,truncated:twoStage?truncated:lines.length===limit,path,bytes:text.length}));
}
// Three independent staged object acquisitions; each has only one active archive request.
const concurrency=twoStage?3:2;
for(let i=0;i<ids.length;i+=concurrency) {
  const results=await Promise.allSettled(ids.slice(i,i+concurrency).map(({id,magnitudeLimit})=>prepare(id,magnitudeLimit)));
  for(const result of results) if(result.status==='rejected') throw result.reason;
}
console.log('NEBULA_FIELD_CATALOGUES_COMPLETE');
