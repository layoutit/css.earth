import { sourceTest } from '../../source-test.mts';
const test = sourceTest('comet-67p');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {decodeVtkCategories} from '../../../../tools/objects/terrestrial-layers/vtk-categories.mts';
import {decodeSbmtPaths, decodeSbmtLocations} from '../../../../tools/objects/terrestrial-layers/sbmt-symbols.mts';
const root = new URL('../../../../', import.meta.url), body = new URL('src/objects/comet-67p/',root);
const read = (path: string|URL) => readFile(new URL(path,body),'utf8'), json = async (path: string) => JSON.parse(await read(path));
const config = await json('source/preparation/terrestrial.json');
const regions = config.raster.scientific.find((l: { id: string; })=>l.id==='regions'), geology = config.raster.scientific.find((l: { id: string; })=>l.id==='geology');
const vtk = decodeVtkCategories(await read('source/'+regions.path),regions.grid);

test('SHAP7 region cell identities agree with independent original-file anchors and published areas', () => {
  // Original VTK rows decoded independently with NumPy; coordinates in metres.
  const anchors = [[0,0,[-1832.5,-1483.6333333333,-190.88]],[5000,3,[-2167.6333333333,-236.13,-123.59]],
    [24000,11,[-2128.7666666667,-212.4566666667,722.4333333333]],
    [74000,21,[1860.9333333333,-1301.1,-85.6243333333]],
    [114000,14,[759.3266666667,1273.7333333333,229.9866666667]]] as const;
  for (const [id,region,point] of anchors) {
    assert.equal(vtk.values[id],region);
    const center=[0,1,2].map(axis=>vtk.indices[id].reduce((sum:number,i:number)=>sum+vtk.positions[i][axis],0)/3);
    assert.ok(Math.hypot(...center.map((n,i)=>n-point[i]))<1e-6);
  }
  const area = Array(26).fill(0);
  vtk.indices.forEach(([i,j,k],id)=>{
    const a=vtk.positions[i],b=vtk.positions[j].map((n,x)=>n-a[x]),c=vtk.positions[k].map((n,x)=>n-a[x]);
    area[vtk.values[id]]+=Math.hypot(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0])/2e6;
  });
  // Thomas et al. (2018), Table 1. The released 125k mesh is coarser than
  // the publication's area model; agreement within 1% validates the ID join.
  for(const [name,published] of [['Atum',1.9497],['Khonsu',2.16872],['Apis',.39798],['Imhotep',4.90446],['Anubis',.92241],['Seth',4.66022],['Ash',6.25734],['Aten',1.12758],['Babi',1.45666],['Geb',1.02767],['Khepry',1.63087],['Anhur',1.87013]] as const){
    const i=regions.categories.findIndex((c: { label: string|number; })=>c.label===name);assert.ok(i>=0);assert.ok(Math.abs(area[i]/published-1)<.01,name+' area and source ID');
  }
});

test('every prepared category texel decodes to its original region or SBMT symbol class', async () => {
  const surfaces=(await json('prepared/surfaces.json')).surfaces;
  const paths=decodeSbmtPaths(await read('source/'+geology.symbols.paths),geology.symbols.shapeModel);
  const locations=decodeSbmtLocations(await read('source/'+geology.symbols.locations));
  const featureCategories=[0,...[...paths,...locations].map(f=>geology.symbols.colorCategories[f.color])];
  const runtime=await read('prepared/object.json');
  for (const lens of [regions,geology]) {
    const surface=surfaces.find((s:{id:string})=>s.id===lens.id), ref=surface.scalarMap.sampleSources;
    const bytes=await readFile(new URL('prepared/'+ref.file,body));
    assert.equal(bytes.length,ref.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);
    const index=JSON.parse((bytes).toString('utf8')), codes=gunzipSync(Buffer.from(index.data,'base64'));
    const rgba=await sharp(new URL('public'+surface.surface.url,root).pathname).ensureAlpha().raw().toBuffer();
    assert.equal(rgba.length,codes.length);
    const palette=lens.categories.map((c: { color: string; })=>[1,3,5].map(i=>parseInt(c.color.slice(i,i+2),16)));
    let accepted=0,invalid=0,checked=0;const seen=new Set();
    for(let offset=0;offset<codes.length;offset+=4){
      const code=codes.readUInt32LE(offset);if(!code){invalid++;continue;}
      const category=lens.id==='regions'?vtk.values[code-1]:featureCategories[code-1];
      assert.ok(palette[category],'valid original source ID');accepted++;seen.add(category);
      if(accepted%997===0){assert.deepEqual([...rgba.subarray(offset,offset+3)],palette[category]);assert.equal(rgba[offset+3],255);checked++;}
    }
    assert.ok(checked>100);assert.ok(seen.size>=lens.categories.length-1);assert.ok(invalid>0);
    const transfer=surface.surfaceSampling.transfer;
    assert.equal(accepted,transfer.sampledTexels-transfer.withheldTexels);
    assert.ok(transfer.maximumDistanceMeters<=50);assert.ok(transfer.withheldTriangleInteriorTexels>0);
    assert.ok(!runtime.includes(index.data),'source index remains preparation-only');
  }
});
