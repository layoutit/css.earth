import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseVolumeRecipe } from './config.js';
import { loadVolumeSource, sampleEncoded, decodeDensityKtx2, containedPath, sha256 } from './source.js';
import { parseVolumeAcquisition, reduceRawVolume, encodeDensityKtx2 } from './acquisition.js';
import { bakeSlab, channelDensity, slabStepSize, withinVolumeSupport } from './slices.js';
import { encodeVolumeRaster } from './raster.js';
import sharp from 'sharp';
import './retirement.test.js';
import { sunBarycentricAu, M_PER_AU } from '@cssearth/astronomy';
const sourceDirectory = 'src/objects/milky-way/source';
const readRecipe = async () => parseVolumeRecipe(JSON.parse(await readFile(`${sourceDirectory}/volume.json`, 'utf8')) as unknown);

test('OpenSpace Galactic placement, rotation, physical extent and Sun offset match its pinned asset', async () => {
  const descriptor=JSON.parse(await readFile('src/objects/milky-way/object.json','utf8')) as {properties:{volume:{originM:number[];epochJdTt:number;localToReferenceXyzw:number[];metersPerUnit:number;boundsUnits:{min:number[];max:number[]}}}};
  const provenance=JSON.parse(await readFile(`${sourceDirectory}/provenance.json`,'utf8')) as {frame:{centerIcrfM:number[];rotationRadians:number[];fullExtentM:number[]};references:{path:string;sha256:string}[]};
  for (const reference of provenance.references) assert.equal(sha256(await readFile(`${sourceDirectory}/${reference.path}`)),reference.sha256);
  const asset=await readFile(`${sourceDirectory}/openspace/volume.asset`,'utf8');
  assert.match(asset,/KiloParsec = 3\.086E19/);assert.match(asset,/8 \* KiloParsec, 0, 0/);
  assert.match(asset,/1\.2E21, 1\.2E21, 0\.15E21/);
  assert.match(asset,/3\.1248, 4\.45741/);
  // Published Hipparcos Galactic-to-ICRF matrix, independently tabulated rather than copied from descriptor.
  const gal=[-.0548755604162154,.4941094278755837,-.8676661490190047,
    -.8734370902348850,-.4448296299600112,-.1980763734312015,
    -.4838350155487132,.7469822444972189,.4559837761750669];
  const recorded=provenance.frame.centerIcrfM;
  for(let axis=0;axis<3;axis++) assert(Math.abs(recorded[axis]!/(8*3.086e19)-gal[axis*3]!)<1e-14);
  const barycentric=sunBarycentricAu(descriptor.properties.volume.epochJdTt);
  const expected=recorded.map((value,axis)=>value-barycentric[axis]!*M_PER_AU);
  assert.deepEqual(descriptor.properties.volume.originM,expected);
  assert.notDeepEqual(recorded,expected,'dropping the barycentric conversion must be detectable');
  const volume=descriptor.properties.volume;
  for(let axis=0;axis<3;axis++) assert.equal((volume.boundsUnits.max[axis]!-volume.boundsUnits.min[axis]!)*volume.metersPerUnit,provenance.frame.fullExtentM[axis]);
  // Apply Z then Y then X to basis vectors, independent of preparation's matrix-to-quaternion calculation.
  const [qx,qy,qz,qw]=volume.localToReferenceXyzw as [number,number,number,number];
  for(const basis of [[1,0,0],[0,1,0],[0,0,1]]) {
    let [x,y,z]=basis as [number,number,number];
    for(const axis of [2,1,0]) { const a=provenance.frame.rotationRadians[axis]!,c=Math.cos(a),s=Math.sin(a);
      if(axis===2) [x,y]=[c*x-s*y,s*x+c*y]; else if(axis===1) [x,z]=[c*x+s*z,-s*x+c*z]; else [y,z]=[c*y-s*z,s*y+c*z]; }
    const wanted=[0,1,2].map(row=>gal[row*3]!*x+gal[row*3+1]!*y+gal[row*3+2]!*z);
    const [bx,by,bz]=basis as [number,number,number];
    const tx=2*(qy*bz-qz*by),ty=2*(qz*bx-qx*bz),tz=2*(qx*by-qy*bx);
    const actual=[bx+qw*tx+qy*tz-qz*ty,by+qw*ty+qz*tx-qx*tz,bz+qw*tz+qx*ty-qy*tx];
    assert(Math.hypot(...actual.map((v,i)=>v-wanted[i]!))<1e-13,'raw volume axes must use the published rotation, not the retired model orientation');
  }
});

