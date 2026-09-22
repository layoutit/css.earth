import {required} from '../../../../tools/contract/test-values.mts';
import {observation} from '../observation.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fromFile} from 'geotiff';
import sharp from 'sharp';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';

const root = new URL('../../../../', import.meta.url);
const sourceRoot = new URL('src/objects/dione/source/', root).pathname;

test('Dione elevation preserves source radius values and hemisphere orientation across three projections', async () => {
  const config = JSON.parse((await readFile(`${sourceRoot}/preparation/terrestrial.json`)).toString('utf8'));
  const elevation = await loadScienceSurface(sourceRoot, config.raster.scientific[0]);
  for (const region of ['eq', 'np', 'sp']) {
    const file = await fromFile(`${sourceRoot}/observations/dione_${region}radius_g.tif`);
    try {
      const image = await file.getImage(), [ox, oy] = image.getOrigin(), [rx, ry] = image.getResolution();
      const cells = region === 'eq' ? [[100,100], [1419,130], [2170,550]] : [[150,150], [300,170], [180,300]];
      for (const [x, y] of cells) {
        const easting = ox + (x + 0.5) * rx, northing = oy + (y + 0.5) * ry;
        let longitude, latitude;
        if (region === 'eq') {
          longitude = 180 + easting / 561400 * 180 / Math.PI;
          latitude = northing / 561400 * 180 / Math.PI;
        } else {
          const sign = region === 'np' ? 1 : -1;
          longitude = (Math.atan2(easting, -sign * northing) * 180 / Math.PI + 360) % 360;
          latitude = sign * (90 - 2 * Math.atan(Math.hypot(easting, northing) / 1122800) * 180 / Math.PI);
        }
        const [values] = await image.readRasters({window: [x,y,x+1,y+1]});
        assert.ok(Math.abs(required(elevation.sample(longitude, latitude)) - (values[0] - 561400) / 1000) < 1e-8, `${region} cell ${x},${y}`);
      }
    } finally {await file.close();}
  }
  for (const latitude of [-90, 90]) {
    assert.ok(Number.isFinite(elevation.sample(0, latitude)));
    assert.equal(elevation.sample(0, latitude), elevation.sample(123, latitude), 'Every longitude meets at the same measured pole');
  }
  // The actual polar rectangles fall just short of the nominal 55-degree circle at cardinal longitudes.
  assert.equal(elevation.sample(90, 55.05), null, 'Do not extrapolate across the narrow source join gap');
  assert.equal(elevation.sample(90, -55.05), null);
  for (const latitude of [-55.2, -54.9, 54.9, 55.2]) assert.ok(Number.isFinite(elevation.sample(90, latitude)));
});

test('Dione photographic maps retain their different source longitude origins and native pixels', async () => {
  const width = 8192, height = 4096;
  const monochrome = await sharp(`${sourceRoot}/observations/Dione_Cassini_Voyager_mosaic_global_154m.tif`)
    .greyscale().resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
  const map = (await observation('dione', 'normal', width, height)).data;
  for (const [lat, lon] of [[24.6,215.9],[-3.3,297],[20,90],[-60,90],[0,180]] as const) {
    const x = Math.floor(lon/360*width), y = Math.floor((90-lat)/180*height), sx = (x+width/2)%width;
    const gray = monochrome.data[(y*width+sx)*monochrome.info.channels];
    assert.ok(gray > 0, 'Comparison lies inside observed coverage');
    assert.deepEqual([...map.subarray((y*width+x)*3,(y*width+x)*3+3)], [gray,gray,gray]);
  }
  const colorSource = await sharp(`${sourceRoot}/observations/PIA18434.jpg`).resize(width,height,{fit:'fill',kernel:'lanczos3'})
    .toColourspace('srgb').raw().toBuffer();
  const colorMap = (await observation('dione', 'enhanced', width, height)).data;
  assert.ok(colorMap.equals(colorSource), 'The original color map is neither rolled nor retouched');
});
