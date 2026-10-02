// Read the unique-value fill colors of one ArcMap renderer from a persisted .mxd or .lyr file.
//
// ArcMap stores each RgbColor as CIE L*a*b* doubles after the RgbColor CLSID. ArcGIS converts them to RGB with Apple RGB
// primaries, gamma 1.8 and a D65 white: that conversion reproduces the RGB triples NASA Trek's ArcGIS server publishes for
// the same SIM 3237 symbols exactly (20 shared units) and lands every SIM 3237 color within 6e-7 of an integer.
// Refuses a color that does not land on an integer, so a wrong conversion cannot pass silently.
//
// Usage: node esri-symbology.mts <file.mxd|file.lyr> <byte offset of the renderer heading> > renderer.json
import {readFile} from 'node:fs/promises';

const CLSID = Buffer.from('96c4e97e23d1d011838308000' + '9b996cc', 'hex'); // {7EE9C496-D123-11D0-8383-080009B996CC}
const D65 = [0.3127, 0.329], APPLE = [[0.625, 0.34], [0.28, 0.595], [0.155, 0.07]], GAMMA = 1.8, GRAY_OUTLINE_L = 54.04379;

type Mat = number[][];
const solve3 = (m: Mat, v: number[]) => {
  const det = (a: Mat) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  return [0, 1, 2].map(i => det(m.map((row, r) => row.map((x, c) => c === i ? v[r] : x))) / d);
};
const xyz = ([x, y]: number[]) => [x / y, 1, (1 - x - y) / y];
const P: Mat = [0, 1, 2].map(r => APPLE.map(p => xyz(p)[r])), W = xyz(D65);
const S = solve3(P, W), M: Mat = P.map(row => row.map((x, c) => x * S[c]));

export function labToRgb(L: number, a: number, b: number) {
  const fy = (L + 16) / 116, f = [fy + a / 500, fy, fy - b / 200];
  const t = f.map(v => v ** 3 > 0.008856 ? v ** 3 : (v - 16 / 116) / 7.787).map((v, i) => v * W[i]);
  return solve3(M, t).map(v => Math.min(1, Math.max(0, v)) ** (1 / GAMMA) * 255);
}

type Item = {offset: number, kind: 'color', lab: number[]} | {offset: number, kind: 'text', text: string};
function items(bytes: Buffer, start: number, end: number): Item[] {
  const out: Item[] = [];
  for (let i = bytes.indexOf(CLSID, start); i >= 0 && i < end; i = bytes.indexOf(CLSID, i + 1))
    out.push({offset: i, kind: 'color', lab: [0, 8, 16].map(k => bytes.readDoubleLE(i + 25 + k))});
  for (let i = start; i < end - 3;) {
    let j = i;
    while (j + 1 < end && bytes[j] >= 0x20 && bytes[j] <= 0x7e && bytes[j + 1] === 0) j += 2;
    if (j - i >= 4) { const text = bytes.subarray(i, j).toString('utf16le').trim(); if (text && text !== ',') out.push({offset: i, kind: 'text', text}); i = j; } else i++;
  }
  return out.sort((x, y) => x.offset - y.offset);
}

export function readRenderer(bytes: Buffer, heading: number) {
  const list = items(bytes, heading, Math.min(bytes.length, heading + 0x2400));
  const stop = list.findIndex(item => item.kind === 'text' && item.text === 'Pastels');
  if (stop < 0) throw new Error(`No renderer color-ramp marker after byte ${heading}`);
  const body = list.slice(0, stop), symbols: {label: string, lab: number[]}[] = [];
  let fill: number[] | null = null;
  for (const item of body) {
    if (item.kind === 'color') { if (Math.abs(item.lab[0] - GRAY_OUTLINE_L) > 1e-4 && item.lab.some(v => v !== 0)) fill = item.lab; }
    else if (fill) { symbols.push({label: item.text, lab: fill}); fill = null; }
  }
  const texts = body.filter(item => item.kind === 'text').map(item => (item as {text: string}).text);
  const values = texts.slice(-symbols.length);
  return symbols.map(({label, lab}, i) => {
    const rgb = labToRgb(lab[0], lab[1], lab[2]);
    if (rgb.some(v => Math.abs(v - Math.round(v)) > 1e-3)) throw new Error(`Color of ${values[i]} at renderer ${heading} does not convert to integer RGB: ${rgb.join(',')}`);
    const hex = '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    return {value: values[i], label, lab: lab.map(v => Number(v.toFixed(6))), rgb: rgb.map(Math.round), color: hex};
  });
}

if (import.meta.main) {
  const [file, offset] = process.argv.slice(2);
  if (!file || !offset) throw new Error('Usage: node esri-symbology.mts <file.mxd|file.lyr> <renderer heading byte offset>');
  console.log(JSON.stringify(readRenderer(await readFile(file), Number(offset)), null, 1));
}
