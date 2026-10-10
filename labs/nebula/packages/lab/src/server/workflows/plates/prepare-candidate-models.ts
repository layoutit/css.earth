// Entry script: node --experimental-strip-types labs/nebula/packages/lab/src/server/workflows/plates/prepare-candidate-models.ts
/**
 * Lab-only: lays every downloaded published 3D model of Cassiopeia A in one frame the lab viewer reads
 * (`src/objects/cassiopeia-a-layers/.local/candidates/models/prepared/`): places in arcseconds from the expansion centre of
 * Thorstensen, Fesen & van den Bergh (2001), east, north and toward the Sun, at 3.4 kpc. Meshes are reduced by vertex
 * clustering to a few thousand triangles and point sets are thinned evenly, so the viewer can draw them as DOM.
 * Nothing here ships; inputs and outputs stay in ignored scratch.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../../../../..');
const MODELS = resolve(ROOT, 'src/objects/cassiopeia-a-layers/.local/candidates/models');
const OUT = resolve(MODELS, 'prepared');
/** One parsec at 3.4 kpc, in arcseconds. */
export const ARCSEC_PER_PC = 206264.806 / 3400;
const MOST_TRIANGLES = 7000, MOST_POINTS = 6000;

export type Place = [number, number, number];
export interface Mesh { vertices: Place[]; faces: [number, number, number][] }
export interface Entry {
  id: string; label: string; kind: 'measured' | 'simulation' | 'illustration'; color: string; credit: string; citation: string;
  /** How the model is laid in Cas A's frame: its stated orientation and units, or how they were fitted. */
  placement: string; outerRing: boolean; jets: boolean;
  /** How the placement is known: from the paper, verified by fit, or ambiguous (output/cas-a-models/alignment). */
  verdict?: { kind: 'per paper' | 'verified by fit' | 'ambiguous'; text: string };
  read(): Promise<{ mesh?: Mesh; points?: Place[] }>;
}

/** The surfaces of a legacy ASCII VTK POLYDATA file: POINTS, then TRIANGLE_STRIPS or POLYGONS. */
export function readVtk(text: string): Mesh {
  const tokens = text.split(/\s+/u).filter(Boolean), at = tokens.indexOf('POINTS'), count = Number(tokens[at + 1]);
  if (at < 0 || !Number.isInteger(count)) throw new TypeError('No POINTS block.');
  const vertices: Place[] = [];
  for (let index = 0; index < count; index++) vertices.push([Number(tokens[at + 3 + 3 * index]), Number(tokens[at + 4 + 3 * index]), Number(tokens[at + 5 + 3 * index])]);
  if (!vertices.every(point => point.every(Number.isFinite))) throw new TypeError('A vertex is not a number.');
  const faces: [number, number, number][] = [];
  for (const block of ['TRIANGLE_STRIPS', 'POLYGONS']) {
    let cursor = tokens.indexOf(block); if (cursor < 0) continue;
    const cells = Number(tokens[cursor + 1]); cursor += 3;
    for (let cell = 0; cell < cells; cell++) {
      const size = Number(tokens[cursor]), ids = tokens.slice(cursor + 1, cursor + 1 + size).map(Number); cursor += size + 1;
      if (block === 'POLYGONS') for (let k = 1; k + 1 < ids.length; k++) faces.push([ids[0]!, ids[k]!, ids[k + 1]!]);
      else for (let k = 0; k + 2 < ids.length; k++) faces.push(k % 2 ? [ids[k + 1]!, ids[k]!, ids[k + 2]!] : [ids[k]!, ids[k + 1]!, ids[k + 2]!]);
    }
  }
  return { vertices, faces };
}

