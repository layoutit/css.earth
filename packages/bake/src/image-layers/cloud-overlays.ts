/** An image-layer object's datasets drawn over its layers (`properties.overlays`).
 * The default, `optical`: its cloud (source/cloud-points.json: dots in arcsec east,
 * north and depth from the object's centre, each with a diameter, color and opacity) as billboards
 * (@cssearth/objects cloud-points.ts). The dots are grouped into CLUSTERS compact clusters in 3D (k-means, seeded), and
 * each cluster is drawn once into a cell of prepared/cloud-atlas.webp as Earth sees it: its dots as soft Gaussians,
 * composited far to near: prepared/cloud.bin. With source/tube.json, an `outer-shell` dataset: the tube's wall as a wireframe of
 * rings and lines along it (prepared/outer-shell.bin). With source/kinematics.json, a `motions` dataset: each knot an arrow
 * from where it is to where its measured motion takes it in ARROW_YEARS (prepared/motions.bin). Both are
 * cssearth-cloud-segments@1. Run after its layers' bake (prepareImageLayerOverlays), by packages/bake/cli/prepare-image-layers.mts and
 * packages/bake/cli/prepare-cloud-points.mts. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { encodeCloudPoints, encodeCloudSegments, encodePreparedBank, parseObjectDescriptor, readCloudPoints, readCloudSegments, parseDensityVolumeFrame } from '@cssearth/objects';
import { packPreparedBinary } from '@cssearth/objects/node';
import { writeLossyWebp } from '../raster/lossy-lane.ts';
import { basisSpansSpace, rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '@cssearth/engine';

/** Clusters: about 25 dots each, small enough that their dots barely shift against each other as the view turns. */
const CLUSTERS = 300, CELL = 96, ITERATIONS = 40;
/** A dot's alpha at r, a share of its radius: a Gaussian of 0.4 radii, tapered to none at its edge. */
const dotAlpha = (r: number) => r >= 1 ? 0 : Math.exp(-r * r / (2 * .397 * .397)) * Math.min(1, (1 - r) / .15);

/** The source records, checked as they are read: every number finite, every list the shape its use needs. */
const record = (raw: unknown, at: string): Record<string, unknown> => { if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`${at} is an object.`); return raw as Record<string, unknown>; };
const finite = (raw: unknown, at: string): number => { if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new TypeError(`${at} is a finite number, not ${JSON.stringify(raw)}.`); return raw; };
const list = <T,>(raw: unknown, at: string, item: (value: unknown, at: string) => T): T[] => { if (!Array.isArray(raw)) throw new TypeError(`${at} is a list.`); return raw.map((value, i) => item(value, `${at}[${i}]`)); };
const triple = (raw: unknown, at: string): number[] => { const v = list(raw, at, finite); if (v.length !== 3) throw new TypeError(`${at} is three numbers.`); return v; };
export function readCloudSource(raw: unknown, at: string) {
  const r = record(raw, at);
  return {
    points: list(r.points, `${at} points`, (p, where) => { const q = record(p, where);
      if (typeof q.color !== 'string') throw new TypeError(`${where}.color is a #rrggbb.`);
      const diameter = finite(q.diameter, `${where}.diameter`); if (!(diameter > 0)) throw new TypeError(`${where}.diameter is positive.`);
      return { east: finite(q.east, `${where}.east`), north: finite(q.north, `${where}.north`), depth: finite(q.depth, `${where}.depth`), diameter, color: q.color, opacity: finite(q.opacity, `${where}.opacity`) }; }),
    occluder: list(r.occluder, `${at} occluder`, (e, where) => { const q = record(e, where); const axes = list(q.axes, `${where}.axes`, triple);
      if (axes.length !== 3 || !basisSpansSpace(axes)) throw new TypeError(`${where}.axes are three that span space.`);
      return { centre: triple(q.centre, `${where}.centre`), axes }; }),
  };
}
export function readTubeSource(raw: unknown, at: string) {
  const r = record(raw, at), centreline = list(r.centreline, `${at} centreline`, triple), radius = list(r.radius, `${at} radius`, finite);
  if (centreline.length < 2 || radius.length !== centreline.length || radius.some(v => !(v > 0))) throw new TypeError(`${at}: a centreline of two or more samples and a positive radius for each.`);
  return { centreline, radius, traced: list(r.traced, `${at} traced`, triple) };
}
export function readKinematicsSource(raw: unknown, at: string) {
  return { knots: list(record(raw, at).knots, `${at} knots`, (k, where) => { const q = record(k, where);
    return { east: finite(q.east, `${where}.east`), north: finite(q.north, `${where}.north`), depth: finite(q.depth, `${where}.depth`),
      vEast: finite(q.vEast, `${where}.vEast`), vNorth: finite(q.vNorth, `${where}.vNorth`), vLos: finite(q.vLos, `${where}.vLos`) }; }) };
}

