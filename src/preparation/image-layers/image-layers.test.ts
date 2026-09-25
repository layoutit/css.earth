import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseImageLayerRecipe, type ImageLayerRecipe } from './config.js';
import { prepareImageLayers } from './prepare.js';
import { sha256 } from '@cssearth/core/node';
import { assertImageLayerReplay, restoreEnvironmentObject } from '../environment-images.js';
import { resizeRgbaLanczos3 } from './resize-rgba.js';

test('environment restoration leaves dedicated preparation owners to restore their missing banks', async () => {
  const { writeFile } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'dedicated-environment-'));
  try {
    for (const type of ['volume-lens-bank', 'galaxy-point-field']) {
      const descriptor = JSON.stringify({ id: 'fixture', type,
        prepared: { url: 'prepared/missing.json', sha256: '0'.repeat(64) } });
      await writeFile(join(root, 'object.json'), descriptor);
      await restoreEnvironmentObject(root);
      assert.equal(await readFile(join(root, 'object.json'), 'utf8'), descriptor);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('production preparation preserves canonical flux and supplies nondegenerate edge banks',async()=>{
  const root=await mkdtemp(join(tmpdir(),'image-layers-')),source=join(root,'source'),output=join(root,'prepared');
  const {mkdir,writeFile}=await import('node:fs/promises');await mkdir(source);
  const rgba=Buffer.alloc(7*7*4);for(let y=1;y<6;y++)for(let x=1;x<6;x++){const i=4*(y*7+x),peak=x===3&&y===3;rgba[i]=peak?240:30+x*12;rgba[i+1]=peak?80:25+y*9;rgba[i+2]=peak?40:20+(x+y)*5;rgba[i+3]=255;}
  const image=await sharp(rgba,{raw:{width:7,height:7,channels:4}}).png().toBuffer();await writeFile(join(source,'source.png'),image);await writeFile(join(source,'provenance.json'),'{}\n');
  const provenance=Buffer.from('{}\n');
  const recipe:ImageLayerRecipe={schema:'cssearth-image-layer-recipe@1',id:'fixture',source:{path:'source.png',dimensions:[7,7],originalDimensions:[7,7],publisherUrl:'https://example.test',downloadUrl:'https://example.test/a',credit:'Fixture',license:'CC-BY-4.0'},observation:{centerRaDeg:1,centerDecDeg:2,fieldOfViewDeg:[2,1],northClockwiseDeg:0},target:{centerRaDeg:1,centerDecDeg:2,distancePc:1000},geometry:{kind:'inclined-disk',inclinationDeg:40,lineOfNodesPaDeg:25,thicknessKpc:.2,supportRadiusKpc:1,supportTaperFraction:.9,depthWeights:[.25,.5,.25],depthScales:[1,1,1]},bake:{maxFacePixels:7,diffuseFacePixels:7,crossAxisSlices:3,crossAxisAlongPixels:7,crossAxisDepthPixels:9,backgroundFloor:0,edgeTaperFraction:.1,diffuseFraction:.6,diffuseSigmaPixels:1,encoding:{format:'webp',quality:100}},provenance:{path:'provenance.json'}};
  const parsed=parseImageLayerRecipe(recipe),bank=await prepareImageLayers({sourceDirectory:source,outputDirectory:output,recipe:parsed});
  assert.deepEqual(bank.banks.map(b=>[b.axis,b.leaves.length]),[['x',3],['y',3],['z',4]]);
  for(const b of bank.banks){assert(b.leaves.every(l=>l.style.transform.startsWith('matrix3d(')));assert(b.leaves.some(l=>l.verticesUnits.some(v=>Math.abs(v[2])>0)));const leaf=b.leaves[Math.floor(b.leaves.length/2)],edgeA=leaf.verticesUnits[1].map((v,i)=>v-leaf.verticesUnits[0][i]) as [number,number,number],edgeB=leaf.verticesUnits[2].map((v,i)=>v-leaf.verticesUnits[1][i]) as [number,number,number],cross=[edgeA[1]*edgeB[2]-edgeA[2]*edgeB[1],edgeA[2]*edgeB[0]-edgeA[0]*edgeB[2],edgeA[0]*edgeB[1]-edgeA[1]*edgeB[0]],length=Math.hypot(...cross);assert(Math.abs(cross.reduce((sum,v,i)=>sum+v*b.normalUnits[i],0)/length)>.999,'bank normal follows its prepared central plane');}
  const layers=await Promise.all(bank.banks[2].leaves.map(async l=>await sharp(join(output,l.texturePath)).raw().ensureAlpha().toBuffer({resolveWithObject:true})));
  const pixels=layers[0].info.width*layers[0].info.height,alphas=Array.from({length:pixels},(_,p)=>layers.reduce((a,l)=>1-(1-a)*(1-l.data[4*p+3]/255),0));assert(Math.abs(Math.max(...alphas)-240/255)<.02,'optical split recomposes the strongest nonuniform source alpha');
  const detail=layers.at(-1)!;assert(detail.data[4*Math.floor(pixels/2)+3]>detail.data[4*(Math.floor(pixels/2)-1)+3],'compact residual retains the isolated high-frequency peak');
  assert.equal(JSON.parse(await readFile(join(output,'image-layers.json'),'utf8')).schema,'cssearth-image-layer-bank@1');
  const recipeBytes = Buffer.from(JSON.stringify(recipe));
  await writeFile(join(source, 'recipe.json'), recipeBytes);
  const preparedBytes = await readFile(join(output, 'image-layers.json'));
  const descriptor = JSON.stringify({id:'fixture',type:'image-layer-bank',properties:{preparation:{source:'source/recipe.json',sha256:sha256(recipeBytes)}},prepared:{url:'prepared/image-layers.json',sha256:sha256(preparedBytes)}});
  await writeFile(join(root, 'object.json'), descriptor);
  // Exercise a clean-checkout cache miss, not only an already-populated output bank.
  await rm(join(output, 'layers'), {recursive:true});
  await restoreEnvironmentObject(root);
  for (const resource of bank.resources) await readFile(join(output,resource.path));
  assert.equal(await readFile(join(root,'object.json'),'utf8'),descriptor);
  assert.deepEqual(await readFile(join(output,'image-layers.json')),preparedBytes);
  const downsampled=await prepareImageLayers({sourceDirectory:source,outputDirectory:join(root,'downsampled'),recipe:{...parsed,bake:{...parsed.bake,diffuseFacePixels:5}}});
  const diffuseLeaf=downsampled.banks.find(bank=>bank.axis==='z')!.leaves[0];
  const resizedImage=await sharp(join(root,'downsampled',diffuseLeaf.texturePath)).metadata();
  assert.equal(resizedImage.width,5,'production preparation invokes the diffuse downsampler');
  assert.equal(resizedImage.height,5);
  const rotated=await prepareImageLayers({sourceDirectory:source,outputDirectory:join(root,'rotated'),recipe:{...parsed,observation:{...parsed.observation,northClockwiseDeg:31,centerRaDeg:1.2}}});
  assert.notDeepEqual(rotated.banks[2].leaves[0].verticesUnits,bank.banks[2].leaves[0].verticesUnits,'astrometric registration must affect baked geometry');
});

test('recipe rejects an unnormalised depth model',()=>{const bad={schema:'cssearth-image-layer-recipe@1',id:'bad',source:{path:'a.png',sha256:'0'.repeat(64),dimensions:[2,2],originalDimensions:[2,2],publisherUrl:'https://example.test',downloadUrl:'https://example.test/a',credit:'Fixture',license:'CC-BY-4.0'},observation:{centerRaDeg:1,centerDecDeg:2,fieldOfViewDeg:[2,1],northClockwiseDeg:0},target:{centerRaDeg:1,centerDecDeg:2,distancePc:1000},geometry:{kind:'inclined-disk',inclinationDeg:20,lineOfNodesPaDeg:30,thicknessKpc:1,supportRadiusKpc:2,supportTaperFraction:.9,depthWeights:[1,1,1],depthScales:[1,1,1]},bake:{maxFacePixels:2,diffuseFacePixels:2,crossAxisSlices:3,crossAxisAlongPixels:2,crossAxisDepthPixels:9,backgroundFloor:0,edgeTaperFraction:.1,diffuseFraction:.6,diffuseSigmaPixels:1,encoding:{format:'webp',quality:90}},provenance:{path:'provenance.json',sha256:'0'.repeat(64)}};assert.throws(()=>parseImageLayerRecipe(bad),/sum to one/);});


test('diffuse resize preserves canonical pixels at fractional horizontal phases across CPUs', () => {
  const width = 2391, height = 64, input = Buffer.alloc(width * height * 4);
  let state = 1;
  for (let index = 0; index < input.length; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    input[index] = state >>> 24;
  }
  // Independent baseline: Sharp 0.35.3 / libvips 8.18.3 on macOS arm64.
  // Unfused coordinate arithmetic changes two bytes in this small fixture.
  assert.equal(sha256(resizeRgbaLanczos3(input, width, height, 320, 8)),
    'ba6855a162e3aff54dbea530227f1bb1389363282bf009faf0d168950609d804');
});

test('diffuse resize rejects malformed dimensions and unsupported enlargement', () => {
  const pixel = Buffer.from([17, 29, 43, 127]);
  assert.deepEqual(resizeRgbaLanczos3(pixel, 1, 1, 1, 1), pixel);
  assert.throws(() => resizeRgbaLanczos3(pixel, 0, 1, 1, 1), /positive integers/);
  assert.throws(() => resizeRgbaLanczos3(pixel, 1.5, 1, 1, 1), /positive integers/);
  assert.throws(() => resizeRgbaLanczos3(pixel, 2, 1, 1, 1), /input bytes/);
  assert.throws(() => resizeRgbaLanczos3(pixel, 1, 1, 2, 1), /downsampling only/);
});


test('image-layer replay permits only bounded coordinate drift and leaves accepted metadata untouched', () => {
  const accepted = {
    id: 'fixture', frame: { originM: [1.6e20, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      boundsUnits: { min: [-20, -10, -1], max: [20, 10, 1] }, epochJdTt: 2461286.5, metersPerUnit: 3e19 },
    banks: [{ normalUnits: [0, 0, 1], samplingStepUnits: .1, leaves: [{ id: 'z-0', offsetKpc: -.5,
      centerUnits: [0, 0, -.5], verticesUnits: [[-1, -1, -.5], [1, -1, -.5], [1, 1, -.5], [-1, 1, -.5]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], widthPx: 320, heightPx: 268,
      sha256: 'a'.repeat(64), bytes: 1234, style: { transform: 'matrix3d(accepted)' } }] }],
    resources: [{ path: 'layers/z-0.webp', sha256: 'a'.repeat(64), bytes: 1234, width: 320, height: 268 }],
  };
  const before = JSON.stringify(accepted), drifted = structuredClone(accepted);
  drifted.frame.originM[0] += 70000;
  drifted.frame.localToReferenceXyzw[3] += Number.EPSILON;
  drifted.frame.boundsUnits.min[0] += 1e-13;
  drifted.banks[0].normalUnits[0] += Number.EPSILON;
  drifted.banks[0].samplingStepUnits += Number.EPSILON;
  const leaf = drifted.banks[0].leaves[0];
  leaf.offsetKpc += Number.EPSILON;
  leaf.centerUnits[2] += Number.EPSILON;
  leaf.verticesUnits[0][2] += Number.EPSILON;
  assert.doesNotThrow(() => assertImageLayerReplay(drifted, accepted));
  assert.equal(JSON.stringify(accepted), before);

  const mutations: Array<(value: typeof accepted) => void> = [
    value => { value.frame.originM[0] += 1e8; },
    value => { value.banks[0].normalUnits[0] += 1e-10; },
    value => { value.banks[0].leaves[0].verticesUnits[0][2] += 1e-10; },
    value => { value.banks[0].leaves[0].sha256 = 'b' + 'a'.repeat(63); },
    value => { value.resources[0].sha256 = 'b' + 'a'.repeat(63); },
    value => { value.resources[0].bytes += 1; },
    value => { value.banks[0].leaves[0].bytes += 1; },
    value => { value.banks[0].leaves[0].widthPx += 1; },
    value => { value.banks[0].leaves[0].id = 'z-1'; },
    value => { value.id = 'other'; },
    value => { value.banks[0].leaves[0].style.transform = 'matrix3d(changed)'; },
    value => { value.banks[0].leaves[0].uvs[0][0] += Number.EPSILON; },
    value => { value.frame.metersPerUnit += 4096; },
    value => { value.frame.originM.pop(); },
    value => { Object.assign(value.frame, { extra: 0 }); },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(accepted); mutate(changed);
    assert.throws(() => assertImageLayerReplay(changed, accepted), /changed accepted metadata/);
  }
});