/** Wavefront OBJ vertices and faces (polygons fanned into triangles). */
export function readObj(text: string): Mesh {
  const vertices: Place[] = [], faces: [number, number, number][] = [];
  for (const line of text.split(/\r?\n/u)) {
    const cells = line.trim().split(/\s+/u);
    if (cells[0] === 'v') vertices.push([Number(cells[1]), Number(cells[2]), Number(cells[3])]);
    else if (cells[0] === 'f') {
      const ids = cells.slice(1).map(cell => { const value = Number(cell.split('/')[0]); return value < 0 ? vertices.length + value : value - 1; });
      for (let k = 1; k + 1 < ids.length; k++) faces.push([ids[0]!, ids[k]!, ids[k + 1]!]);
    }
  }
  return { vertices, faces };
}

/** Binary or ASCII STL triangles, with shared corners merged. */
export function readStl(buffer: Buffer): Mesh {
  const vertices: Place[] = [], faces: [number, number, number][] = [], index = new Map<string, number>();
  const add = (point: Place) => { const key = point.map(value => value.toPrecision(7)).join(','); let id = index.get(key); if (id === undefined) { id = vertices.length; vertices.push(point); index.set(key, id); } return id; };
  const triangles = buffer.readUInt32LE(80);
  if (buffer.length === 84 + 50 * triangles) {
    for (let t = 0; t < triangles; t++) { const base = 84 + 50 * t + 12, ids = [0, 1, 2].map(k => add([buffer.readFloatLE(base + 12 * k), buffer.readFloatLE(base + 12 * k + 4), buffer.readFloatLE(base + 12 * k + 8)]));
      faces.push(ids as [number, number, number]); }
  } else {
    const corners = [...buffer.toString('utf8').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/gu)].map(match => [Number(match[1]), Number(match[2]), Number(match[3])] as Place);
    for (let k = 0; k + 2 < corners.length; k += 3) faces.push([add(corners[k]!), add(corners[k + 1]!), add(corners[k + 2]!)]);
  }
  return { vertices, faces };
}

/** Vertex clustering: merge the vertices in each cube of `cell`, dropping triangles that collapse; the cell grows until
 * at most `most` triangles remain. */
export function reduce(mesh: Mesh, most = MOST_TRIANGLES): Mesh {
  if (mesh.faces.length <= most) return mesh;
  let span = 0;
  for (const axis of [0, 1, 2]) { let low = Infinity, high = -Infinity; for (const point of mesh.vertices) { low = Math.min(low, point[axis]!); high = Math.max(high, point[axis]!); } span = Math.max(span, high - low); }
  for (let cell = span / 400; ; cell *= 1.15) {
    const cluster = new Map<string, number>(), sums: number[][] = [], of = mesh.vertices.map(point => {
      const key = point.map(value => Math.floor(value / cell)).join(',');
      let id = cluster.get(key); if (id === undefined) { id = sums.length; cluster.set(key, id); sums.push([0, 0, 0, 0]); }
      const sum = sums[id]!; sum[0]! += point[0]; sum[1]! += point[1]; sum[2]! += point[2]; sum[3]!++; return id;
    });
    const seen = new Set<string>(), faces: [number, number, number][] = [];
    for (const face of mesh.faces) {
      const ids = face.map(id => of[id]!) as [number, number, number];
      if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
      const key = [...ids].sort((a, b) => a - b).join(','); if (seen.has(key)) continue; seen.add(key); faces.push(ids);
    }
    if (faces.length <= most) return { vertices: sums.map(sum => [sum[0]! / sum[3]!, sum[1]! / sum[3]!, sum[2]! / sum[3]!]), faces };
  }
}
export const thin = (points: Place[], most = MOST_POINTS) => { const stride = Math.max(1, Math.ceil(points.length / most)); return points.filter((_, index) => index % stride === 0); };
const round = (values: number[]) => values.map(value => Math.round(value * 10) / 10);

export const modelPath = (...parts: string[]) => resolve(MODELS, ...parts);
export const readText = (...parts: string[]) => readFile(modelPath(...parts), 'utf8');

