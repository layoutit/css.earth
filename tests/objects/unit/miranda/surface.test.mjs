import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {readObservation} from '../../../../tools/objects/terrestrial-layers/solid-raster.mjs';

const root = new URL('../../../../src/planets/miranda/source/', import.meta.url).pathname;
test('Miranda registers the Voyager map without mirroring and preserves its northern gap', async () => {
  const config = JSON.parse(await readFile(`${root}/preparation/terrestrial.json`));
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`));
  const entry = manifest.inputs.find(x => x.lensId === 'normal');
  const {rgb,missing} = await readObservation(root,entry,config.raster.observations[0].validity,1440,720);
  const raw = await sharp(`${root}/${entry.path}`).toColourspace('b-w').raw().toBuffer();
  // Independent USGS Gazetteer feature centres, in east-positive degrees.
  for (const [longitude,latitude] of [[257.1,-24.8],[73.7,-29.1],[325.7,-66.9]]) {
    const x=Math.floor(longitude*4),y=Math.floor((90-latitude)*4);
    const sourceX=Math.floor(((longitude+180)%360)*4);
    assert.equal(missing[y*1440+x],0);
    assert.equal(rgb[(y*1440+x)*3],raw[y*1440+sourceX]);
  }
  assert.equal(missing[30*1440+720],1,'Unobserved north stays missing');
  assert.equal(missing[690*1440+720],0,'Observed south remains terrain');
});
