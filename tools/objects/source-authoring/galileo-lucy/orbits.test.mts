import { fixtureRecord } from '../../../contract/test-values.mts';
import { requireString } from '../../../sources/source-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadBodyEpochEphemeris, evaluatePublishedOrbit } from '../../../../packages/astronomy/tools/body-epoch-ephemeris.mts';

for (const [id, parent, a, periodHours, eccentricity] of [['dactyl', 'ida', 82.3, .96534 * 24, .15], ['selam', 'dinkinesh', 3.11, 52.67, 0]] as const) {
  test(`${id}: declared approximate state preserves period, separation, orbital pole and phase qualification`, async () => {
    const bodyRoot = resolve('src/objects', id), epochJdTt = 2461286.5;
    const parameters = JSON.parse(await readFile(resolve(bodyRoot, 'source/orbit/published-parameters.json'), 'utf8'));
    const state = await loadBodyEpochEphemeris({ bodyRoot, bodyId: id, centerBodyId: parent, target:null,center:null,epochJdTt });
    assert.equal(fixtureRecord(state.provenance).placement, 'approximate');
    assert.match(requireString(fixtureRecord(state.provenance).timeQualification), /not a propagation/);
    const r = state.positionKm, v = state.velocityKmPerDay;
    assert(Math.abs(Math.hypot(...r) - a * (1 - eccentricity)) < 1e-10);
    // Independent periapsis speed from n*a*sqrt((1+e)/(1-e)).
    assert(Math.abs(Math.hypot(...v) - 2 * Math.PI / (periodHours / 24) * a * Math.sqrt((1 + eccentricity) / (1 - eccentricity))) < 1e-10);
    assert(Math.abs(r.reduce((sum, n, i) => sum + n * v[i], 0)) < 1e-8);
    const normal = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
    const rotation = JSON.parse(await readFile(resolve(bodyRoot, 'source/preparation/rotation.json'), 'utf8'));
    const ra = rotation.rightAscensionDegrees * Math.PI / 180, dec = rotation.declinationDegrees * Math.PI / 180;
    const pole = [Math.cos(ra) * Math.cos(dec), Math.sin(ra) * Math.cos(dec), Math.sin(dec)];
    for (let i = 0; i < 3; i++) assert(Math.abs(normal[i] / Math.hypot(...normal) - pole[i]) < 1e-12);
    const returned = evaluatePublishedOrbit(parameters, epochJdTt + periodHours / 24);
    assert(Math.hypot(...returned.positionKm.map((n, i) => n - r[i])) < 1e-6);
    await assert.rejects(Reflect.apply(loadBodyEpochEphemeris, undefined, [{ bodyRoot, bodyId: id, centerBodyId: parent, target:null,center:null,epochJdTt: epochJdTt + 1 }]), /epoch/);
  });
}
