import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import type { PreparedCssVolume, VolumeAxis } from '../../../../../../../../src/renderers/css/volume/types.ts';
import { validatePreparedVolumeLenses } from '../../../../../../../../src/renderers/css/volume/prepared-volume-lenses.ts';
import { prepareNebulaObject, readNebulaDelivery } from './nebula-objects.ts';

const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

test('a pinned optical composite is a compiler delivery stage, never a symmetry fallback', async () => {
  const recipe: unknown = JSON.parse(await readFile('src/objects/m45/source/delivery.json', 'utf8'));
  const parsed = readNebulaDelivery(recipe);
  assert.equal(parsed.defaultLens, 'optical-composite');
  assert.equal(parsed.compositeRecipe?.path, 'labs/nebula/models/m45/optical-composite.json');
  assert.ok(parsed.compositeRecipe);
  assert.throws(() => readNebulaDelivery({ ...parsed, schema: 'cssearth-nebula-delivery@1', method: 'axial-symmetry' }), /requires compiler/);
  const ordinary = readNebulaDelivery(JSON.parse(await readFile('src/objects/m8/source/delivery.json', 'utf8')));
  assert.equal(ordinary.compositeRecipe, undefined);
});
async function put(root: string, path: string, bytes: Uint8Array | string) {
  await mkdir(dirname(join(root,path)),{recursive:true});
  await writeFile(join(root,path),bytes);
}
async function fixture(root: string) {
  // The delivery identity reads these source files from its checkout; keep the fixture isolated.
  for (const directory of ['tools/nebula/application','packages/bake/src/volume','src/renderers/css/preparation','src/renderers/css/volume','src/preparation/volume']) {
    for (const name of await readdir(directory,{recursive:true})) {
      if (!name.endsWith('.ts')) continue;
      const path = `${directory}/${name}`;
      await put(root,path,await readFile(path));
    }
  }
  const request = '{}', directory = join(root,'object');
  const recipe = JSON.parse(await readFile('src/objects/m2-9/source/delivery.json','utf8'));
  for (const path of [recipe.fieldStars.path, 'src/renderers/css/navigation/world-camera-math.ts',
    'src/renderers/css/stars/prepared-catalogue-points.ts']) {
    await put(root,path,await readFile(path));
  }
  await put(root,'input/request.json',request);
  await put(directory,'source/delivery.json',JSON.stringify({...recipe,
    request:{path:'input/request.json',sha256:hash(request)},inputPins:[],compactInputs:undefined,compactMethod:undefined,symmetryDirectory:'input'}));
  await copyFile('src/objects/m2-9/source/nebula.json',join(directory,'source/nebula.json'));
  const pixels = await sharp({create:{width:2,height:2,channels:4,background:{r:220,g:80,b:30,alpha:0.6}}}).png().toBuffer();
  const matrices: Record<VolumeAxis,string> = {
    x:'50,0,0,0,0,0,50,0,0,1,0,0,-50,0,-50,1',
    y:'0,50,0,0,0,0,50,0,1,0,0,0,0,-50,-50,1',
    z:'0,50,0,0,50,0,0,0,0,0,1,0,-50,-50,0,1',
  };
  const volume: PreparedCssVolume = {
    schema:'cssearth-css-volume@1',id:'fixture',
    frame:{referenceFrame:'lab',epochJdTt:0,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:1,
      boundsUnits:{min:[-1,-1,-1],max:[1,1,1]}},
    anchors:[],stacks:(['x','y','z'] as const).map(axis=>({axis,leaves:[{
      id:axis,centerUnits:[0,0,0],texturePath:'slice.png',widthPx:2,heightPx:2,
      style:{width:'2px',height:'2px',transform:`matrix3d(${matrices[axis]})`,backgroundSize:'2px 2px',backgroundPosition:'0px 0px'},
    }]})),
    resources:[{path:'slice.png',sha256:hash(pixels),bytes:pixels.length,width:2,height:2}],provenance:{},approximation:{},
  };
  const prepared = JSON.stringify({data:volume});
  await put(root,'input/prepared/volume.json',prepared);
  await put(root,'input/prepared/slice.png',pixels);
  await put(root,'input/object.json',JSON.stringify({properties:{preparation:{sha256:hash(request)}},
    prepared:{url:'prepared/volume.json',sha256:hash(prepared)}}));
  return {directory,pixels};
}

test('delivery restores missing impostors, rejects drift and rebuilds when their generator changes',async()=>{
  const root = await mkdtemp(join(tmpdir(),'nebula-impostor-delivery-'));
  try {
    const {directory,pixels} = await fixture(root);
    assert.equal((await prepareNebulaObject(root,directory,true,true)).status,'prepared');
    const envelope = JSON.parse(await readFile(join(directory,'prepared/lenses.json'),'utf8'));
    const data = validatePreparedVolumeLenses(envelope.data), lens = data.lenses[0]!;
    assert.equal(lens.stars?.points.length,7,'The isolated delivery must include its pinned catalogue field.');
    assert.ok(lens.volume.impostors,'Delivery must retain the generated impostor descriptor.');
    const proxies = lens.volume.resources.filter(resource=>resource.path.includes('/impostors/'));
    assert.ok(proxies.length>0,'Generated views must join the fixed resource inventory.');
    for (const resource of lens.volume.resources) {
      const bytes = await readFile(join(directory,'prepared',resource.path));
      assert.equal(hash(bytes),resource.sha256);
      assert.equal(bytes.length,resource.bytes);
    }
    assert.equal(lens.volume.resources.filter(resource=>resource.path.includes('/atlases/')).length,3);
    assert.ok(lens.volume.stacks.every(stack=>stack.leaves.every(leaf=>leaf.texturePath === `hst-optical/atlases/${stack.axis}.webp`)));
    await assert.rejects(readFile(join(directory,'prepared/hst-optical/slice.png')),/ENOENT/);
    assert.equal((await prepareNebulaObject(root,directory,true,true)).status,'verified');

    const proxy = proxies[0]!, path = join(directory,'prepared',proxy.path), original = await readFile(path);
    await rm(path);
    assert.equal((await prepareNebulaObject(root,directory,true,true)).status,'prepared');
    assert.equal(hash(await readFile(path)),proxy.sha256,'Missing proxies must reproduce their exact bytes.');
    await writeFile(path,'corrupt');
    await assert.rejects(prepareNebulaObject(root,directory,true,true),/Nebula source hash mismatch/);
    await writeFile(path,original);
    const generator = resolve(root,'src/renderers/css/preparation/volume-impostors.ts');
    await writeFile(generator,`${await readFile(generator,'utf8')}\n// changed fixture generator\n`);
    assert.equal((await prepareNebulaObject(root,directory,true,true)).status,'prepared');
    assert.equal(hash(await readFile(path)),proxy.sha256);
    assert.equal((await prepareNebulaObject(root,directory,true,true)).status,'verified');
  } finally { await rm(root,{recursive:true,force:true}); }
});
