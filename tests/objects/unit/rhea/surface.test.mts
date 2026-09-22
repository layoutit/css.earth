import {required} from '../../../../tools/contract/test-values.mts';
import {observation} from '../observation.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fromFile} from 'geotiff';
import sharp from 'sharp';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {prepareMaskedObservation} from '../../../../tools/objects/terrestrial-layers/observed-geotiff.mts';

const root = new URL('../../../../', import.meta.url);
const sourceRoot = new URL('src/objects/rhea/source/', root).pathname;

test('Rhea elevation uses measured radii, actual geotransform and source bounds', async () => {
  const config=JSON.parse((await readFile(`${sourceRoot}/preparation/terrestrial.json`)).toString('utf8'));
  const source=await loadScienceSurface(sourceRoot,config.raster.scientific[0]);
  const file=await fromFile(`${sourceRoot}/observations/rhea_radius_g.tif`);
  try {
    const image=await file.getImage(),[ox,oy]=image.getOrigin(),[rx,ry]=image.getResolution();
    for(const [x,y] of [[0,0],[100,100],[1287,344],[1535,642],[2221,1110]] as const){
      const longitude=180+(ox+(x+.5)*rx)/763500*180/Math.PI;
      const latitude=(oy+(y+.5)*ry)/763500*180/Math.PI;
      const [values]=await image.readRasters({window:[x,y,x+1,y+1]});
      assert.ok(Math.abs(required(source.sample(longitude,latitude))-(values[0]-763500)/1000)<1e-8);
    }
    assert.equal(source.sample(359.9,0),null,'Do not stretch the short raster to fill the eastern edge');
    assert.equal(source.sample(90,-89.9),null,'Do not extrapolate the south-polar edge');
    assert.ok(Number.isFinite(source.sample(90,89.9)));
    assert.ok(Number.isFinite(source.sample(90,-89)));
  }finally{await file.close();}
});

test('GeoTIFF surface alignment follows Rhea origin easting rather than projection center alone', async () => {
  const config=JSON.parse((await readFile(`${sourceRoot}/preparation/terrestrial.json`)).toString('utf8'));
  const manifest=JSON.parse((await readFile(`${sourceRoot}/manifest.json`)).toString('utf8'));
  const entry=manifest.inputs.find((e: { lensId: string; })=>e.lensId==='normal');
  const width=8192,height=4096,path=`${sourceRoot}/${entry.path}`;
  const prepared=await prepareMaskedObservation(path,entry,config.raster.observations[0].validity,width,height);
  const gray=await sharp(path).greyscale().resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer();
  // Independent USGS landmark longitudes, plus another hemisphere: all require the half-width roll.
  for(const [lat,lon] of [[34.2,208.3],[-14.1,247.9],[20,90],[-55,50]] as const){
    const x=Math.floor(lon/360*width),y=Math.floor((90-lat)/180*height),i=y*width+x;
    const expected=gray[y*width+(x+width/2)%width];
    assert.equal(prepared.missing[i],0);
    assert.deepEqual([...prepared.rgb.subarray(i*3,i*3+3)],[expected,expected,expected]);
  }
});

test('Rhea prepared photographic maps retain observed geography and color', async () => {
  const width=8192,height=4096;
  const gray=await sharp(`${sourceRoot}/observations/Rhea_Cassini_Voyager_mosaic_global_417m.tif`).greyscale()
    .resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer();
  const map=(await observation('rhea', 'normal', width, height)).data;
  for(const [lat,lon] of [[34.2,208.3],[-14.1,247.9],[20,90],[-55,50]] as const){
    const x=Math.floor(lon/360*width),y=Math.floor((90-lat)/180*height),value=gray[y*width+(x+width/2)%width];
    assert.ok(value>0);
    assert.deepEqual([...map.subarray((y*width+x)*3,(y*width+x)*3+3)],[value,value,value]);
  }
  const color=await sharp(`${sourceRoot}/observations/PIA18438.jpg`).resize(width,height,{fit:'fill',kernel:'lanczos3'}).toColourspace('srgb').raw().toBuffer();
  const prepared=(await observation('rhea', 'enhanced', width, height)).data;
  assert.ok(prepared.equals(color), 'Keep observed hemisphere color differences and photographed detail');
});
