import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePointTransmission, PREPARED_POINT_TRANSMISSION_SCHEMA, type DensityVolumeFrame, type PreparedBank, type PreparedPointTransmission } from '@cssearth/objects';
import { packPreparedBank } from '@cssearth/objects/node';
import { cameraPoseToReferenceFrame, presentPhysicalPoseInVolume, rotateWorldPosition, worldRotationFromQuaternion, type WorldCameraPose } from '@cssearth/engine';
import { readPreparedHere } from '../../prepared-data/readers.js';
import { pointTransmissionAt, setPointTransmission, transmissionLookup, transmissionPaints } from './prepared-transmission.js';

const frame = { referenceFrame:'test',epochJdTt:1,originM:[0,0,0] as const,localToReferenceXyzw:[0,0,0,1] as const,metersPerUnit:1,boundsUnits:{min:[-1,-1,-1] as const,max:[1,1,1] as const} };
function bank(): PreparedBank {
  const tau=new Uint16Array(64),colors=new Uint8Array(2*3*256);
  // Targets on the far side cross this test column; targets on its near face do not.
  for(let observer=0;observer<8;observer++)for(let target=0;target<8;target++)tau[observer*8+target]=target%2===0?1000:0;
  for(let level=0;level<2;level++)for(let band=0;band<3;band++)for(let value=0;value<256;value++)colors[(level*3+band)*256+value]=level?Math.round(value/(band+2)):value;
  return {schema:PREPARED_POINT_TRANSMISSION_SCHEMA,fields:{frame,targetAxes:[[-1,1],[-1,1],[-1,1]],observerAxes:[[-2,2],[-2,2],[-2,2]],thresholds:[.5]},columns:{tau,colors}};
}
const world={referenceFrame:'test',epochJdTt:1,pose:{positionM:[0,0,1.5] as const,orientationXyzw:[0,0,0,1] as const}};
test('the registered reader decodes the packed table and transfers its shared buffer once',async()=>{
  const packed=packPreparedBank(bank());
  const result=await readPreparedHere('point-transmission','https://example.test/transfer.bin',async()=>new Response(new Uint8Array(packed)));
  assert.deepEqual(result.value,parsePointTransmission(bank()));assert.equal(result.transfer.length,1);
});
test('prepared dust dims and reddens a star behind it, with an unchanged near-side style',()=>{
  const field=parsePointTransmission(bank()),lookup=transmissionLookup(field,world,frame),paints=transmissionPaints(field,'#80a0c0ff@1');
  assert.equal(lookup([0,0,.9]),0);assert.equal(paints[0],'#80a0c0ff@1');
  assert.equal(lookup([0,0,-100]),1);assert.equal(paints[1],'#403530ff@1');
  const empty=bank();empty.columns.tau!.fill(0);assert.equal(transmissionLookup(parsePointTransmission(empty),world,frame)([0,0,-100]),0);
});
test('prepared extinction respects the source frame and the selected owner',()=>{
  const field=parsePointTransmission(bank()),root={parentNode:null} as unknown as Node,child={parentNode:root} as unknown as Node,owner={};
  assert.equal(pointTransmissionAt(child),null);setPointTransmission(root,owner,field);assert.equal(pointTransmissionAt(child),field);
  const translated={...frame,originM:[0,0,1000] as const};
  assert.equal(transmissionLookup(field,world,translated)([0,0,-999]),0);
  assert.equal(transmissionLookup(field,world,translated)([0,0,-1100]),1);
  setPointTransmission(root,owner,null);assert.equal(pointTransmissionAt(child),null);
});
test('refuses malformed prepared optical tables rather than inventing missing transmission',()=>{
  const truncated=bank();assert.throws(()=>parsePointTransmission({...truncated,columns:{...truncated.columns,tau:new Uint16Array(63)}}));
  assert.throws(()=>parsePointTransmission({...bank(),fields:{...bank().fields,observerAxes:[[2,-2],[-2,2],[-2,2]]}}));
  assert.throws(()=>parsePointTransmission({...bank(),fields:{...bank().fields,thresholds:[NaN]}}));
});