export async function prepareCloudOverlays(objectDirectory: string) {
  const dir = resolve(objectDirectory);
  const objectRaw: unknown = JSON.parse(await readFile(resolve(dir, 'object.json'), 'utf8'));
  // checked as a descriptor; its raw record is what is written back, with `overlays` set
  const object = { ...record(objectRaw, 'object.json'), id: parseObjectDescriptor(objectRaw).id, properties: { ...record(record(objectRaw, 'object.json').properties, 'object.json properties') } };
  const frame = parseDensityVolumeFrame(object.properties.frame);
  const source = readCloudSource(JSON.parse(await readFile(resolve(dir, 'source/cloud-points.json'), 'utf8')), 'source/cloud-points.json');
  const [ox, oy, oz] = frame.originM, metres = Math.hypot(ox, oy, oz);
  const ra = Math.atan2(oy, ox), dec = Math.asin(oz / metres), metresPerArcsec = metres * Math.PI / 648000;
  const toward = [ox / metres, oy / metres, oz / metres], east = [-Math.sin(ra), Math.cos(ra), 0];
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const inverse = transposeWorldRotation(worldRotationFromQuaternion(frame.localToReferenceXyzw));
  /** A vector in arcsec (east, north, depth away from Earth) in the frame's units. */
  const units = (e: number, n: number, d: number) => rotateWorldPosition(inverse,
    [0, 1, 2].map(k => (e * east[k]! + n * north[k]! + d * toward[k]!) * metresPerArcsec / frame.metersPerUnit) as [number, number, number]);

  const dots = source.points.map((p, i) => {
    const hex = /^#([0-9a-f]{6})$/iu.exec(p.color); if (!hex) throw new TypeError(`point ${i}: color ${p.color} is not #rrggbb.`);
    return { at: [p.east, p.north, p.depth], radius: p.diameter / 2, rgb: [0, 1, 2].map(c => parseInt(hex[1]!.slice(2 * c, 2 * c + 2), 16) / 255), alpha: Math.max(0, Math.min(1, p.opacity)) };
  });
  // --- clusters: k-means++ from a seeded generator, then Lloyd's steps ------------------------------------------------------
  let seed = 7; const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const d2 = (a: number[], b: number[]) => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
  const centres: number[][] = [dots[Math.floor(random() * dots.length)]!.at], nearest = dots.map(dot => d2(dot.at, centres[0]!));
  while (centres.length < Math.min(CLUSTERS, dots.length)) {
    let pick = random() * nearest.reduce((a, b) => a + b, 0), i = 0; while (i < dots.length - 1 && (pick -= nearest[i]!) > 0) i++;
    centres.push(dots[i]!.at); dots.forEach((dot, k) => { nearest[k] = Math.min(nearest[k]!, d2(dot.at, dots[i]!.at)); });
  }
  const label = new Int32Array(dots.length);
  for (let step = 0; step < ITERATIONS; step++) {
    dots.forEach((dot, k) => { let best = 0, bestD = Infinity; centres.forEach((c, j) => { const d = d2(dot.at, c); if (d < bestD) { bestD = d; best = j; } }); label[k] = best; });
    const sum = centres.map(() => [0, 0, 0, 0]);
    dots.forEach((dot, k) => { const s = sum[label[k]!]!; s[0]! += dot.at[0]!; s[1]! += dot.at[1]!; s[2]! += dot.at[2]!; s[3]!++; });
    sum.forEach((s, j) => { if (s[3]) centres[j] = [s[0]! / s[3], s[1]! / s[3], s[2]! / s[3]]; });
  }
  // --- each cluster drawn into its cell, as seen from Earth --------------------------------------------------------------
  const members = centres.map((_, j) => dots.filter((__, k) => label[k] === j)).filter(list => list.length);
  const across = Math.ceil(Math.sqrt(members.length)), atlas = new Uint8Array(across * CELL * across * CELL * 4);
  const positions = new Float64Array(members.length * 3), diameters = new Float32Array(members.length), cells = new Uint16Array(members.length * 2);
  members.forEach((list, j) => {
    const c = [0, 1, 2].map(k => list.reduce((a, dot) => a + dot.at[k]!, 0) / list.length);
    const half = 1.02 * Math.max(...list.map(dot => Math.max(Math.abs(dot.at[0]! - c[0]!), Math.abs(dot.at[1]! - c[1]!)) + dot.radius));
    const rgba = new Float64Array(CELL * CELL * 4), texel = 2 * half / CELL;
    for (const dot of [...list].sort((a, b) => b.at[2]! - a.at[2]!)) {           // far (larger depth) first, near over it
      const u = (dot.at[0]! - c[0]! + half) / texel, v = (half - (dot.at[1]! - c[1]!)) / texel, r = dot.radius / texel;
      for (let y = Math.max(0, Math.floor(v - r)); y < Math.min(CELL, Math.ceil(v + r)); y++)
        for (let x = Math.max(0, Math.floor(u - r)); x < Math.min(CELL, Math.ceil(u + r)); x++) {
          const a = dotAlpha(Math.hypot(x + .5 - u, y + .5 - v) / r) * dot.alpha; if (!a) continue;
          const o = (y * CELL + x) * 4;                                               // premultiplied "over"
          for (let k = 0; k < 3; k++) rgba[o + k] = rgba[o + k]! * (1 - a) + dot.rgb[k]! * a;
          rgba[o + 3] = rgba[o + 3]! * (1 - a) + a;
        }
    }
    const cx = (j % across) * CELL, cy = Math.floor(j / across) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const i = (y * CELL + x) * 4, a = rgba[i + 3]!, o = ((cy + y) * across * CELL + cx + x) * 4;
      for (let k = 0; k < 3; k++) atlas[o + k] = a > 1e-6 ? Math.round(Math.min(1, rgba[i + k]! / a) * 255) : 0;
      atlas[o + 3] = Math.round(a * 255);
    }
    positions.set(units(c[0]!, c[1]!, c[2]!), j * 3); diameters[j] = 2 * half * metresPerArcsec / frame.metersPerUnit; cells.set([cx, cy], j * 2);
  });
  // a display image: the lossy lane, its alpha kept exact (the billboards' coverage)
  const atlasBytes = await writeLossyWebp(sharp(atlas, { raw: { width: across * CELL, height: across * CELL, channels: 4 } }), resolve(dir, 'prepared/cloud-atlas.webp'), { alphaQuality: 100 });
  const occluder = source.occluder.map(e => ({ centreUnits: units(e.centre[0]!, e.centre[1]!, e.centre[2]!), axesUnits: e.axes.map(a => units(a[0]!, a[1]!, a[2]!)) }));
  // checked as the page will read it before it is written: a bank its reader refuses is never published
  const cloudBank = encodeCloudPoints({ id: 'cloud', frame, count: members.length, positions, diameters, cells, atlas: 'cloud-atlas.webp', cellTexels: CELL, occluder });
  readCloudPoints(cloudBank, `${object.id}: prepared/cloud.bin`);
  const { bytes, regions } = encodePreparedBank(cloudBank, 'cloud points');
  await writeFile(resolve(dir, 'prepared/cloud.bin'), packPreparedBinary(bytes, regions, `${object.id}: cloud points`));
  const overlays: Record<string, string[]> = { optical: ['cloud'] };
  /** Lines as a segments bank: ends in arcsec (east, north, depth), a color and opacity each, arrowheads or none. */
  const writeSegments = async (id: string, lines: { from: number[]; to: number[]; rgba: number[]; head: boolean }[], widthPixels: number, label?: { text: string; at: number[] }) => {
    const from = new Float64Array(lines.length * 3), to = new Float64Array(lines.length * 3), rgba = new Uint8Array(lines.length * 4), heads = new Uint8Array(lines.length);
    lines.forEach((line, i) => { from.set(units(line.from[0]!, line.from[1]!, line.from[2]!), i * 3); to.set(units(line.to[0]!, line.to[1]!, line.to[2]!), i * 3); rgba.set(line.rgba, i * 4); heads[i] = line.head ? 1 : 0; });
    const encoded = encodeCloudSegments({ id, frame, count: lines.length, from, to, rgba, heads, widthPixels, occluder,
      ...(label ? { label: { text: label.text, atUnits: units(label.at[0]!, label.at[1]!, label.at[2]!) } } : {}) });
    readCloudSegments(encoded, `${object.id}: prepared/${id}.bin`);
    const bank = encodePreparedBank(encoded, `${id} lines`);
    await writeFile(resolve(dir, `prepared/${id}.bin`), packPreparedBinary(bank.bytes, bank.regions, `${object.id}: ${id} lines`));
    overlays[id] = [id]; console.log(`${object.id}: ${lines.length} ${id} lines, prepared/${id}.bin`);
  };
  const optional = async <T,>(path: string, read: (raw: unknown, at: string) => T): Promise<T | null> => readFile(resolve(dir, path), 'utf8').then(text => read(JSON.parse(text), path),
    (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  /** The tube's wireframe: RINGS rings around its centreline and ALONG lines along its wall, a ring of SIDES segments. A
   * segment is solid where MUSE traced the wall (a detection the tube is fitted to within TRACED_ARCSEC of its middle) and
   * faint where it did not: Mehner et al. (2016) see only parts of the cylinder, its open parts not at all. */
  const RINGS = 16, ALONG = 12, SIDES = 24, TRACED_ARCSEC = 3, TRACED_RGBA = [150, 205, 255, 190], UNSEEN_RGBA = [150, 205, 255, 45];
  const tube = await optional('source/tube.json', readTubeSource);
  if (tube) {
    const C = tube.centreline, n = C.length;
    const sub = (a: number[], b: number[]) => a.map((v, k) => v - b[k]!), norm = (a: number[]) => { const l = Math.hypot(...a); return a.map(v => v / l); };
    const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
    // the wall at sample i and angle phi: the centreline's tangent there, and two directions across it
    const wall = (i: number, phi: number) => {
      const axis = norm(sub(C[Math.min(n - 1, i + 1)]!, C[Math.max(0, i - 1)]!)), u = norm(cross(axis, [0, 0, 1])), v = cross(axis, u);
      return C[i]!.map((c, k) => c + tube.radius[i]! * (Math.cos(phi) * u[k]! + Math.sin(phi) * v[k]!));
    };
    // the traced detections in cells of TRACED_ARCSEC, so a segment looks only in the cells around its middle
    const cellOf = (p: number[]) => p.map(v => Math.floor(v / TRACED_ARCSEC)).join(), cells = new Map<string, number[][]>();
    for (const p of tube.traced) { const key = cellOf(p); cells.set(key, [...(cells.get(key) ?? []), p]); }
    const traced = (a: number[], b: number[]) => {
      const mid = a.map((v, k) => (v + b[k]!) / 2), c = mid.map(v => Math.floor(v / TRACED_ARCSEC));
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
        for (const p of cells.get([c[0]! + dx, c[1]! + dy, c[2]! + dz].join()) ?? []) if (Math.hypot(p[0]! - mid[0]!, p[1]! - mid[1]!, p[2]! - mid[2]!) <= TRACED_ARCSEC) return true;
      return false;
    };
    const lines: { from: number[]; to: number[]; rgba: number[]; head: boolean }[] = [];
    const add = (from: number[], to: number[]) => lines.push({ from, to, rgba: traced(from, to) ? TRACED_RGBA : UNSEEN_RGBA, head: false });
    for (let k = 0; k < RINGS; k++) { const i = Math.round(k * (n - 1) / (RINGS - 1));
      for (let j = 0; j < SIDES; j++) add(wall(i, 2 * Math.PI * j / SIDES), wall(i, 2 * Math.PI * (j + 1) / SIDES)); }
    const step = Math.max(1, Math.round((n - 1) / (2 * RINGS)));
    for (let j = 0; j < ALONG; j++) { const phi = 2 * Math.PI * j / ALONG;
      for (let i = 0; i + step < n; i += step) add(wall(i, phi), wall(Math.min(n - 1, i + step), phi)); }
    // its caption on the wall's northernmost point, four fifths of the way along it
    const ring = Array.from({ length: SIDES }, (_, j) => wall(Math.round(.8 * (n - 1)), 2 * Math.PI * j / SIDES));
    const top = ring.reduce((best, p) => p[1]! > best[1]! ? p : best);
    console.log(`${object.id}: outer shell ${lines.filter(line => line.rgba === TRACED_RGBA).length} of ${lines.length} segments traced by MUSE`);
    await writeSegments('outer-shell', lines, 1, { text: 'Outer shell (model)', at: top });
  }
  /** Each knot's arrow: its motion over ARROW_YEARS, at the 2.3 kpc its speeds were measured for (1 arcsec a year is
   * 4.74 km/s per parsec); approaching knots blue, receding red. Knots placed beyond MAX_DEPTH arcsec are left out: their
   * line-of-sight speed is too large for their sky motion to be the same material's. */
  const ARROW_YEARS = 100, KNOT_DISTANCE_PC = 2300, MAX_DEPTH = 60;
  const kinematics = await optional('source/kinematics.json', readKinematicsSource);
  if (kinematics) {
    const arcsecPerYear = 1 / (4.74 * KNOT_DISTANCE_PC);
    await writeSegments('motions', kinematics.knots.filter(knot => Math.abs(knot.depth) <= MAX_DEPTH).map(knot => {
      const from = [knot.east, knot.north, knot.depth], v = [knot.vEast, knot.vNorth, knot.vLos];
      return { from, to: from.map((p, k) => p + v[k]! * arcsecPerYear * ARROW_YEARS), rgba: knot.vLos < 0 ? [110, 170, 255, 210] : [255, 110, 90, 210], head: true };
    }), 1.25);
  }
  delete object.properties.cloudPoints;
  object.properties.overlays = overlays;
  await writeFile(resolve(dir, 'object.json'), `${JSON.stringify(object, null, 2)}\n`);
  const sizes = [...diameters].map(d => d * frame.metersPerUnit / metresPerArcsec).sort((a, b) => a - b);
  console.log(`${object.id}: ${dots.length} dots as ${members.length} billboards (median ${sizes[sizes.length >> 1]!.toFixed(1)} arcsec), ${occluder.length} occluding ellipsoids, prepared/cloud.bin and cloud-atlas.webp (${atlasBytes.length} bytes)`);
}

/** What its datasets draw over the layers (prepareCloudOverlays), placed in the frame the bake just wrote. Only the
 * probe for its source may find nothing; a bank whose descriptor names overlay banks (`overlays`) needs that source. */
export async function prepareImageLayerOverlays(root:string,overlays:unknown,id:string){
  const cloudSource=await readFile(resolve(root,'source','cloud-points.json')).then(()=>true,(error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return false;throw error;});
  const declared=overlays!==null&&typeof overlays==='object'&&Object.values(overlays).some(banks=>Array.isArray(banks)&&banks.length>0);
  if(cloudSource)await prepareCloudOverlays(root);
  else if(declared)throw new TypeError(`${id}: object.json names overlay banks but source/cloud-points.json is missing.`);
}