/** DeLaney et al. (2010) through the CXC's VTK files: x east, z north, y toward the Sun, 3.6 arcsec a unit, origin on
 * the expansion centre (measured by `packages/bake/authoring/cassiopeia-a/ejecta-speeds.mts --frame`). */
const DELANEY_DIR = 'delaney-2010-cxc';
const delaneyFile = (name: string) => {
  for (const candidate of [`CasA_supernova_remnant-ascii_vtks/CasA_supernova_remnant-ascii_vtks/asciivtks/${name}-ascii.vtk`, `asciivtks/${name}-ascii.vtk`, `${name}-ascii.vtk`])
    if (existsSync(modelPath(DELANEY_DIR, candidate))) return candidate;
  throw new Error(`${name}-ascii.vtk is not under ${DELANEY_DIR}.`);
};
const delaney = (name: string): Entry['read'] => async () => {
  const mesh = readVtk(await readText(DELANEY_DIR, delaneyFile(name)));
  return { mesh: { vertices: mesh.vertices.map(([x, y, z]) => [3.6 * x, 3.6 * z, 3.6 * y]), faces: mesh.faces } };
};
const DELANEY_CITE = 'DeLaney et al. 2010, ApJ 725, 2038 (2010ApJ...725.2038D)', DELANEY_CREDIT = 'NASA/CXC/SAO; T. DeLaney et al. (CXC 3D files)';
const DELANEY_PLACE = 'Units and orientation unstated by the CXC; fitted (ejecta-speeds.mts --frame): x east, z north, y toward the Sun, 3.6″ a unit, origin on the expansion centre.';

export const ENTRIES: Entry[] = [
  { id: 'delaney-ar', label: 'DeLaney 2010 [Ar II] (Spitzer)', kind: 'measured', color: '#ff7a59', credit: DELANEY_CREDIT, citation: DELANEY_CITE, placement: DELANEY_PLACE, outerRing: false, jets: false, read: delaney('newar') },
  { id: 'delaney-si', label: 'DeLaney 2010 Si XIII (Chandra)', kind: 'measured', color: '#4fc3ff', credit: DELANEY_CREDIT, citation: DELANEY_CITE, placement: DELANEY_PLACE, outerRing: false, jets: false, read: delaney('newsi') },
  { id: 'delaney-fe', label: 'DeLaney 2010 Fe K (Chandra)', kind: 'measured', color: '#b18cff', credit: DELANEY_CREDIT, citation: DELANEY_CITE, placement: DELANEY_PLACE, outerRing: false, jets: false, read: delaney('fekcorr') },
  { id: 'delaney-hetg', label: 'DeLaney 2010 HETG Doppler (Chandra)', kind: 'measured', color: '#5ee08a', credit: DELANEY_CREDIT, citation: DELANEY_CITE, placement: DELANEY_PLACE, outerRing: false, jets: false, read: delaney('newhetg') },
  { id: 'delaney-opt', label: 'DeLaney 2010 optical knots', kind: 'measured', color: '#ffd84d', credit: DELANEY_CREDIT, citation: DELANEY_CITE, placement: DELANEY_PLACE, outerRing: true, jets: false, read: delaney('newopt') },
  { id: 'delaney-jets', label: 'DeLaney 2010 jets', kind: 'measured', color: '#ff5fd2', credit: DELANEY_CREDIT, citation: DELANEY_CITE, placement: DELANEY_PLACE, outerRing: true, jets: true, read: delaney('newjets') },
];

/** Milisavljevic & Fesen's web app (Purdue / CfA, 2013-2014): places in velocity space, km/s. Per Milisavljevic &
 * Fesen (2013, Sect. 4 and Fig. 8): "V_x is east–west, V_y is north–south, and V_z is radial velocity", "v = r × S",
 * S = 0.022″ per km/s, the centre of expansion of Thorstensen et al. (2001) with v_c = 760 km/s. The web app keeps
 * the raw Doppler speed (its shell sphere sits at z = 760), so the sight line is -(z - 760) S toward the Sun. The
 * signs of x and y are not stated: verified by fit (output/cas-a-models/alignment), +x east and +y north. */
