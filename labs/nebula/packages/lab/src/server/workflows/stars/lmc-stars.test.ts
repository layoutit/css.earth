import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parsePreparedLmcStars, mountPreparedLmcStars, type PreparedLmcStars } from '@cssearth/nebula-lab/adapters/viewer/catalogue-stars';
import { worldCameraFromCenteredPresentation } from '../../../../../../../../src/renderers/css/navigation/world-camera.ts';
import { referenceRotationFromPresentation, worldRotationFromQuaternion } from '../../../../../../../../src/renderers/css/navigation/world-camera-math.ts';
import { preparedVolumeCameraTransform } from '../../../../../../../../src/renderers/css/volume/prepared-volume-runtime.ts';
import { prepareCatalogue, sampleJointDepth } from '../../../cli/commands/prepare-lmc-stars.ts';
import { sampleEncoded } from '@cssearth/bake/volume/node';
import { createObservationMapping } from '../../../adapters/preparation/observation-prior.ts';
import { loadStarCloudModel } from './lmc-star-cloud-model.ts';
import sharp from 'sharp';
const load = async () => JSON.parse(await readFile('labs/nebula/models/lmc/stars/prepared/stars.json', 'utf8')) as PreparedLmcStars;
const modelPromise = load().then(p => loadStarCloudModel(p.frame));
const close = (a: number, b: number, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function referenceRay(p: readonly number[], f: PreparedLmcStars['frame']) {
  const [x, y, z, w] = f.localToReferenceXyzw;
  const t = [2 * (y*p[2]-z*p[1]), 2 * (z*p[0]-x*p[2]), 2 * (x*p[1]-y*p[0])];
  return [p[0]+w*t[0]+y*t[2]-z*t[1], p[1]+w*t[1]+z*t[0]-x*t[2], p[2]+w*t[2]+x*t[1]-y*t[0]]
    .map((v, i) => v + f.originM[i] / f.metersPerUnit);
}
test('all 943 prepared stars come from pinned measured V rows and preserve independent sky rays and native footprint', async () => {
  const payload = await load(), recipe = JSON.parse(await readFile('labs/nebula/models/lmc/clouds.json', 'utf8'));
  const table = await readFile('labs/nebula/models/lmc/stars/source/table3.dat', 'utf8');
  assert.equal(table.trimEnd().split('\n').length, 1268);
  const model=await modelPromise, source=model.source;
  assert.deepEqual(prepareCatalogue(table, payload.frame, recipe.wcs, model), payload.stars);
  assert.equal(payload.stars.length, 943);
  const frame = JSON.parse(await readFile('labs/nebula/models/lmc/clouds/object.json', 'utf8')).properties.volume;
  parsePreparedLmcStars(payload, frame);
  const radius = Math.hypot(...payload.frame.originM) / payload.frame.metersPerUnit;
  const w = recipe.wcs, rad = Math.PI / 180, [a0,d0] = w.referenceValueDeg.map((v: number) => v * rad);
  const plane = JSON.parse(await readFile('labs/nebula/models/lmc/clouds/source/provenance.json', 'utf8')).volume.depthPlane;
  const offsets: number[] = [], density: [number, number, number, number] = [0,0,0,0], emission:[number,number,number]=[0,0,0];
  // Independent target orientation oracle reads its DISPLAY-flopped PNG directly.
  const target=await sharp(await readFile('labs/nebula/models/lmc/clouds-observation/source/target.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const signal=Float32Array.from({length:target.info.width*target.info.height},(_,i)=>(target.data[3*i]*.2126+target.data[3*i+1]*.7152+target.data[3*i+2]*.0722)/255);
  const maximum=signal.reduce((a,b)=>Math.max(a,b),0),bounds=model.mapping.boundsUnits;
  const signalAt=(x:number,y:number)=>{
    const xx=(x-bounds.min[0])/(bounds.max[0]-bounds.min[0])*target.info.width-.5;
    const yy=(bounds.max[1]-y)/(bounds.max[1]-bounds.min[1])*target.info.height-.5;
    const ix=Math.max(0,Math.min(target.info.width-1,Math.floor(xx))),iy=Math.max(0,Math.min(target.info.height-1,Math.floor(yy)));
    const tx=Math.max(0,Math.min(1,xx-ix)),ty=Math.max(0,Math.min(1,yy-iy));
    const at=(x:number,y:number)=>signal[Math.min(target.info.height-1,y)*target.info.width+target.info.width-1-Math.min(target.info.width-1,x)];
    return ((1-ty)*((1-tx)*at(ix,iy)+tx*at(ix+1,iy))+ty*((1-tx)*at(ix,iy+1)+tx*at(ix+1,iy+1)))/maximum;
  };
  for (const s of payload.stars) {
    const p = referenceRay(s.positionUnits, payload.frame), r = Math.hypot(...p);
    close(Math.atan2(p[1],p[0]) / rad, s.raDeg, 1e-9); close(Math.asin(p[2]/r)/rad, s.decDeg, 1e-9);
    // Independent direct spherical TAN inverse, without the preparation homography.
    const a = s.raDeg*rad, d = s.decDeg*rad;
    const den = Math.sin(d)*Math.sin(d0)+Math.cos(d)*Math.cos(d0)*Math.cos(a-a0);
    const east = Math.cos(d)*Math.sin(a-a0)/den, north = (Math.sin(d)*Math.cos(d0)-Math.cos(d)*Math.sin(d0)*Math.cos(a-a0))/den;
    const angle = w.rotationDeg*rad, c=Math.cos(angle), sn=Math.sin(angle);
    const fx = w.referencePixel[0]+(c*east+sn*north)/(w.scaleDeg[0]*rad);
    const fy = w.referencePixel[1]+(-sn*east+c*north)/(w.scaleDeg[1]*rad);
    assert.ok(fx >= .5 && fx <= w.referenceDimension[0]+.5 && fy >= .5 && fy <= w.referenceDimension[1]+.5);
    assert.ok(s.magnitude <= 16);
    const [x,y,z] = s.positionUnits, scale = 1 + z / radius;
    offsets.push(z - (plane.interceptKpc + plane.xSlope*x/scale + plane.ySlope*y/scale));
    sampleEncoded(source, ...s.positionUnits, density);
    assert.ok(density[3] > 0, `${s.id} was placed outside source stellar support`);
    model.cloud.sample(x/scale,y/scale,z,emission);
    assert.ok(Math.max(...emission)>0,`${s.id} has no emitting reconstructed cloud at its position`);
    const ids=model.cloud.parts.filter(part=>{part.sample(x/scale,y/scale,z,emission);return Math.max(...emission)>0;}).map(part=>part.id).sort();
    assert.deepEqual(s.cloudPartIds,ids);assert.ok(ids.some(id=>id.startsWith('extended:')));
    close(s.cloudSignal,signalAt(x/scale,y/scale),1e-12);
    assert.ok(s.cloudSignal>0 && s.cloudSignal<=1);
  }
  function assertDepthSpread(values: number[]) {
    values.sort((a,b) => a-b);
    assert.ok(values[Math.floor(values.length*.9)] - values[Math.floor(values.length*.1)] > .2,
      'The actual catalogue collapsed into a plane instead of sampling the stellar volume');
    assert.ok(new Set(values.map(z=>z.toFixed(8))).size>900, 'Depths collapsed into discrete layers');
  }
  assertDepthSpread(offsets);
  // Mutation proof: the previous fitted-plane assignment has zero residual at every measured ray.
  assert.throws(() => assertDepthSpread(offsets.map(() => 0)), /collapsed into a plane/);
  // A lost physical scale cannot pass the astrometric check.
  const s = payload.stars[0], mutated = referenceRay(s.positionUnits.map(v => v*3), payload.frame);
  assert.throws(() => close(Math.atan2(mutated[1],mutated[0])/rad, s.raDeg, 1e-9));
});
test('joint CDF preserves solid-angle weighting and rejects missing cloud/density and true support gaps', async () => {
  const model=await modelPromise, source=model.source;
  const uniform = { ...source, width: 1, height: 1, depth: 32, encodedRgba: new Uint8Array(32*4).fill(255),
    recipe: { ...source.recipe, grid: { ...source.recipe.grid, bounds: { min: [-10,-10,-1] as [number,number,number], max: [10,10,1] as [number,number,number] } } } };
  const flatCloud={...model.cloud,supportBoundsKpc:uniform.recipe.grid.bounds,
    sample(_x:number,_y:number,_z:number,out:[number,number,number]) {out.fill(1);} };
  const d=model.mapping.distanceUnits,id='Bonanos2009:test';
  const q=(createHash('sha256').update(`cssearth-joint-star-depth@1:${id}`).digest().readUInt32BE(0)+.5)/2**32;
  const expected=Math.cbrt((d-1)**3+q*((d+1)**3-(d-1)**3))-d;
  const context={source:uniform,cloud:flatCloud,mapping:model.mapping};
  close(sampleJointDepth(context,0,0,id),expected,1e-7);
  assert.equal(sampleJointDepth(context,0,0,id),sampleJointDepth(context,0,0,id));
  const gapCloud={...flatCloud,sample(_x:number,_y:number,z:number,out:[number,number,number]){out.fill(Math.abs(z-expected)<1e-6?0:1);}};
  assert.throws(()=>sampleJointDepth({...context,cloud:gapCloud},0,0,id),/zero-support gap/);
  const emptyCloud={...flatCloud,sample(_x:number,_y:number,_z:number,out:[number,number,number]){out.fill(0);}};
  assert.throws(()=>sampleJointDepth({...context,cloud:emptyCloud},0,0,id),/No joint stellar and cloud emission/);
  uniform.encodedRgba.fill(0);
  assert.throws(()=>sampleJointDepth(context,0,0,id),/No joint stellar and cloud emission/);
});
test('parser rejects mismatched frames, nonfinite geometry, duplicate identifiers and invalid display values', async () => {
  const p = await load();
  for (const mutate of [
    (v: PreparedLmcStars) => {v.frame = {...v.frame, metersPerUnit: v.frame.metersPerUnit * 3};},
    (v: PreparedLmcStars) => {v.stars[0].positionUnits[0] = NaN;},
    (v: PreparedLmcStars) => {v.stars[1].id = v.stars[0].id;},
    (v: PreparedLmcStars) => {v.stars[0].sizePx = 500;},
    (v: PreparedLmcStars) => {v.stars[0].cloudSignal = NaN;},
    (v: PreparedLmcStars) => {v.stars[0].cloudSignal = 1.1;},
    (v: PreparedLmcStars) => {v.stars[0].cloudSignal = -.01;},
    (v: PreparedLmcStars) => {delete (v.stars[0] as Partial<typeof v.stars[0]>).cloudPartIds;},
    (v: PreparedLmcStars) => {v.stars[0].cloudPartIds = [];},
  ]) {const changed=structuredClone(p);mutate(changed);assert.throws(()=>parsePreparedLmcStars(changed,p.frame));}
});
test('published magnitude drives a visible diameter and light hierarchy in the prepared catalogue', async () => {
  const { stars } = await load();
  function assertHierarchy(points: typeof stars) {
    const sorted = [...points].sort((a, b) => a.magnitude - b.magnitude);
    assert.ok(sorted[0].sizePx / sorted.at(-1)!.sizePx > 3, 'Bright and faint stars need distinct diameters');
    const light = (s: typeof stars[number]) => {
      const c = s.colorCss.slice(1).match(/../g)!.map(value => parseInt(value,16)/255);
      return s.sizePx ** 2 * s.opacity * (.2126*c[0]+.7152*c[1]+.0722*c[2]);
    };
    for (const point of sorted) {
      const expected = 10 ** (.4 * (point.magnitude - sorted[0].magnitude));
      close(light(sorted[0]) / light(point), expected, 1e-9);
    }
    assert.ok(sorted.at(-1)!.opacity < .1, 'Faint stars must not receive an opacity floor.');
    assert.ok(light(sorted[0]) / light(sorted.at(-1)!) > 200, 'Measured flux range must survive the display mapping.');
  }
  assertHierarchy(stars);
  assert.throws(() => assertHierarchy(stars.map(s => ({ ...s, sizePx: 2 }))), /distinct diameters/);
});
class Element {
  style: any = {}; dataset: any = {}; children: Element[] = []; parent?: Element; clientWidth=1000;clientHeight=800;
  ownerDocument = { createElement: () => new Element() };
  append(node: Element) {this.children.push(node);node.parent=this;}
  insertBefore(node: Element) {this.append(node);}
  remove() {if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
test('actual catalogue projects through shared camera as retained CSS points, with no second east-left reflection', async () => {
  const payload=await load(), host=new Element(), mount=mountPreparedLmcStars({host:host as unknown as HTMLElement,payload});
  const f=payload.frame, [qx,qy,qz,qw]=f.localToReferenceXyzw, radius=Math.hypot(...f.originM)/f.metersPerUnit;
  const frame = {world:{referenceFrame:f.referenceFrame,epochJdTt:f.epochJdTt,
    pose:{positionM:[0,0,0] as const,orientationXyzw:[qw,qz,-qy,-qx] as const}},
    viewport:{focalPixels:2000,widthPixels:1000,heightPixels:800,principalOffsetPixels:[0,0] as const}};
  const root=host.children[0], initial=[...root.children];mount.publish(frame);
  assert.ok(Number(root.dataset.visibleStars)>500);
  for(let i=0;i<payload.stars.length;i++) {
    const s=payload.stars[i], node=root.children[i];
    if(node.style.visibility==='hidden')continue;
    const [x,y]=node.style.transform.slice(10,-1).split(',').map((v: string) => parseFloat(v));
    close(x,2000*s.positionUnits[0]/(radius+s.positionUnits[2])-s.sizePx/2,1e-8);
    // CSS screen y points down, so prepared +y renders upward only once the camera's CSS view has
    // reversed its y row; the sign here is the prepared volume's, checked against it in the next test.
    close(y,2000*s.positionUnits[1]/(radius+s.positionUnits[2])-s.sizePx/2,1e-8);
    assert.ok(!/filter:|gradient|mask:|blend-mode|clip-path/.test(node.style.cssText));
  }
  for (const scale of [.5, 2, 3]) {
    mount.setSize(scale); mount.publish(frame);
    payload.stars.forEach((s, i) => {
      const node = root.children[i], size = s.sizePx * scale;
      close(parseFloat(node.style.width), size); close(parseFloat(node.style.height), size);
      if (node.style.visibility === 'hidden') return;
      const [x,y] = node.style.transform.slice(10,-1).split(',').map((v: string) => parseFloat(v));
      close(x + size / 2, 2000*s.positionUnits[0]/(radius+s.positionUnits[2]), 1e-8);
      close(y + size / 2, 2000*s.positionUnits[1]/(radius+s.positionUnits[2]), 1e-8);
    });
  }
  for (const invalid of [NaN, Infinity, 0, 3.1]) assert.throws(() => mount.setSize(invalid));
  mount.setVisible(false); assert.equal(root.style.display,'none');mount.setVisible(true);mount.publish(frame);
  assert.deepEqual(root.children,initial);assert.equal(mount.count,943);
  mount.destroy(); assert.equal(host.children.length,0);
});

/** Row-major proper rotations, built without a DOM: the test needs many camera orientations, not the lab's DOMMatrix. */
const axisRotation = (axis: 0 | 1 | 2, degrees: number): number[] => {
  const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180);
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};
const multiplyRotation = (a: number[], b: number[]) => [0, 1, 2].flatMap(row => [0, 1, 2]
  .map(column => a[row * 3]! * b[column]! + a[row * 3 + 1]! * b[3 + column]! + a[row * 3 + 2]! * b[6 + column]!));

test('prepared stars land exactly where the prepared volume camera puts the same XYZ, at every orbit pose', async () => {
  const payload = await load(), host = new Element();
  const mount = mountPreparedLmcStars({ host: host as unknown as HTMLElement, payload });
  const root = host.children[0], f = payload.frame;
  // The lab's inspection camera: the presentation looks along Rx(180), then orbits in yaw and pitch.
  const presentationToReference = referenceRotationFromPresentation(worldRotationFromQuaternion(f.localToReferenceXyzw));
  const distanceUnits = Math.hypot(...f.originM) / f.metersPerUnit;
  const viewport = { focalPixels: 2000, widthPixels: 1000, heightPixels: 800, principalOffsetPixels: [0, 0] as const };
  const base = axisRotation(0, 180);
  const poses: [number, number][] = [[0, 0], [20, 0], [-20, 0], [60, 0], [-60, 0], [90, 0], [-90, 0],
    [0, 20], [0, -20], [0, 60], [0, -60], [0, 90], [0, -90], [35, 27], [-48, 133]];
  let checked = 0;
  for (const [pitch, yaw] of poses) {
    const rotation = multiplyRotation(multiplyRotation(axisRotation(0, pitch), axisRotation(1, yaw)), base);
    const world = worldCameraFromCenteredPresentation({ rotation, distanceUnits },
      { referenceFrame: f.referenceFrame, epochJdTt: f.epochJdTt, originM: f.originM,
        presentationToReference, metersPerUnit: f.metersPerUnit, bodyRadiusM: f.metersPerUnit }, viewport);
    const publication = { world, viewport };
    mount.publish(publication);
    // The volume's own camera, from the renderer that mounts the slabs: prepared vertices arrive in
    // [y,x,z] order at 50 CSS px per unit and are flattened by the camera's CSS perspective.
    const transform = preparedVolumeCameraTransform(publication, f, 50);
    const [ox, oy] = viewport.principalOffsetPixels;
    payload.stars.forEach((star, index) => {
      const node = root.children[index];
      if (node.style.visibility === 'hidden') return;
      const point = [star.positionUnits[1] * 50, star.positionUnits[0] * 50, star.positionUnits[2] * 50];
      const eye = [0, 1, 2].map(row => transform.rotation[row * 3]! * point[0]! + transform.rotation[row * 3 + 1]! * point[1]! +
        transform.rotation[row * 3 + 2]! * point[2]! + transform.translationCssPixels[row]!);
      const near = transform.focalPixels - eye[2]!;
      assert.ok(near > 0, 'A visible prepared star must sit in front of the volume camera.');
      const volumeX = ox + (eye[0]! - ox) * transform.focalPixels / near;
      const volumeY = oy + (eye[1]! - oy) * transform.focalPixels / near;
      const [x, y] = node.style.transform.slice(10, -1).split(',').map((v: string) => parseFloat(v));
      close(x + star.sizePx / 2, volumeX, 1e-6);
      close(y + star.sizePx / 2, volumeY, 1e-6);
      checked++;
    });
  }
  assert.ok(checked > 10000, `Too few star/pose projections compared: ${checked}`);
  mount.destroy();
});

test('actual prepared cloud signal and part membership govern retained star support', async () => {
  const payload=await load(),host=new Element(),mount=mountPreparedLmcStars({host:host as unknown as HTMLElement,payload});
  const f=payload.frame,[qx,qy,qz,qw]=f.localToReferenceXyzw;
  const camera={world:{referenceFrame:f.referenceFrame,epochJdTt:f.epochJdTt,
    pose:{positionM:[0,0,0] as const,orientationXyzw:[qw,qz,-qy,-qx] as const}},
    viewport:{focalPixels:2000,widthPixels:1000,heightPixels:800,principalOffsetPixels:[0,0] as const}};
  const root=host.children[0],nodes=[...root.children],allParts=[...new Set(payload.stars.flatMap(s=>s.cloudPartIds))];
  const shown=()=>root.children.filter(n=>n.style.visibility!=='hidden').map(n=>n.dataset.catalogueSource).sort();
  mount.publish(camera);assert.equal(shown().length,943);
  const transforms=nodes.map(n=>n.style.transform),cameraBefore=JSON.stringify(camera);
  for(const removed of [false,true]) {
    mount.setCloudSupport({cutoff:.3,softness:0,showRemoved:removed},allParts);mount.publish(camera);
    const expected=payload.stars.filter(s=>removed?s.cloudSignal<.3:s.cloudSignal>=.3).map(s=>s.id).sort();
    assert.ok(expected.length>0 && expected.length<943,'real cutoff must partition the catalogue');
    assert.deepEqual(shown(),expected);assert.equal(Number(root.dataset.visibleStars),expected.length);
    payload.stars.forEach((s,i)=>close(Number(nodes[i].style.opacity),expected.includes(s.id)?s.opacity:0));
  }
  mount.setCloudSupport({cutoff:0,softness:.25,showRemoved:false},[]);mount.publish(camera);
  assert.equal(shown().length,0);assert.equal(root.dataset.visibleStars,'0');
  mount.setCloudSupport({cutoff:0,softness:.25,showRemoved:false},allParts);mount.publish(camera);
  assert.equal(shown().length,943);assert.deepEqual(root.children,nodes);
  assert.deepEqual(nodes.map(n=>n.style.transform),transforms);assert.equal(JSON.stringify(camera),cameraBefore);
  mount.destroy();
});
