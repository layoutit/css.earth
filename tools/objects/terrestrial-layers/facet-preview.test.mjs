import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {BASE_TILE} from '@layoutit/polycss';
import {scientificPreviewGrid, prepareSolidRasters} from './solid-raster.mjs';
import {prepareRadialMaterials} from './radial-terrain.mjs';
import {parseObjShape} from './obj-shape.mjs';
import {parseTerrestrialProfile} from './index.mjs';
const exec = promisify(execFile);

test('facet previews alone can opt into smaller band-compatible dimensions; defaults remain global',async()=>{
  const raster={width:1280,height:640,bandCount:16}, grid={width:640,height:320};
  assert.deepEqual(scientificPreviewGrid({format:'facet-scalars',previewGrid:grid},raster),grid);
  for(const format of ['facet-scalars','wavefront-obj','geotiff','geologic-shapefile']) {
    assert.deepEqual(scientificPreviewGrid({format},raster),{width:1280,height:640});
    if(format!=='facet-scalars')assert.throws(()=>scientificPreviewGrid({format,previewGrid:grid},raster),/Facet preview grid/);
  }
  for(const previewGrid of [null,{width:0,height:0},{width:640.5,height:320.25},{width:640,height:319},
    {width:2560,height:1280},{width:100,height:50},{width:640,height:320,extra:true}]) {
    assert.throws(()=>scientificPreviewGrid({format:'facet-scalars',previewGrid},raster),/Facet preview grid/);
  }
  let count=0;
  for(const id of ['phobos','deimos','dimorphos']) {
    const recipe=JSON.parse(await readFile(new URL(`../../../src/planets/${id}/source/preparation/terrestrial.json`,import.meta.url)));
    parseTerrestrialProfile(recipe);
    for(const lens of recipe.raster.scientific)if(lens.format==='facet-scalars') {
      assert.deepEqual(lens.previewGrid,grid);assert.equal(lens.displaySampling,'nearest');count++;
    }
    const invalid=structuredClone(recipe);invalid.raster.scientific[0].previewGrid=grid;
    assert.throws(()=>parseTerrestrialProfile(invalid),/Facet preview grid/);
  }
  assert.equal(count,5);
});

test('640x320 facet preview bounds exact ray queries and cannot alter native atlas dimensions or original rows',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cssearth-facet-preview-'));
  try {
    const obj=['v 1 0 0','v 1 3 0','v 1 0 3','v 5 0 0','v 5 3 0','v 5 0 3','f 1 2 3','f 4 5 6'].join('\n');
    const mesh=parseObjShape(obj,{metersPerUnit:1,expectedVertices:6,expectedFaces:2});
    let rays=0;
    const grid={...mesh,hit(...args){assert.ok(++rays<=640*320,'Flat preview exceeded its declared ray budget');return mesh.hit(...args)}};
    const csv='X,Y,Z,Slope\nkm,km,km,degrees\n0.001,0.001,0.001,10\n0.005,0.001,0.001,30\n';
    await Promise.all([writeFile(join(root,'fixture.obj'),obj),writeFile(join(root,'fixture.csv'),csv)]);
    await exec('zip',['-j',join(root,'fixture.csv.zip'),join(root,'fixture.csv')]);
    await sharp(Buffer.alloc(4*2*3,128),{raw:{width:4,height:2,channels:3}}).png().toFile(join(root,'normal.png'));
    const lens={id:'slope',label:'Slope',consumer:'facet-science',format:'facet-scalars',path:'fixture.csv.zip',meshPath:'fixture.obj',
      sampling:'nearest',displaySampling:'nearest',previewGrid:{width:640,height:320},minimum:0,maximum:50,colors:['#000000','#ffffff'],
      table:{format:'sbmt-csv-zip',field:'Slope',units:'degrees',expectedRows:2,maximumCentroidErrorMeters:.001,member:'fixture.csv'},
      surfaceSampling:{method:'closest-source-point',maximumDistanceMeters:.5}};
    const inputs=['fixture.obj','fixture.csv.zip'].map(path=>({id:path,path,consumers:['facet-science']}));
    inputs.push({id:'normal',path:'normal.png',lensId:'normal',width:4,height:2,consumers:['surfaces']});
    const source={manifest:{inputs,documents:[],generatedIntermediates:[]},validateGroup:async consumer=>inputs.filter(input=>input.consumers.includes(consumer))};
    const config={namespace:'fixture',publicBase:'/scenes/fixture/',geometry:{radiusKm:.001,radius:1,radialTerrain:{path:'fixture.obj'}},
      raster:{width:1280,height:640,bandCount:16,gutter:1,poleSize:16,surfaceQuality:90,observations:[{id:'normal',validity:{kind:'image-rgb-no-data',noData:null,centerLongitude:0}}],scientific:[lens]}};
    const radial={grid};
    const surfaces=await prepareSolidRasters({sourceDirectory:root,publicDirectory:root,outputDirectory:root,config,source,radial});
    assert.equal(rays,640*320);
    const normal=surfaces.find(surface=>surface.id==='normal');
    assert.equal(normal.map.width,1280);assert.equal(normal.map.height,640);
    assert.equal(normal.previewGrid,undefined);assert.equal(normal.displaySampling,undefined);
    const surface=surfaces.find(surface=>surface.id==='slope');assert.deepEqual(surface.previewGrid,{width:640,height:320});
    assert.equal(surface.map.width,640);assert.equal(surface.map.height,320);
    const metadata=await sharp(join(root,'fixture-slope-map.webp')).metadata();
    assert.equal(metadata.width,640);assert.equal(metadata.height,320);
    assert.equal(surface.layout.width,640);assert.equal(surface.layout.height,320);
    assert.equal(surface.scalarMap.rows,2,'Both original source rows were loaded');
    // Atlas pixel (0,0) samples the second original face at (5,1/4,1/4).
    const face={vertices:[[5,0,0],[5,1,0],[5,0,1]],normal:[1,0,0],vertexNormals:[[1,0,0],[1,0,0],[1,0,0]]};
    const matrix=[BASE_TILE/2,0,0,0,0,0,BASE_TILE/2,0,0,0,1,0,0,5*BASE_TILE,0,1];
    Object.assign(radial,{faces:[face],width:2,height:2,tileSize:2,plans:[{face,rect:{x:0,y:0},geometry:{leafWidth:2,leafHeight:2},matrix}]});
    await rm(join(root,'fixture-slope-map.webp'));
    await prepareRadialMaterials({radial,surfaces:[surface],config,source,publicDirectory:root,outputDirectory:root,sunDirection:[1,0,0]});
    assert.equal(rays,640*320,'Native source-point transfer must not sample the flat preview');
    assert.equal(surface.surface.width,2);assert.equal(surface.surface.height,2);
    const index=JSON.parse(await readFile(join(root,'slope-source-index.json'))),bytes=gunzipSync(Buffer.from(index.data,'base64'));
    assert.equal(index.width,2);assert.equal(index.height,2);
    assert.deepEqual([0,4,8,12].map(offset=>bytes.readUInt32LE(offset)),[2,2,2,2],'Atlas indices still identify original table row 2');
    const color=await sharp(join(root,'fixture-slope-surface@2x.webp')).removeAlpha().raw().toBuffer();
    assert.deepEqual([...color.subarray(0,3)],[153,153,153],'Native atlas retains the original second-row value');
  } finally {await rm(root,{recursive:true,force:true})}
});