const PURDUE = 'milisavljevic-fesen-2013-2015-purdue-webapp', PURDUE_K = 0.022, PURDUE_VC = 760;
const purdue = (name: string): Entry['read'] => async () => ({ points: (await readText(PURDUE, `${name}.csv`)).trim().split(/\r?\n/u).slice(1)
  .map(line => line.split(',').map(Number)).filter(cells => cells.length === 3 && cells.every(Number.isFinite))
  .map(([x, y, z]) => [PURDUE_K * x!, PURDUE_K * y!, -PURDUE_K * (z! - PURDUE_VC)] as Place) });
const PURDUE_PLACE = 'Per paper (M&F 2013 §4, Fig. 8): velocity space in km/s, S = 0.022″ per km/s, centre of expansion of Thorstensen et al. 2001, v_c = 760 km/s subtracted, z = radial velocity (positive away). Signs of x and y verified by fit: +x east, +y north.';
const PURDUE_CREDIT = 'D. Milisavljevic & R. Fesen; web app by W. Armstrong (2013), D. Milisavljevic (2014)';
ENTRIES.push(
  { id: 'mf-shell', label: 'Milisavljevic & Fesen 2013 main shell', kind: 'measured', color: '#ff4040', credit: PURDUE_CREDIT, citation: 'Milisavljevic & Fesen 2013, ApJ 772, 134 (2013ApJ...772..134M)', placement: PURDUE_PLACE, outerRing: false, jets: false, read: purdue('shell') },
  { id: 'mf-knots', label: 'Milisavljevic & Fesen 2013 outer knots and jets', kind: 'measured', color: '#ffee33', credit: PURDUE_CREDIT, citation: 'Milisavljevic & Fesen 2013, ApJ 772, 134 (2013ApJ...772..134M)', placement: PURDUE_PLACE, outerRing: true, jets: true,
    read: async () => ({ points: [...(await purdue('knots1')()).points!, ...(await purdue('knots2')()).points!] }) },
  { id: 'mf-interior', label: 'Milisavljevic & Fesen 2015 interior [S III]', kind: 'measured', color: '#44ff66', credit: PURDUE_CREDIT, citation: 'Milisavljevic & Fesen 2015, Science 347, 526 (2015Sci...347..526M)', placement: PURDUE_PLACE, outerRing: false, jets: false, read: purdue('interior') },
  { id: 'mf-iron', label: 'Web-app iron (DeLaney 2010 Fe K)', kind: 'measured', color: '#7777ff', credit: PURDUE_CREDIT, citation: 'DeLaney et al. 2010, ApJ 725, 2038, as sampled in the Milisavljevic & Fesen web app', placement: PURDUE_PLACE, outerRing: false, jets: false, read: purdue('iron') },
);

/** A mesh whose units and axes nothing states, converted from its GLB by output/cas-a-models/glb-to-mesh.mts and laid by
 * the fit of output/cas-a-models/fit-chamfer.mts: the signed axis permutation, scale and offset that bring its
 * vertices nearest DeLaney et al.'s surfaces. */
