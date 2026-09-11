import {required} from '../../../../tools/test-values.mts';
import {observation} from '../observation.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fromFile} from 'geotiff';
import sharp from 'sharp';

const root = new URL('../../../../', import.meta.url);
const sourceRoot = new URL('src/planets/iapetus/source/', root).pathname;

test('Iapetus maps preserve geographic registration and observed dark terrain', async () => {
  const width=8192,height=4096;
  const monochrome = await sharp(`${sourceRoot}/observations/Iapetus_Cassini_Voyager_mosaic_global_783m.tif`)
    .greyscale().resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
  const map = (await observation('iapetus', 'normal', width, height)).data;
  // USGS Iapetus nomenclature is west-positive: Cassini Regio 92.6 W,
  // Carcassone Montes 216.7 W, Engelier crater 264.7 W, Almeric 276 W.
  // These fixed independently published coordinates distinguish a half-turn or mirror.
  for (const [lat,lon] of [[-28.1,267.4],[0,143.3],[-40.5,95.3],[53.4,84],[0,359.9],[0,0.1],[-80,90],[80,90]] as const) {
    const x=Math.floor(lon/360*width),y=Math.floor((90-lat)/180*height),sx=(x+width/2)%width;
    const gray=monochrome.data[(y*width+sx)*monochrome.info.channels];
    assert.ok(gray>0,'Comparison lies within source coverage');
    assert.deepEqual([...map.subarray((y*width+x)*3,(y*width+x)*3+3)],[gray,gray,gray]);
  }
  const colorSource=await sharp(`${sourceRoot}/observations/PIA18436.jpg`).resize(width,height,{fit:'fill',kernel:'lanczos3'})
    .toColourspace('srgb').raw().toBuffer();
  const colorMap=(await observation('iapetus', 'enhanced', width, height)).data;
  assert.ok(colorMap.equals(colorSource), 'Enhanced color is neither mirrored, rolled nor brightness-normalized');
  function meanPatch(lat: number,lon: number) {
    let sum=0,count=0;
    const cx=Math.floor(lon/360*width),cy=Math.floor((90-lat)/180*height);
    for(let y=cy-10;y<=cy+10;y++)for(let x=cx-10;x<=cx+10;x++){
      const i=(y*width+x)*3;sum+=colorMap[i]+colorMap[i+1]+colorMap[i+2];count+=3;
    }
    return sum/count;
  }
  assert.ok(meanPatch(0,270)<meanPatch(0,90)/3,'Physical leading/trailing hemisphere albedo contrast survives preparation');
});

test('Iapetus source coordinates use the actual GeoTIFF radius and explicit validity', async () => {
  const file=await fromFile(`${sourceRoot}/observations/Iapetus_Cassini_Voyager_mosaic_global_783m.tif`);
  try {
    const image=await file.getImage(), keys=required(image.getGeoKeys());
    const [x,y]=image.getOrigin(),[dx,dy]=image.getResolution(),radius=keys.GeogSemiMajorAxisGeoKey;
    assert.equal(image.getGDALNoData(),0);
    assert.equal(keys.ProjCoordTransGeoKey,17);
    assert.equal(radius,736000);
    assert.ok(Math.abs((x/radius*180/Math.PI)+180)<1e-9);
    assert.ok(Math.abs((y/radius*180/Math.PI)-90)<1e-9);
    assert.ok(Math.abs(dx*image.getWidth()/radius*180/Math.PI-360)<1e-9);
    assert.equal(dy,-dx);
    const config=JSON.parse((await readFile(`${sourceRoot}/preparation/terrestrial.json`)).toString('utf8'));
    assert.equal(config.raster.observations.find((lens: { id: string; })=>lens.id==='enhanced').validity.noData,null,
      'A dark enhanced pixel is an observation, not an inferred coverage gap');
  } finally {await file.close();}
});
