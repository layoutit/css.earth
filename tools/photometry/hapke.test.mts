import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { hFunction, particlePhase, shadowHidingFactor, coherentBackscatterFactor, hapkeRadianceFactor, assertHapkeModel, type HapkeModel, type ParticlePhaseFunction, hapkeRoughness } from '@cssearth/bake/photometry';

const close = (a: number, b: number, tolerance: number, message?: string) => assert.ok(Math.abs(a - b) <= tolerance, `${message ?? ''} ${a} vs ${b}`);

test('both H-function approximations equal 1 at grazing and bracket Chandrasekhar at conservative scattering', () => {
  for (const approximation of ['hapke-1981', 'hapke-2002'] as const) for (const w of [0.05, 0.5, 0.95]) close(hFunction(0, w, approximation), 1, 1e-12, `${approximation} H(0)`);
  // Chandrasekhar (1960) tabulates H(1) = 2.9078 for conservative isotropic scattering; 1981 gives 3 exactly, 2002 is within 1%.
  close(hFunction(1, 1, 'hapke-1981'), 3, 1e-12);
  assert.ok(Math.abs(hFunction(1, 1, 'hapke-2002') - 2.9078) / 2.9078 < 0.01, `2002 approximation ${hFunction(1, 1, 'hapke-2002')}`);
  // Darker particles scatter less: H decreases with falling albedo.
  assert.ok(hFunction(0.7, 0.2, 'hapke-2002') < hFunction(0.7, 0.8, 'hapke-2002'));
});

test('particle phase functions are normalized over the sphere and scatter in the declared direction', () => {
  const integrate = (p: ParticlePhaseFunction) => { let sum = 0; const n = 20000; for (let k = 0; k < n; k++) { const g = (k + 0.5) * Math.PI / n; sum += particlePhase(p, g) * Math.sin(g) * Math.PI / n; } return sum / 2; };
  for (const p of [{ form: 'henyey-greenstein', asymmetry: -0.37 }, { form: 'henyey-greenstein', asymmetry: 0.2 }, { form: 'double-henyey-greenstein', b: 0.3, c: 0.6 }, { form: 'legendre', b: -0.4, c: 0.1 }, { form: 'isis-henyey-greenstein', b: 0.213, c: 0.4 }] as ParticlePhaseFunction[])
    close(integrate(p), 1, 1e-4, `${p.form} normalization`);
  assert.ok(particlePhase({ form: 'henyey-greenstein', asymmetry: -0.37 }, 0) > particlePhase({ form: 'henyey-greenstein', asymmetry: -0.37 }, 2), 'negative asymmetry is brighter at zero phase');
  assert.ok(particlePhase({ form: 'double-henyey-greenstein', b: 0.3, c: 0.6 }, 0) > particlePhase({ form: 'double-henyey-greenstein', b: 0.3, c: 0.6 }, 2), 'positive c weights the backward lobe');
});

test('opposition factors peak at zero phase at one plus their amplitude and fade with phase', () => {
  const term = { amplitude: 2.5, width: 0.079 };
  close(shadowHidingFactor(0, term), 3.5, 1e-12); close(coherentBackscatterFactor(0, { amplitude: 0.4, width: 0.02 }), 1.4, 1e-12);
  assert.ok(shadowHidingFactor(0.2, term) < shadowHidingFactor(0.05, term) && shadowHidingFactor(1.5, term) > 1);
  assert.ok(coherentBackscatterFactor(0.2, { amplitude: 0.4, width: 0.02 }) < coherentBackscatterFactor(0.01, { amplitude: 0.4, width: 0.02 }));
  close(coherentBackscatterFactor(1e-13, { amplitude: 0.4, width: 0.02 }), 1.4, 1e-9, 'continuous at zero phase');
  assert.equal(shadowHidingFactor(0.3), 1); assert.equal(coherentBackscatterFactor(0.3), 1);
});

test('the smooth IMSA radiance factor has its closed form at zero phase and obeys reciprocity', () => {
  const model: HapkeModel = { family: 'hapke', singleScatteringAlbedo: 0.3, hFunction: 'hapke-2002', phaseFunction: { form: 'henyey-greenstein', asymmetry: 0 } };
  const h1 = hFunction(1, 0.3, 'hapke-2002');
  close(hapkeRadianceFactor(model, 1, 1, 0), 0.3 / 4 * 0.5 * (1 + h1 * h1 - 1), 1e-15, 'I/F at i = e = g = 0');
  const rough = { ...model, phaseFunction: { form: 'double-henyey-greenstein', b: 0.3, c: 0.5 } as const, shadowHiding: { amplitude: 1.2, width: 0.05 } };
  for (const [mu0, mu, g] of [[0.9, 0.4, 0.7], [0.3, 0.8, 1.1], [0.55, 0.55, 0.2]]) {
    // Bidirectional reflectance r/μ0 is symmetric in incidence and emission for a smooth surface.
    close(hapkeRadianceFactor(rough, mu0, mu, g) / mu0, hapkeRadianceFactor(rough, mu, mu0, g) / mu, 1e-14, 'reciprocity');
  }
  assert.equal(hapkeRadianceFactor(model, 0, 0.5, 0.3), 0, 'no light at grazing incidence');
  assert.throws(() => assertHapkeModel({ ...model, singleScatteringAlbedo: 1.4 }), /single-scattering albedo/);
  assert.throws(() => assertHapkeModel({ ...model, porosity: 0.5 }), /porosity/);
});

test('Hapke 1984 roughness vanishes smoothly, is continuous where incidence meets emission, and limits to χ(θ̄) at normal geometry', () => {
  const rad = Math.PI / 180;
  const nearlySmooth = hapkeRoughness(Math.cos(40 * rad), Math.cos(25 * rad), 50 * rad, 1e-7);
  close(nearlySmooth.mu0e, Math.cos(40 * rad), 1e-6); close(nearlySmooth.mue, Math.cos(25 * rad), 1e-6); close(nearlySmooth.shadowing, 1, 1e-6);
  const theta = 25 * rad, chi = 1 / Math.sqrt(1 + Math.PI * Math.tan(theta) ** 2), normal = hapkeRoughness(1, 1, 0, theta);
  close(normal.mu0e, chi, 1e-12, 'effective incidence cosine at normal geometry'); close(normal.mue, chi, 1e-12); close(normal.shadowing, 1, 1e-12);
  const below = hapkeRoughness(Math.cos(35 * rad), Math.cos(35.0001 * rad), 20 * rad, theta), above = hapkeRoughness(Math.cos(35.0001 * rad), Math.cos(35 * rad), 20 * rad, theta);
  close(below.shadowing, above.shadowing, 1e-5, 'shadowing continuous across the i = e branch');
  close(below.mu0e, above.mue, 1e-5, 'effective cosines swap across the branch');
  assert.ok(hapkeRoughness(Math.cos(75 * rad), Math.cos(10 * rad), 70 * rad, theta).shadowing < 1, 'grazing illumination is shadowed');
  const rough: HapkeModel = { family: 'hapke', singleScatteringAlbedo: 0.3, hFunction: 'hapke-1981', phaseFunction: { form: 'henyey-greenstein', asymmetry: -0.3 }, roughness: theta };
  assert.ok(hapkeRadianceFactor(rough, Math.cos(75 * rad), Math.cos(10 * rad), 70 * rad) < hapkeRadianceFactor({ ...rough, roughness: 0 }, Math.cos(75 * rad), Math.cos(10 * rad), 70 * rad), 'roughness darkens grazing illumination');
});