interface Fit { east: string; north: string; toward: string; arcsecPerUnit: number; modelCentre: number[]; offsetArcsec: number[]; meanNearestArcsec: number }
const fitted = (directory: string, fit: Fit): Entry['read'] => async () => {
  const mesh = JSON.parse(await readText(directory, 'model.mesh.json')) as Mesh;
  const axis = (spec: string, point: Place, slot: number) => { const a = 'xyz'.indexOf(spec[1]!); return (spec[0] === '-' ? -1 : 1) * fit.arcsecPerUnit * (point[a]! - fit.modelCentre[a]!) + fit.offsetArcsec[slot]!; };
  return { mesh: { vertices: mesh.vertices.map(point => [axis(fit.east, point, 0), axis(fit.north, point, 1), axis(fit.toward, point, 2)] as Place), faces: mesh.faces } };
};
const fitText = (fit: Fit, what: string) => `Units and axes unstated; fitted to ${what} (fit-chamfer.mts): east ${fit.east}, north ${fit.north}, toward the Sun ${fit.toward}, ${fit.arcsecPerUnit}″ a unit, mean nearest distance ${fit.meanNearestArcsec}″.`;
const NASA_A: Fit = { east: '+x', north: '+z', toward: '+y', arcsecPerUnit: 22.922, modelCentre: [-0.1123, 0.0956, 0.4933], offsetArcsec: [-4.6, 9, 3.3], meanNearestArcsec: 3.8 };
const NASA_B: Fit = { east: '-x', north: '-y', toward: '-z', arcsecPerUnit: 16.433, modelCentre: [0, 0, 0], offsetArcsec: [0, 0, 0], meanNearestArcsec: 7.4 };
const NASA_C: Fit = { east: '-x', north: '+z', toward: '-y', arcsecPerUnit: 16.93, modelCentre: [0, 0, 0], offsetArcsec: [0, 0, 0], meanNearestArcsec: 6.8 };
const SI: Fit = { east: '+x', north: '-y', toward: '-z', arcsecPerUnit: 128.831, modelCentre: [0.0648, 0.0813, -0.0559], offsetArcsec: [-0.6, 3, 1.3], meanNearestArcsec: 8.5 };
const ORLANDO = 'Model / simulation: Orlando et al. 2021, A&A 645, A66 (2021A&A...645A..66O). Scenario: 3D MHD (PLUTO) of a neutrino-driven explosion of a 15-20 M☉ progenitor evolved to Cas A\'s age (~350 yr)';
/** Hammell & Fesen (2008): 1,825 outer knots, J2000 positions only (no radial speeds), on the sky plane. */
const HAMMELL_CENTRE = [(23 + 23 / 60 + 27.77 / 3600) * 15, 58 + 48 / 60 + 49.4 / 3600] as const;
const hammell: Entry['read'] = async () => ({ points: (await readText('hammell-fesen-2008-vizier', 'table2.dat')).split(/\r?\n/u).filter(line => line.trim()).map(line => {
  const c = line.trim().split(/\s+/u).map(Number), ra = (c[1]! + c[2]! / 60 + c[3]! / 3600) * 15, dec = Math.sign(c[4]!) * (Math.abs(c[4]!) + c[5]! / 60 + c[6]! / 3600);
  return [(ra - HAMMELL_CENTRE[0]) * Math.cos(dec * Math.PI / 180) * 3600, (dec - HAMMELL_CENTRE[1]) * 3600, 0] as Place;
}) });
ENTRIES.push(
  { id: 'nasa-casa-print', label: 'NASA/CXC 3D-print mesh (DeLaney data)', kind: 'illustration', color: '#9ad0ff', credit: 'NASA/CXC/SAO; NASA 3D Resources (T. DeLaney)', citation: 'Built from DeLaney et al. 2010 (2010ApJ...725.2038D)', placement: fitText(NASA_A, 'DeLaney\'s surfaces'), outerRing: true, jets: true, read: fitted('nasa-3d-resources-cassiopeia-a-supernova', NASA_A) },
  { id: 'smithsonian-casa', label: 'Smithsonian 3D Cas A mesh', kind: 'illustration', color: '#c0c0c0', credit: 'Smithsonian DPO 3D / NASA/CXC/SAO (© Smithsonian, all rights reserved)', citation: 'Built from DeLaney et al. 2010 (2010ApJ...725.2038D)', placement: fitText(SI, 'DeLaney\'s surfaces'), outerRing: false, jets: true, read: fitted('smithsonian-3d-casa', SI) },
  { id: 'orlando-2021-b', label: 'Orlando 2021 ejecta (NASA 2023 model)', kind: 'simulation', color: '#ff9f1c', credit: 'NASA/S. Orlando (NASA 3D Resources, 2023)', citation: ORLANDO, placement: 'Axes per paper (Orlando et al. 2021 §2: Earth on the −y axis; east is −x, north +z), here in the file\'s coordinates before its node rotation; origin at the simulation\'s explosion site, on the expansion centre. Units unstated: 16.4″ a unit, fitted to DeLaney\'s surfaces.', outerRing: false, jets: false, read: fitted('nasa-3d-resources-cassiopeia-a-supernova-b-2023', NASA_B) },
  { id: 'orlando-2021-c', label: 'Orlando 2021 Fe isosurface (NASA 2025 model)', kind: 'simulation', color: '#2ec4b6', credit: 'NASA/S. Orlando (NASA 3D Resources, 2025; chandra.si.edu/photo/2025/3dmodels)', citation: ORLANDO, placement: 'Axes per paper (Orlando et al. 2021 §2: Earth on the −y axis; east is −x, north +z); origin at the simulation\'s explosion site, on the expansion centre. Units unstated: 16.9″ a unit, fitted to DeLaney\'s surfaces.', outerRing: false, jets: false, read: fitted('nasa-3d-resources-cassiopeia-a-supernova-c-2025', NASA_C) },
  { id: 'hammell-2008-knots', label: 'Hammell & Fesen 2008 outer knots (sky only)', kind: 'measured', color: '#ffffff', credit: 'Hammell & Fesen 2008 via CDS VizieR J/ApJS/179/195', citation: 'Hammell & Fesen 2008, ApJS 179, 195 (2008ApJS..179..195H)', placement: 'J2000 positions from the table, from the Thorstensen et al. (2001) centre. No radial speeds: every knot is drawn on the sky plane through the centre (depth unknown, not zero).', outerRing: true, jets: true, read: hammell },
);

