import { cross3 as cross } from '../../../../src/platform/vector3.mts';
import { prepareProjectiveTextureLayer } from "../../../../src/platform/projective-surface-raster.mts";

import type { PageAddress, GeographicScene, GeographicLeaf, GeographicBounds, PolarBounds, PageGeometry, PolarProjection, PolarPlane } from './contracts.mts';
export const CITY_PAGE_PIXELS = 1024;
export const CITY_PAGE_GUTTER = 8;
export const CITY_PAGE_LAST_LEVEL = 7;
export const CITY_POLAR_PAGE_LAST_LEVEL = 8;
// Bounded regional pages need a native-sized raster box. The 128px whole-body
// box loses city texels in Chrome; this does not change the coarse Earth leaves.
export const CITY_PAGE_RASTER_SCALE = 32;

export function cityPageRasterDensity(level: number) {
  if(!Number.isSafeInteger(level)||level<0||level>CITY_POLAR_PAGE_LAST_LEVEL)throw new Error('Invalid city raster level.');
  return 2**Math.min(0,level-3);
}

export function pageBounds({ level, x, y }: PageAddress): GeographicBounds | PolarBounds {
  const factor = 2 ** level;
  const step = 11.25 / factor;
  if (!Number.isSafeInteger(level) || level < 0 || level > CITY_POLAR_PAGE_LAST_LEVEL ||
      !Number.isSafeInteger(x) || x < 0 || x >= 32 * 2 ** level ||
      !Number.isSafeInteger(y) || y < 0 || y >= 16 * 2 ** level) {
    throw new Error("Invalid prepared city page address.");
  }
  const band = Math.floor(y / factor);
  if (band === 0 || band === 15) {
    // One square retained face per pole. Reserve only its first x root; the
    // other 31 longitude roots do not exist on the accepted polar geometry.
    if (x >= factor) throw new Error("Invalid polar city page address.");
    return { projection: "polar", hemisphere: band === 15 ? "north" : "south",
      u0: x / factor, u1: (x + 1) / factor,
      v0: (y % factor) / factor, v1: (y % factor + 1) / factor };
  }
  if (level > CITY_PAGE_LAST_LEVEL) throw new Error("Invalid regular city page level.");
  return { west: x * step, east: (x + 1) * step,
    south: y * step - 90, north: (y + 1) * step - 90 };
}

export function pageKey({ level, x, y }: PageAddress) {
  return `${level}-${x}-${y}`;
}

// Geographic placement is independent of the renderer's prepared raster box.
// PR2 bakes that warp into surface atlases and retains this original face basis.
export function cityGeographicFrame(leaf: GeographicLeaf) {
  return leaf.geographicFrameMatrix ?? leaf.style.match(/matrix3d\(([^)]+)\)/)![1];
}

