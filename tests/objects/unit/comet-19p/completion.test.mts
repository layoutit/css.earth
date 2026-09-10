import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';

const root = new URL('../../../../src/planets/comet-19p/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));

test('both completed Borrelly banks close around source-backed terrain', async () => {
  for (const [file, measuredCount, completedCount] of [['terrain',452,994],['terrain-dlr',799,1862]]) {
    const terrain = await json(`prepared/${file}.json`), positions = [], lookup = new Map();
    assert.equal(terrain.faces.filter(face => !face.estimated).length, measuredCount);
    assert.equal(terrain.faces.length, completedCount);
    const indices = terrain.faces.flatMap(face => face.vertices.map(p => {
      const key = p.join(',');
      if (!lookup.has(key)) { lookup.set(key, positions.length); positions.push(p); }
      return lookup.get(key);
    }));
    const topology = validateClosedMesh(indices, positions);
    assert.equal(topology.components, 1); assert.equal(topology.eulerCharacteristic, 2);
    const measured = terrain.faces.filter(face => !face.estimated);
    const raw = (await readFile(new URL(`source/${terrain.source.path}`, root), 'utf8')).trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number));
    const t = terrain.source.grid.xyTransform, z = terrain.source.grid.zOffsetMeters, scale = 230/4000;
    const source = new Set(raw.map(p => [t[0]*p[0]+t[1]*p[1]+t[2],t[3]*p[0]+t[4]*p[1]+t[5],p[2]+z].map(n => (n*scale).toFixed(7)).join(',')));
    for (const face of measured) for (const p of face.vertices) assert.ok(source.has(p.map(n => n.toFixed(7)).join(',')), 'Measured positions must remain original source posts.');
  }
});

test('every added face is gridded in all datasets and has no MICAS source code', async () => {
  const index = await json('prepared/micas-source-index.json'), codes = gunzipSync(Buffer.from(index.data, 'base64'));
  let accepted = 0, withheld = 0;
  for (const lens of ['micas','usgs','dlr','height','difference']) {
    const terrain = await json(`prepared/terrain${lens==='dlr'?'-dlr':''}.json`);
    const {data,info} = await sharp(new URL(`../../../../public/scenes/comet-19p/comet-19p-${lens}-surface@2x.webp`, import.meta.url).pathname).removeAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width, terrain.width); assert.equal(info.height, terrain.height);
    for (let i=0;i<terrain.faces.length;i++) {
      const tile=terrain.source.tileSize, columns=terrain.source.atlasColumns;
      for (let y=0;y<tile;y++) for (let x=0;x<tile;x++) {
        const pixel=(Math.floor(i/columns)*tile+y)*info.width+i%columns*tile+x;
        if (!terrain.faces[i].estimated) { if(lens==='micas' && codes[pixel]) accepted++; continue; }
        const rgb=[...data.subarray(pixel*3,pixel*3+3)];
        assert.ok(rgb.every(n=>n>=76 && n<=122) && Math.max(...rgb)-Math.min(...rgb)<=10, `${lens}: estimated face ${i} must contain neutral grid, never source imagery or science colors.`);
        if (lens==='micas') { assert.equal(codes[pixel],0); withheld++; }
      }
    }
  }
  assert.ok(accepted>100000 && withheld>500000);
});
