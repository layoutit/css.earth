// Entry script: node packages/bake/authoring/homunculus-nebula/outer-ejecta.mts [--downloads=<directory>] [--work=<directory>] [--stages=<a,b,...>] [--fetch] [--write-source]
/**
 * The Homunculus's outer ejecta from the archive: Hubble F658N motions, MUSE H-beta speeds, the bent tube they lie on and
 * the dots that draw them. Stage by stage (./outer-ejecta/*.mts):
 *
 *   epochs  - the eleven F658N epochs on the common grid            -> hst-grid/<epoch>.npy
 *   masks   - each epoch's artefacts                                -> hst-masks/<epoch>.npy
 *   motions - each tile's motion across the sky                     -> fit.npy
 *   heic    - heic1912a's registration on the sky                   -> heic-registration.npy
 *   hbeta   - the cube's continuum-subtracted H-beta channels       -> hbeta/E.npy, v.npy, header.json
 *   points  - MUSE emission points                                  -> points-clean.npy
 *   knots   - the knots in 3D                                       -> knots3d.npy
 *   tube    - Mehner et al. (2016)'s bent tube fitted to the points -> tube.npy
 *   cloud   - the gas and dust dots and the lobes' occluder         -> clump-points.json, cloud-points.json
 *   records - the kinematics and tube source records                -> kinematics.json, tube.json
 *
 * Inputs (declared in src/objects/homunculus-nebula-layers/source/manifest.json; not tracked) under `--downloads`
 * (default: the body's `.local/`): `hst-epochs/` (MAST products), `muse/ADP.2016-06-20T21:41:31.322.fits` (ESO),
 * `candidates/raw/heic1912a.tif` (ESA/Hubble); and from the body's `source/`: recipe.json, homunculus.stl, source.jpg.
 * `--fetch` downloads the missing ones first (./outer-ejecta/inputs.mts lists each URL and size). Every stage writes to `--work` (default output/homunculus-outer-ejecta) and reads its inputs there, so a run can start
 * at any stage. `--write-source` also writes the three records into the body's `source/`.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cloudDots, cloudPointsRecord, lobeOccluder, readSurface } from './outer-ejecta/cloud-points.mts';
import { readPicture, registerHeic } from './outer-ejecta/heic-registration.mts';
import { EPOCHS, hubbleEpochs, WFPC2_VISITS } from './outer-ejecta/hubble-epochs.mts';
import { hubbleMasks } from './outer-ejecta/hubble-masks.mts';
import { hubbleMotions } from './outer-ejecta/hubble-motions.mts';
import { knots3d } from './outer-ejecta/knots.mts';
import { emissionPoints, hbetaCube, type HbetaCube } from './outer-ejecta/muse-hbeta.mts';
import { readNpyFile, writeNpyFile, type NpyArray } from './outer-ejecta/python-ports/npy.mts';
import { pythonJson, type PyJson } from './outer-ejecta/python-ports/python-json.mts';
import { fetchDownloads, missingDownloads } from './outer-ejecta/inputs.mts';
import { kinematicsRecord, tubeRecord } from './outer-ejecta/records.mts';
import { SIDE } from './outer-ejecta/sky-grid.mts';
import { fitTube, tubePoints } from './outer-ejecta/tube.mts';

export const STAGES = ['epochs', 'masks', 'motions', 'heic', 'hbeta', 'points', 'knots', 'tube', 'cloud', 'records'] as const;
type Stage = typeof STAGES[number];
/** The generator named in the records this command writes. */
export const GENERATOR = 'packages/bake/authoring/homunculus-nebula/outer-ejecta.mts';
/** The MUSE cube and the WFPC2 visit the dots' brightness reads beyond heic1912a. */
export const MUSE_CUBE = 'muse/ADP.2016-06-20T21:41:31.322.fits', HEIC = 'candidates/raw/heic1912a.tif', WFPC2_2003 = `hst-epochs/${WFPC2_VISITS['2003.60']}_drz.fits`;