// Partition the accepted face itself, including its presentation apron. Paging
// nominal geographic rectangles left that apron uncovered: a neighboring coarse
// face could cover city texels. Geographic reprojection belongs in preparation.
export function prepareCityPageGeometry(address: PageAddress, scene: GeographicScene): PageGeometry {
  const bounds = pageBounds(address);
  const factor = 2 ** address.level;
  const bandIndex = Math.floor(address.y / factor);
  if (bounds.projection === "polar") {
    return preparePolarCityPageGeometry(address, scene, bounds);
  }
  // City addresses use geographic 0..360 degrees. Blue Marble's left edge is
  // the antimeridian, so its accepted mesh/atlas origin is 180 degrees away.
  // Resolve that offset once when choosing the accepted coarse face.
  const meshWest = (bounds.west + 180) % 360;
  const longitudeIndex = Math.floor(meshWest / 11.25);
  const leaf = scene.body.bands.find((band) => band.latitudeIndex === bandIndex)!
    .leaves[longitudeIndex];
  const matrix = cityGeographicFrame(leaf).split(",").map(Number);
  const gutterDegrees = (bounds.east - bounds.west) * CITY_PAGE_GUTTER / CITY_PAGE_PIXELS;
  const outer = {
    west: bounds.west - gutterDegrees, east: bounds.east + gutterDegrees,
    south: bounds.south - gutterDegrees, north: bounds.north + gutterDegrees,
  };
  const { x0, y0, x1, y1, ...patch } = prepareFacePatch(matrix, 32, address);
  const page: PageGeometry = { key: pageKey(address), ...address, bounds, outer, ...patch, sourceBounds: outer };
  const inverse = canonicalFaceInverse(scene,bandIndex,longitudeIndex);
  const local = [x1-x0,0,x0, 0,y1-y0,y0,
    matrix[3]*(x1-x0),matrix[7]*(y1-y0),1+matrix[3]*x0+matrix[7]*y0];
  const nominalWest=Math.floor(address.x/factor)*11.25;
  page.geographicMatrix=multiply3([11.25,0,nominalWest,0,11.25,bandIndex*11.25-90,0,0,1],
    multiply3(inverse,local));
  const geographic=createCityGeographicSampler(page);
  const sourceCorners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>geographic(u,v));
  page.sourceBounds={west:Math.min(...sourceCorners.map(p=>p[0])),east:Math.max(...sourceCorners.map(p=>p[0])),
    south:Math.min(...sourceCorners.map(p=>p[1])),north:Math.max(...sourceCorners.map(p=>p[1]))};
  return page;
}

function prepareFacePatch(matrix: number[], side: number, address: PageAddress) {
  const factor = 2 ** address.level;
  const margin = CITY_PAGE_GUTTER / CITY_PAGE_PIXELS;
  const x0 = side * (address.x % factor - margin) / factor;
  const y0 = side * (address.y % factor - margin) / factor;
  const x1 = side * (address.x % factor + 1 + margin) / factor;
  const y1 = side * (address.y % factor + 1 + margin) / factor;
  const transform = [...matrix];
  for (let row = 0; row < 4; row += 1) {
    transform[row] = matrix[row] * (x1 - x0) / 32;
    transform[row + 4] = matrix[row + 4] * (y1 - y0) / 32;
    transform[row + 12] = matrix[row] * x0 + matrix[row + 4] * y0 + matrix[row + 12];
  }
  const denominator = transform[15];
  for (let i = 0; i < 16; i += 1) transform[i] /= denominator;
  // Sub-metre prepared separation from the coarse plane, not a new radius.
  const normal = matrix.slice(8, 11);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      transform[column * 4 + row] += normal[row] * 0.001 * transform[column * 4 + 3];
    }
  }
  const corners = [[0, 0], [32, 0], [32, 32], [0, 32]].map(([x, y]) => {
    const w = transform[3] * x + transform[7] * y + transform[15];
    if (w <= 0 || !Number.isFinite(w)) throw new Error("Invalid prepared city homography.");
    return [0, 1, 2].map((row) =>
      (transform[row] * x + transform[row + 4] * y + transform[row + 12]) / w);
  });
  const layer = prepareProjectiveTextureLayer(transform.join(","), CITY_PAGE_RASTER_SCALE);
  return {
    x0, y0, x1, y1, corners, normal,
    width: CITY_PAGE_PIXELS + 2 * CITY_PAGE_GUTTER,
    height: CITY_PAGE_PIXELS + 2 * CITY_PAGE_GUTTER,
    frameMatrix: layer.frameMatrix,
    textureMatrix: layer.textureMatrix,
  };
}

// Preparation only. u/v address the complete page, including gutters; v grows
// northward like the retained face. Return unwrapped geographic longitude.
export function createCityGeographicSampler(page: Pick<PageGeometry, 'geographicMatrix' | 'geographicProjection'>) {
  if (page.geographicProjection?.type === "polar") return polarGeographicSampler(page.geographicProjection);
  const m=page.geographicMatrix;
  if (!m) throw new TypeError("Prepared geographic matrix is missing.");
  return (u: number,v: number) => {
    const w=m[6]*u+m[7]*v+m[8];
    return [(m[0]*u+m[1]*v+m[2])/w,(m[3]*u+m[4]*v+m[5])/w];
  };
}

