// Small compatibility check using the unchanged production observation reader.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fromFile} from 'geotiff';
import {prepareRgbBandObservation} from '../../../tools/objects/terrestrial-layers/observed-geotiff.mjs';
const body=process.argv[2];
assert(['iapetus','tethys','phoebe'].includes(body));
const root=`src/planets/${body}/source/cassini-ice`;
const recipe=JSON.parse(await readFile(`${root}/prepare.json`));
const path=`${root}/${recipe.outputs.rgbDisplay}`;
const file=await fromFile(path);
let planes,origin,resolution;
try{const image=await file.getImage();planes=await image.readRasters();origin=image.getOrigin();resolution=image.getResolution();}finally{await file.close();}
const entry={id:'infrared',width:recipe.width,height:recipe.height,projection:{referenceRadiusMeters:recipe.radiusMeters}};
const policy={kind:'geotiff-rgb-bands',samples:[0,1,2],alphaBand:3,sampleBytes:2,noData:0,centerLongitude:180,
  resolutionMeters:resolution[0],origin:origin.slice(0,2),grid:{
    pixelsPerDegree:recipe.width/360,
    sampleOffset:recipe.width/2-.5,lineOffset:recipe.height/2-.5}};
const result=await prepareRgbBandObservation(path,entry,policy,recipe.width,recipe.height);
let originalValid=0,retained=0,withheld=0,maximumByteError=0;
for(let i=0;i<planes[0].length;i++){
  const valid=planes[3][i]===65535;
  originalValid+=valid;
  if(result.missing[i]){withheld+=valid;continue;}
  assert(valid,'The display reader admitted a source gap.');
  retained++;
  for(let c=0;c<3;c++)maximumByteError=Math.max(maximumByteError,Math.abs(result.rgb[i*3+c]-Math.round(planes[c][i]*255/65535)));
}
assert.equal(maximumByteError,0,'The unchanged reader must preserve these aligned display codes.');
assert(retained>0);
assert.equal(withheld,0,'Aligned display decoding must preserve every supported source sample.');
const receipt={body,sourceSha256:createHash('sha256').update(await readFile(path)).digest('hex'),
  dimensions:[recipe.width,recipe.height],policy,originalValid,retained,withheld,
  maximumByteError,longitudeConvention:'0..360 east, source derivative rolled from the lossless -180..180 map',
  limits:'Grid-edge samples withheld by the existing reader remain gaps; this is source-map decoder evidence, not mounted browser proof.'};
await writeFile(`docs/moons/b9-cassini-ice-surfaces/source-review/${body}/display-reader-receipt.json`,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
