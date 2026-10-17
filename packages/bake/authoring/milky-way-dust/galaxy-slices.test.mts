import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { galaxySlices, galaxyCompletedImageOpacity, record } from './galaxy-slices.mts';
import {writeGalaxyGolden} from './galaxy-slice-golden.mts';

const directory=mkdtempSync(join(tmpdir(),'galaxy-slices-golden-'));
after(()=>rmSync(directory,{recursive:true,force:true}));
writeGalaxyGolden(directory);
const input:unknown=JSON.parse(readFileSync(join(directory,'prototype.json'),'utf8'));
record(record(input).field).record='runs/b30-native-scatterFaceSide/fit-crisp.json';
const frame:unknown=JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way-volume/source/preparation/b30/frame.json',import.meta.url),'utf8'));

test('accepted b30 keeps its Sun-centred Galactic frame, kpc conversion and all physical slab centres', () => {
  const prepared = galaxySlices(input, frame, directory);
  assert.equal(prepared.frame.metersPerUnit, Number(record(frame).metersPerUnit) * 1000);
  assert.deepEqual(prepared.frame.originM, record(frame).originM);
  assert.deepEqual(prepared.frame.localToReferenceXyzw, record(frame).localToReferenceXyzw);
  const counts = record(input).counts;
  assert.ok(Array.isArray(counts) && counts.every(n => typeof n === 'number'));
  assert.equal(prepared.slices.quads.length, counts.reduce((a: number, b: number) => a + b, 0));
  assert.ok(prepared.slices.quads.length * 3 + 16 <= 500);
  for (const axis of ['x', 'y', 'z'] as const) {
    const quads = prepared.slices.quads.filter(quad => quad.axis === axis), a = 'xyz'.indexOf(axis);
    const count: number = counts[a], lo = prepared.frame.boundsUnits.min[a]!, hi = prepared.frame.boundsUnits.max[a]!;
    assert.equal(quads.length, count);
    for (const quad of quads) {
      const intervals = record(input).intervals;
      const positions = intervals && record(intervals)[axis] ? record(record(intervals)[axis]).centers : undefined;
      const depth = Array.isArray(positions) ? Number(positions[quad.sliceIndex]) : lo + (quad.sliceIndex + .5) * (hi - lo) / count;
      assert.ok(Math.abs(quad.center[a] - depth) < 1e-12);
      for (const vertex of quad.vertices) assert.ok(Math.abs(vertex[a] - depth) < 1e-12);
    }
  }
});

test('missing, repeated, misplaced or misidentified slabs fail before installation', () => {
  for (const corrupt of [
    (data: Record<string, unknown>) => { data.leaves = []; },
    (data: Record<string, unknown>) => { const leaves = data.leaves as unknown[]; leaves[1] = leaves[0]; },
    (data: Record<string, unknown>) => { record((data.leaves as unknown[])[0]).center = 999; },
    (data: Record<string, unknown>) => { record(data.field).record = 'another-fit.json'; },
  ]) {
    const data = record(structuredClone(input)); corrupt(data);
    assert.throws(() => galaxySlices(data, frame, directory));
  }
});

test('the slab count cap includes all three optical copies and reserved scene wrappers', () => {
  const data = record(structuredClone(input));
  const counts = [64, 64, 34], box = record(data.field).box;
  assert.ok(Array.isArray(box));
  data.counts = counts;
  const fixture = mkdtempSync(join(tmpdir(), 'galaxy-piece-cap-'));
  const leaves: unknown[] = [];
  try {
    for (const [axisIndex, axis] of ['x', 'y', 'z'].entries()) {
      mkdirSync(join(fixture, axis!));
      for (let index = 0; index < counts[axisIndex]!; index++) {
        const texturePath = `${axis}/${String(index).padStart(3, '0')}.png`;
        symlinkSync(join(directory, axis!, '000.png'), join(fixture, texturePath));
        leaves.push({ axis, index, center: box[axisIndex * 2] + (index + .5) * (box[axisIndex * 2 + 1] - box[axisIndex * 2]) / counts[axisIndex]!,
          width: 401, height: axis === 'z' ? 401 : 161, texturePath });
      }
    }
    data.leaves = leaves;
    assert.throws(() => galaxySlices(data, frame, fixture), /500 pieces/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('the accepted default freezes exposure and rejects experimental controls',async()=>{
 const {parseGalaxySliceControls}=await import('./slice-galaxy.mts');
 assert.deepEqual(parseGalaxySliceControls({}),{mode:'outside-display',counts:[26,26,26],axes:[0,1,2],displayScale:0.044094241663168915,dustAlpha:1});
 for(const flag of ['one-sided-pilot','two-layer-z','calibration-job','z-placement','defer-display-gain','display-scale','dust-alpha'])assert.throws(()=>parseGalaxySliceControls({[flag]:'on'}),/Unsupported experimental/);
 assert.throws(()=>parseGalaxySliceControls({counts:'64,64,34'}),/500 pieces/);
 for(const mode of ['legacy','column-tone','nasa-display'])assert.throws(()=>parseGalaxySliceControls({mode}),/Only outside-display/);
 assert.equal(galaxyCompletedImageOpacity({}),1);
 for(const completedImageOpacity of [0,.12,1.1,'0.12',NaN])assert.throws(()=>galaxyCompletedImageOpacity({completedImageOpacity}));
});

test('extended rectangles preserve the frame, every stacking depth and sorting anchor', () => {
  const base=galaxySlices(input,frame,directory),data=record(structuredClone(input));
  assert.ok(Array.isArray(data.leaves));
  for(const value of data.leaves){const leaf=record(value),axis=String(leaf.axis),a='xyz'.indexOf(axis),h=a===0?1:0,v=a===2?1:2;
    const lo=base.frame.boundsUnits.min,hi=base.frame.boundsUnits.max;
    leaf.imageBounds=[lo[h]!-.8,hi[h]!+1.6,lo[v]!-.4,hi[v]!+.8];
  }
  const extended=galaxySlices(data,frame,directory);
  assert.deepEqual(extended.frame,base.frame,'image size must not change handover normalization');
  assert.deepEqual(extended.slices.approximation,base.slices.approximation);
  for(const [i,quad] of extended.slices.quads.entries()){
    const previous=base.slices.quads[i]!,a='xyz'.indexOf(quad.axis);
    assert.deepEqual(quad.center,previous.center,'image rectangle must not move its sorting anchor');
    assert.deepEqual(quad.vertices.map(p=>p[a]),previous.vertices.map(p=>p[a]),'stacking range/spacing must stay fixed');
    assert.notDeepEqual(quad.vertices,previous.vertices,'the image extent must actually grow');
  }
  record(data.leaves[0]).imageBounds=[0,0,0,0];
  assert.throws(()=>galaxySlices(data,frame,directory),/contain the canonical footprint/);
});
