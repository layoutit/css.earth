import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const exec = promisify(execFile);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** Read the released triangular surface in its body-fixed frame. Units are
 * authored explicitly; no ellipsoid or missing terrain is synthesized. */
export async function loadObjShape(path, profile) {
  const { stdout } = await exec('unzip', ['-p', path, profile.member], { maxBuffer: 96 * 1024 * 1024 });
  return parseObjShape(stdout, profile);
}

/** Sample a bounded scientific grid from the source mesh. A facet-support
 * column can withhold regions whose detailed SPC solution is absent. */
export async function loadObjScalarGrid(root, lens) {
  const mesh = await loadObjShape(resolve(root, lens.path), lens.grid);
  const { width = 721, height = 361 } = lens.sampleGrid ?? {};
  if (![width,height].every(n => Number.isInteger(n) && n >= 3 && n <= 4097)) throw new Error('Invalid shape sampling grid.');
  let validity;
  if (lens.coverage) {
    const {stdout} = await exec('unzip',['-p',resolve(root,lens.coverage.path),lens.coverage.member],{maxBuffer:128*1024*1024});
    const rows=stdout.trim().split(/\r?\n/),field=rows[0].split(',').indexOf(lens.coverage.field);
    if(field<0 || rows.length-2!==mesh.faces)throw new Error('Shape facet attributes differ from the pinned mesh.');
    validity=Uint8Array.from(rows.slice(2),row=>Number.isFinite(Number(row.split(',')[field]))?1:0);
  }
  const data=new Float64Array(width*height);data.fill(NaN);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const h=mesh.hit(x/(width-1)*360,90-y/(height-1)*180);
    if(h && (!validity || validity[h.faceId])) data[y*width+x]=h.radius;
  }
  return {sample(longitude,latitude){
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(latitude)>90)return null;
    const x=((longitude%360+360)%360)/360*(width-1),y=(90-latitude)/180*(height-1);
    const x0=Math.floor(x),x1=Math.min(width-1,x0+1),y0=Math.floor(y),y1=Math.min(height-1,y0+1);
    const v=[data[y0*width+x0],data[y0*width+x1],data[y1*width+x0],data[y1*width+x1]];
    if(v.some(n=>!Number.isFinite(n)))return null;
    const u=x-x0,t=y-y0;
    const radius=(v[0]*(1-u)+v[1]*u)*(1-t)+(v[2]*(1-u)+v[3]*u)*t;
    return radius*(lens.valueTransform?.scale??1)+(lens.valueTransform?.offset??0);
  }};
}

export function parseObjShape(text, { metersPerUnit, expectedVertices, expectedFaces }) {
  if (!(metersPerUnit > 0)) throw new TypeError('Shape units must be explicit.');
  const vertices = [], indices = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const v = line.trim().split(/\s+/).slice(1).map(Number);
      if (v.length !== 3 || v.some(n => !Number.isFinite(n))) throw new Error('Invalid OBJ vertex.');
      vertices.push(v.map(n => n * metersPerUnit));
    } else if (line.startsWith('f ')) {
      const f = line.trim().split(/\s+/).slice(1).map(v => Number(v.split('/')[0]) - 1);
      if (f.length !== 3 || f.some(n => !Number.isInteger(n) || n < 0)) throw new Error('Expected triangular OBJ faces.');
      indices.push(f);
    }
  }
  if (vertices.length !== expectedVertices || indices.length !== expectedFaces) throw new Error('OBJ shape dimensions changed.');
  const faces = indices.map((f, id) => {
    if (f.some(i => i >= vertices.length)) throw new Error('OBJ face references an absent vertex.');
    const [a,b,c] = f.map(i => vertices[i]), ab = sub(b,a), ac = sub(c,a);
    if (!(Math.hypot(...cross(ab,ac)) > 0)) throw new Error('Degenerate source shape face.');
    return { id, a, ab, ac, min: a.map((v,i) => Math.min(v,b[i],c[i])), max: a.map((v,i) => Math.max(v,b[i],c[i])) };
  });
  function build(items) {
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    for (const f of items) for (let i=0;i<3;i++) { min[i]=Math.min(min[i],f.min[i]); max[i]=Math.max(max[i],f.max[i]); }
    if (items.length <= 12) return {min,max,items};
    const extent = max.map((n,i) => n-min[i]), axis = extent.indexOf(Math.max(...extent));
    items.sort((a,b) => a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
    const half = Math.floor(items.length/2);
    return {min,max,left:build(items.slice(0,half)),right:build(items.slice(half))};
  }
  const root = build(faces);
  function hit(longitude, latitude) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude)>90) return null;
    const lon=longitude*Math.PI/180, lat=latitude*Math.PI/180;
    const d=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
    let nearest=Infinity, faceId=-1;
    function visit(n) {
      let lo=0,hi=nearest;
      for (let i=0;i<3;i++) {
        if (Math.abs(d[i])<1e-15) { if(n.min[i]>0||n.max[i]<0)return; continue; }
        const a=n.min[i]/d[i],b=n.max[i]/d[i]; lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
        if(lo>hi)return;
      }
      if (!n.items) {visit(n.left);visit(n.right);return;}
      for (const f of n.items) {
        const h=cross(d,f.ac),det=dot(f.ab,h);
        if(Math.abs(det)<1e-12)continue;
        const s=f.a.map(v=>-v),u=dot(s,h)/det;
        if(u < -1e-9 || u > 1+1e-9)continue;
        const q=cross(s,f.ab),v=dot(d,q)/det;
        if(v < -1e-9 || u+v > 1+1e-9)continue;
        const t=dot(f.ac,q)/det;
        if(t>0&&t<nearest){nearest=t;faceId=f.id;}
      }
    }
    visit(root);
    return faceId<0?null:{radius:nearest,faceId};
  }
  return { vertices: vertices.length, faces: faces.length, bounds:[root.min,root.max], hit,
    sample(longitude,latitude) {return hit(longitude,latitude)?.radius??null;} };
}