const root = checkoutProjectRoot(import.meta.url), body = resolve(root, 'src/objects/homunculus-nebula-layers'), flags = process.argv.slice(2);
const flag = (name: string) => flags.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
for (const item of flags) if (!/^--(downloads|work|stages)=.+$|^--(write-source|fetch)$/u.test(item)) throw new TypeError(`Unknown argument ${item}. Usage: outer-ejecta.mts [--downloads=<directory>] [--work=<directory>] [--stages=${STAGES.join(',')}] [--fetch] [--write-source]`);
const downloads = resolve(flag('downloads') ?? resolve(body, '.local')), work = resolve(flag('work') ?? resolve(root, 'output/homunculus-outer-ejecta')), writeSource = flags.includes('--write-source');
const stages = (flag('stages')?.split(',') ?? [...STAGES]) as Stage[];
for (const stage of stages) if (!(STAGES as readonly string[]).includes(stage)) throw new TypeError(`Unknown stage ${stage}; the stages are ${STAGES.join(', ')}.`);

const at = (...parts: string[]) => resolve(work, ...parts);
const rowsOf = (array: NpyArray) => { if (array.dtype !== '<f8' || array.shape.length !== 2) throw new TypeError(`Expected a float64 table, got ${array.dtype} ${array.shape.join('x')}.`); const [n, m] = array.shape as [number, number]; return Array.from({ length: n }, (_, i) => array.data.subarray(i * m, (i + 1) * m)); };
const table = (rows: readonly ArrayLike<number>[], columns: number): NpyArray => ({ dtype: '<f8', shape: [rows.length, columns], data: Float64Array.from(rows.flatMap(row => Array.from(row))) });
async function readGrid(directory: string, kind: 'f4' | 'b1') {
  const out = new Map<string, Float32Array & Uint8Array>();
  for (const epoch of EPOCHS) { const array = await readNpyFile(at(directory, `${epoch}.npy`)); if (array.dtype !== (kind === 'f4' ? '<f4' : '|b1') || array.shape.join() !== `${SIDE},${SIDE}`) throw new TypeError(`${directory}/${epoch}.npy is not a ${SIDE}-square ${kind} grid.`); out.set(epoch, array.data as Float32Array & Uint8Array); }
  return out;
}
async function readHbeta(): Promise<HbetaCube> {
  const E = await readNpyFile(at('hbeta', 'E.npy')), v = await readNpyFile(at('hbeta', 'v.npy')), header = JSON.parse(await readFile(at('hbeta', 'header.json'), 'utf8')) as unknown;
  if (E.dtype !== '<f4' || E.shape.length !== 3 || v.dtype !== '<f4' || v.shape[0] !== E.shape[0] || typeof header !== 'object' || header === null) throw new TypeError('hbeta/ holds no float32 cube, velocities and header.');
  const [channels, height, width] = E.shape as [number, number, number];
  return { E: E.data, v: v.data, channels, height, width, header: header as HbetaCube['header'] };
}
const writeJson = async (name: string, value: PyJson, toSource: boolean) => { const text = pythonJson(value); await writeFile(at(name), text); if (toSource) { await writeFile(resolve(body, 'source', name), text); console.log(`wrote source/${name}`); } };