const dot=(a: readonly number[],b: readonly number[])=>a.reduce((sum,v,i)=>sum+v*b[i],0);

const multiply3=(a: readonly number[],b: readonly number[])=>Array.from({length:9},(_,i)=>[0,1,2].reduce((sum,k)=>sum+a[Math.floor(i/3)*3+k]*b[k*3+i%3],0));
function inverse3(m: readonly number[]) {
  const a=cross(m.slice(3,6),m.slice(6,9)),b=cross(m.slice(6,9),m.slice(0,3)),c=cross(m.slice(0,3),m.slice(3,6));
  const determinant=dot(m.slice(0,3),a);
  if(Math.abs(determinant)<1e-12)throw new Error('Singular prepared geographic mapping.');
  return [a[0],b[0],c[0],a[1],b[1],c[1],a[2],b[2],c[2]].map(v=>v/determinant);
}
const faceCaches=new WeakMap<GeographicScene, Map<string, number[]>>();
function acceptedFace(scene: GeographicScene, b: number, x: number) {
  if(b<0||b>15)throw new Error('Invalid accepted face.');
  const leafIndex=b===0||b===15?0:(x+32)%32;
  const m=cityGeographicFrame(scene.body.bands.find(p=>p.latitudeIndex===b)!.leaves[leafIndex]).split(',').map(Number);
  const origin=m.slice(12,15),u=origin.map((v,i)=>m[i]-m[3]*v),v=origin.map((v,i)=>m[i+4]-m[7]*v);
  let normal: number[]=cross(u,v);normal=normal.map(n=>n/Math.hypot(...normal));
  return {origin,u,v,normal,d:dot(normal,origin)};
}
function canonicalFaceInverse(scene: GeographicScene,band: number,longitude: number) {
  let cache=faceCaches.get(scene);
  if(!cache){cache=new Map();faceCaches.set(scene,cache);}
  const key=`${band}-${longitude}`;
  if(cache.has(key))return cache.get(key)!;
  const face=(b: number,x: number)=>acceptedFace(scene,b,x);
  const vertex=(b: number,x: number)=>{
    // Each pole is one retained planar cap, not another row of 32 faces.
    // Its real plane supplies the third constraint at the transition. Reusing
    // a neighboring band's slope would make the prepared edges disagree.
    const planes=b===1?[face(0,0),face(1,x-1),face(1,x)]:
      b===15?[face(14,x-1),face(14,x),face(15,0)]:
      [face(b-1,x-1),face(b-1,x),face(b,x-1),face(b,x)];
    // Least-squares intersection only absorbs rounding in the accepted matrices.
    // It does not move the face planes or derive a new sphere.
    const a=Array.from({length:9},(_,i)=>planes.reduce((sum,p)=>sum+p.normal[Math.floor(i/3)]*p.normal[i%3],0));
    const rhs=[0,1,2].map(i=>planes.reduce((sum,p)=>sum+p.normal[i]*p.d,0));
    const inverse=inverse3(a);
    return [0,1,2].map(i=>dot(inverse.slice(i*3,i*3+3),rhs));
  };
  const plane=face(band,longitude),uu=dot(plane.u,plane.u),vv=dot(plane.v,plane.v),uv=dot(plane.u,plane.v),det=uu*vv-uv*uv;
  const points=[[band,longitude],[band,longitude+1],[band+1,longitude+1],[band+1,longitude]].map(([b,x])=>{
    const p=vertex(b,x).map((v,i)=>v-plane.origin[i]),pu=dot(p,plane.u),pv=dot(p,plane.v);
    return [(pu*vv-pv*uv)/det,(pv*uu-pu*uv)/det];
  });
  const [p0,p1,p2,p3]=points;
  const a=p1.map((v,i)=>v-p2[i]),b=p3.map((v,i)=>v-p2[i]),c=p2.map((v,i)=>v-p1[i]-p3[i]+p0[i]);
  const d=a[0]*b[1]-a[1]*b[0],g=(c[0]*b[1]-c[1]*b[0])/d,h=(a[0]*c[1]-a[1]*c[0])/d;
  const homography=[(g+1)*p1[0]-p0[0],(h+1)*p3[0]-p0[0],p0[0],
    (g+1)*p1[1]-p0[1],(h+1)*p3[1]-p0[1],p0[1],g,h,1];
  const result=inverse3(homography);cache.set(key,result);return result;
}

