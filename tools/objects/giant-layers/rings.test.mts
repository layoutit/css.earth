import { fixtureRecord } from '../../contract/test-values.mts';
import type { SourcePin } from './radial-contract.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { readFile } from 'node:fs/promises';
import { mapRadius, ringRayOccluded, rasterAnnularField } from './rings.mts';
import { parseRadialLayerRecipe } from './index.mts';
const test = sourceTest();

const recipe = () => ({schema:'cssearth-radial-layer-recipe@1',units:'kilometers',sources:[] as SourcePin[],layers:[{
  kind:'annular-field',size:9,densities:[1],output:'hypothetical-ring{suffix}.webp',encoding:{lossless:true},
  outerRadius:4,mapping:{kind:'linear',scale:1},grid:{centerInset:1,sampleOffset:0,marginPixels:0,scaleOrder:'divide-multiply'},
  composition:'maximum',alphaUnits:255,maximumAlpha:255,
  bands:[{envelope:'constant',bounds:[2,3],opacity:90,color:[10,20,30]}],
}]});

test('annular preparation is driven by physical band data for an unregistered body', () => {
  const input = parseRadialLayerRecipe(recipe());
  const layer = input.layers[0];
  assert.equal(layer.kind, 'annular-field');
  if (layer.kind !== 'annular-field') throw new Error('Expected annular fixture');
  const pixels = rasterAnnularField(layer,9);
  const pixel = (x: number,y: number) => [...pixels.subarray((y*9+x)*4,(y*9+x)*4+4)];
  assert.deepEqual(pixel(4,4),[0,0,0,0]);
  assert.deepEqual(pixel(6,4),[10,20,30,90]);
  assert.deepEqual(pixel(7,4),[10,20,30,90]);
  assert.deepEqual(pixel(8,4),[0,0,0,0]);
  const band = layer.bands[0];
  assert.ok('bounds' in band);
  Object.assign(band,{bounds:[1,2]});
  assert.equal(rasterAnnularField(layer,9)[(4*9+7)*4+3],0);
});

test('piecewise logarithmic physical radii preserve authored anchor and inverse values', () => {
  const mapping: Parameters<typeof mapRadius>[1]={kind:'piecewise-log',knots:[[10,1],[100,3],[1000,6]]};
  assert.equal(mapRadius(10,mapping),1);
  assert.equal(mapRadius(100,mapping),3);
  assert.equal(mapRadius(1000,mapping),6);
  for (const radius of [20,90,110,500,1300]) assert.ok(Math.abs(mapRadius(mapRadius(radius,mapping),mapping,true)-radius)<1e-9);
});

test('ring shadow uses the authored oblate body and a forward ray', () => {
  const shadow: Parameters<typeof ringRayOccluded>[2]={luminance:1,direction:[1,0,0],equatorialRadius:2,polarRadius:1};
  assert.equal(ringRayOccluded(-4,0,shadow),true);
  assert.equal(ringRayOccluded(4,0,shadow),false);
  assert.equal(ringRayOccluded(-4,3,shadow),false);
});

test('invalid recipes fail before raster output', () => {
  for (const mutate of [
(input: unknown)=>fixtureRecord(input,'layers',0).size=Infinity,
(input: unknown)=>fixtureRecord(input,'layers',0).output='../escaped{suffix}.webp',
(input: unknown)=>fixtureRecord(input,'layers',0,'bands',0).envelope='unimplemented',
(input: unknown)=>fixtureRecord(input,'layers',0).mapping={kind:'piecewise-log',knots:[[1,1],[2,1]]},
(input: unknown)=>fixtureRecord(input).sources=[{path:'../source'}],
  ]) { const input=recipe();mutate(input);assert.throws(()=>parseRadialLayerRecipe(input),TypeError); }
});


