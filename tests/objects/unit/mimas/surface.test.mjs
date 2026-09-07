import {observation} from '../observation.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fromFile} from 'geotiff';
import sharp from 'sharp';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mjs';
const root = new URL('../../../../', import.meta.url);
test('Mimas elevation uses PDS radius units, east-positive geography and exact raster bounds', async () => {
  const config = JSON.parse(await readFile(new URL('src/planets/mimas/source/preparation/terrestrial.json', root)));
  const sourceRoot = new URL('src/planets/mimas/source/', root).pathname;
  const elevation = await loadScienceSurface(sourceRoot, config.raster.scientific[0]);
  const file = await fromFile(`${sourceRoot}/observations/mimas_radius_g.tif`);
  try {
    const image = await file.getImage();
    // Original PDS XML: 2222 x 1111, 559.13276289079 m cells on a 198200 m sphere.
    for (const [x, y] of [[300,200],[1532,564],[2100,900]]) {
      const longitude = 180 + (-622663.6639415 + (x + 0.5) * 559.13276289079) / 198200 * 180 / Math.PI;
      const latitude = (311331.83197075 - (y + 0.5) * 559.13276289079) / 198200 * 180 / Math.PI;
      const [values] = await image.readRasters({window:[x,y,x+1,y+1]});
      assert.ok(Math.abs(elevation.sample(longitude, latitude) - (values[0] - 198200) / 1000) < 1e-8);
    }
    assert.equal(elevation.sample(359.8,0), null, 'Do not stretch the eastern edge to fill the seam');
    assert.equal(elevation.sample(180,-89.9), null, 'Do not extrapolate the southern edge');
    assert.ok(elevation.sample(248.24,-1.38) < elevation.sample(230,-1.38) - 4, 'Herschel floor lies below its western rim');
  } finally {await file.close();}
});

test('Mimas maps preserve source geography through the shared atlas resampling', async () => {
  const width=8192,height=4096;
  const source = await sharp(new URL('src/planets/mimas/source/observations/PIA17214_unlabeled.png',root).pathname)
    .toColourspace('srgb').resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
  const prepared = await observation('mimas', 'normal', width, height);
  assert.deepEqual([prepared.info.width,prepared.info.height],[width,height]);
  // NASA's labeled map starts at 180 E. Herschel is near 248 E, not 68 E.
  for(const [lat,lon] of [[-1.38,248.24],[30,30],[-65,300],[85,180],[0,.1],[0,359.9]]) {
    const x=Math.floor(lon/360*width),y=Math.floor((90-lat)/180*height);
    const sx=(x+width/2)%width;
    assert.deepEqual(prepared.data.subarray((y*width+x)*3,(y*width+x)*3+3),
      source.data.subarray((y*width+sx)*3,(y*width+sx)*3+3));
  }
  let black=0;
  for(let i=0;i<source.data.length;i+=3)if(source.data[i]===0){
    const y=Math.floor(i/3/width),sx=i/3%width,x=(sx+width/2)%width;
    assert.equal(prepared.data[(y*width+x)*3],0);black++;
  }
  assert.ok(black>0,'Reference must include photographed black pixels');
  const colorSource = await sharp(new URL('src/planets/mimas/source/observations/PIA18437.jpg',root).pathname)
    .resize(width,height,{fit:'fill',kernel:'lanczos3'}).toColourspace('srgb').raw().toBuffer();
  const colorMap = (await observation('mimas', 'enhanced', width, height)).data;
  // The LPI companion has a 0 E left edge, so the color map must not be rolled.
  assert.ok(colorMap.equals(colorSource), 'Enhanced color must preserve the source pixels and longitude origin');
});