test('pinned density source is self-contained and sampling matches real voxel centers', async () => {
  const recipe = await readRecipe(), source = await loadVolumeSource(sourceDirectory, recipe);
  assert.deepEqual(recipe.grid.dimensions,[1024,1024,128]);
  assert.equal(recipe.grid.decodedSha256,'16cf24ed3bf1e3f85d4c64be603b47fa68a3dd8fad7839ae7b7ff17c4bd12d01',
    'every decoded source byte must equal the published original, without downsampling');
  const result: [number, number, number, number] = [0, 0, 0, 0];
  for (const [x, y, z] of [[0, 0, 0], [255, 200, 32], [1023, 1023, 127], [193, 351, 29]] as const) {
    const position = [x, y, z].map((coordinate, axis) => {
      const lo = recipe.grid.bounds.min[axis], hi = recipe.grid.bounds.max[axis], count = recipe.grid.dimensions[axis];
      assert(lo !== undefined && hi !== undefined && count !== undefined);
      return lo + (hi - lo) * (coordinate + 0.5) / count;
    });
    const [px, py, pz] = position; assert(px !== undefined && py !== undefined && pz !== undefined);
    sampleEncoded(source, px, py, pz, result);
    for (let channel = 0; channel < 4; channel++) {
      const expected = source.encodedRgba[4 * ((z * source.height + y) * source.width + x) + channel];
      assert(expected !== undefined); assert.equal(result[channel], expected / 255);
    }
  }
  sampleEncoded(source, 0, 0, recipe.grid.bounds.max[2] + 1, result);
  assert.deepEqual(result, [0, 0, 0, 0]);
});

test('source hash and compression mutations fail before a density field can be used', async () => {
  const recipe = await readRecipe();
  await assert.rejects(loadVolumeSource(sourceDirectory, { ...recipe, grid: { ...recipe.grid, sha256: '0'.repeat(64) } }), /digest mismatch/);
  const original = await readFile(`${sourceDirectory}/${recipe.grid.path}`), changed = Buffer.from(original);
  changed.writeUInt32LE(1, 44);
  assert.throws(() => decodeDensityKtx2(changed), /Zstd/);
  assert.throws(() => containedPath(sourceDirectory, '../../outside.ktx2'), /escapes/);
});

test('generic volume config validates spatial bounds and channel indices', async () => {
  const recipe = await readRecipe();
  assert.throws(() => parseVolumeRecipe({ ...recipe, grid: { ...recipe.grid, bounds: { min: [0, 0, 0], max: [0, 1, 1] } } }), /Bounds/);
  assert.throws(() => parseVolumeRecipe({ ...recipe, material: { ...recipe.material, emission: [{ channel: 4, color: [1, 1, 1], strength: 1 }] } }), /RGBA/);
  assert.throws(() => parseVolumeRecipe({ ...recipe, material: { ...recipe.material, stepMetric: 'world' } }), /stepMetric/);
  assert.throws(() => parseVolumeRecipe({ ...recipe, material: { ...recipe.material, absorption: [{ channel: 3, color: [1,1,1], strength: 1, decodedPower: 0 }] } }), /decodedPower/);
  assert.throws(() => parseVolumeRecipe({ ...recipe, bake: { ...recipe.bake, imageEncoding: { format: 'jpeg', quality: 90 } } }), /image encoding/);
  assert.throws(() => parseVolumeRecipe({ ...recipe, bake: { ...recipe.bake, imageEncoding: { format: 'webp', quality: 101 } } }), /quality/);
  for (const matrix of [[1, 0], [1, 0, 0, 0, -1, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0, 0, 0, Infinity], [1, .01, 0, 0, 1, 0, 0, 0, 1]])
    assert.throws(() => parseVolumeRecipe({ ...recipe, material: { ...recipe.material, displayColorMatrix: matrix } }), /displayColorMatrix/);
});

