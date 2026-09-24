import { sha256 } from '@cssearth/core/node';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';

type RecordValue=Record<string,unknown>;
type CubeSource={file:string;sha256:string;commitUrl:string};

const sources:CubeSource[]=[
  {file:'reflectance_SPHERE-2015-02-01.json.gz',sha256:'c29b41c90f438c601672487dc7d0978aa22e8557e3eb200cdb8866186534f3b7',commitUrl:'https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/reflectance_SPHERE-2015-02-01.json.gz'},
  {file:'reflectance_SPHERE-2021-07-21.json.gz',sha256:'8ec367d96316c9de2f2f29a81d689aba7cd1a0c63bfedf74acd6e796f89accb7',commitUrl:'https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/reflectance_SPHERE-2021-07-21.json.gz'},
  {file:'reflectance_SPHERE-2021-07-22.json.gz',sha256:'861edecda689fc1a35063f36b16613464599efcf3f6a18dbe1dfd6c11ff8bc9d',commitUrl:'https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/reflectance_SPHERE-2021-07-22.json.gz'},
  {file:'reflectance_SPHERE-2021-09-05.json.gz',sha256:'451dc54e85c8b86d12ed16e3c2bdd974156772c0a8fc0461e93788e6ed90b67d',commitUrl:'https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/reflectance_SPHERE-2021-09-05.json.gz'},
];
const fit={file:'fit_SPHERE.json.gz',sha256:'cd7843ce36dcf64782907b29c34b7bfb61937288ffb99fd3ee38e2369261c8e4',commitUrl:'https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/fit_SPHERE.json.gz'};
const cells=180*360;
const record=(value:unknown):RecordValue=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected source record.');
  return value as RecordValue;
};
const array=(value:unknown,length:number,label:string):unknown[]=>{
  if(!Array.isArray(value)||value.length!==length)throw new TypeError(`Expected ${label}.`);
  return value;
};

async function documentAt(path:string,expectedHash:string):Promise<RecordValue>{
  const bytes=await readFile(path);
  if(sha256(bytes)!==expectedHash)throw new Error(`Pinned source hash changed: ${path}`);
  return record(JSON.parse(gunzipSync(bytes).toString('utf8')));
}
function maskFromCube(document:RecordValue):boolean[]{
  const metadata=record(document.metadata),wavelengths=array(metadata.wavelengths,41,'41 native wavelengths');
  const selected=wavelengths.map((raw,index)=>({raw,index})).filter(({raw})=>typeof raw==='number'&&raw>=.95&&raw<=1.65);
  if(selected.length!==39)throw new TypeError('Expected the 39 published 0.95–1.65 micrometre IFS bands.');
  const cube=array(document.cube,41,'41 native cube bands');
  const mask=Array<boolean>(cells).fill(true);
  for(const {index}of selected){
    const rows=array(cube[index],180,'180 latitude rows');
    for(let y=0;y<180;y++){
      const row=array(rows[y],360,'360 longitude columns');
      for(let x=0;x<360;x++){
        const value=row[x];
        if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Non-numeric reflectance sample.');
        if(value===-99)mask[y*360+x]=false;
      }
    }
  }
  return mask;
}
function fitMask(document:RecordValue):boolean[]{
  const abundance=record(document.best_estimate_abundance),rows=array(abundance.derived_total_ices,180,'fit latitude rows');
  const mask:boolean[]=[];
  for(let y=0;y<180;y++)for(const value of array(rows[y],360,'fit longitude columns')){
    if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Non-numeric fitted sample.');
    mask.push(value!==-99);
  }
  return mask;
}
const count=(mask:boolean[])=>mask.filter(Boolean).length;

export async function ganymedeCompositionCoverage(root:string,fitPath:string){
  const reflectanceMasks:boolean[][]=[];
  for(const source of sources)reflectanceMasks.push(maskFromCube(await documentAt(resolve(root,source.file),source.sha256)));
  const modelMask=fitMask(await documentAt(fitPath,fit.sha256));
  const union=Array.from({length:cells},(_,index)=>reflectanceMasks.some(mask=>mask[index]));
  const intersection=union.map((covered,index)=>covered&&modelMask[index]);
  const sourceOnly=union.map((covered,index)=>covered&&!modelMask[index]);
  const fitOnly=modelMask.map((covered,index)=>covered&&!union[index]);
  const excludedFitCoordinates=sourceOnly.flatMap((excluded,index)=>excluded?[{latitude:Math.floor(index/360)-90,longitude:index%360}]:[]);
  if(count(union)!==38478||count(modelMask)!==38473||count(intersection)!==38473||count(sourceOnly)!==5||count(fitOnly)!==0)
    throw new Error('Published coverage relationship changed.');
  return {
    schema:'cssearth-ganymede-sphere-composition-coverage@1',
    command:'node --experimental-strip-types tools/objects/acquisition/mapped-composition-coverage.mts output/moon-composition/source-review src/objects/ganymede/source/composition/fit_SPHERE.json.gz > src/objects/ganymede/evidence/composition/registration.json',
    grid:{latitudeNodes:'-90 through 89 degrees',longitudeNodes:'0 through 359 degrees east-positive',cells},
    fittingBandsMicrometres:[.95,1.65],
    sources:sources.map(source=>({...source,validNodes:count(reflectanceMasks[sources.indexOf(source)])})),
    fit:{...fit,field:'derived_total_ices',validNodes:count(modelMask)},
    comparison:{reflectanceUnionNodes:count(union),fitNodes:count(modelMask),intersectionNodes:count(intersection),reflectanceOnlyNodes:count(sourceOnly),fitOnlyNodes:count(fitOnly),excludedFitCoordinates},
    interpretation:'The fitted-map mask equals the union of the four 0.95–1.65 micrometre reflectance-footprint masks except for these five 2015 nodes. This establishes coverage correspondence with the all-epoch union despite the fit metadata naming the 2015 observation. It does not show which epoch contributed to an individual fitted cell, the relative contribution of epochs, or any quality filtering beyond the compared masks.'
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [root,fitPath]=process.argv.slice(2);
  if(!root||!fitPath)throw new Error('Usage: node --experimental-strip-types mapped-composition-coverage.mts <source-cube-directory> <fit_SPHERE.json.gz>');
  process.stdout.write(`${JSON.stringify(await ganymedeCompositionCoverage(root,fitPath),null,2)}\n`);
}