if (flags.includes('--fetch')) await fetchDownloads(downloads);
const needsDownloads = stages.some(stage => ['epochs', 'heic', 'hbeta', 'cloud'].includes(stage)), missing = needsDownloads ? await missingDownloads(downloads) : [];
if (missing.length) throw new Error(`Missing under ${downloads}: ${missing.map(item => item.path).join(', ')}. Run with --fetch, or point --downloads at a directory that holds them.`);
await mkdir(at('hst-grid'), { recursive: true }); await mkdir(at('hst-masks'), { recursive: true }); await mkdir(at('hbeta'), { recursive: true });
const run: Record<Stage, () => Promise<void>> = {
  async epochs() { for (const [epoch, image] of await hubbleEpochs(resolve(downloads, 'hst-epochs'))) await writeNpyFile(at('hst-grid', `${epoch}.npy`), { dtype: '<f4', shape: [SIDE, SIDE], data: image }); },
  async masks() { for (const [epoch, mask] of hubbleMasks(await readGrid('hst-grid', 'f4'))) await writeNpyFile(at('hst-masks', `${epoch}.npy`), { dtype: '|b1', shape: [SIDE, SIDE], data: mask }); },
  async motions() { await writeNpyFile(at('fit.npy'), table(hubbleMotions(await readGrid('hst-grid', 'f4'), await readGrid('hst-masks', 'b1')), 8)); },
  async heic() {
    const epoch = await readNpyFile(at('hst-grid', '2014.59.npy')); if (epoch.dtype !== '<f4') throw new TypeError('hst-grid/2014.59.npy is not float32.');
    await writeNpyFile(at('heic-registration.npy'), { dtype: '<f8', shape: [3], data: Float64Array.from(registerHeic(await readPicture(resolve(downloads, HEIC)), epoch.data).x) });
  },
  async hbeta() {
    const cube = await hbetaCube(resolve(downloads, MUSE_CUBE));
    await writeNpyFile(at('hbeta', 'E.npy'), { dtype: '<f4', shape: [cube.channels, cube.height, cube.width], data: cube.E }); await writeNpyFile(at('hbeta', 'v.npy'), { dtype: '<f4', shape: [cube.channels], data: cube.v });
    await writeFile(at('hbeta', 'header.json'), JSON.stringify(cube.header));
  },
  async points() { const points = emissionPoints(await readHbeta()); await writeNpyFile(at('points-clean.npy'), { dtype: '<f4', shape: [points.length / 5, 5], data: points }); },
  async knots() { await writeNpyFile(at('knots3d.npy'), table(knots3d(rowsOf(await readNpyFile(at('fit.npy'))), await readHbeta()), 7)); },
  async tube() {
    const points = await readNpyFile(at('points-clean.npy')); if (points.dtype !== '<f4') throw new TypeError('points-clean.npy is not float32.');
    const { X, W, count } = tubePoints(points.data, rowsOf(await readNpyFile(at('fit.npy'))));
    console.log(`${count.all} points; ${count.fast} fast; ${count.kept} after dropping old knots`);
    const { q, cost, within3 } = fitTube(X, W), rad = Math.PI / 180;
    console.log(`PA ${(q[0]! / rad).toFixed(1)} tilt ${(q[1]! / rad).toFixed(1)} bend ${q[2]!.toFixed(2)} dir ${(q[3]! / rad).toFixed(0)} centre (${[q[4]!, q[5]!, q[6]!].map(v => v.toFixed(1)).join(', ')}) R near ${q[7]!.toFixed(1)} far ${q[8]!.toFixed(1)} arcsec; cost ${cost.toFixed(3)}; within 3 arcsec of the wall ${within3.toFixed(2)}`);
    await writeNpyFile(at('tube.npy'), { dtype: '<f8', shape: [9], data: Float64Array.from(q) });
  },
  async cloud() {
    const knots = rowsOf(await readNpyFile(at('knots3d.npy'))), registration = await readNpyFile(at('heic-registration.npy')), surface = await readSurface(resolve(body, 'source'));
    if (registration.dtype !== '<f8' || registration.data.length !== 3) throw new TypeError('heic-registration.npy holds no three numbers.');
    const dots = await cloudDots({ knots, heic: await readPicture(resolve(downloads, HEIC)), heicRegistration: Array.from(registration.data) as [number, number, number], wfpc2Path: resolve(downloads, WFPC2_2003),
      photo: await readPicture(resolve(body, 'source', 'source.jpg')), ...surface });
    await writeFile(at('clump-points.json'), pythonJson({ points: dots as unknown as PyJson }));
    await writeJson('cloud-points.json', cloudPointsRecord(dots, lobeOccluder(surface.triangles, surface.placement), GENERATOR), writeSource);
  },
  async records() {
    const fit = rowsOf(await readNpyFile(at('fit.npy'))), tube = await readNpyFile(at('tube.npy')), points = await readNpyFile(at('points-clean.npy'));
    if (points.dtype !== '<f4') throw new TypeError('points-clean.npy is not float32.');
    await writeJson('kinematics.json', kinematicsRecord(fit, rowsOf(await readNpyFile(at('knots3d.npy'))), GENERATOR), writeSource);
    await writeJson('tube.json', tubeRecord(tube.data as Float64Array, tubePoints(points.data, fit).X, GENERATOR), writeSource);
  },
};
for (const stage of STAGES) if (stages.includes(stage)) { const start = Date.now(); console.log(`== ${stage}`); await run[stage](); console.log(`   ${((Date.now() - start) / 1000).toFixed(1)} s`); }
