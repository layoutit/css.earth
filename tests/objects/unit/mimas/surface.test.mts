import {required} from '../../../../tools/contract/test-values.mts';
import {observation} from '../observation.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('mimas');
import {readFile} from 'node:fs/promises';
import {fromFile} from 'geotiff';
import sharp from 'sharp';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {loadObjShape, parseObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {simplifyRadialShape} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../', import.meta.url);
test('Mimas source simplification stays closed, preserves source positions and agrees with the independent radius product', async () => {
  const config = JSON.parse((await readFile(new URL('src/objects/mimas/source/preparation/terrestrial.json', root))).toString('utf8'));
  const sourceRoot = new URL('src/objects/mimas/source/', root).pathname;
  const profile = config.geometry.radialTerrain;
  const source = await loadObjShape(`${sourceRoot}/${profile.path}`, profile.grid);
  const elevation = await loadScienceSurface(sourceRoot, config.raster.scientific[0]);
  for (const [lon, lat] of [[0,0],[90,0],[180,0],[270,0],[0,90],[45,45],[135,-45],[248.24,-1.38]] as const) {
    assert.ok(Math.abs(required(source.sample(lon,lat)) / 1000 - (required(elevation.sample(lon,lat)) + 198.2)) < 1.5,
      `Independent OBJ and GeoTIFF geography/units differ at ${lon},${lat}`);
  }
  assert.ok(required(source.sample(0,-90)) > 190000, 'The released mesh closes the pole even where the raster has no coverage');
  const faces = await simplifyRadialShape(source, profile, 1);
  assert.ok(faces.length <= 720 && faces.length > 0);
  const originals = new Set(source.positions.map(v => v.join(','))), edges = new Map();
  for (const face of faces) for (let i=0;i<3;i++) {
    const a=face.vertices[i].join(','),b=face.vertices[(i+1)%3].join(',');
    assert.ok(originals.has(a), 'Simplification must retain released positions');
    const edge=[a,b].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
  }
  assert.ok([...edges.values()].every(count=>count===2), 'Every retained edge must join exactly two faces');
  const obj=faces.flatMap(f=>f.vertices.map(v=>'v '+v.join(' '))).join('\n')+'\n'+faces.map((_,i)=>`f ${3*i+1} ${3*i+2} ${3*i+3}`).join('\n');
  const coarse=parseObjShape(obj,{metersPerUnit:1,expectedVertices:faces.length*3,expectedFaces:faces.length});
  const errors=[];
  for(let lat=-87;lat<90;lat+=6)for(let lon=3;lon<360;lon+=6) {
    const radius=required(coarse.sample(lon,lat));
    assert.ok(radius > 0, 'Simplified body must have no radial holes');
    errors.push(Math.abs(radius-required(source.sample(lon,lat))));
  }
  errors.sort((a,b)=>a-b);
  assert.ok(errors[Math.floor(errors.length*.95)] < 3000, 'Simplification must retain the broad relief across the body');
  await assert.rejects(simplifyRadialShape(source,{...profile,simplification:{targetFaces:4,maximumErrorMeters:1}},1),/error limit|requested \d+ within/);
});

test('Mimas elevation uses PDS radius units, east-positive geography and exact raster bounds', async () => {
  const config = JSON.parse((await readFile(new URL('src/objects/mimas/source/preparation/terrestrial.json', root))).toString('utf8'));
  const sourceRoot = new URL('src/objects/mimas/source/', root).pathname;
  const elevation = await loadScienceSurface(sourceRoot, config.raster.scientific[0]);
  const file = await fromFile(`${sourceRoot}/observations/mimas_radius_g.tif`);
  try {
    const image = await file.getImage();
    // Original PDS XML: 2222 x 1111, 559.13276289079 m cells on a 198200 m sphere.
    for (const [x, y] of [[300,200],[1532,564],[2100,900]] as const) {
      const longitude = 180 + (-622663.6639415 + (x + 0.5) * 559.13276289079) / 198200 * 180 / Math.PI;
      const latitude = (311331.83197075 - (y + 0.5) * 559.13276289079) / 198200 * 180 / Math.PI;
      const [values] = await image.readRasters({window:[x,y,x+1,y+1]});
      assert.ok(Math.abs(required(elevation.sample(longitude, latitude)) - (values[0] - 198200) / 1000) < 1e-8);
    }
    assert.equal(elevation.sample(359.8,0), null, 'Do not stretch the eastern edge to fill the seam');
    assert.equal(elevation.sample(180,-89.9), null, 'Do not extrapolate the southern edge');
    assert.ok(required(elevation.sample(248.24,-1.38)) < required(elevation.sample(230,-1.38)) - 4, 'Herschel floor lies below its western rim');
  } finally {await file.close();}
});

test('Mimas maps preserve source geography through the shared atlas resampling', async () => {
  const width=8192,height=4096;
  const source = await sharp(new URL('src/objects/mimas/source/observations/PIA17214_unlabeled.png',root).pathname)
    .toColourspace('srgb').resize(width,height,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
  const prepared = await observation('mimas', 'normal', width, height);
  assert.deepEqual([prepared.info.width,prepared.info.height],[width,height]);
  // NASA's labeled map starts at 180 E. Herschel is near 248 E, not 68 E.
  for(const [lat,lon] of [[-1.38,248.24],[30,30],[-65,300],[85,180],[0,.1],[0,359.9]] as const) {
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
  const colorSource = await sharp(new URL('src/objects/mimas/source/observations/PIA18437.jpg',root).pathname)
    .resize(width,height,{fit:'fill',kernel:'lanczos3'}).toColourspace('srgb').raw().toBuffer();
  const colorMap = (await observation('mimas', 'enhanced', width, height)).data;
  // The LPI companion has a 0 E left edge, so the color map must not be rolled.
  assert.ok(colorMap.equals(colorSource), 'Enhanced color must preserve the source pixels and longitude origin');
});