/** Alignment verdicts from output/cas-a-models/alignment (scores.json, knots.json): image correlation r of the
 * projected model against Chandra ACIS (2007.9) and Webb MIRI F2100W (2022.6), and knot-position medians against
 * Hammell & Fesen (2008), each best orientation against its runner-up of the 8 sky orientations. */
const VERDICTS: Record<string, NonNullable<Entry['verdict']>> = {
  'delaney-ar': { kind: 'verified by fit', text: 'Chandra Si r 0.393 vs runner-up 0.323; MIRI 0.386 vs 0.225; SE "blue-shifted parentheses" approach.' },
  'delaney-si': { kind: 'ambiguous', text: 'Own image score unresolved (lab frame r 0.149; best 0.225 at the grid edge, runner-up 0.218). Same file frame as the verified surfaces.' },
  'delaney-fe': { kind: 'verified by fit', text: 'Chandra 0.5–1.5 keV r 0.377 vs 0.284; north redshifted, SE blueshifted as DeLaney §4 states.' },
  'delaney-hetg': { kind: 'verified by fit', text: 'Chandra Si r 0.418 vs 0.188.' },
  'delaney-opt': { kind: 'verified by fit', text: 'Knots vs Hammell & Fesen: median 1.1″ vs runner-up 7.5″ (positions of 1988/1996, scaled to 2004.2).' },
  'delaney-jets': { kind: 'verified by fit', text: 'Orientation verified: knots vs Hammell & Fesen median 1.6″ vs 5.4″. Open question: the knots match best ×1.075 larger, which no paper explains; not applied.' },
  'mf-shell': { kind: 'per paper', text: 'S, v_c, centre per M&F 2013 §4; x/y signs verified: Chandra r 0.443 vs 0.302, MIRI 0.458 vs 0.229.' },
  'mf-knots': { kind: 'per paper', text: 'Per M&F 2013 §4; knots vs Hammell & Fesen median 1.3″ vs 8.0″.' },
  'mf-interior': { kind: 'per paper', text: 'Per M&F 2015 S2 (centre, 0.022″/km s⁻¹; v_c as 2013, inferred). No image shows the unshocked interior: image check inconclusive.' },
  'mf-iron': { kind: 'verified by fit', text: 'Chandra 0.5–1.5 keV r 0.377 vs 0.319 (Si band ambiguous, 0.325 vs 0.324). North red / SE blue as DeLaney.' },
  'nasa-casa-print': { kind: 'verified by fit', text: '3D fit to DeLaney surfaces 3.8″ mean (runner-up orientation 11.5″). Image score ambiguous (0.238 vs 0.234).' },
  'smithsonian-casa': { kind: 'ambiguous', text: '3D fit 10.2″ vs runner-up 10.6″; image 0.222 vs 0.207. Mirror and sign not resolved.' },
  'orlando-2021-b': { kind: 'per paper', text: 'Axes per Orlando 2021 §2; scale fitted (units unstated). A simulation: image scores ambiguous (≤0.18, no clear winner).' },
  'orlando-2021-c': { kind: 'per paper', text: 'Axes per Orlando 2021 §2; scale fitted (units unstated). A simulation: image scores ambiguous.' },
  'hammell-2008-knots': { kind: 'per paper', text: 'Catalogue J2000 positions, epoch 2004.2; Chandra Si outer region r 0.261 vs 0.050 at zero shift.' },
};
for (const entry of ENTRIES) { const verdict = VERDICTS[entry.id]; if (verdict) entry.verdict = verdict; }
/** Dropped after the alignment review: their placement is ambiguous (output/cas-a-models/alignment). */
const DROPPED = new Set(['delaney-si', 'smithsonian-casa']);
for (let index = ENTRIES.length - 1; index >= 0; index--) if (DROPPED.has(ENTRIES[index]!.id)) ENTRIES.splice(index, 1);

