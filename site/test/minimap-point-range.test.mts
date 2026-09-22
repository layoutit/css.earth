import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { minimapPointRange } from '../minimap/point-range.mts';
import prepared from '../minimap/prepared.json' with { type: 'json' };
import context from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import { SCENE_OBJECTS } from '../objects.mts';

test('prepared minimap index includes every source point once without changing DOM order', () => {
  assert.equal(prepared.pointOrderX.length, prepared.points.length);
  assert.deepEqual([...prepared.pointOrderX].sort((a, b) => a - b), prepared.points.map((_, i) => i));
  assert(prepared.pointOrderX.every((id, i, order) => i === 0 || prepared.points[order[i - 1]].positionM[0] <= prepared.points[id].positionM[0]));
  const ids = new Set(SCENE_OBJECTS.map(object => object.id));
  assert.deepEqual(prepared.bodyIds, [context.focus, ...context.bodies].filter(body => ids.has(body.id)).map(body => body.id));
});

test('X range keeps inclusive duplicate boundaries and handles empty/disjoint ranges', () => {
  const points = [4, -2, 4, 9, -2].map(x => ({ positionM: [x, 0, 0] })), order = [1, 4, 0, 2, 3];
  for (const [center, radius] of [[1, 3], [4, 0], [-2, 0], [50, 2], [-50, 2], [0, 100]]) {
    const [first, end] = minimapPointRange(points, order, center, radius);
    assert.deepEqual(order.slice(first, end).sort(), points.flatMap((p, i) => p.positionM[0] >= center - radius && p.positionM[0] <= center + radius ? [i] : []).sort());
  }
  assert.deepEqual(minimapPointRange([], [], 0, 1), [0, 0]);
});

test('indexed candidates preserve exact 3D visible points across physical scales and off-origin views', () => {
  let seed = 72451;
  const random = () => (seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32;
  for (let frame = 0; frame < 200; frame++) {
    const anchor = prepared.points[Math.floor(random() * prepared.points.length)].positionM;
    const radius = 10 ** (3 + random() * 20);
    const center = anchor.map(v => v + (random() - .5) * radius * 3);
    const visible = (index: number) => Math.hypot(...prepared.points[index].positionM.map((v, i) => v - center[i])) / radius < 1;
    const [first, end] = minimapPointRange(prepared.points, prepared.pointOrderX, center[0], radius);
    const indexed = prepared.pointOrderX.slice(first, end).filter(visible).sort((a, b) => a - b);
    assert.deepEqual(indexed, prepared.points.map((_, i) => i).filter(visible));
  }
});

test('minimap retains the principal Local Group galaxies and published cluster positions', async () => {
  const {readFile}=await import('node:fs/promises');
  const {parsePreparedGalaxyCatalog,parsePreparedClusterCatalog}=await import('@cssearth/catalog');
  const read=async(path:string)=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
  const galaxies=parsePreparedGalaxyCatalog(await read('../../src/objects/local-group/prepared/catalogue.json'));
  const clusters=parsePreparedClusterCatalog(await read('../../src/objects/galaxy-clusters/prepared/catalogue.json'));
  const expected=[...galaxies.objects.filter(object=>object.membership.group==='local-group'&&object.detailedObjectId),...clusters.objects];
  assert.equal(prepared.points.filter(point=>['galaxy','galaxy-cluster'].includes(point.classification)).length,expected.length);
  for(const object of expected){
    assert.deepEqual(prepared.points.find(point=>point.id===object.id)?.positionM,object.positionM);
    assert.ok(prepared.pointMarkup.includes(`data-body="${object.id}"`));
  }
});
