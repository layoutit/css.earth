// Node-only preparation input. These are geometric states at one instant,
// not a replacement for the package's general-time compact orbit models.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { parseSceneManifest } from './lib/ephemeris-records.mts';
export const SCENE_EPHEMERIS_DIRECTORY = new URL('../source/scene-epoch/', import.meta.url);
const REQUIRED: Readonly<Record<string, readonly [number, number, string]>> = Object.freeze({
  mercury: [199, 10, 'sun'], venus: [299, 10, 'sun'], earth: [399, 10, 'sun'], mars: [499, 10, 'sun'],
  jupiter: [599, 10, 'sun'], saturn: [699, 10, 'sun'], uranus: [799, 10, 'sun'], neptune: [899, 10, 'sun'], pluto: [999, 10, 'sun'],
  moon: [301, 399, 'earth'], io: [501, 599, 'jupiter'], titan: [606, 699, 'saturn'], charon: [901, 999, 'pluto'],
  phobos: [401, 499, 'mars'], mimas: [601, 699, 'saturn'], janus: [610, 699, 'saturn'],
  epimetheus: [611, 699, 'saturn'], helene: [612, 699, 'saturn'], triton: [801, 899, 'neptune'] });

/** Reject wrong-center, stale, unbound or incomplete data; never extrapolate a snapshot. */
export async function loadSceneEpochEphemeris(epochJdTt: number, directory = SCENE_EPHEMERIS_DIRECTORY) {
  const manifest = parseSceneManifest(JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8')));
  if (manifest.schema !== 'cssearth-scene-epoch-ephemeris@1' || manifest.epochJdTt !== epochJdTt ||
      manifest.referenceFrame !== 'ICRF' || manifest.units !== 'KM-D' || manifest.correction !== 'NONE' ||
      manifest.ttMinusUtcSeconds !== 69.184 ||
      Math.abs((manifest.requestEpochJdUtc + manifest.ttMinusUtcSeconds / 86400) - epochJdTt) > 1e-9) {
    throw new TypeError('Scene ephemeris epoch, time scale or reference convention differs; reacquire the snapshot.');
  }
  type SceneState = { positionKm: readonly number[]; velocityKmPerDay: readonly number[]; centerBodyId: string; provenance: { model: string; epochJdTt: number; referenceFrame: string; target: number; center: number; source: string; sourcePath: string; timeQualification: string } };
  const states = new Map<string, SceneState>();
  for (const record of manifest.records) {
    const expected = REQUIRED[record.id];
    if (!expected || states.has(record.id) || record.target !== expected[0] || record.center !== expected[1] || record.centerBodyId !== expected[2] ||
        record.path !== `${record.id}.txt`) throw new TypeError('Scene ephemeris target/center identity differs.');
    const url = new URL(record.url);
    const query = url.searchParams;
    const fields = { COMMAND: String(record.target), CENTER: `500@${record.center}`, EPHEM_TYPE: 'VECTORS',
      TIME_TYPE: 'UT', REF_PLANE: 'FRAME', REF_SYSTEM: 'ICRF', OUT_UNITS: 'KM-D', VEC_CORR: 'NONE',
      VEC_TABLE: '2', CSV_FORMAT: 'YES', TLIST_TYPE: 'JD' };
    if (url.origin !== 'https://ssd.jpl.nasa.gov' || url.pathname !== '/api/horizons.api' ||
        Object.entries(fields).some(([key, value]) => query.get(key) !== value) ||
        Math.abs(Number(query.get('TLIST')) - manifest.requestEpochJdUtc) > 1e-9) {
      throw new TypeError(`Scene ephemeris query differs: ${record.id}.`);
    }
    const bytes = await readFile(new URL(record.path, directory));
    const text = bytes.toString('utf8');
    const target = text.match(/^Target body name:.*?\((\d+)\)/m)?.[1];
    const center = text.match(/^Center body name:.*?\((\d+)\)/m)?.[1];
    if (Number(target) !== record.target || Number(center) !== record.center ||
        !/^Center-site name:\s+BODY CENTER\s*$/m.test(text) ||
        !/^Output units\s+: KM-D\s*$/m.test(text) ||
        !/^Output type\s+: GEOMETRIC cartesian states\s*$/m.test(text) ||
        !/^Reference frame\s+: ICRF\s*$/m.test(text) || !/Calendar Date \(UT\s*\)/.test(text)) {
      throw new TypeError(`Scene ephemeris response convention differs: ${record.id}.`);
    }
    const lines = text.split('$$SOE')[1]?.split('$$EOE')[0]?.trim().split('\n');
    if (lines?.length !== 1) throw new TypeError(`Scene ephemeris needs exactly one state: ${record.id}.`);
    const fieldsCsv = lines[0].split(',').map(field => field.trim());
    const values = fieldsCsv.slice(2, 8).map(Number);
    if (Math.abs(Number(fieldsCsv[0]) - manifest.requestEpochJdUtc) > 1e-9 ||
        values.length !== 6 || values.some(value => !Number.isFinite(value))) {
      throw new TypeError(`Scene ephemeris state epoch/components differ: ${record.id}.`);
    }
    states.set(record.id, Object.freeze({ positionKm: Object.freeze(values.slice(0, 3)),
      velocityKmPerDay: Object.freeze(values.slice(3, 6)), centerBodyId: record.centerBodyId,
      provenance: Object.freeze({ model: 'Horizons geometric state at prepared epoch', epochJdTt,
        referenceFrame: 'ICRF', target: record.target, center: record.center, source: record.url,
        sourcePath: `packages/astronomy/source/scene-epoch/${record.path}`,
        timeQualification: manifest.timeQualification }) }));
  }
  if (states.size !== Object.keys(REQUIRED).length) throw new TypeError('Scene ephemeris is missing a required body.');
  return states;
}