test('offline display grading cross-mixes emitted RGB while preserving the original slab alpha and dark dust', async () => {
  const sourceRecipe = await readRecipe();
  const material = { ...sourceRecipe.material };
  delete material.displayColorMatrix;
  const recipe = { ...sourceRecipe, material: { ...material, exposureGain: 1 } };
  const fixture = { width: 1, height: 1, depth: 1, encodedRgba: Buffer.from([64, 128, 192, 0]), recipe, provenance: {} };
  const slabWidth = .25 / recipe.bake.sliceCounts.z;
  const withMatrix = (matrix: number[]) => parseVolumeRecipe({ ...recipe, material: { ...recipe.material, displayColorMatrix: matrix } });
  const original = bakeSlab(fixture, 'z', 0, slabWidth, 1, 1, undefined).rgba;
  const identity = bakeSlab({ ...fixture, recipe: withMatrix([1, 0, 0, 0, 1, 0, 0, 0, 1]) }, 'z', 0, slabWidth, 1, 1, undefined).rgba;
  assert.deepEqual(identity, original, 'the optional identity must retain every previously baked byte');

  const mixed = bakeSlab({ ...fixture, recipe: withMatrix([0, 1, 0, 0, 0, 1, 1, 0, 0]) }, 'z', 0, slabWidth, 1, 1, undefined).rgba;
  assert.deepEqual([...mixed], [original[1]!, original[2]!, original[0]!, original[3]!],
    'the known row-major transform must permute premultiplied display channels before straight-alpha encoding');
  const dimmed = bakeSlab({ ...fixture, recipe: withMatrix([0, .5, 0, 0, 0, .5, .5, 0, 0]) }, 'z', 0, slabWidth, 1, 1, undefined).rgba;
  assert.equal(dimmed[3], original[3], 'grading must retain alpha derived from the original emission and dust');
  assert(Math.max(...dimmed.subarray(0, 3)) < Math.max(...mixed.subarray(0, 3)));

  const dust = { ...fixture, encodedRgba: Buffer.from([0, 0, 0, 192]) };
  const dark = bakeSlab(dust, 'z', 0, slabWidth, 1, 1, undefined).rgba;
  const gradedDark = bakeSlab({ ...dust, recipe: withMatrix([.2, .3, .5, .5, .5, 0, 0, .25, .75]) }, 'z', 0, slabWidth, 1, 1, undefined).rgba;
  assert.deepEqual([...dark.subarray(0, 3)], [0, 0, 0]);
  assert.deepEqual(gradedDark, dark, 'a linear display matrix must neither emit from black nor alter dust opacity');
});

test('compressed volume rasters preserve every original alpha value and crop coordinate', async () => {
  const width=32,height=16,rgba=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const at=4*(y*width+x);rgba[at]=x*8;rgba[at+1]=y*16;rgba[at+2]=(x+y)%2*255;rgba[at+3]=(y*width+x)%256;
  }
  const crop={left:3,top:2,width:23,height:11};
  const bytes=await encodeVolumeRaster({rgba,width,height,crop,encoding:{format:'webp',quality:90}});
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  const {data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height,info.channels],[crop.width,crop.height,4]);
  for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++)assert.equal(data[4*(y*crop.width+x)+3],rgba[4*((y+crop.top)*width+x+crop.left)+3]);
});

