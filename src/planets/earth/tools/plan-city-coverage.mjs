#!/usr/bin/env node
// Read-only preflight: no imagery download, source mutation or scene publishing.
import { readFile, mkdir, writeFile, statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PREPARED_EARTH_SCENE } from '../runtime/preparedScene.mjs';
import { readWorldCoverCatalog } from './city/worldcover-catalog.mjs';
import { cityCoverageRoots, planCityCoverage } from './city/plan-coverage.mjs';
import { CITY_PAGE_PIXELS, pageKey } from './city/page-geometry.mjs';

const {pin,entries}=await readWorldCoverCatalog();
const root=resolve(import.meta.dirname,'../../../..');
const ancestors=new Set(),sourceTiles=new Set();
const summary={schema:'cssearth-city-coverage-preflight@1',dataset:pin.dataset,
  catalogSha256:pin.expectedSha256,qualification:'Catalog-based source-window jobs, not prepared or valid-pixel coverage.',
  jobs:0,jobsByLevel:{},jobsWithUnavailableSourceTiles:0,blockedJobs:0,blockedExamples:[],
  maximumWindowPixels:0,pagesByLevelUpperBound:{},sourceWindowPixels:0,
  faceBuild:{acceptedFaces:cityCoverageRoots().length,nonemptyFaces:0,maximumJobs:0,
    maximumJobsFace:null,maximumPages:0,maximumPagesFace:null,
    maximumLosslessCoreRgbaBytes:0,maximumLosslessCoreRgbaBytesFace:null}};
for(const face of cityCoverageRoots()) {
  const faceAncestors=new Set(),faceSourceRoots=new Set();
  let faceJobs=0,faceFinePages=0;
  for(const job of planCityCoverage(PREPARED_EARTH_SCENE,entries,[face])) {
    faceJobs++;
    summary.jobs++;
    summary.jobsByLevel[job.root.level]=(summary.jobsByLevel[job.root.level]??0)+1;
    summary.jobsWithUnavailableSourceTiles+=Number(job.unavailableTiles.length>0);
    summary.maximumWindowPixels=Math.max(summary.maximumWindowPixels,job.window.pixels);
    summary.sourceWindowPixels+=job.window.pixels;
    for(const source of job.sources)sourceTiles.add(source.tile);
    if(job.blocked) {
      summary.blockedJobs++;
      if(summary.blockedExamples.length<10)summary.blockedExamples.push({id:job.id,window:job.window});
      continue;
    }
    for(let level=job.root.level;level<=job.lastLevel;level++) {
      const count=4**(level-job.root.level);
      summary.pagesByLevelUpperBound[level]=(summary.pagesByLevelUpperBound[level]??0)+count;
      faceFinePages+=count;
    }
    faceSourceRoots.add(job.id);
    for(let level=0;level<job.root.level;level++) {
      const factor=2**(job.root.level-level);
      const key=`${level}-${Math.floor(job.root.x/factor)}-${Math.floor(job.root.y/factor)}`;
      ancestors.add(key);faceAncestors.add(key);
    }
  }
  if(faceJobs) {
    const pages=faceFinePages+faceAncestors.size;
    const losslessCores=faceSourceRoots.size+faceAncestors.size;
    summary.faceBuild.nonemptyFaces++;
    const coreBytes=losslessCores*CITY_PAGE_PIXELS*CITY_PAGE_PIXELS*4;
    if(faceJobs>summary.faceBuild.maximumJobs) {
      summary.faceBuild.maximumJobs=faceJobs;summary.faceBuild.maximumJobsFace=pageKey(face);
    }
    if(pages>summary.faceBuild.maximumPages) {
      summary.faceBuild.maximumPages=pages;summary.faceBuild.maximumPagesFace=pageKey(face);
    }
    if(coreBytes>summary.faceBuild.maximumLosslessCoreRgbaBytes) {
      summary.faceBuild.maximumLosslessCoreRgbaBytes=coreBytes;
      summary.faceBuild.maximumLosslessCoreRgbaBytesFace=pageKey(face);
    }
  }
}
for(const key of ancestors) {
  const level=key.split('-')[0];
  summary.pagesByLevelUpperBound[level]=(summary.pagesByLevelUpperBound[level]??0)+1;
}
summary.pagesUpperBound=Object.values(summary.pagesByLevelUpperBound).reduce((a,b)=>a+b,0);
summary.sourceObjectsReferenced=sourceTiles.size;
summary.sourceObjectBytes=[...sourceTiles].reduce((sum,tile)=>sum+entries.get(tile).sourceBytes,0);
const disk=await statfs(root);
summary.localAvailableBytes=disk.bavail*disk.bsize;
const fixture=JSON.parse(await readFile(resolve(root,'output/earth-city',pin.dataset,'manifest.json'),'utf8'));
const fine=fixture.pages.filter(page=>page.level>=5).map(page=>page.bytes).sort((a,b)=>a-b);
summary.sampleExtrapolation={qualification:'Eight-region sample only; not a global compression measurement or storage guarantee.',
  samplePages:fine.length,medianFinePageBytes:fine[Math.floor(fine.length/2)],
  finePageUpperBound:Object.entries(summary.pagesByLevelUpperBound).filter(([level])=>Number(level)>=5).reduce((sum,[,count])=>sum+count,0)};
summary.sampleExtrapolation.compressedFineBytes=summary.sampleExtrapolation.medianFinePageBytes*summary.sampleExtrapolation.finePageUpperBound;
const output=resolve(root,'output/earth-city/global-coverage-preflight.json');
await mkdir(resolve(root,'output/earth-city'),{recursive:true});
await writeFile(output,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,output},null,2));
