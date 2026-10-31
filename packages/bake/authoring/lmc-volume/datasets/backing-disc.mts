/** The universe backing laid in the disc plane with the face-on picture, so a far camera sees the disc where the volume stands. */
import { modelFarViews } from '../delivery/far-model.mts';
import { add, mul, type V3 } from '../geometry.mts';

const columnLength = (text: string) => Math.hypot(...text.slice(9, -1).split(',').map(Number).slice(0, 3));
export interface BackingRecord { leaf: { texturePath: string; style: { transform: string } & Record<string, string> }; datasets: Record<string, string>; meaning: string; [key: string]: unknown }
/** The prepared leaf's scene axes, read back from the Sun-facing leaf: a body direction's image in the scene. */
export function discBacking(record: BackingRecord): BackingRecord {
  const views = modelFarViews(), pz = views.find(v => v.id === 'pz')!, side = parseFloat(record.leaf.style.width);
  // Body → scene: three pairs fix the linear map. Each row of S is solved by dotting with the orthonormal Earth basis.
  // The scene mirrors the body (x → y, y → x, z → z), read from the installed slab leaves; a leaf's third column is only its normal's sign, so it cannot say so.
  const k = columnLength(record.leaf.style.transform), S = (v: V3): V3 => [v[1], v[0], v[2]];
  const right = mul(S(pz.right), k), down = mul(S(pz.down), k), normal: V3 = [0, 0, -1], t = mul(add(right, down), -side / 2), next = [right[0], right[1], right[2], 0, down[0], down[1], down[2], 0, normal[0], normal[1], normal[2], 0, t[0], t[1], t[2], 1];
  return { ...record, discNormalUnits: [0, 0, 1], leaf: { ...record.leaf, texturePath: pz.texturePath.replace(/^.*l36-far/u, 'l36-far'), style: { ...record.leaf.style, transform: 'matrix3d(' + next.map(v => +v.toFixed(6)).join(',') + ')' } }, datasets: Object.fromEntries(Object.keys(record.datasets).map(key => [key, 'l36-far/pz.png'])),
    meaning: 'The approved l36 face-on model picture, laid in the disc plane through its centre, so it foreshortens with the disc from every direction. Not a second light source: it gives way to the volume.' };
}