const polarCaches = new WeakMap<GeographicScene, Map<boolean, PolarPlane[]>>();
function preparePolarCityPageGeometry(address: PageAddress, scene: GeographicScene, bounds: PolarBounds): PageGeometry {
  const north = bounds.hemisphere === "north";
  const leaf = scene.body.bands.find(b => b.latitudeIndex === (north ? 15 : 0))!.leaves[0];
  const matrix = leaf.style.match(/matrix3d\(([^)]+)\)/)![1].split(",").map(Number);
  if (matrix[3] !== 0 || matrix[7] !== 0 || matrix[15] !== 1) {
    throw new Error("The accepted polar cap must remain affine.");
  }
  const { x0, y0, x1, y1, ...patch } = prepareFacePatch(matrix, leaf.leafWidth, address);
  let cache = polarCaches.get(scene);
  if (!cache) { cache = new Map(); polarCaches.set(scene, cache); }
  if (!cache.has(north)) {
    const band = north ? 14 : 1;
    cache.set(north, Array.from({ length: 32 }, (_, longitude) => {
      const face = acceptedFace(scene, band, longitude);
      const { u, v, normal, d } = face;
      const uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), determinant = uu * vv - uv * uv;
      const denominator = d - normal[2] * matrix[14];
      return { origin: face.origin,
        basisU: u.map((value, i) => (value * vv - v[i] * uv) / determinant),
        basisV: v.map((value, i) => (value * uu - u[i] * uv) / determinant),
        qx: normal[0] / denominator, qy: normal[1] / denominator,
        inverse: canonicalFaceInverse(scene, band, longitude),
        west: ((longitude + 16) % 32) * 11.25 };
    }));
  }
  // This projection is used only by the preparer. It is removed before pages
  // enter the browser index. The cap's real band-plane intersections establish
  // its boundary, so the same geographic texel meets on both accepted planes.
  const geographicProjection: PolarProjection = { type: "polar", sign: north ? 1 : -1,
    side: leaf.leafWidth, x0, y0, x1, y1, matrix, planes: cache.get(north)! };
  const margin = CITY_PAGE_GUTTER / CITY_PAGE_PIXELS / 2 ** address.level;
  const page = { key: pageKey(address), ...address, bounds,
    outer: { ...bounds, u0: bounds.u0 - margin, u1: bounds.u1 + margin,
      v0: bounds.v0 - margin, v1: bounds.v1 + margin }, ...patch, geographicProjection };
  return { ...page, sourceBounds: polarSourceBounds(geographicProjection) };
}

function polarWorldPoint(projection: PolarProjection, u: number, v: number) {
  const { matrix: m, x0, x1, y0, y1 } = projection;
  const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * v;
  return [m[0] * x + m[4] * y + m[12], m[1] * x + m[5] * y + m[13], m[14]];
}