export async function prepare(entries: Entry[]) {
  await mkdir(OUT, { recursive: true });
  const listed = [];
  for (const entry of entries) {
    try {
      const { mesh, points } = await entry.read();
      const reduced = mesh ? reduce(mesh) : undefined, thinned = points ? thin(points) : undefined;
      const all = [...(reduced?.vertices ?? []), ...(thinned ?? [])], radius = all.map(point => Math.hypot(point[0], point[1])), depth = all.map(point => Math.abs(point[2]));
      const { read: _, ...record } = entry;
      await writeFile(resolve(OUT, `${entry.id}.json`), JSON.stringify({ ...record,
        ...(reduced ? { vertices: round(reduced.vertices.flat()), faces: reduced.faces.flat() } : {}), ...(thinned ? { points: round(thinned.flat()) } : {}) }));
      listed.push({ ...record, triangles: reduced?.faces.length ?? 0, points: thinned?.length ?? 0, sourceTriangles: mesh?.faces.length ?? 0, sourcePoints: points?.length ?? 0,
        maxSkyRadiusArcsec: Math.round(Math.max(...radius)), maxDepthArcsec: Math.round(Math.max(...depth)) });
      console.log(`${entry.id}: ${reduced ? `${reduced.faces.length} of ${mesh!.faces.length} triangles` : ''}${thinned ? `${thinned.length} of ${points!.length} points` : ''}; reaches ${Math.round(Math.max(...radius))}″ on the sky, ±${Math.round(Math.max(...depth))}″ deep.`);
    } catch (failure) { console.error(`${entry.id}: ${failure instanceof Error ? failure.message : String(failure)}`); }
  }
  await writeFile(resolve(OUT, 'index.json'), JSON.stringify({ frame: 'arcsec from the Thorstensen et al. (2001) expansion centre: east, north, toward the Sun; 3.4 kpc', models: listed }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) await prepare(ENTRIES);
