import {shape,array,text,number,optional,boolean} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { rasterAtlasLayout, validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';

const root = new URL('../../../../src/objects/comet-19p/', import.meta.url);
const json = async (path: string|URL) => JSON.parse((await readFile(new URL(path, root))).toString('utf8'));

test('both completed Borrelly banks close around source-backed terrain', async () => {
  for (const [file, measuredCount, completedCount] of [['terrain',452,994],['terrain-dlr',799,1862]] as const) {
    const terrain=shape({faces:array(shape({estimated:optional(boolean),vertices:array(array(number))})),source:shape({path:text,grid:shape({xyTransform:array(number),zOffsetMeters:number})})})(await json(`prepared/${file}.json`)),positions:number[][]=[],lookup=new Map<string,number>();
    assert.equal(terrain.faces.filter(face => !face.estimated).length, measuredCount);
    assert.equal(terrain.faces.length, completedCount);
    const indices = terrain.faces.flatMap(face => face.vertices.map(p => {
      const key = p.join(',');
      if (!lookup.has(key)) { lookup.set(key, positions.length); positions.push(p); }
      return required(lookup.get(key));
    }));
    const topology = validateClosedMesh(indices, positions);
    assert.equal(topology.components, 1); assert.equal(topology.eulerCharacteristic, 2);
    const measured = terrain.faces.filter(face => !face.estimated);
    const raw = (await readFile(new URL(`source/${terrain.source.path}`, root), 'utf8')).trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number));
    const t = terrain.source.grid.xyTransform, z = terrain.source.grid.zOffsetMeters, scale = 230/4000;
    const source = new Set(raw.map(p => [t[0]*p[0]+t[1]*p[1]+t[2],t[3]*p[0]+t[4]*p[1]+t[5],p[2]+z].map(n => (n*scale).toFixed(7)).join(',')));
    for (const face of measured) for (const p of face.vertices) assert.ok(source.has(p.map((n: number) => n.toFixed(7)).join(',')), 'Measured positions must remain original source posts.');
  }
});

test('every added face is gridded in all datasets and has no MICAS source code', async () => {
  // A single-photograph lens has no source index: its atlas and transfer counts already say where MICAS was sampled.
  let withheld = 0;
  for (const lens of ['micas','usgs','dlr','height','difference']) {
    const terrain = await json(`prepared/terrain${lens==='dlr'?'-dlr':''}.json`);
    const {data,info} = await sharp(new URL(`../../../../public/scenes/comet-19p/comet-19p-${lens}-surface@2x.webp`, import.meta.url).pathname).removeAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width, terrain.width); assert.equal(info.height, terrain.height);
    const layout = rasterAtlasLayout(terrain.faces, terrain.source.texelsPerFace, 1);
    assert.equal(layout.width, terrain.width); assert.equal(layout.height, terrain.height);
    for (let i=0;i<terrain.faces.length;i++) {
      if (!terrain.faces[i].estimated) continue;
      const {rect} = layout.plans[i];
      for (let y=0;y<rect.height;y++) for (let x=0;x<rect.width;x++) {
        const pixel=(rect.y+y)*info.width+rect.x+x;
        const rgb=[...data.subarray(pixel*3,pixel*3+3)];
        assert.ok(rgb.every(n=>n>=76 && n<=122) && Math.max(...rgb)-Math.min(...rgb)<=10, `${lens}: estimated face ${i} must contain neutral grid, never source imagery or science colors.`);
        if (lens==='micas') withheld++;
      }
    }
  }
  const surfaces = await json('prepared/surfaces.json');
  const micas = (Array.isArray(surfaces) ? surfaces : surfaces.surfaces).find((surface: { id: string }) => surface.id === 'micas');
  assert.ok(Number(micas.observation.transfer.counts.accepted) > 100000 && withheld > 500000);
});