function polarGeographicSampler(projection: PolarProjection) {
  const raw = (u: number, v: number) => {
    const world = polarWorldPoint(projection, u, v);
    let ratio = 0, selected: PolarPlane | undefined;
    for (const plane of projection.planes) {
      const q = plane.qx * world[0] + plane.qy * world[1];
      if (q > ratio) { ratio = q; selected = plane; }
    }
    if (ratio < 1e-12 || !selected) return [0, projection.sign * 90];
    const edge = [world[0] / ratio, world[1] / ratio, world[2]];
    const relative = edge.map((value, i) => value - selected.origin[i]);
    const x = dot(relative, selected.basisU), y = dot(relative, selected.basisV);
    const m = selected.inverse, w = m[6] * x + m[7] * y + m[8];
    const longitude = selected.west + 11.25 * (m[0] * x + m[1] * y + m[2]) / w;
    const latitude = projection.sign * Math.acos(Math.min(1,
      ratio * Math.cos(78.75 * Math.PI / 180))) * 180 / Math.PI;
    return [longitude, latitude];
  };
  const reference = raw(.5, .5)[0];
  return (u: number, v: number) => {
    const [longitude, latitude] = raw(u, v);
    return [longitude + 360 * Math.round((reference - longitude) / 360), latitude];
  };
}

// Radial sectors are linear on the cap plane. Include every sector crossing
// on the page edges, not merely four geographic corners or a sampled grid.
function polarSourceBounds(projection: PolarProjection) {
  const vertices = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const points = [...vertices];
  for (let edge = 0; edge < 4; edge++) {
    const a = vertices[edge], b = vertices[(edge + 1) % 4];
    const wa = polarWorldPoint(projection, a[0], a[1]), wb = polarWorldPoint(projection, b[0], b[1]);
    for (let i = 0; i < 32; i++) {
      const p = projection.planes[i], q = projection.planes[(i + 1) % 32];
      const qa = (p.qx - q.qx) * wa[0] + (p.qy - q.qy) * wa[1];
      const qb = (p.qx - q.qx) * wb[0] + (p.qy - q.qy) * wb[1];
      const t = qa / (qa - qb);
      if (t > 0 && t < 1) points.push(a.map((value, j) => value + t * (b[j] - value)));
    }
  }
  const m = projection.matrix, det = m[0] * m[5] - m[4] * m[1];
  const centerX = (-m[12] * m[5] + m[4] * m[13]) / det;
  const centerY = (-m[0] * m[13] + m[1] * m[12]) / det;
  const u = (centerX - projection.x0) / (projection.x1 - projection.x0);
  const v = (centerY - projection.y0) / (projection.y1 - projection.y0);
  const containsPole = u >= 0 && u <= 1 && v >= 0 && v <= 1;
  if (containsPole) points.push([u, v]);
  const sampler = polarGeographicSampler(projection);
  const geographic = points.map(point => sampler(point[0], point[1]));
  const reference = sampler(.5, .5)[0];
  return { west: containsPole ? reference - 180 : Math.min(...geographic.map(p => p[0])),
    east: containsPole ? reference + 180 : Math.max(...geographic.map(p => p[0])),
    south: Math.min(...geographic.map(p => p[1])), north: Math.max(...geographic.map(p => p[1])) };
}

// Bake the accepted cap's circular alpha into page pixels. This is not a
// runtime CSS mask, and it never alters the retained square cap geometry.
export function createCityCoverageSampler(page: Pick<PageGeometry, 'geographicProjection'>) {
  const p = page.geographicProjection;
  if (p?.type !== "polar") return () => true;
  return (u: number, v: number) => {
    const x = 2 * (p.x0 + (p.x1 - p.x0) * u) / p.side - 1;
    const y = 2 * (p.y0 + (p.y1 - p.y0) * v) / p.side - 1;
    return x * x + y * y <= 1;
  };
}

export function childAddresses({ level, x, y }: PageAddress) {
  return [0, 1].flatMap((dy) => [0, 1].map((dx) => ({
    level: level + 1, x: x * 2 + dx, y: y * 2 + dy,
  })));
}