test('ring wedges cover every point of their sectors from where the ring begins, and share their boundaries exactly', async () => {
  const { ringWedgeLayout, wedgePoint, wedgeShare, wedgeMatrix } = await import('../../../src/renderers/css/preparation/scene/ring-wedges.ts');
  const layout = ringWedgeLayout({ size: 1200, count: 16, contentPixels: 213.4 });
  let seed = 3;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let trial = 0; trial < 2000; trial++) {
    const radius = 213.4 + random() * (600 - 213.4), angle = random() * 2 * Math.PI;
    const shares = layout.angles.map((_, k) => wedgeShare(layout, k, radius * 2, angle));
    assert.ok(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1) < 1e-9, `shares at ${radius}, ${angle} sum to ${shares.reduce((a, b) => a + b, 0)}`);
    // Every wedge with a share holds the point inside its rectangle.
    for (const [k, share] of shares.entries()) {
      if (share === 0) continue;
      const t = layout.angles[k], x = radius * Math.cos(angle), y = radius * Math.sin(angle);
      const a = Math.cos(t) * x + Math.sin(t) * y - layout.innerPixels, b = -Math.sin(t) * x + Math.cos(t) * y + layout.halfHeight;
      assert.ok(a >= -1e-9 && a <= layout.width + 1e-9 && b >= -1.5 && b <= layout.height + 1.5, `wedge ${k} misses ${radius}, ${angle}`);
      const [px, py] = wedgePoint(layout, k, a, b);
      assert.ok(Math.hypot(px - x, py - y) < 1e-9);
    }
  }
  // At angle zero the wedge lands where the single square leaf put the same image point, whose matrix swaps x and y.
  const scale = 1.7, half = scale * 1200 / 2, m = wedgeMatrix(layout, 0, scale).split(',').map(Number);
  for (const [a, b] of [[0, 0], [10.5, 3.25], [layout.width, layout.height]]) {
    const imageX = 600 + layout.innerPixels + a, imageY = 600 - layout.halfHeight + b;
    const wedge = [m[0] * a + m[4] * b + m[12], m[1] * a + m[5] * b + m[13]], square = [scale * imageY - half, scale * imageX - half];
    assert.ok(Math.hypot(wedge[0] - square[0], wedge[1] - square[1]) < 1e-5, `matrix moves ${a}, ${b}`);
  }
  assert.throws(() => ringWedgeLayout({ size: 1200, count: 2, contentPixels: 200 }), /three wedges/);
});

test('ring wedges draw exactly the square ring image inside each wedge, arcs included', async () => {
  const { rasterAnnularField, rasterAnnularWedges, annularContentPixels } = await import('./rings.mts');
  const { ringWedgeLayout, wedgePoint, wedgeShare } = await import('../../../src/renderers/css/preparation/scene/ring-wedges.ts');
  for (const body of ['uranus', 'neptune']) {
    const recipe = JSON.parse(await readFile(new URL(`../../../src/objects/${body}/source/preparation/rings.json`, import.meta.url), 'utf8'));
    const layer = { ...recipe.layers[0], overlays: undefined, size: 600 }, density = 2, size = layer.size * density;
    const layout = ringWedgeLayout({ size: layer.size, count: 16, contentPixels: annularContentPixels(layer) });
    const square = rasterAnnularField(layer, size), atlas = rasterAnnularWedges(layer, density, layout), width = layout.width * density;
    let compared = 0, drawn = 0;
    for (let k = 0; k < layout.count; k++) for (let j = 0; j < layout.height * density; j += 2) for (let i = 0; i < width; i += 2) {
      const [x, y] = wedgePoint(layout, k, (i + 0.5) / density, (j + 0.5) / density);
      if (wedgeShare(layout, k, Math.hypot(x, y) * density, Math.atan2(y, x)) < 1) continue;
      // Compare where the wedge pixel's centre is a square pixel's centre: every wedge at a multiple of 90°.
      const column = x * density + size / 2 - 0.5, row = y * density + size / 2 - 0.5;
      if (Math.abs(column - Math.round(column)) > 1e-6 || Math.abs(row - Math.round(row)) > 1e-6) continue;
      const a = ((k * layout.height * density + j) * width + i) * 4, s = (Math.round(row) * size + Math.round(column)) * 4;
      assert.deepEqual([...atlas.subarray(a, a + 4)], [...square.subarray(s, s + 4)], `${body} wedge ${k} texel ${i}, ${j}`);
      compared++; if (square[s + 3]) drawn++;
    }
    assert.ok(compared > 20000 && drawn > 500, `${body}: compared ${compared}, ${drawn} drawn`);
  }
});
