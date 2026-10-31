/** The universe backing laid in the disc plane with the face-on picture, so a far camera sees the disc where the volume stands. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { modelFarViews } from '../delivery/far-model.mts';
import { add, dot, mul, type V3 } from '../geometry.mts';
import { pilotCamera } from '../piece-pilot/cameras.mts';

export interface BackingRecord { leaf: { texturePath: string; style: { transform: string } & Record<string, string> }; datasets: Record<string, string>; meaning: string; [key: string]: unknown }
const columns = (text: string) => { const m = text.slice(9, -1).split(',').map(Number); return { c0: m.slice(0, 3) as V3, c1: m.slice(4, 7) as V3, c2: m.slice(8, 11) as V3, t: m.slice(12, 15) as V3, m }; };
/** The prepared leaf's scene axes, read back from the Sun-facing leaf: a body direction's image in the scene. */
export function discBacking(record: BackingRecord): BackingRecord {
  const views = modelFarViews(), earth = views.find(v => v.id === 'earth')!, pz = views.find(v => v.id === 'pz')!, { c0, c1, c2, m } = columns(record.leaf.style.transform), side = parseFloat(record.leaf.style.width);
  // Body → scene: three pairs fix the linear map. Each row of S is solved by dotting with the orthonormal Earth basis.
  // The scene mirrors the body (x → y, y → x, z → z), read from the installed slab leaves; a leaf's third column is only its normal's sign, so it cannot say so.
  const k = Math.hypot(...c0), S = (v: V3): V3 => [v[1], v[0], v[2]];
  void c1; void c2; void earth;
  const right = mul(S(pz.right), k), down = mul(S(pz.down), k), normal: V3 = [0, 0, -1], t = mul(add(right, down), -side / 2), next = [right[0], right[1], right[2], 0, down[0], down[1], down[2], 0, normal[0], normal[1], normal[2], 0, t[0], t[1], t[2], 1];
  void m;
  return { ...record, discNormalUnits: [0, 0, 1], leaf: { ...record.leaf, texturePath: pz.texturePath.replace(/^.*l36-far/u, 'l36-far'), style: { ...record.leaf.style, transform: 'matrix3d(' + next.map(v => +v.toFixed(6)).join(',') + ')' } }, datasets: Object.fromEntries(Object.keys(record.datasets).map(key => [key, 'l36-far/pz.png'])),
    meaning: 'The approved l36 face-on model picture, laid in the disc plane through its centre, so it foreshortens with the disc from every direction. Not a second light source: it gives way to the volume.' };
}
/** Screen error of disc-rim points between the old Sun-facing plane and their true place, at a far camera. */
export function sunPlaneError(tilt: number, az: number, distance: number, focal: number, radius = 5) {
  const earth = modelFarViews().find(v => v.id === 'earth')!, c = pilotCamera('e', 128, [0, 0, 0], 10, tilt, az), eye = mul(c.back, distance); let worst = 0, widest = 0;
  const screen = (p: V3): [number, number] => { const v = add(p, mul(eye, -1)), z = -dot(v, c.back); return [focal * dot(v, c.right) / z, -focal * dot(v, c.up) / z]; };
  for (let a = 0; a < 360; a += 15) { const p: V3 = [radius * Math.cos(a * Math.PI / 180), radius * Math.sin(a * Math.PI / 180), 0]; const sc = 1 - dot(p, earth.back) / 49.59, q = add(mul(earth.right, dot(p, earth.right) / sc), mul(earth.down, dot(p, earth.down) / sc)), S0 = screen(p), S1 = screen(q); worst = Math.max(worst, Math.hypot(S0[0] - S1[0], S0[1] - S1[1])); widest = Math.max(widest, Math.hypot(...S0)); }
  return { worstPx: +worst.toFixed(1), shareOfRadius: +(worst / widest).toFixed(3) };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const old = JSON.parse(readFileSync('src/objects/lmc-volume/prepared/backing.json', 'utf8')) as BackingRecord;
  const fresh = discBacking(old); console.log(fresh.leaf.style.transform, fresh.datasets, old.leaf.style.transform);
  for (const [name, t, a, d] of [['tilt25-away', 25, 120, 100], ['face', 0, 0, 200], ['t45', 45, 0, 200], ['edge', 90, 0, 200], ['t65', 65, 30, 200]] as const) console.log(name, JSON.stringify(sunPlaneError(t, a, d, 886 * d / 100 * .25)));
}