/** Independent of the composed matrix: two engine rotations, then trilinear corners and the ray exit. */
function referenceLevel(field: PreparedPointTransmission, world: WorldCameraPose, source: DensityVolumeFrame, point: readonly number[]): number {
  const eye = presentPhysicalPoseInVolume(world.pose, field.frame).positionUnits;
  const inverse = worldRotationFromQuaternion([-field.frame.localToReferenceXyzw[0], -field.frame.localToReferenceXyzw[1], -field.frame.localToReferenceXyzw[2], field.frame.localToReferenceXyzw[3]]);
  const sourceRotation = worldRotationFromQuaternion(source.localToReferenceXyzw);
  const origin = rotateWorldPosition(inverse, source.originM.map((value, k) => (value - field.frame.originM[k]!) / field.frame.metersPerUnit) as [number, number, number]);
  const scaled = point.map(value => value * source.metersPerUnit / field.frame.metersPerUnit) as [number, number, number];
  let target = rotateWorldPosition(inverse, rotateWorldPosition(sourceRotation, scaled)).map((value, k) => value + origin[k]!);
  let fraction = 1;
  for (let k = 0; k < 3; k++) {
    const delta = target[k]! - eye[k]!, axis = field.targetAxes[k]!, end = delta > 0 ? axis[axis.length - 1]! : axis[0]!;
    if (delta !== 0) fraction = Math.min(fraction, Math.max(0, (end - eye[k]!) / delta));
  }
  if (fraction < 1) target = target.map((value, k) => eye[k]! + fraction * (value - eye[k]!));
  const bracket = (axes: readonly (readonly number[])[], at: readonly number[]) => axes.map((axis, k) => {
    let low = 0, high = axis.length - 1;
    while (high - low > 1) { const mid = low + high >> 1; if (axis[mid]! <= at[k]!) low = mid; else high = mid; }
    return { low, t: Math.max(0, Math.min(1, (at[k]! - axis[low]!) / (axis[low + 1]! - axis[low]!))) };
  });
  const sample = bracket(field.targetAxes, target), observer = bracket(field.observerAxes, eye);
  const targetShape = field.targetAxes.map(axis => axis.length), observerShape = field.observerAxes.map(axis => axis.length);
  const stride = targetShape.reduce((a, b) => a * b, 1);
  let tau = 0;
  for (let oa = 0; oa < 2; oa++) for (let ob = 0; ob < 2; ob++) for (let oc = 0; oc < 2; oc++) {
    const view = ((observer[0]!.low + oa) * observerShape[1]! * observerShape[2]! + (observer[1]!.low + ob) * observerShape[2]! + observer[2]!.low + oc) * stride;
    const viewWeight = (oa ? observer[0]!.t : 1 - observer[0]!.t) * (ob ? observer[1]!.t : 1 - observer[1]!.t) * (oc ? observer[2]!.t : 1 - observer[2]!.t);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      const offset = ((sample[0]!.low + a) * targetShape[1]! + sample[1]!.low + b) * targetShape[2]! + sample[2]!.low + c;
      tau += field.tau[view + offset]! * viewWeight * (a ? sample[0]!.t : 1 - sample[0]!.t) * (b ? sample[1]!.t : 1 - sample[1]!.t) * (c ? sample[2]!.t : 1 - sample[2]!.t);
    }
  }
  const value = tau / 1000;
  let level = 0; while (level < field.thresholds.length && value >= field.thresholds[level]!) level++;
  return level;
}
function volume(origin: readonly [number, number, number], quaternion: readonly [number, number, number, number], metersPerUnit: number): DensityVolumeFrame {
  return { referenceFrame: 'test', epochJdTt: 1, originM: origin, localToReferenceXyzw: quaternion, metersPerUnit, boundsUnits: { min: [-8, -8, -8], max: [8, 8, 8] } };
}
test('composed source-to-field lookup matches an independent trilinear ray, including far exits', () => {
  const targetAxes = [[-2, 0, 2], [-2, 0, 2], [-2, 0, 2]];
  const observerAxes = [[-4, 0, 4], [-4, 4], [-4, 4]];
  const stride = 27, tau = new Uint16Array(3 * 2 * 2 * stride), colors = new Uint8Array(2 * 3 * 256);
  for (let level = 0; level < 2; level++) for (let band = 0; band < 3; band++) for (let value = 0; value < 256; value++) colors[(level * 3 + band) * 256 + value] = level ? Math.round(value / (band + 2)) : value;
  for (let observer = 0; observer < 12; observer++) for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy < 3; iy++) for (let iz = 0; iz < 3; iz++) {
    const hot = ix === 1 && iy === 1 && iz === 1 || ix === 2 && iy === 2;
    tau[observer * stride + (ix * 3 + iy) * 3 + iz] = hot ? 1000 : 0;
  }
  const fieldFrame = volume([10, -20, 30], [0, 1, 0, 0], 2);
  const source = volume([14, -20, 36], [1, 0, 0, 0], 4);
  const field = parsePointTransmission({ schema: PREPARED_POINT_TRANSMISSION_SCHEMA, fields: { frame: fieldFrame, targetAxes, observerAxes, thresholds: [.5] }, columns: { tau, colors } });
  // Eye at field units [-1,-1,-1]: Ry180 maps local metres [-2,-2,-2] to [2,-2,2].
  const world = { referenceFrame: 'test', epochJdTt: 1, pose: { positionM: [12, -22, 32] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const lookup = transmissionLookup(field, world, source);
  const inside: readonly number[] = [-1, 0, 1.5], clear: readonly number[] = [0, 1, .5];
  const far: readonly number[] = [-11, -.875, 1.25], face: readonly number[] = [-2, -.875, 1.25];
  for (const point of [inside, clear, far, face]) assert.equal(lookup(point), referenceLevel(field, world, source, point));
  assert.equal(lookup(inside), 1, 'rotated scaled node is reddened');
  assert.equal(lookup(clear), 0, 'a zero bin stays clear');
  assert.equal(lookup(face), 1, 'the unclipped exit face is reddened');
  assert.equal(lookup(far), 0, 'the ray exits before the reddened face');
  assert.equal(transmissionPaints(field, '#80a0c0ff@1')[1], '#403530ff@1');
  const started = performance.now();
  let sink = 0;
  for (let n = 0; n < 20000; n++) sink += lookup(far);
  const elapsed = performance.now() - started;
  assert.equal(sink, 0);
  console.log(`transmissionLookup far-point mean ${(elapsed / 20).toFixed(3)} µs over 20000 calls`);
});
test('observer bins stay interpolated, and a point behind the eye keeps the same exit', () => {
  const targetAxes = [[-2, 2], [-2, 2], [-2, 2]], observerAxes = [[-4, 0], [-4, 4], [-4, 4]];
  const tau = new Uint16Array(2 * 2 * 2 * 8), colors = new Uint8Array(2 * 3 * 256);
  for (let ox = 0; ox < 2; ox++) for (let oy = 0; oy < 2; oy++) for (let oz = 0; oz < 2; oz++) for (let target = 0; target < 8; target++) {
    tau[(((ox * 2 + oy) * 2 + oz) * 8) + target] = ox ? 1000 : 0;
  }
  const fieldFrame = volume([0, 0, 0], [0, 0, 0, 1], 1), source = volume([0, 0, 0], [0, 0, 0, 1], 1);
  const field = parsePointTransmission({ schema: PREPARED_POINT_TRANSMISSION_SCHEMA, fields: { frame: fieldFrame, targetAxes, observerAxes, thresholds: [.5] }, columns: { tau, colors } });
  const world = { referenceFrame: 'test', epochJdTt: 1, pose: { positionM: [-2, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const lookup = transmissionLookup(field, world, source);
  assert.equal(lookup([0, 0, 0]), 1);
  assert.equal(lookup([0, 0, 0]), referenceLevel(field, world, source, [0, 0, 0]));
  const behind: readonly number[] = [-10, -1, -1];
  assert.equal(lookup(behind), referenceLevel(field, world, source, behind));
  assert.equal(lookup(behind), 1);
});

test('seeded noncommuting frame rotations preserve observer and target interpolation across repeated far rays', () => {
  let state = 45;
  const random = () => { state = Math.imul(1664525, state) + 1013904223 | 0; return (state >>> 0) / 4294967296; };
  const vector = (extent: number): [number, number, number] => [(2 * random() - 1) * extent, (2 * random() - 1) * extent, (2 * random() - 1) * extent];
  const quaternion = (): [number, number, number, number] => {
    const axis = vector(1), length = Math.hypot(...axis), angle = (2 * random() - 1) * Math.PI, s = Math.sin(angle / 2) / length;
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
  };
  const targetAxes = [[-3, -1, .2, 4], [-4, -.3, 2], [-2, .1, .9, 3]], observerAxes = [[-6, -2, 1, 6], [-5, 0, 7], [-8, 8]];
  const thresholds = [.5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], colors = new Uint8Array((thresholds.length + 1) * 3 * 256);
  const tau = Uint16Array.from({ length: 4 * 3 * 4 * 4 * 3 * 2 }, () => Math.floor(random() * 60000));
  let comparisons = 0; const bins = new Set<number>();
  for (let trial = 0; trial < 32; trial++) {
    const fieldOrigin = vector(100), fieldRotation = quaternion(), meters = 10 ** (random() * 4 - 2);
    const fieldFrame = volume(fieldOrigin, fieldRotation, meters), shift = rotateWorldPosition(worldRotationFromQuaternion(fieldRotation), vector(meters * .3));
    const source = volume([fieldOrigin[0] + shift[0], fieldOrigin[1] + shift[1], fieldOrigin[2] + shift[2]], quaternion(), meters * 10 ** (random() * 2 - 1));
    const eye = vector(12), pose = cameraPoseToReferenceFrame({ positionM: [eye[0] * meters, eye[1] * meters, eye[2] * meters], orientationXyzw: [0, 0, 0, 1] }, fieldFrame);
    const camera: WorldCameraPose = { referenceFrame: 'test', epochJdTt: 1, pose };
    const field = parsePointTransmission({ schema: PREPARED_POINT_TRANSMISSION_SCHEMA, fields: { frame: fieldFrame, targetAxes, observerAxes, thresholds }, columns: { tau, colors } });
    const lookup = transmissionLookup(field, camera, source);
    const points = [[0, 0, 0], ...Array.from({ length: 128 }, () => vector(10)), [1e6, 0, 0], [-1e6, 0, 0], [0, 1e6, 0], [0, 0, -1e6]];
    for (const point of points) {
      const expected = referenceLevel(field, camera, source, point), actual = lookup(point);
      assert.equal(actual, expected, `trial ${trial}, point ${point}`); bins.add(actual); comparisons++;
    }
    // Target bracketing mutates closure-local scalars; it must not corrupt the prepared observer weights.
    for (const point of points.slice(0, 12).reverse()) assert.equal(lookup(point), referenceLevel(field, camera, source, point));
    const withoutMap = new Proxy(points[0]!, { get(target, property, receiver) {
      if (property === 'map') throw Error('The per-target path allocated a mapped coordinate array.');
      return Reflect.get(target, property, receiver);
    } });
    assert.equal(lookup(withoutMap), referenceLevel(field, camera, source, points[0]!));
  }
  assert.equal(comparisons, 4256);
  assert.ok(bins.size >= 8, 'Equivalence must exercise many transmission bins rather than an unchanged output.');
});
