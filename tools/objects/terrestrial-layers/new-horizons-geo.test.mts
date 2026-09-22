import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeNewHorizonsLorri,decodeArrokothMvic,newHorizonsCamera} from './new-horizons-geo.mts';
import {bindSipCamera} from './llorri-geo.mts';
import {readFitsPrimary} from '../observation/fits.mts';
import {array,number,nullable,optional,shape,text} from './source-records.mts';
import {validateSurfaceObservation} from '../surface-observations/index.mts';
import {pinnedOracleVersions} from '../../oracles/fixture.mts';

const source=new URL('../../../src/objects/arrokoth/source/',import.meta.url);
const read=async(path:string)=>JSON.parse(await readFile(new URL(path,source),'utf8'));
const fixture=shape({schema:text,tool:text,version:text,images:array(shape({path:text,bytes:number,
  planes:array(shape({name:text,shape:array(number),samples:array(shape({index:number,value:nullable(number)}))})),
  wcs:optional(array(shape({pixel:array(number),raDecDegrees:array(number)}))),exposureSeconds:optional(number),acceptedPixels:optional(number)}))})(JSON.parse(await readFile(new URL('../../../tests/objects/fixtures/arrokoth/new-horizons-astropy.json',import.meta.url),'utf8')));

test('three pinned New Horizons products match independent Astropy pixels and HDU layouts',async()=>{
  assert.equal(fixture.tool,'Astropy');assert.equal(fixture.images.length,3);
  assert.equal(fixture.version,(await pinnedOracleVersions()).get('astropy'));
  let samples=0;
  for(const image of fixture.images){
    const bytes=await readFile(new URL(image.path,source));
    assert.equal(bytes.length,image.bytes);
    if(image.wcs){
      let offset=0;
      for(const expected of image.planes){const plane=readFitsPrimary(bytes.subarray(offset));offset+=plane.nextOffset;
        assert.deepEqual([plane.height,plane.width],expected.shape);
        for(const sample of expected.samples){assert.ok(plane.values[sample.index]===sample.value,`${image.path}/${expected.name}/${sample.index}`);samples++;}
      }
      assert.equal(offset,bytes.length);
      const id=image.path.includes('5591')?'ca05':'ca06',camera=await read(`observations/${id}-camera.json`),decoded=decodeNewHorizonsLorri(bytes,camera);
      for(const p of image.planes[0].samples)if(p.value!==null)assert.equal(decoded.planes.IMAGE[p.index],Math.fround(p.value/number(image.exposureSeconds)));
      for(const p of image.planes[2].samples)if(p.value!==0)assert.equal(decoded.acceptPixel(p.index),false);
      let accepted=0;
      for(let i=0;i<decoded.width*decoded.height;i++)if(decoded.acceptPixel(i))accepted++;
      assert.equal(accepted,image.acceptedPixels,'Every detector quality decision matches Astropy');
    }else{
      const label=await readFile(new URL('observations/ca05_mvic_cube.lblx',source),'utf8');
      const camera=await read('observations/mvic-camera.json');
      const frame=decodeArrokothMvic(bytes,camera,label);
      assert.throws(()=>decodeArrokothMvic(bytes,camera,label.replace('<unit>data number</unit>','<unit>I/F</unit>')),/native band/);
      assert.throws(()=>decodeArrokothMvic(bytes,camera,label.replace('<sp:filter_name>NIR</sp:filter_name>','<sp:filter_name>Green</sp:filter_name>')),/native band/);
      assert.deepEqual(image.planes[0].shape,[4,300,300]);
      const bands=[frame.colorPlanes[2],frame.colorPlanes[1],frame.colorPlanes[0]];
      for(const p of image.planes[0].samples){const band=Math.floor(p.index/90000);if(band<3){assert.equal(bands[band][p.index%90000],p.value);samples++;}}
    }
  }
  assert.ok(samples>230,`${samples} native values checked`);
});

test('native New Horizons TAN-SIP rays agree with Astropy over the full detector',async()=>{
  let count=0;
  for(const image of fixture.images){if(!image.wcs)continue;
    const bytes=await readFile(new URL(image.path,source)),camera=newHorizonsCamera(bytes,{bodyToJ2000:[[1,0,0],[0,1,0],[0,0,1]],offsetPixels:[0,0]}),bound=bindSipCamera(camera);
    for(const {pixel,raDecDegrees:[ra,dec]} of image.wcs){
      const r=Math.PI/180,ray=[Math.cos(ra*r)*Math.cos(dec*r),Math.sin(ra*r)*Math.cos(dec*r),Math.sin(dec*r)];
      const point=camera.positionKm.map((n,i)=>n+1000*ray[i]),projected=bound.projectPoint(point);
      assert.ok(Math.hypot(projected[0]-pixel[0],projected[1]-pixel[1])<1e-6,`${image.path}: ${pixel}`);count++;
    }
  }
  assert.equal(count,50);
});

test('LORRI rejects a different image, incomplete quality layout and non-rigid body attitude',async()=>{
  const bytes=await readFile(new URL('observations/lor_0408626332_0x636_sci.fit',source)),camera=await read('observations/ca06-camera.json');
  const changed=Buffer.from(bytes);changed[changed.length-1]^=1;
  assert.throws(()=>decodeNewHorizonsLorri(changed,camera),/hash/);
  const short=bytes.subarray(0,readFitsPrimary(bytes).nextOffset);
  assert.throws(()=>decodeNewHorizonsLorri(short,{...camera}));
  assert.throws(()=>newHorizonsCamera(bytes,{bodyToJ2000:[[2,0,0],[0,1,0],[0,0,1]],offsetPixels:[0,0]}),/attitude/);
});

test('enhanced color keeps one shared zero-based scale and rejects photometric recoloring',async()=>{
  const config=await read('preparation/terrestrial.json'),recipe=config.raster.surfaceObservations.find((v:{id:string})=>v.id==='mvic');
  validateSurfaceObservation(recipe,config.geometry.radialTerrain);
  assert.throws(()=>validateSurfaceObservation({...recipe,display:{displayRange:[.01,.17]}},config.geometry.radialTerrain));
  assert.throws(()=>validateSurfaceObservation({...recipe,photometry:{...recipe.photometry,model:'lommel-seeliger'}},config.geometry.radialTerrain));
});
