import { resolve } from 'node:path';
import { requireRecord, requireArray, requireFiniteNumber, requireString } from '../../sources/source-values.mts';
import { readOracleFixture, readOracleInput, ORACLE_ROOT, verifyOracleBytes } from '../fixture.mts';
import { parsePdsVertexFacetShape } from '../../objects/terrestrial-layers/obj-shape.mts';
import { readFitsImage } from '../../fits/fits.mts';
import { readPointing, camera } from './candidate.mts';
import { cases, parseCase, vector, assertQueryCoverage, orientations } from './cases.mts';
import { runtimeLock, hashFile, generatorFingerprint } from './runtime.mts';

export const tolerances = Object.freeze({ positionKm: .00005, direction: 1e-10, projectionPixels: .25 });
export interface Stage { name: string; status: 'match'|'different'; compared: number; maximumError: number; tolerance: number; failures: string[] }
function stage(name: string, tolerance: number) {
  const result: Stage = {name,status:'match',compared:0,maximumError:0,tolerance,failures:[]};
  return { result, check(error: number, label: string) {
    result.compared++;
    if (!Number.isFinite(error) || error < 0) throw new Error(`Invalid ${name} comparison: ${label}`);
    result.maximumError=Math.max(result.maximumError,error);
    if(error>tolerance){result.status='different'; if(result.failures.length<8)result.failures.push(label);}
  } };
}
export async function compare(selectedIds?: readonly string[]) {
  const fixture=await readOracleFixture('sbmt/projection.json'), definitions=await cases();
  const expectedIds=definitions.map(c=>c.id).sort(), actualIds=Object.keys(fixture.cases).sort();
  if(JSON.stringify(expectedIds)!==JSON.stringify(actualIds))throw new Error('Missing or unexpected SBMT cases');
  if(selectedIds&&(!selectedIds.length||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!expectedIds.includes(id))))throw new Error('Unknown or duplicate comparison case selection');
  const input=async(path:string)=>{
    const pin=fixture.inputs.find(p=>p.path===path);
    if(!pin)throw new Error(`Unpinned SBMT comparison input: ${path}`);
    return readOracleInput(pin);
  };
  await input('tests/fixtures/sbmt/cases.json');
  const reports=[];
  // Group by shape and release each body before loading the next. No native
  // process, browser, download or prepared output is needed for comparisons.
  const selected=definitions.filter(c=>!selectedIds||selectedIds.includes(c.id));
  for(const shape of [...new Set(selected.map(c=>c.shape))]){
    const group=selected.filter(c=>c.shape===shape), first=group[0];
    const mesh=parsePdsVertexFacetShape((await input(shape)).toString(),{metersPerUnit:1000,expectedVertices:first.vertices,expectedFaces:first.faces});
    for(const c of group){
      const expected=requireRecord(fixture.cases[c.id]);
      if(JSON.stringify(parseCase(expected.definition))!==JSON.stringify(parseCase(c)))throw new Error('Case definition changed');
      const source=readPointing((await input(c.pointing)).toString(),c);
      const pointing=stage('pointing',tolerances.direction), geometry=stage('shape-and-visibility',tolerances.positionKm), pixels=stage('FITS-samples',0), uv=stage('in-image-UV',tolerances.projectionPixels);
      const expectedOrigin=vector(expected.origin), expectedFrustum=requireArray(expected.frustum).map(v=>vector(v));
      if(expectedFrustum.length!==4)throw new Error('Incomplete native frustum');
      source.origin.forEach((v,i)=>pointing.check(Math.abs(v-expectedOrigin[i]),`origin[${i}]`));
      source.frustum.forEach((r,j)=>r.forEach((v,i)=>pointing.check(Math.abs(v-expectedFrustum[j][i]),`frustum[${j}][${i}]`)));
      for(const raw of requireArray(expected.shapeSamples)){
        const s=requireRecord(raw), i=requireFiniteNumber(s.index), p=vector(s.point);
        geometry.check(Math.hypot(...p.map((v,j)=>v-mesh.positions[i][j]/1000)),`source vertex ${i}`);
      }
      let hits=0,misses=0,occluded=0;
      for(const raw of assertQueryCoverage(expected.rays)){
        const r=requireRecord(raw), fraction=vector(r.fraction,2), direction=vector(r.direction), max=requireFiniteNumber(r.maximumDistance);
        const independent=source.frustum[0].map((v,i)=>v+fraction[0]*(source.frustum[1][i]-v)+fraction[1]*(source.frustum[2][i]-v));
        const length=Math.hypot(...independent);
        independent.forEach((v,i)=>pointing.check(Math.abs(v/length-direction[i]),`ray ${fraction}`));
        const ours=mesh.intersect(source.origin.map(v=>v*1000),direction,max*1000);
        const nativeHits=requireArray(r.hits).map(h=>vector(requireRecord(h).point));
        if(!nativeHits.length){misses++;geometry.check(ours?1:0,`off-limb ${fraction}`);continue;}
        hits++;if(nativeHits.length>1)occluded++;
        // VTK may return multiple intersections. The preparation contract is
        // the nearest visible surface, never the far side of a concave body.
        const nearest=nativeHits.sort((a,b)=>Math.hypot(...a.map((v,i)=>v-source.origin[i]))-Math.hypot(...b.map((v,i)=>v-source.origin[i])))[0];
        const oursPoint=ours?source.origin.map((v,i)=>v+direction[i]*ours.radius/1000):null;
        geometry.check(oursPoint?Math.hypot(...nearest.map((v,i)=>v-oursPoint[i])):1,`visible intercept ${fraction}`);
      }
      const image=readFitsImage(await input(c.image)), nativeImage=requireRecord(expected.image);
      pixels.check(image.width===c.width&&image.height===c.height?0:1,'dimensions');
      for(const raw of requireArray(nativeImage.samples)){
        const sample=requireRecord(raw), index=requireFiniteNumber(sample.index), value=requireFiniteNumber(sample.value);
        pixels.check(Math.abs(image.values[index]-value),`pixel ${index}`);
      }
      let outside=0,behind=0;const variants=requireArray(expected.uvCases);
      if(JSON.stringify(variants.map(v=>requireRecord(v).orientation))!==JSON.stringify([...orientations,'central-crop']))throw new Error('Missing UV orientation/crop cases');
      for(const raw of variants){
        const v=requireRecord(raw), width=requireFiniteNumber(v.width),height=requireFiniteNumber(v.height),orientation=requireString(v.orientation);
        const cam=camera(source.origin,requireArray(v.frustum).map(r=>vector(r)),width,height);
        for(const rawProbe of assertQueryCoverage(v.probes,true)){
          const p=requireRecord(rawProbe), fraction=vector(p.fraction,2), xy=cam.project(vector(p.point)), reference=vector(p.uv,2);
          if(p.depth===-1){if(xy[2]>=0)throw new Error('Behind-camera point accepted');behind++;continue;}
          if(fraction.some(f=>f<0||f>1)){
            // Outside the selected image has no photographic support. SBMT
            // clamps/mirrors these points; that is not our validity policy.
            if(xy[0]>=-1e-8&&xy[0]<=width-1+1e-8&&xy[1]>=-1e-8&&xy[1]<=height-1+1e-8)throw new Error('Off-image probe incorrectly projects inside');
            outside++;continue;
          }
          uv.check(Math.hypot(xy[0]-(reference[0]*width-.5),xy[1]-(reference[1]*height-.5)),`${orientation} ${fraction}`);
        }
      }
      const stages=[pointing.result,geometry.result,pixels.result,uv.result];
      if(stages.some(s=>s.compared===0)||!hits||!misses||!occluded||!outside)throw new Error(`Incomplete stage coverage for ${c.id}`);
      reports.push({id:c.id,status:stages.every(s=>s.status==='match')?'match':'different',stages,hits,misses,occluded,outside,behind,
        nativeFootprintCells:requireFiniteNumber(expected.footprintCells)});
    }
  }
  return {schema:'cssearth-sbmt-comparison@1',scope:selectedIds?'selected-cases':'all-cases',fixture:await hashFile(resolve(ORACLE_ROOT,'tests/oracles/sbmt/projection.json')),tolerances,cases:reports};
}
