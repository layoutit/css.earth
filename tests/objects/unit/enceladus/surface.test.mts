import {observation} from '../observation.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('enceladus');
import {fromFile} from 'geotiff';
import sharp from 'sharp';

// Independent cartographic samples from the original PDS image and its label,
// including NASA's Baghdad Sulcus view centered at 79 S, 24 W (https://science.nasa.gov/resource/baghdad-sulcus-in-3-d/).
// A latitude inversion or east/west reversal must not preserve this correspondence.
test('prepared Enceladus imagery keeps source terrain at its geographic coordinates', async () => {
  const root = new URL('../../../../', import.meta.url);
  const file = await fromFile(new URL('src/objects/enceladus/source/observations/Enceladus_Cassini_mosaic_global_100m_schenk2024.tif', root).pathname);
  try {
    const source = await file.getImage();
    const mapped = await observation('enceladus', 'normal');
    const {data, info} = await sharp(mapped.data, {raw:mapped.info}).greyscale().raw().toBuffer({resolveWithObject:true});
    for (const [latitude, longitude] of [[-79,336],[-65,50],[45,220],[70,330],[0,0.2],[0,359.8]] as const) {
      const x = Math.floor(longitude/360*info.width), y = Math.floor((90-latitude)/180*info.height);
      const lon = (x+.5)/info.width*360, lat = 90-(y+.5)/info.height*180;
      // Original ISIS label: radius 256200 m; upper-left (-804900,402500); 100 m cells.
      const sx = Math.floor(((lon-180)*Math.PI/180*256200+804900)/100);
      const sy = Math.floor((402500-lat*Math.PI/180*256200)/100);
      const [pixels] = await source.readRasters({window:[sx-1,sy-1,sx+2,sy+2]});
      const levels = [...pixels].filter(v=>Number.isFinite(v)&&Math.abs(v)<1e30).map(v=>v/16500*255);
      assert.ok(levels.length, 'Reference patch must contain observations');
      const observed = data[y*info.width+x];
      assert.ok(observed >= Math.min(...levels)-1 && observed <= Math.max(...levels)+1,
        `Surface no longer matches source terrain at ${latitude}, ${longitude}`);
    }
  } finally { await file.close(); }
});
