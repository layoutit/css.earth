import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parsePreparedLmcStars, mountPreparedLmcStars, type PreparedLmcStars } from './lmc-stars.js';
import { prepareCatalogue } from './prepare-lmc-stars.js';
const load = async () => JSON.parse(await readFile('labs/nebula/models/lmc-stars/prepared/stars.json', 'utf8')) as PreparedLmcStars;
const close = (a: number, b: number, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function referenceRay(p: readonly number[], f: PreparedLmcStars['frame']) {
  const [x, y, z, w] = f.localToReferenceXyzw;
  const t = [2 * (y*p[2]-z*p[1]), 2 * (z*p[0]-x*p[2]), 2 * (x*p[1]-y*p[0])];
  return [p[0]+w*t[0]+y*t[2]-z*t[1], p[1]+w*t[1]+z*t[0]-x*t[2], p[2]+w*t[2]+x*t[1]-y*t[0]]
    .map((v, i) => v + f.originM[i] / f.metersPerUnit);
}
test('all 943 prepared stars come from pinned measured V rows and preserve independent sky rays and native footprint', async () => {
  const payload = await load(), recipe = JSON.parse(await readFile('labs/nebula/models/lmc-clouds.json', 'utf8'));
  const table = await readFile('labs/nebula/models/lmc-stars/source/table3.dat', 'utf8');
  assert.equal(table.trimEnd().split('\n').length, 1268);
  const plane = JSON.parse(await readFile('labs/nebula/models/lmc-clouds/source/provenance.json', 'utf8')).volume.depthPlane;
  assert.deepEqual(prepareCatalogue(table, payload.frame, recipe.wcs, plane), payload.stars);
  assert.equal(payload.stars.length, 943);
  const frame = JSON.parse(await readFile('labs/nebula/models/lmc-clouds/object.json', 'utf8')).properties.volume;
  parsePreparedLmcStars(payload, frame);
  const radius = Math.hypot(...payload.frame.originM) / payload.frame.metersPerUnit;
  const w = recipe.wcs, rad = Math.PI / 180, [a0,d0] = w.referenceValueDeg.map((v: number) => v * rad);
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
    close(z, plane.interceptKpc + plane.xSlope*x/scale + plane.ySlope*y/scale);
    // Restoring the previous shared-radius shell must fail the actual cloud-plane condition.
    const normal = payload.frame.originM.map(v => v / Math.hypot(...payload.frame.originM));
    const oldZ = radius * p.reduce((sum,v,i) => sum+v/r*normal[i],0) - radius;
    assert.ok(Math.abs(oldZ-z) > 1e-5);
  }
  // A lost physical scale cannot pass the astrometric check.
  const s = payload.stars[0], mutated = referenceRay(s.positionUnits.map(v => v*3), payload.frame);
  assert.throws(() => close(Math.atan2(mutated[1],mutated[0])/rad, s.raDeg, 1e-9));
});
test('parser rejects mismatched frames, nonfinite geometry, duplicate identifiers and invalid display values', async () => {
  const p = await load();
  for (const mutate of [
    (v: PreparedLmcStars) => {v.frame.metersPerUnit *= 3;},
    (v: PreparedLmcStars) => {v.stars[0].positionUnits[0] = NaN;},
    (v: PreparedLmcStars) => {v.stars[1].id = v.stars[0].id;},
    (v: PreparedLmcStars) => {v.stars[0].sizePx = 500;},
  ]) {const changed=structuredClone(p);mutate(changed);assert.throws(()=>parsePreparedLmcStars(changed,p.frame));}
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
    close(y,-2000*s.positionUnits[1]/(radius+s.positionUnits[2])-s.sizePx/2,1e-8);
    assert.ok(!/filter:|gradient|mask:|blend-mode|clip-path/.test(node.style.cssText));
  }
  mount.setVisible(false); assert.equal(root.style.display,'none');mount.setVisible(true);mount.publish(frame);
  assert.deepEqual(root.children,initial);assert.equal(mount.count,943);
  mount.destroy(); assert.equal(host.children.length,0);
});