test('raw importer preserves X-fastest RGBA order, encoded filtering and rejects source mutations', () => {
  const raw=Buffer.alloc(4*4*4*4);
  for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++)for(let c=0;c<4;c++) raw[4*((z*4+y)*4+x)+c]=z*40+y*8+x*2+c;
  const acquisition=parseVolumeAcquisition({schema:'cssearth-raw-volume-acquisition@1',source:{url:'https://example.test/pinned.raw',sha256:sha256(raw),bytes:raw.length,dimensions:[4,4,4],layout:'x-fastest-rgba8',invertZ:false},reduction:{method:'encoded-box-average-round-half-up',factor:2},compression:{format:'ktx2-rgba8-zstd',level:9}});
  const grid=reduceRawVolume(raw,acquisition);
  assert.deepEqual([grid.width,grid.height,grid.depth],[2,2,2]);
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)for(let c=0;c<4;c++) assert.equal(grid.encodedRgba[4*((z*2+y)*2+x)+c],z*80+y*16+x*4+c+25);
  const encoded=encodeDensityKtx2(grid,9), decoded=decodeDensityKtx2(encoded);
  assert.deepEqual(decoded,grid); assert.deepEqual(encodeDensityKtx2(grid,9),encoded);
  const unchanged=reduceRawVolume(raw,{...acquisition,reduction:{...acquisition.reduction,factor:1}});
  assert.equal(unchanged.encodedRgba,raw,'factor one must preserve the original buffer and every encoded byte');
  assert.deepEqual([unchanged.width,unchanged.height,unchanged.depth],[4,4,4]);
  raw[0]=255; assert.throws(()=>reduceRawVolume(raw,acquisition),/digest/);
  assert.throws(()=>parseVolumeAcquisition({...acquisition,source:{...acquisition.source,invertZ:true}}),/Unsupported/);
});

test('OpenSpace shader transfer keeps independent RGB emission and alpha extinction in actual slabs', async () => {
  const recipe=await readRecipe();
  assert.deepEqual(recipe.material.emission.map(c=>[c.channel,c.color,c.strength]),[[0,[1,0,0],250],[1,[0,1,0],250],[2,[0,0,1],250]]);
  assert.deepEqual(recipe.material.absorption,[{channel:3,color:[.3,.54,.85],strength:200,decodedPower:.7}]);
  assert.equal(recipe.material.radialEmission,undefined,'published volume already contains its bulge');
  assert.equal(channelDensity(.5,recipe.grid.encoding),.25);
  assert.equal(channelDensity(.5,recipe.grid.encoding,.7),.5**1.4);
  assert.notEqual(channelDensity(.5,recipe.grid.encoding),channelDensity(.5,recipe.grid.encoding,.7));
  assert.equal(withinVolumeSupport(recipe,[.9,0,0]),false);assert.equal(withinVolumeSupport(recipe,[.8,0,0]),true);
  assert.equal(recipe.material.exposureGain,16,'keep the calibrated display exposure separate from OpenSpace emission coefficients');
  assert.equal(slabStepSize(recipe,'x',.01),slabStepSize(recipe,'z',.01),'equal physical lengths must not bake different optical coefficients');
  assert.notEqual(slabStepSize({...recipe,material:{...recipe.material,stepMetric:'texture'}},'z',.01),slabStepSize(recipe,'z',.01),
    'the previous axis-dependent metric must fail this physical-length contract');
  const source={width:1,height:1,depth:1,encodedRgba:Buffer.from([32,0,0,0]),recipe,provenance:{}};
  const width=.25/recipe.bake.sliceCounts.z;
  const emissive=bakeSlab(source,'z',0,width,1,1,undefined).rgba;
  assert(emissive[0]!>0);assert.equal(emissive[1],0);assert.equal(emissive[2],0);
  assert.deepEqual(bakeSlab(source,'x',0,width,1,1,undefined).rgba,emissive,
    'actual raster transfer must be independent of axis for equal physical paths through the same field');
  // The dust signal must span a full RGBA8 quantization step at the calibrated display gain.
  const dusty=bakeSlab({...source,encodedRgba:Buffer.from([32,0,0,192])},'z',0,width,1,1,undefined).rgba;
  assert(dusty[0]! * dusty[3]! < emissive[0]! * emissive[3]!,'alpha dust must attenuate emitted red energy');
  const alphaOnly=bakeSlab({...source,encodedRgba:Buffer.from([0,0,0,128])},'z',0,width,1,1,undefined).rgba;
  assert.deepEqual([...alphaOnly.subarray(0,3)],[0,0,0]);assert(alphaOnly[3]!>0,'alpha is extinction, not an extra light channel');
});
